# Kết quả kiểm thử FR-20 (Mobile — Login & Account Lock) qua API

> SUT: `POST /api/login` (Mobile dùng chung API đăng nhập theo FR-20/FR-02).

| TC_ID | Loại Test | Payload / Hành động | HTTP | Response / Quan sát | Pass/Fail |
|---|---|---|---|---|---|
| TC_FR20_D1 | Domain - Hợp lệ (V1,V2,V3) | `{email:test, pass:Test1234!}` | 200 | Có JWT token | **✅ PASS** |
| TC_FR20_D2 | Domain - Email sai định dạng (UI-layer, xem ghi chú) | `{email:test_eshop.com}` | 401 | Định dạng validate ở UI (FR-22); API trả 401 là hợp lệ | **✅ PASS** |
| TC_FR20_D3 | Domain - Email không tồn tại (I2) | `{email:fake@eshop.com}` | 401 | {"error":"Invalid email or password"} | **✅ PASS** |
| TC_FR20_D4 | Domain - Sai mật khẩu (I4) | `{pass:WrongPass}` | 401 | {"error":"Invalid email or password"} | **✅ PASS** |
| TC_FR20_D5 | Domain - Email rỗng (I3) | `{email:""}` | 401 | {"error":"Invalid email or password"} | **✅ PASS** |
| TC_FR20_D6 | Domain - Mật khẩu rỗng (I5) | `{password:""}` | 401 | {"error":"Invalid email or password"} | **✅ PASS** |
| TC_FR20_B_COUNT | BVA - Sau 1 lần sai, bộ đếm phải = 1 | `1x sai -> đọc login_attempts` | - | login_attempts = 2 (mong đợi 1) | **❌ FAIL (BUG)** |
| TC_FR20_B1 | BVA - Sai lần 1 (OFF, chưa khóa) | `{pass:WrongPass}` | 401 | {"error":"Invalid email or password"} | **✅ PASS** |
| TC_FR20_B2 | BVA - Sai lần 2 (OFF, chưa khóa) | `{pass:WrongPass}` | 401 | {"error":"Invalid email or password"} | **✅ PASS** |
| TC_FR20_B3 | BVA - Đăng nhập ĐÚNG sau 2 lần sai (phải thành công) | `{pass:Test1234!}` | 403 | {"error":"Tài khoản đã bị khóa. Vui lòng thử lại sau."} (Đã bị khóa quá sớm!) | **❌ FAIL (BUG)** |
| TC_FR20_B4 | BVA - Sai lần 3 (ON, response vẫn 401) | `{pass:WrongPass} #3` | 403 | {"error":"Tài khoản đã bị khóa. Vui lòng thử lại sau."} | **❌ FAIL (BUG)** |
| TC_FR20_B5 | BVA - Request thứ 4 khi đã khóa (Robust) | `{pass:Test1234!} #4` | 403 | {"error":"Tài khoản đã bị khóa. Vui lòng thử lại sau."} | **✅ PASS** |
| TC_FR20_B6 | BVA - Đăng nhập sau 31s (khóa 30s phải hết) | `{pass:Test1234!} +31s` | 403 | {"error":"Tài khoản đã bị khóa. Vui lòng thử lại sau."} (Khóa dài hơn 30s!) | **❌ FAIL (BUG)** |

## Tổng kết

| Thiết kế | Thực thi | PASS | FAIL (BUG) |
|---|---|---|---|
| 13 | 13 | 9 | 4 |
