# FR-09: Áp dụng Mã giảm giá (Apply Coupon) - Test Design

## Yêu cầu hệ thống (Trích xuất từ README.md)

Tại bước Checkout, người dùng có thể nhập mã giảm giá. Hệ thống áp dụng giảm giá dựa trên **5 điều kiện** sau, tất cả phải thỏa mãn:

| #   | Điều kiện              | Mô tả                                                       |
| --- | ---------------------- | ----------------------------------------------------------- |
| C1  | **Mã tồn tại**         | Mã phải có trong CSDL và đang hoạt động (`is_active = 1`)   |
| C2  | **Còn hạn sử dụng**    | Ngày hiện tại phải trước `expired_at`                       |
| C3  | **Đủ ngưỡng đơn hàng** | Tổng đơn hàng **>= (lớn hơn hoặc bằng)** `min_order_amount` |
| C4  | **Đã đăng nhập**       | Người dùng phải có JWT Token hợp lệ                         |
| C5  | **Chưa dùng hết lượt** | Số lần đã dùng mã này của user < `max_uses_per_user`        |

**Công thức tính giảm giá:**
- Loại `percent`: `discount_amount = total × discount_value / 100`
- Loại `fixed`: `discount_amount = discount_value`
- `final_amount = total - discount_amount`

---

## Phần 1: Domain Testing Workflow

### Step 1 — Variable inventory

| Variable | Type | Rule | Status |
|----------|------|------|--------|
| `code_status` | state | Mã tồn tại và `is_active = 1` | verified |
| `current_date` | date | Phải `< expired_at` | verified (Ordered) |
| `total_amount` | number | Phải `>= min_order_amount` | verified (Ordered) |
| `token` | string | Phải hợp lệ (Logged in) | verified |
| `uses_count` | number | Phải `< max_uses_per_user` | verified (Ordered) |
| `discount_type` | enum | `percent` hoặc `fixed` | verified |

### Step 2 — Partition into equivalence classes

- **`code_status`**:
  - `EC-V1`: Mã tồn tại và hoạt động (Ví dụ: `SAVE10`)
  - `EC-I1`: Mã không tồn tại (`FAKECODE`)
  - `EC-I2`: Mã tồn tại nhưng `is_active = 0` (Bị khóa)
- **`current_date`** (So với `expired_at`):
  - `EC-V2`: Ngày hiện tại nằm trước hạn (`current < expired_at`)
  - `EC-I3`: Ngày hiện tại bằng hoặc sau hạn (`current >= expired_at`)
- **`total_amount`** (So với `min_order_amount`):
  - `EC-V3`: Giá trị đơn hàng đủ lớn (`total >= min`)
  - `EC-I4`: Giá trị đơn hàng quá nhỏ (`total < min`)
- **`token`**:
  - `EC-V4`: Có token JWT hợp lệ
  - `EC-I5`: Không có token hoặc token sai/hết hạn
- **`uses_count`** (So với `max_uses_per_user`):
  - `EC-V5`: Số lần dùng `< max`
  - `EC-I6`: Số lần dùng `>= max`
- **`discount_type`**:
  - `EC-V6`: Loại `percent`
  - `EC-V7`: Loại `fixed`

### Step 3 & 4 — Expected results per class

*Chọn `SAVE10` (min=300k, max_uses=1, percent=10%) làm mốc chuẩn cho các test invalid.*

| Class | Representative Value | Expected Result |
|-------|----------------------|-----------------|
| All Valid (`EC-V*`) | `SAVE10`, total=500k, chưa dùng | Trả về `discount_amount` và `final_amount` đúng công thức |
| `EC-I1` | Mã `KHONGCO` | Từ chối - "Mã không tồn tại" |
| `EC-I2` | Mã `LOCKEDCODE` | Từ chối - "Mã không hoạt động" |
| `EC-I3` | Mã `EXPIRED` | Từ chối - "Mã đã hết hạn" |
| `EC-I4` | `SAVE10`, total=200k | Từ chối - "Đơn hàng chưa đủ điều kiện" |
| `EC-I5` | No token (Guest) | Từ chối - HTTP 401 Unauthorized |
| `EC-I6` | `SAVE10`, đã dùng 1 lần | Từ chối - "Bạn đã hết lượt dùng mã này" |
| `EC-V6` | `SAVE10`, total=400k | `discount = 40,000`, `final = 360,000` |
| `EC-V7` | `BIGBUY`, total=600k | `discount = 50,000`, `final = 550,000` |

### Step 5 — Domain matrix (Single-fault assumption)

| TC_ID | Target Class | Coupon Code | Total Amount | Token | Uses Count | Expected Result |
|---|---|---|---|---|---|---|
| TC_FR09_D1 | V1,V2,V3,V4,V5,V6 | `SAVE10` | 400,000 | Hợp lệ | 0 | Chấp nhận, discount=40k |
| TC_FR09_D2 | V1,V2,V3,V4,V5,V7 | `BIGBUY` | 600,000 | Hợp lệ | 0 | Chấp nhận, discount=50k |
| TC_FR09_D3 | I1 | `KHONGCO` | 400,000 | Hợp lệ | 0 | Từ chối - Không tồn tại |
| TC_FR09_D4 | I3 | `EXPIRED` | 400,000 | Hợp lệ | 0 | Từ chối - Hết hạn |
| TC_FR09_D5 | I4 | `SAVE10` | 200,000 | Hợp lệ | 0 | Từ chối - Chưa đủ ngưỡng |
| TC_FR09_D6 | I5 | `SAVE10` | 400,000 | Trống | 0 | 401 Unauthorized |
| TC_FR09_D7 | I6 | `SAVE10` | 400,000 | Hợp lệ | 1 | Từ chối - Hết lượt |

### Step 6 & 7 — Coverage & Reconcile
- Tất cả 5 điều kiện (C1->C5) đều bị bẻ gãy thử ít nhất 1 lần (Single-fault).
- Các biến có tính thứ tự (`total_amount`, `current_date`, `uses_count`) sẽ được đưa qua BVA để phân tích ranh giới.

---

## Phần 2: Boundary Value Analysis (BVA) Workflow

### Step 1 — Select
Có 3 biến tính thứ tự được nhận diện:
1. `total_amount`
2. `current_date`
3. `uses_count`

### Step 2 — Bounds
1. **`total_amount`**: `[min_order_amount, +∞)`. 
   - Tính bao hàm: **Inclusive lower bound** (`>=`).
   - Step size: 1 VND.
2. **`current_date`**: `(-∞, expired_at)`.
   - Tính bao hàm: **Exclusive upper bound** (`<`). Hệ thống yêu cầu "trước" `expired_at`.
   - Step size: 1 ms (nếu check timestamp) hoặc 1 day. Thường tính là 1 giây/1 mili-giây.
3. **`uses_count`**: `[0, max_uses_per_user)`.
   - Tính bao hàm: **Exclusive upper bound** (`<`).
   - Step size: 1 (số nguyên).

### Step 3 — Enumerate (ON/OFF Points)
Sử dụng mã `SAVE10` làm chuẩn (`min_order_amount = 300,000`, `max_uses_per_user = 1`):

- **Biên `total_amount` (>= 300000):**
  - **Lower OFF**: `299,999` (Invalid)
  - **Lower ON**: `300,000` (Valid)
  - **Upper**: Không có giới hạn trên.

- **Biên `uses_count` (< 1):**
  - **Upper ON**: `0` (Valid - Chưa dùng lần nào)
  - **Upper OFF**: `1` (Invalid - Vừa chạm ngưỡng bị chặn)

- **Biên `current_date` (< expired_at):**
  - Đặt `E` = thời điểm `expired_at`.
  - **Upper ON**: `E - 1ms` (Hoặc 23:59:59 của ngày trước đó tùy logic) -> Valid.
  - **Upper OFF**: `E` (Đúng thời điểm hết hạn) -> Invalid.

### Step 4 & 5 — Boundary matrix

| TC_ID | Target Bound | Mã dùng | Thuộc tính thay đổi | Giá trị test tại biên | Các biến khác | Expected Result |
|---|---|---|---|---|---|---|
| TC_FR09_B1 | `total` (Lower OFF) | `SAVE10` | `total_amount` | 299,999 ₫ | Hợp lệ | Từ chối - Thiếu 1₫ |
| TC_FR09_B2 | `total` (Lower ON) | `SAVE10` | `total_amount` | 300,000 ₫ | Hợp lệ | Chấp nhận - Vừa đủ ngưỡng |
| TC_FR09_B3 | `uses` (Upper ON) | `SAVE10` | `uses_count` | 0 lần | Hợp lệ | Chấp nhận |
| TC_FR09_B4 | `uses` (Upper OFF) | `SAVE10` | `uses_count` | 1 lần | Hợp lệ | Từ chối - Đã dùng hết |
| TC_FR09_B5 | `date` (Upper OFF) | `SAVE10` | `current_date` | Đúng bằng `expired_at` | Hợp lệ | Từ chối - Hết hạn |

### Step 6 & 7 — Check & Reconcile
- Đã test sát sạt ranh giới của điều kiện `>` và `>=` để bắt lỗi "Off-by-one" (VD: lập trình viên code nhầm `total > min` thay vì `total >= min`).
- Kết quả OFF khớp hoàn toàn với các class vô hiệu `EC-I4`, `EC-I6`, `EC-I3` bên phần Domain.
