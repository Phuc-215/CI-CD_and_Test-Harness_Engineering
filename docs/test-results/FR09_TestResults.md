# Kết quả kiểm thử FR-09 (Apply Coupon) qua API

| TC_ID | Loại Test | Payload / Hành động | HTTP Status | Response Data | Pass/Fail |
|---|---|---|---|---|---|
| TC_FR09_D1 | Domain - SAVE10 Hợp lệ (percent) | SAVE10, total=400k | 200 | {"success":true,"coupon_id":1,"discount_amount":-3600000,"final_amount":4000000,"message":"Áp dụng thành công! Giảm 10%"} (Sai số tiền. Mong đợi: 40000, Thực tế: -3600000) | **❌ FAIL (BUG)** |
| TC_FR09_D2 | Domain - BIGBUY Hợp lệ (fixed) | BIGBUY, total=600k | 200 | {"success":true,"coupon_id":2,"discount_amount":50000,"final_amount":550000,"message":"Áp dụng thành công! Giảm 50,000 ₫"} | **✅ PASS** |
| TC_FR09_D3 | Domain - Mã không tồn tại | KHONGCO, total=400k | 404 | {"error":"Mã giảm giá không tồn tại hoặc đã bị vô hiệu hóa"} | **✅ PASS** |
| TC_FR09_D4 | Domain - Mã bị khóa (LOCKEDCODE) | LOCKEDCODE, total=400k | 404 | {"error":"Mã giảm giá không tồn tại hoặc đã bị vô hiệu hóa"} | **✅ PASS** |
| TC_FR09_D5 | Domain - Mã hết hạn (EXPIRED) | EXPIRED, total=400k | 400 | {"error":"Mã giảm giá đã hết hạn"} | **✅ PASS** |
| TC_FR09_D6 | Domain - Không đủ tiền | SAVE10, total=200k | 400 | {"error":"Đơn hàng chưa đủ giá trị tối thiểu 300,000 ₫ để áp dụng mã này"} | **✅ PASS** |
| TC_FR09_D7 | Domain - Không có token | SAVE10, total=400k, Guest | 200 | {"success":true,"coupon_id":1,"discount_amount":-3600000,"final_amount":4000000,"message":"Áp dụng thành công! Giảm 10%"} | **❌ FAIL (BUG)** |
| TC_FR09_D8 | Domain - Đã dùng hết lượt (uses >= max) | SAVE10, total=400k, seeded usage=1 | 400 | {"error":"Bạn đã sử dụng mã này 1 lần (đã đạt giới hạn)"} | **✅ PASS** |
| TC_FR09_B1 | BVA - Thiếu 1 đồng | SAVE10, total=299999 | 400 | {"error":"Đơn hàng chưa đủ giá trị tối thiểu 300,000 ₫ để áp dụng mã này"} | **✅ PASS** |
| TC_FR09_B2 | BVA - Vừa đủ tiền (Lower ON) | SAVE10, total=300000 | 400 | {"error":"Đơn hàng chưa đủ giá trị tối thiểu 300,000 ₫ để áp dụng mã này"} | **❌ FAIL (BUG)** |
| TC_FR09_B3 | BVA - Số lượt dùng = 0 (Upper ON) | SAVE10, total=400k, usage=0 | 200 | {"success":true,"coupon_id":1,"discount_amount":-3600000,"final_amount":4000000,"message":"Áp dụng thành công! Giảm 10%"} | **✅ PASS** |
| TC_FR09_B4 | BVA - Số lượt dùng = 1 (Upper OFF) | SAVE10, total=400k, usage=1 | 400 | {"error":"Bạn đã sử dụng mã này 1 lần (đã đạt giới hạn)"} | **✅ PASS** |
| TC_FR09_B5 | BVA - Ngày hiện tại = Hạn dùng (Upper OFF) | SAVE10, expired_at=now | 400 | {"error":"Mã giảm giá đã hết hạn"} | **✅ PASS** |

## Tổng kết

| Thiết kế | Thực thi | PASS | FAIL (BUG) |
|---|---|---|---|
| 13 | 13 | 10 | 3 |
