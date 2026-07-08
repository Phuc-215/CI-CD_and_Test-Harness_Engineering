# Kết quả kiểm thử FR-15 (Quản lý Sản phẩm) qua API

| TC_ID | Loại Test | Payload test | HTTP Status | Response Message | Pass/Fail |
|---|---|---|---|---|---|
| TC_FR15_D1 | Domain - Valid All | `{"name":"Sản phẩm A","price":100000,"category_id":1}` | 200 | `{"message":"Product created","id":6}` | **✅ PASS** |
| TC_FR15_D2 | Domain - Tên rỗng | `{"name":"","price":100000,"category_id":1}` | 200 | `{"message":"Product created","id":7}` | **❌ FAIL (BUG)** |
| TC_FR15_D3 | Domain - Tên quá dài (256) | `{"name":"XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX...` | 200 | `{"message":"Product created","id":8}` | **❌ FAIL (BUG)** |
| TC_FR15_D4 | Domain - Giá = 0 | `{"name":"Sản phẩm A","price":0,"category_id":1}` | 200 | `{"message":"Product created","id":9}` | **❌ FAIL (BUG)** |
| TC_FR15_D5 | Domain - Giá âm | `{"name":"Sản phẩm A","price":-50000,"category_id":1}` | 200 | `{"message":"Product created","id":10}` | **❌ FAIL (BUG)** |
| TC_FR15_D6 | Domain - Giá trống | `{"name":"Sản phẩm A","price":"","category_id":1}` | 200 | `{"message":"Product created","id":11}` | **❌ FAIL (BUG)** |
| TC_FR15_D7 | Domain - Category Fake | `{"name":"Sản phẩm A","price":100000,"category_id":9999}` | 200 | `{"message":"Product created","id":12}` | **❌ FAIL (BUG)** |
| TC_FR15_D8 | Domain - Category Trống | `{"name":"Sản phẩm A","price":100000,"category_id":""}` | 200 | `{"message":"Product created","id":13}` | **❌ FAIL (BUG)** |
| TC_FR15_D9 | Domain - User token (403) | `{"name":"Sản phẩm A","price":100000,"category_id":1}` | 200 | `{"message":"Product created","id":14}` | **❌ FAIL (BUG)** |
| TC_FR15_D10 | Domain - No token (401) | `{"name":"Sản phẩm A","price":100000,"category_id":1}` | 200 | `{"message":"Product created","id":15}` | **❌ FAIL (BUG)** |
| TC_FR15_B1 | BVA - Tên rỗng (0) | `{"name":"","price":100000,"category_id":1}` | 200 | `{"message":"Product created","id":16}` | **❌ FAIL (BUG)** |
| TC_FR15_B2 | BVA - Tên ngắn nhất (1) | `{"name":"A","price":100000,"category_id":1}` | 200 | `{"message":"Product created","id":17}` | **✅ PASS** |
| TC_FR15_B3 | BVA - Tên dài nhất (255) | `{"name":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA...` | 200 | `{"message":"Product created","id":18}` | **✅ PASS** |
| TC_FR15_B4 | BVA - Vượt giới hạn (256) | `{"name":"XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX...` | 200 | `{"message":"Product created","id":19}` | **❌ FAIL (BUG)** |
| TC_FR15_B5 | BVA - Giá âm (-1) | `{"name":"SP BVA","price":-1,"category_id":1}` | 200 | `{"message":"Product created","id":20}` | **❌ FAIL (BUG)** |
| TC_FR15_B6 | BVA - Giá tại điểm OFF (0) | `{"name":"SP BVA","price":0,"category_id":1}` | 200 | `{"message":"Product created","id":21}` | **❌ FAIL (BUG)** |
| TC_FR15_B7 | BVA - Giá dương nhỏ nhất (1) | `{"name":"SP BVA","price":1,"category_id":1}` | 200 | `{"message":"Product created","id":22}` | **✅ PASS** |
