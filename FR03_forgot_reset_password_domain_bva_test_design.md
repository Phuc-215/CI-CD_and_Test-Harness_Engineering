# FR-03 Forgot/Reset Password - Domain Testing & BVA Test Design

## 1. Objective and Scope

Thiết kế bộ kiểm thử cho FR-03 "Quên mật khẩu & Đặt lại mật khẩu (2 bước)" bằng Domain Testing, Boundary Value Analysis, Decision Table và State Transition.

Phạm vi kiểm thử:

- API `POST /api/forgot-password`.
- API `POST /api/reset-password`.
- UI web `frontend-web/src/pages/ForgotPassword.jsx`.
- UI mobile `frontend-mobile/App.js` màn hình `forgotPassword`.
- Các yêu cầu mật khẩu mới kế thừa từ FR-01.

Nguồn yêu cầu:

- FR-03: người dùng nhập email đã đăng ký, hệ thống sinh OTP 6 chữ số, demo hiển thị OTP trực tiếp, UI có Step Indicator, có nút quay lại đăng nhập.
- FR-03 bước 2: người dùng nhập OTP, mật khẩu mới, xác nhận mật khẩu mới; mật khẩu mới tuân thủ FR-01; hai mật khẩu phải khớp; OTP chỉ hợp lệ cho email đã yêu cầu.
- FR-01 password rule: tối thiểu 8 ký tự, ít nhất 1 chữ hoa, 1 chữ thường, 1 chữ số, 1 ký tự đặc biệt trong tập `@`, `$`, `!`, `%`, `*`, `?`, `&`.
- SEC-07 tham khảo: OTP đủ entropy tối thiểu 6 chữ số, có thời hạn và vô hiệu hóa sau khi dùng.

## 2. Current Codebase Deviations to Capture

Các điểm khác yêu cầu tìm thấy khi phân tích codebase hiện tại:

| Area | File | Current behavior | Requirement impact |
| --- | --- | --- | --- |
| OTP length | `backend/server.js` | Sinh OTP bằng `Math.floor(1000 + Math.random() * 9000)`, tức 4 chữ số. | Sai FR-03/SEC-07: yêu cầu 6 chữ số. |
| OTP label | `frontend-web/src/pages/ForgotPassword.jsx`, `frontend-mobile/App.js` | Label hiển thị "Mã OTP (4 số)". | Sai FR-03: yêu cầu OTP 6 chữ số. |
| Mobile demo OTP display | `frontend-mobile/App.js` | Sau khi lấy OTP chỉ hiện thông báo generic, không hiển thị OTP. | Sai yêu cầu demo: OTP phải hiển thị trực tiếp trên màn hình. |
| Confirm password | Web/mobile/API | Không có trường `confirmNewPassword`; backend cũng không nhận hoặc kiểm tra confirm. | Sai FR-03: hai trường mật khẩu phải khớp. |
| Backend password policy | `backend/server.js` | `reset-password` cập nhật trực tiếp `newPassword`, không validate mạnh/yếu. | Sai FR-03 kế thừa FR-01. |
| Web password regex | `frontend-web/src/pages/ForgotPassword.jsx` | Regex yêu cầu whitespace `\s` và chỉ cho chữ/số/khoảng trắng. | Sai FR-01: ký tự đặc biệt phải thuộc `@ $ ! % * ? &`; password hợp lệ như `Newpass1!` bị UI web từ chối. |
| Mobile password regex | `frontend-mobile/App.js` | Cho bất kỳ ký tự không phải chữ/số. | Lỏng hơn FR-01 vì không giới hạn tập ký tự đặc biệt. |
| Step indicator | Web/mobile | Không hiển thị "Bước 1 / 2" hoặc indicator tương đương. | Sai FR-03. |
| Back to login | Web/mobile | Không có nút rõ ràng "Quay lại đăng nhập"; step 2 chỉ quay về step 1. | Sai FR-03. |
| Email input type | Web | Input email ở forgot dùng `type="text"`. | Lệch yêu cầu form chung/email validation; nên có test UI. |
| OTP expiry | Backend DB/API | Chỉ lưu `reset_token`, không có thời hạn. | Lệch SEC-07 nếu áp dụng security requirements. |
| Testability | `backend/server.js` | Server gọi `app.listen` trực tiếp, không export `app`. | Cần refactor nhỏ hoặc test qua server đang chạy. |

## 3. Variables and Constraints

| Variable | Source | Valid domain | Invalid / boundary classes |
| --- | --- | --- | --- |
| `email` | Step 1 UI/API | Email đã đăng ký, định dạng email hợp lệ. Nominal: `test@eshop.com`. | Missing, empty, malformed, unregistered, registered different user. |
| OTP generation | Step 1 API response | Chuỗi đúng 6 chữ số, range conceptual `000000`-`999999`, hiển thị trong demo. | 4/5/7 digits, non-digit, missing response value. |
| Workflow step | UI | Step 1 before request; Step 2 only after successful OTP request; visible Step Indicator. | Step 2 accessible without Step 1, no indicator, no back to login. |
| `resetToken` | Step 2 UI/API | OTP issued for the same email, 6 digits. | Missing, empty, 5 digits, 7 digits, non-digit, wrong OTP, OTP from another email, reused OTP. |
| `newPassword` | Step 2 UI/API | Length >= 8; contains uppercase, lowercase, digit, and one allowed special char from `@ $ ! % * ? &`. | Length 7, missing uppercase, missing lowercase, missing digit, missing allowed special, disallowed special, empty/missing. |
| `confirmNewPassword` | Step 2 UI/API | Exactly matches `newPassword`. | Missing, empty, mismatch, case-only mismatch. |
| Reset persistence | API/DB observable via login | After successful reset, old password rejected and new password accepted. OTP invalidated after use. | Password unchanged, old password still accepted, OTP reusable. |

## 4. Equivalence Classes and Boundaries

### Email

- E1 valid registered email: `test@eshop.com`.
- E2 valid format but unregistered: `notfound@example.com`.
- E3 malformed email: `test@`.
- E4 empty email: `""`.
- E5 missing `email` property.
- E6 registered email different from OTP owner: `admin@eshop.com`.

### OTP

- O1 valid issued OTP for same email: 6 numeric digits.
- O2 just below expected length: 5 digits.
- O3 just above expected length: 7 digits.
- O4 empty OTP.
- O5 missing OTP.
- O6 non-numeric same length: `ABC123`.
- O7 wrong numeric OTP: `000000`.
- O8 valid OTP but paired with another email.
- O9 already-used OTP.
- O10 expired OTP, if SEC-07 is implemented.

### Password

Nominal valid: `Newpass1!`

- P1 length boundary valid: 8 chars, e.g. `Aa1!bbbb`.
- P2 just below minimum: 7 chars, e.g. `Aa1!bbb`.
- P3 missing uppercase: `newpass1!`.
- P4 missing lowercase: `NEWPASS1!`.
- P5 missing digit: `Newpass!`.
- P6 missing special: `Newpass1`.
- P7 allowed special set coverage: `@`, `$`, `!`, `%`, `*`, `?`, `&`.
- P8 disallowed special: `Newpass1#`.
- P9 empty/missing password.

### Confirm Password

- C1 exact match.
- C2 mismatch: `Newpass1!` vs `Newpass2!`.
- C3 case mismatch: `Newpass1!` vs `newpass1!`.
- C4 missing confirm value.

## 5. Decision Table

| Row | Email exists | OTP issued | OTP matches same email | Password strong | Confirm matches | Expected |
| --- | --- | --- | --- | --- | --- | --- |
| D1 | Yes | Yes | Yes | Yes | Yes | Reset succeeds; token invalidated; user can login with new password. |
| D2 | No | No | N/A | N/A | N/A | Step 1 rejected; no OTP generated. |
| D3 | Yes | No | No | Yes | Yes | Step 2 rejected. |
| D4 | Yes | Yes | No, wrong OTP | Yes | Yes | Step 2 rejected; password unchanged. |
| D5 | Yes | Yes | No, OTP belongs to other email | Yes | Yes | Step 2 rejected; password unchanged. |
| D6 | Yes | Yes | Yes | No | Yes | Step 2 rejected; password unchanged. |
| D7 | Yes | Yes | Yes | Yes | No | Step 2 rejected; password unchanged. |
| D8 | Yes | Yes | Already used | Yes | Yes | Step 2 rejected; OTP one-time use. |
| D9 | Yes | Yes | Expired | Yes | Yes | Step 2 rejected, if SEC-07 is in scope. |

## 6. State Transition Model

| State | Action | Expected next state |
| --- | --- | --- |
| S0 Login page | User opens forgot password | S1 Forgot Step 1 |
| S1 Step 1 | Submit registered email | S2 Step 2 with OTP displayed in demo |
| S1 Step 1 | Submit invalid/unregistered email | S1 with validation/error |
| S1 Step 1 | Click "Quay lại đăng nhập" | Login page |
| S2 Step 2 | Submit valid OTP + strong matching passwords | Login page or success state |
| S2 Step 2 | Submit invalid OTP/password/confirm | S2 with validation/error |
| S2 Step 2 | Click "Quay lại đăng nhập" | Login page |
| S2 Step 2 | Reuse already successful OTP | S2 with invalid OTP error |

## 7. Minimal Test Case Set

| ID | Requirement Trace | Technique | Condition / Input | Class or Boundary | Expected Outcome |
| --- | --- | --- | --- | --- | --- |
| FR03-001 | "Người dùng nhập địa chỉ Email đã đăng ký" | Happy Path | `POST /api/forgot-password` with `email=test@eshop.com` | E1 | `200 OK`; response contains `resetToken`; token is exactly 6 digits per spec. Current code is expected to fail this by returning 4 digits. |
| FR03-002 | "Email đã đăng ký" | Equivalence Partitioning | `email=notfound@example.com` | E2 | Request rejected; no OTP generated. Current backend returns `404`. |
| FR03-003 | Email format | Negative | `email=test@` | E3 | Request rejected with validation error; should not query/reset. Current backend likely returns `404` rather than format validation. |
| FR03-004 | Required email | Negative | Missing `email` field | E5 | Request rejected with validation error. |
| FR03-005 | OTP 6 chữ số | Weak BVA | Generated OTP length = 6 | O1 | Accepted as valid generated format; UI displays same 6-digit OTP in demo. |
| FR03-006 | OTP 6 chữ số | Robust BVA | Generated/displayed OTP length = 5 or less | O2 | Test fails if accepted/generated; system must never generate/display short OTP. Current code generates 4 digits. |
| FR03-007 | OTP 6 chữ số | Robust BVA | Submit `resetToken=12345` | O2 | Reset rejected; password unchanged. |
| FR03-008 | OTP 6 chữ số | Robust BVA | Submit `resetToken=1234567` | O3 | Reset rejected; password unchanged. |
| FR03-009 | OTP numeric | Negative | Submit `resetToken=ABC123` | O6 | Reset rejected; password unchanged. |
| FR03-010 | "OTP chỉ hợp lệ cho email đã yêu cầu" | Decision Table | Generate OTP for `test@eshop.com`, reset with `email=admin@eshop.com` and that OTP | O8 | Reset rejected; admin password unchanged. |
| FR03-011 | Correct OTP | Happy Path | Generate OTP for `test@eshop.com`; reset with same email/token and `newPassword=Newpass1!`, `confirmNewPassword=Newpass1!` | D1/P1/C1 | `200 OK`; old password rejected; new password accepted; OTP cleared. Backend currently ignores confirm and accepts password if token matches. |
| FR03-012 | Wrong OTP | Decision Table | Same email with `resetToken=000000`, strong matching passwords | O7 | `400` or validation error; password unchanged. |
| FR03-013 | OTP one-time use | State Transition | Use same issued OTP twice with two password changes | O9 | First reset succeeds; second reset rejected. |
| FR03-014 | Password min length | Weak BVA | `newPassword=Aa1!bbbb` length 8, confirm same | P1 | Accepted when OTP valid. |
| FR03-015 | Password min length | Robust BVA | `newPassword=Aa1!bbb` length 7, confirm same | P2 | Rejected; password unchanged. Current backend likely accepts via direct API. |
| FR03-016 | Password uppercase rule | Equivalence Partitioning | `newPassword=newpass1!` | P3 | Rejected; password unchanged. |
| FR03-017 | Password lowercase rule | Equivalence Partitioning | `newPassword=NEWPASS1!` | P4 | Rejected; password unchanged. |
| FR03-018 | Password digit rule | Equivalence Partitioning | `newPassword=Newpass!` | P5 | Rejected; password unchanged. |
| FR03-019 | Password special rule | Equivalence Partitioning | `newPassword=Newpass1` | P6 | Rejected; password unchanged. |
| FR03-020 | Allowed special chars | Equivalence Partitioning | Repeat valid reset setup with representative passwords containing `@`, `$`, `!`, `%`, `*`, `?`, `&` | P7 | Each allowed special character is accepted when other password rules are met. |
| FR03-021 | Allowed special chars only | Negative | `newPassword=Newpass1#` | P8 | Rejected because `#` is outside allowed FR-01 set. Mobile UI may accept; backend likely accepts. |
| FR03-022 | Confirm password required | Negative | Valid OTP + `newPassword=Newpass1!`, missing confirm | C4 | Rejected; password unchanged. Current API has no confirm field and likely accepts. |
| FR03-023 | Confirm password match | Decision Table | Valid OTP + `newPassword=Newpass1!`, `confirmNewPassword=Newpass2!` | C2 | Rejected; password unchanged. Current UI/API cannot enforce because field is missing. |
| FR03-024 | Web UI Step Indicator | UI Requirement | Open `/forgot-password` step 1 | S1 | Visible "Bước 1 / 2" or equivalent step indicator; current web UI lacks it. |
| FR03-025 | Web UI OTP display | UI Requirement | Submit registered email on web | S1 -> S2 | Step 2 visible; OTP displayed directly in demo; label says 6 digits; current label says 4 digits. |
| FR03-026 | Web UI back to login | UI Requirement | Open step 1 and step 2 | S1/S2 | A clear "Quay lại đăng nhập" control exists and navigates to login; current web UI lacks this exact control. |
| FR03-027 | Web UI password regex | Negative / Deviation Guard | Enter valid spec password `Newpass1!` | P1/P7 | UI should allow submit. Current web regex rejects because it expects whitespace. |
| FR03-028 | Mobile UI OTP display | UI Requirement | Submit registered email on mobile | S1 -> S2 | Step 2 visible; OTP displayed directly in demo; current mobile message does not show OTP. |
| FR03-029 | Mobile UI Step Indicator | UI Requirement | Open forgot password screen | S1 | Visible "Bước 1 / 2"; current mobile UI lacks it. |
| FR03-030 | Mobile UI confirm password | UI Requirement | Open reset step | C1-C4 | New password and confirm new password inputs are present; current mobile UI has only one password field. |
| FR03-031 | API response contract | API Spec | `POST /api/forgot-password` success | O1 | Response matches `{"message": "...", "resetToken": "123456"}` with 6-digit token. Current code returns token but 4 digits. |
| FR03-032 | Malformed JSON/body | Negative | `POST /api/reset-password` with empty body `{}` | Missing email/OTP/password | Request rejected with validation error; no user password changes. |

## 8. Step-by-Step Test Suite Implementation Plan

### Step 1 - Prepare backend test tooling

From `backend/`:

```bash
npm install --save-dev jest supertest cross-env
```

Update `backend/package.json`:

```json
{
  "scripts": {
    "test": "cross-env NODE_ENV=test jest --runInBand"
  }
}
```

### Step 2 - Make Express app importable

Current `backend/server.js` starts the server directly with `app.listen(...)`. For Supertest, split startup from app definition:

- Export `app` from `server.js`.
- Only call `app.listen` when the file is run directly.

Target pattern:

```js
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

module.exports = app;
```

### Step 3 - Add database reset helper

The current `database.js` initializes and seeds SQLite on import. For stable tests:

- Keep using the seeded users `test@eshop.com / Test1234!` and `admin@eshop.com / Admin123!`.
- Before each test group, run `node database.js` or expose an `initDatabase()` function.
- Prefer a separate test DB file later; for this seminar project, reseeding `database.sqlite` before FR-03 tests is acceptable if tests run serially.

### Step 4 - Create API test file

Create:

```text
backend/__tests__/fr03.forgot-reset-password.api.test.js
```

Suggested structure:

```js
const request = require("supertest");
const app = require("../server");

async function requestOtp(email = "test@eshop.com") {
  const res = await request(app)
    .post("/api/forgot-password")
    .send({ email });
  return res;
}
```

Map tests from the table:

- `FR03-001` to `FR03-013` for OTP and workflow.
- `FR03-014` to `FR03-023` for password and confirm rules.
- `FR03-031` and `FR03-032` for API contract and malformed body.

### Step 5 - Validate reset persistence through login

For successful reset cases:

1. Request OTP for `test@eshop.com`.
2. Reset to a new valid password, for example `Newpass1!`.
3. Assert login with old password `Test1234!` fails.
4. Assert login with `Newpass1!` succeeds.
5. Reset password back to `Test1234!` in cleanup or reseed database before the next test.

### Step 6 - Add UI tests

Recommended web tooling:

```bash
cd frontend-web
npm install --save-dev @testing-library/react @testing-library/jest-dom vitest jsdom
```

Create:

```text
frontend-web/src/pages/ForgotPassword.test.jsx
```

Cover:

- `FR03-024`: Step Indicator.
- `FR03-025`: Step 2 and displayed OTP.
- `FR03-026`: Back to login.
- `FR03-027`: valid password `Newpass1!` should pass client validation.
- Confirm password field presence and mismatch behavior.

Recommended mobile tooling, if mobile UI tests are in scope:

```bash
cd frontend-mobile
npm install --save-dev jest-expo @testing-library/react-native
```

Cover:

- `FR03-028`: OTP display.
- `FR03-029`: Step Indicator.
- `FR03-030`: confirm password field.

### Step 7 - Use BVA data builders

Keep password and OTP test data centralized:

```js
const passwords = {
  valid8: "Aa1!bbbb",
  sevenChars: "Aa1!bbb",
  noUpper: "newpass1!",
  noLower: "NEWPASS1!",
  noDigit: "Newpass!",
  noSpecial: "Newpass1",
  disallowedSpecial: "Newpass1#",
};

const otps = {
  fiveDigits: "12345",
  sixDigitsWrong: "000000",
  sevenDigits: "1234567",
  nonNumeric: "ABC123",
};
```

### Step 8 - Expected initial result against current code

Khi chạy bộ test theo yêu cầu chuẩn, một số test nên fail để chỉ ra lỗi hiện tại:

- OTP 6 chữ số sẽ fail vì backend sinh 4 số.
- Web/mobile label OTP 6 số sẽ fail vì đang ghi 4 số.
- Mobile OTP display sẽ fail vì không hiển thị token.
- Confirm password UI/API sẽ fail vì chưa tồn tại.
- Backend password policy tests sẽ fail vì API không validate `newPassword`.
- Web valid password `Newpass1!` sẽ fail vì regex web đang yêu cầu khoảng trắng.
- Step Indicator và nút quay lại đăng nhập sẽ fail vì UI chưa có.

## 9. Priority Recommendation

Ưu tiên tự động hóa theo thứ tự:

1. API happy path, wrong OTP, OTP belongs to another email, OTP reuse.
2. Password BVA: length 7/8, missing character classes, allowed/disallowed special chars.
3. Confirm password required/mismatch.
4. UI contract: step indicator, OTP display, back to login, confirm field.
5. SEC-07 expiry test sau khi implementation có thêm cột expiry hoặc TTL.

