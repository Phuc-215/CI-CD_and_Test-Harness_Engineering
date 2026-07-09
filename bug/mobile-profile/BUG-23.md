# [BUG-23][FR-MB] — Mobile phone regex is inverted relative to the spec

## Description
The spec (FR-04, applied to mobile via FR-20) requires a phone number to start with `0` and be 10–11 digits total. The mobile app's client-side check does the opposite: `/^[1-9][0-9]{8,9}$/` requires the **first digit to be 1–9** (explicitly rejecting a leading `0`) and a total length of **9–10** digits. A spec-valid number like `0912345678` is rejected by the app itself, while a spec-invalid number like `912345678` is accepted.

## Environment
- Component: `frontend-mobile` (React Native / Expo)
- Screen: Profile update form
- No Android/iOS emulator or Expo Go device was available in this session — this is a pure regex evaluation, reproducible without running the app, and confirmed to be the exact expression in the source file.

## Location in Codebase
| File | Range Line |
|---|---|
| `frontend-mobile/App.js` | 286–293 (`handleUpdateProfile` — regex check and error message) |

## Affect Level
**HIGH**

## Steps to Reproduce (CLI)
```bash
node -e '
const re = /^[1-9][0-9]{8,9}$/;
console.log("0912345678 (spec-valid) ->", re.test("0912345678"));  // expect true, actual false
console.log("912345678  (spec-invalid) ->", re.test("912345678"));  // expect false, actual true
'
```
If a device/emulator is available: open the mobile app's Profile screen, enter `0912345678` (a spec-compliant number), tap Save — the app blocks it with "Số điện thoại không hợp lệ. Vui lòng nhập đúng 9-10 chữ số."

## Suggested Fix
Replace the regex at `App.js:287` with one matching the spec: `/^0\d{9,10}$/` (starts with `0`, 10–11 digits total), and update the error message at lines 289–291 to describe the correct rule.
