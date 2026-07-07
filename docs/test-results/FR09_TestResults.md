# Kết quả kiểm thử FR-09 (Apply Coupon) qua API

| TC_ID | Loại Test | Payload test | HTTP Status | Response Data | Pass/Fail |
|---|---|---|---|---|---|
| TC_FR09_D1 | Domain - SAVE10 Hợp lệ | `{"code":"SAVE10","total_amount":400000,"user_id":2}` | 200 | `{"success":true,"coupon_id":1,"discount_amount":-3600000,"final_amount":4000000,"message":"Áp dụng thành công! Giảm 10%"} (Sai số tiền. Mong đợi: 40000)` | **❌ FAIL (BUG)** |
| TC_FR09_D2 | Domain - BIGBUY Hợp lệ | `{"code":"BIGBUY","total_amount":600000,"user_id":2}` | 200 | `{"success":true,"coupon_id":2,"discount_amount":50000,"final_amount":550000,"message":"Áp dụng thành công! Giảm 50,000 ₫"}` | **✅ PASS** |
| TC_FR09_D3 | Domain - Mã không tồn tại | `{"code":"KHONGCO","total_amount":400000,"user_id":2}` | 404 | `{"error":"Mã giảm giá không tồn tại hoặc đã bị vô hiệu hóa"}` | **✅ PASS** |
| TC_FR09_D4 | Domain - Mã hết hạn | `{"code":"EXPIRED","total_amount":400000,"user_id":2}` | 400 | `{"error":"Mã giảm giá đã hết hạn"}` | **✅ PASS** |
| TC_FR09_D5 | Domain - Không đủ tiền | `{"code":"SAVE10","total_amount":200000,"user_id":2}` | 400 | `{"error":"Đơn hàng chưa đủ giá trị tối thiểu 300,000 ₫ để áp dụng mã này"}` | **✅ PASS** |
| TC_FR09_D6 | Domain - Không có token | `{"code":"SAVE10","total_amount":400000,"user_id":2}` | 200 | `{"success":true,"coupon_id":1,"discount_amount":-3600000,"final_amount":4000000,"message":"Áp dụng thành công! Giảm 10%"}` | **❌ FAIL (BUG)** |
| TC_FR09_B1 | BVA - Thiếu 1 đồng | `{"code":"SAVE10","total_amount":299999,"user_id":2}` | 400 | `{"error":"Đơn hàng chưa đủ giá trị tối thiểu 300,000 ₫ để áp dụng mã này"}` | **✅ PASS** |
| TC_FR09_B2 | BVA - Vừa đủ tiền | `{"code":"SAVE10","total_amount":300000,"user_id":2}` | 400 | `{"error":"Đơn hàng chưa đủ giá trị tối thiểu 300,000 ₫ để áp dụng mã này"}` | **❌ FAIL (BUG)** |
| TC_FR09_D7.1 | Thử apply lần 1 (Limit 2) | `{"code":"VIP100"}` | 200 | `{"success":true,"coupon_id":3,"discount_amount":100000,"final_amount":400000,"message":"Áp dụng thành công! Giảm 100,000 ₫"}` | **✅ PASS** |
| TC_FR09_D7.2 | Thử apply lần 2 (Limit 2) | `{"code":"VIP100"}` | 200 | `{"success":true,"coupon_id":3,"discount_amount":100000,"final_amount":400000,"message":"Áp dụng thành công! Giảm 100,000 ₫"}` | **✅ PASS** |
| TC_FR09_D7.3 | Thử apply lần 3 (Limit 2) | `{"code":"VIP100"}` | 200 | `{"success":true,"coupon_id":3,"discount_amount":100000,"final_amount":400000,"message":"Áp dụng thành công! Giảm 100,000 ₫"}` | **❌ FAIL (BUG)** |
