# FR-15: Quản lý Sản phẩm (Product CRUD) - Test Design

## Yêu cầu hệ thống (Trích xuất từ README.md)

### FR-15: Quản lý Sản phẩm (Product CRUD)
- Admin có thể Thêm / Xem / Sửa / Xóa sản phẩm.
- **Ràng buộc đầu vào:**
  - Tên sản phẩm: bắt buộc, tối đa 255 ký tự.
  - Giá: bắt buộc, phải là số **dương** (> 0).
  - Danh mục: bắt buộc, phải chọn từ danh sách có sẵn.
- Khi Sửa một sản phẩm, chỉ sản phẩm đó bị thay đổi — các sản phẩm khác giữ nguyên.

*(Tham chiếu thêm FR-12: Các thao tác Thêm/Sửa/Xóa yêu cầu Token JWT hợp lệ và `role = 'admin'`)*

---

## Phần 1: Domain Testing Workflow

### Step 1 — Variable inventory

| Variable | Type | Rule | Status |
|----------|------|------|--------|
| `name` | string (length) | Bắt buộc, độ dài `1 - 255` ký tự | verified (Ordered) |
| `price` | number | Bắt buộc, `> 0` (Số dương) | verified (Ordered) |
| `category_id` | reference | Bắt buộc, phải tồn tại trong bảng Category | verified |
| `token` | string | Phải là JWT hợp lệ | verified |
| `role` | enum (in token) | Phải là `admin` | verified |

### Step 2 — Partition into equivalence classes

- **`name` (Tên sản phẩm)**:
  - `EC-V1`: Có nhập, độ dài 1-255 ký tự.
  - `EC-I1`: Bỏ trống (Độ dài = 0).
  - `EC-I2`: Quá dài (Độ dài > 255 ký tự).
- **`price` (Giá)**:
  - `EC-V2`: Số dương (`price > 0`).
  - `EC-I3`: Bằng 0 (`price = 0`).
  - `EC-I4`: Số âm (`price < 0`).
  - `EC-I5`: Bỏ trống.
- **`category_id` (Danh mục)**:
  - `EC-V3`: Thuộc danh mục có sẵn (`category_id` hợp lệ).
  - `EC-I6`: Danh mục không tồn tại (`category_id` = 9999).
  - `EC-I7`: Bỏ trống.
- **`token` & `role` (Bảo mật - FR-12)**:
  - `EC-V4`: Token hợp lệ, Role = `admin`.
  - `EC-I8`: Token hợp lệ nhưng Role = `user`.
  - `EC-I9`: Không có Token (Guest).

### Step 3 & 4 — Expected results per class

| Class | Representative Value | Expected Result |
|-------|----------------------|-----------------|
| All Valid | Name="Bánh quy", Price=50000, Cat=1, Admin Token | Tạo/Sửa thành công (HTTP 201/200) |
| `EC-I1` | Name="" (Rỗng) | Từ chối - Tên bắt buộc |
| `EC-I2` | Name=Chuỗi dài 300 ký tự 'A' | Từ chối - Tên tối đa 255 ký tự |
| `EC-I3` | Price=0 | Từ chối - Giá phải là số dương |
| `EC-I4` | Price=-10000 | Từ chối - Giá phải là số dương |
| `EC-I5` | Price="" (Rỗng) | Từ chối - Giá bắt buộc |
| `EC-I6` | Category_id=9999 (Fake) | Từ chối - Danh mục không hợp lệ |
| `EC-I7` | Category_id="" (Rỗng) | Từ chối - Danh mục bắt buộc |
| `EC-I8` | User Token | Từ chối - HTTP 403 Forbidden |
| `EC-I9` | No Token | Từ chối - HTTP 401 Unauthorized |

### Step 5 — Domain matrix (Single-fault assumption)

*(Dùng API Thêm Sản Phẩm `POST /api/products` để làm mẫu test)*

| TC_ID | Target Class | Name | Price | Category ID | Auth | Expected Result |
|---|---|---|---|---|---|---|
| TC_FR15_D1 | V1,V2,V3,V4 | `Sản phẩm A` | `100,000` | `1` (Tồn tại) | Admin | Tạo thành công |
| TC_FR15_D2 | I1 | `` | `100,000` | `1` | Admin | Lỗi Tên rỗng |
| TC_FR15_D3 | I2 | Chuỗi 300 ký tự | `100,000` | `1` | Admin | Lỗi Tên quá dài |
| TC_FR15_D4 | I3 | `Sản phẩm A` | `0` | `1` | Admin | Lỗi Giá > 0 |
| TC_FR15_D5 | I4 | `Sản phẩm A` | `-50,000` | `1` | Admin | Lỗi Giá > 0 |
| TC_FR15_D6 | I6 | `Sản phẩm A` | `100,000` | `9999` (Fake)| Admin | Lỗi Danh mục |
| TC_FR15_D7 | I8 | `Sản phẩm A` | `100,000` | `1` | User | 403 Forbidden |
| TC_FR15_D8 | I9 | `Sản phẩm A` | `100,000` | `1` | Guest | 401 Unauthorized|

---

## Phần 2: Boundary Value Analysis (BVA) Workflow

### Step 1 — Select
Có 2 biến tính thứ tự cần phân tích biên:
1. `name` (Dựa trên chiều dài chuỗi).
2. `price` (Dựa trên giá trị số học).

### Step 2 — Bounds
1. **`name_length`**: `[1, 255]`. 
   - Tính bao hàm: **Inclusive both ends**.
   - Step size: 1 ký tự.
   - Biên dưới = 1, Biên trên = 255.
2. **`price`**: `(0, +∞)`.
   - Tính bao hàm: Yêu cầu "giá phải là số dương (> 0)" -> **Exclusive lower bound**.
   - Step size: 1 (Quy ước đơn vị tiền tệ VND nhỏ nhất là 1 đồng).
   - Biên dưới = 0.

### Step 3 — Enumerate (ON/OFF Points)

- **Biên dưới `name_length` (1):**
  - **Lower OFF**: `0` ký tự (Rỗng)
  - **Lower ON**: `1` ký tự ("A")
- **Biên trên `name_length` (255):**
  - **Upper ON**: `255` ký tự
  - **Upper OFF**: `256` ký tự

- **Biên dưới `price` (> 0):** (Đây là Exclusive, nên `0` là điểm OFF)
  - **Lower OFF**: `0` 
  - **Lower ON**: `1` (Số dương nhỏ nhất)
  - **Vượt biên (Robust)**: `-1`

### Step 4 & 5 — Boundary matrix

| TC_ID | Target Bound | Trạng thái biên | Giá trị test | Các biến khác | Expected Result |
|---|---|---|---|---|---|
| TC_FR15_B1 | `name_length` | Lower OFF | `""` (0 ký tự) | Valid | Lỗi Tên rỗng |
| TC_FR15_B2 | `name_length` | Lower ON | `"A"` (1 ký tự) | Valid | Chấp nhận |
| TC_FR15_B3 | `name_length` | Upper ON | `"X" * 255` | Valid | Chấp nhận |
| TC_FR15_B4 | `name_length` | Upper OFF | `"X" * 256` | Valid | Lỗi Tên quá dài |
| TC_FR15_B5 | `price` | Robust OFF | `-1` | Valid | Lỗi Giá > 0 |
| TC_FR15_B6 | `price` | Lower OFF | `0` | Valid | Lỗi Giá > 0 |
| TC_FR15_B7 | `price` | Lower ON | `1` | Valid | Chấp nhận |

### Step 6 & 7 — Check & Reconcile
- Đặc biệt chú ý **TC_FR15_B6 (price = 0)**: Rất nhiều lập trình viên nhầm lẫn giữa "lớn hơn 0" (`> 0`) và "không âm" (`>= 0`). BVA chỉ ra `0` là một điểm OFF (invalid) bắt buộc phải bị từ chối.
- Các điểm OFF hoàn toàn tương ứng với class `EC-I1`, `EC-I2`, `EC-I3`, `EC-I4` bên Domain Testing.
