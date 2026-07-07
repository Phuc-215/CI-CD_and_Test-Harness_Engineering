# Kết quả kiểm thử FR-04 qua API

| TC_ID | Loại Test | Payload test | API Status | Cập nhật thực tế | Pass/Fail |
|---|---|---|---|---|---|
| TC_FR04_D1 | Hợp lệ | `{"name":"Nguyen Van A","shipping_address":"123 Le Loi","phone":"0912345678"}` | 200 | Status: 200 | **✅ PASS** |
| TC_FR04_D2 | Phone sai prefix | `{"name":"Nguyen Van A","shipping_address":"123 Le Loi","phone":"9912345678"}` | 200 | Status: 200 | **❌ FAIL (BUG)** |
| TC_FR04_D3 | Phone ngắn | `{"name":"Nguyen Van A","shipping_address":"123 Le Loi","phone":"0123456"}` | 200 | Status: 200 | **❌ FAIL (BUG)** |
| TC_FR04_D4 | Phone dài | `{"name":"Nguyen Van A","shipping_address":"123 Le Loi","phone":"0123456789012345"}` | 200 | Status: 200 | **❌ FAIL (BUG)** |
| TC_FR04_D5 | Phone chứa chữ | `{"name":"Nguyen Van A","shipping_address":"123 Le Loi","phone":"09123abc78"}` | 200 | Status: 200 | **❌ FAIL (BUG)** |
| TC_FR04_D6 | Phone rỗng | `{"name":"Nguyen Van A","shipping_address":"123 Le Loi","phone":""}` | 200 | Status: 200 | **❌ FAIL (BUG)** |
| TC_FR04_D7 | Tên rỗng | `{"name":"","shipping_address":"123 Le Loi","phone":"0912345678"}` | 200 | Status: 200 | **❌ FAIL (BUG)** |
| TC_FR04_D8 | Địa chỉ rỗng | `{"name":"Nguyen Van A","shipping_address":"","phone":"0912345678"}` | 200 | Status: 200 | **❌ FAIL (BUG)** |
| TC_FR04_D9 | Đổi email (Hacker) | `{"name":"Nguyen Van A","shipping_address":"123 Le Loi","phone":"0912345678","email":"hacker@eshop.com"}` | 200 | An toàn: Email giữ nguyên là test@eshop.com | **✅ PASS** |
| TC_FR04_D10 | Đổi role (Hacker) | `{"name":"Nguyen Van A","shipping_address":"123 Le Loi","phone":"0912345678","role":"admin"}` | 200 | Nguy hiểm: Quyền bị nâng lên Admin! | **❌ FAIL (BUG)** |
| TC_FR04_B1 | BVA - Phone (9) | `{"name":"Nguyen Van A","shipping_address":"123 Le Loi","phone":"012345678"}` | 200 | Status: 200 | **❌ FAIL (BUG)** |
| TC_FR04_B2 | BVA - Phone (10) | `{"name":"Nguyen Van A","shipping_address":"123 Le Loi","phone":"0123456789"}` | 200 | Status: 200 | **✅ PASS** |
| TC_FR04_B3 | BVA - Phone (11) | `{"name":"Nguyen Van A","shipping_address":"123 Le Loi","phone":"01234567890"}` | 200 | Status: 200 | **✅ PASS** |
| TC_FR04_B4 | BVA - Phone (12) | `{"name":"Nguyen Van A","shipping_address":"123 Le Loi","phone":"012345678901"}` | 200 | Status: 200 | **❌ FAIL (BUG)** |
