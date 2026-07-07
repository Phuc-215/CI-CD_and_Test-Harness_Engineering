# Bug Report — EShop (HW02, 4 features)

SUT commit: local `backend/` (Node + Express + SQLite). Reproduced via API tests in
`tests/api/` against `http://localhost:3000`. Each row links to the failing test case and the
offending source line. Severity: **Critical** (security / data corruption) > **High**
(core rule broken) > **Medium** (edge/off-by-one) > **Low**.

| ID | Feature | Severity | Title | Evidence (TC) | Source |
|----|---------|----------|-------|---------------|--------|
| BUG-01 | FR-20 | High | Bộ đếm đăng nhập sai tăng **+2** thay vì +1 | TC_FR20_B_COUNT (`login_attempts=2` sau 1 lần sai) | server.js:54 |
| BUG-02 | FR-20 | High | Tài khoản bị khóa sau **2** lần sai thay vì 3 | TC_FR20_B3 (đăng nhập đúng sau 2 lần sai → 403) | server.js:54,56 |
| BUG-03 | FR-20 | Medium | Thời lượng khóa **180s** thay vì 30s | TC_FR20_B6 (sau 31s vẫn 403) | server.js:57 |
| BUG-04 | FR-04 | **Critical** | Leo thang đặc quyền: đổi `role`→admin qua cập nhật hồ sơ (vi phạm SEC-06) | TC_FR04_D10 | server.js:124-127 |
| BUG-05 | FR-04 | High | Không validate số điện thoại (prefix/độ dài/ký tự) | TC_FR04_D2–D6, B1, B4 | server.js:118-135 |
| BUG-06 | FR-09 | **Critical** | Công thức giảm giá `percent` sai → `discount_amount` âm khổng lồ, `final_amount` > tổng | TC_FR09_D1 (`discount=-3,600,000`) | server.js:399 |
| BUG-07 | FR-09 | High | `/api/apply-coupon` thiếu xác thực (C4 không thực thi) → khách vãng lai áp mã được | TC_FR09_D6 | server.js:363 |
| BUG-08 | FR-09 | Medium | Off-by-one ngưỡng đơn: dùng `>` thay vì `>=` → đơn == `min_order_amount` bị từ chối | TC_FR09_B2 | server.js:379 |
| BUG-09 | FR-15 | **Critical** | Thiếu kiểm soát truy cập trên `POST/PUT/DELETE /api/products` (vi phạm FR-12/SEC-03) | TC_FR15_D9, D10, DEL1 | server.js:167,179,191 |
| BUG-10 | FR-15 | High | Không validate đầu vào sản phẩm (name rỗng/>255, price 0/âm/rỗng, category không tồn tại/rỗng) | TC_FR15_D2–D8, B1,B4,B5,B6 | server.js:167-177 |

## Chi tiết & tái hiện

### BUG-04 (Critical) — Privilege escalation qua PUT /api/users/me
Đặc tả FR-04 và SEC-06: người dùng **không** được tự đổi `role`. Backend lại nối thêm
`role = ?` vào câu UPDATE nếu payload có trường `role`:
```js
if (role) { query += ", role = ?"; params.push(role); }   // server.js:124-127
```
Tái hiện: đăng nhập user thường → `PUT /api/users/me {"role":"admin", ...}` → `GET
/api/users/me` cho thấy `role: "admin"`. **Tác động:** bất kỳ user nào tự nâng quyền Admin.
**Khắc phục:** loại bỏ nhánh `role` khỏi endpoint; không bao giờ nhận `role` từ client.

### BUG-06 (Critical) — Sai công thức giảm giá percent
```js
discount_amount = Math.floor(total_amount * (1 - coupon.discount_value)); // server.js:399
```
Với `SAVE10` (`discount_value=10`): `total*(1-10) = total*(-9)`. Đơn 400,000 → discount
`-3,600,000`, `final_amount = 400,000 - (-3,600,000) = 4,000,000`. Đúng phải là
`total*discount_value/100 = 40,000`. **Tác động:** tổng thanh toán sai nghiêm trọng.
**Khắc phục:** `discount = Math.floor(total_amount * coupon.discount_value / 100)`.

### BUG-01/02 (High) — Đếm sai & khóa quá sớm
```js
const newAttempts = user.login_attempts + 2;                 // server.js:54  (phải +1)
if (newAttempts >= 3) lockedUntil = now + 180000;            // server.js:56-57 (180s, phải 30s)
```
Do +2: lần sai 1 → đếm=2, lần sai 2 → đếm=4 ≥3 → khóa. Tài khoản khóa sau **2** lần sai,
trái đặc tả "≥3". Bộ test cũ chỉ kiểm HTTP status ở lần thứ 3 (chấp nhận cả 401/403) nên
**bỏ lọt** lỗi này; đã bổ sung `TC_FR20_B_COUNT` (đọc thẳng bộ đếm) và `TC_FR20_B3` (đăng
nhập đúng sau 2 lần sai phải thành công) để phơi bày.

### BUG-09 (Critical) — Thiếu access control trên Product API
`POST/PUT/DELETE /api/products` không gắn middleware `authenticateToken` và không kiểm
`role='admin'`. Khách vãng lai tạo/sửa/xóa sản phẩm được (TC_FR15_D10, DEL1). **Khắc phục:**
thêm `authenticateToken` + kiểm `req.user.role === 'admin'` cho mọi thao tác ghi.

## Điểm mơ hồ (Ambiguity — KHÔNG báo là bug)

| ID | Feature | Vấn đề | Cần xác nhận |
|----|---------|--------|--------------|
| AMB-01 | FR-04 | Đặc tả không nêu `full_name`/`shipping_address` có bắt buộc non-empty khi *cập nhật* hồ sơ | Hỏi chủ sản phẩm: cho phép để trống khi update? (TC_FR04_D7/D8) |
| AMB-02 | FR-09 | Coupon hợp lệ *tại đúng* thời điểm `expired_at` (cạnh dưới-giây) | Semantics "trước `expired_at`": inclusive hay exclusive tới mili-giây? |

## Quan sát ngoài phạm vi (4 feature đã chọn)
- `GET /api/products/:id` trả `price` dạng **chuỗi** cho id chẵn (server.js:162) — ảnh hưởng FR-06.
- `GET /api/products?search=` nối chuỗi trực tiếp vào SQL (server.js:144) — nguy cơ **SQL injection**, vi phạm SEC-05 (FR-05).

> **GitHub Issues:** mỗi BUG-xx nên tạo 1 issue kèm ảnh chụp (payload + response). Dán link
> issue vào cột "Source" hoặc thêm cột "Issue" khi nộp.
