# FR-04: Quản lý hồ sơ cá nhân - Test Design

- Người dùng đã đăng nhập có thể cập nhật: **Họ Tên**, **Số điện thoại**, **Địa chỉ giao hàng mặc định**.
- **Số điện thoại hợp lệ**: bắt đầu bằng số `0`, từ 10–11 chữ số.
- Email không được phép thay đổi qua giao diện.
- Người dùng chỉ có thể cập nhật hồ sơ của chính mình; không thể tự thay đổi thuộc tính `role`.

Áp dụng kỹ thuật Domain Testing dựa theo hướng dẫn từ skill `domain-testing`.

## Step 1 — Variable inventory

Danh sách các biến số (cả hiện trên form và ẩn) tham gia vào chức năng Cập nhật hồ sơ:

| Variable | Type | Rule | Status |
|----------|------|------|--------|
| full_name | string | Bắt buộc (không được rỗng) | assumed |
| phone | string of digits | Bắt đầu bằng `0`; độ dài từ `10` đến `11`; chỉ chứa `0-9` | verified |
| address | string | Bắt buộc (không được rỗng) | assumed |
| role | string/enum | Không được phép thay đổi qua UI | verified |
| email | string | Không được phép thay đổi qua UI | verified |

## Step 2 — Partition into equivalence classes

Phân tách các biến thành các miền tương đương (hợp lệ và không hợp lệ):

**Biến `phone`:**
| Class ID | Kind | Description |
|----------|------|-------------|
| EC-V1 | valid | Bắt đầu bằng `0`, độ dài 10–11, toàn bộ là chữ số |
| EC-I1 | invalid | Ký tự bắt đầu không phải là `0` (VD: `9...`) |
| EC-I2 | invalid | Độ dài < 10 |
| EC-I3 | invalid | Độ dài > 11 |
| EC-I4 | invalid | Chứa ký tự không phải số (chữ cái, khoảng trắng, ký tự đặc biệt) |
| EC-I5 | invalid | Bị bỏ trống (empty) |

**Các biến khác (`full_name`, `address`, `email`, `role`):**
| Class ID | Kind | Description |
|----------|------|-------------|
| EC-V2 | valid | `full_name` hợp lệ (có nội dung) |
| EC-I6 | invalid | `full_name` bị bỏ trống |
| EC-V3 | valid | `address` hợp lệ (có nội dung) |
| EC-I7 | invalid | `address` bị bỏ trống |
| EC-V4 | valid | Payload không chứa `email` và `role` |
| EC-I8 | invalid | Payload cố tình chứa `email` để thử thay đổi |
| EC-I9 | invalid | Payload cố tình chứa `role` = "admin" để thử leo thang đặc quyền |

## Step 3 — Interior representatives

| Class | Representative | Why interior |
|-------|----------------|--------------|
| EC-V1 | `0912345678` | Hợp lệ rõ ràng |
| EC-I1 | `9912345678` | Sai prefix `0` |
| EC-I2 | `0123456` | Ngắn rõ ràng |
| EC-I3 | `0123456789012345` | Dài rõ ràng |
| EC-I4 | `09123abc78` | Cô lập lỗi chứa chữ cái |
| EC-I5 | `` (chuỗi rỗng) | Lỗi thiếu trường bắt buộc |
| EC-I6 | `` (chuỗi rỗng) | Thiếu tên |
| EC-I7 | `` (chuỗi rỗng) | Thiếu địa chỉ |
| EC-I8 | `email: "hacker@eshop.com"` | Thử thay đổi email |
| EC-I9 | `role: "admin"` | Thử thay đổi quyền (leo thang) |

## Step 4 — Expected result per class

| Class | Expected |
|-------|----------|
| EC-V1, V2, V3, V4 | Cập nhật hồ sơ thành công |
| EC-I1..I4 | Từ chối — Lỗi định dạng/độ dài số điện thoại |
| EC-I5 | Từ chối — Không được bỏ trống trường bắt buộc |
| EC-I6..I7 | AMBIGUITY (Trả về 200 do SRS không cấm rõ ràng) |
| EC-I8 | Dữ liệu cập nhật thành công nhưng **email KHÔNG BỊ ĐỔI** (Bỏ qua field email) hoặc Báo lỗi |
| EC-I9 | Dữ liệu cập nhật thành công nhưng **role KHÔNG BỊ ĐỔI** (Bỏ qua field role) hoặc Báo lỗi |

## Step 5 — Domain matrix (single-fault)

| TC_ID | Target Class | Phone | full_name | address | payload ẩn (email/role) | Expected Result |
|---|---|---|---|---|---|---|
| TC_FR04_D1 | EC-V1..V4 | `0912345678` | Nguyễn Văn A | 123 Lê Lợi | Không truyền | Cập nhật thành công |
| TC_FR04_D2 | EC-I1 | `9912345678` | Nguyễn Văn A | 123 Lê Lợi | Không truyền | Từ chối — Lỗi định dạng Phone |
| TC_FR04_D3 | EC-I2 | `0123456` | Nguyễn Văn A | 123 Lê Lợi | Không truyền | Từ chối — Lỗi độ dài Phone |
| TC_FR04_D4 | EC-I3 | `0123456789012345` | Nguyễn Văn A | 123 Lê Lợi | Không truyền | Từ chối — Lỗi độ dài Phone |
| TC_FR04_D5 | EC-I4 | `09123abc78` | Nguyễn Văn A | 123 Lê Lợi | Không truyền | Từ chối — Lỗi định dạng Phone |
| TC_FR04_D6 | EC-I5 | `` | Nguyễn Văn A | 123 Lê Lợi | Không truyền | Từ chối — Phone rỗng |
| TC_FR04_D7 | EC-I6 | `0912345678` | `` | 123 Lê Lợi | Không truyền | AMBIGUITY (Trả về 200, SRS không cấm) |
| TC_FR04_D8 | EC-I7 | `0912345678` | Nguyễn Văn A | `` | Không truyền | AMBIGUITY (Trả về 200, SRS không cấm) |
| TC_FR04_D9 | EC-I8 | `0912345678` | Nguyễn Văn A | 123 Lê Lợi | `email: "hack@eshop.com"` | Thành công nhưng email cũ không đổi |
| TC_FR04_D10| EC-I9 | `0912345678` | Nguyễn Văn A | 123 Lê Lợi | `role: "admin"` | Thành công nhưng role cũ không đổi |

## Step 6 — Coverage check
- Đã test toàn bộ các class từ Step 2. Tất cả quy tắc trong đặc tả đều được test.

## Step 7 — Review & reconcile
- Các điểm yếu bảo mật (đổi email, đổi role) đã được cover.
- Chuyển `phone length` sang BVA.

---

## BVA Workflow cho FR-04 (Thuộc tính Độ dài số điện thoại)

Áp dụng kỹ thuật Boundary Value Analysis (theo chuẩn 7 bước).

### Step 1 — Select
Biến có tính thứ tự: **Độ dài biến `phone`**.

### Step 2 — Bounds
- Giới hạn: `[10, 11]`, Inclusive both ends, Integer step = 1.
- Biên dưới (Lower) = 10, Biên trên (Upper) = 11.

### Step 3 — Enumerate (3-value robust)
Union dedup: **`{9, 10, 11, 12}`**.
- **Lower OFF**: `9`
- **Lower ON**: `10`
- **Upper ON**: `11`
- **Upper OFF**: `12`

### Step 4 & 5 — Boundary matrix
| TC_ID | Point | Phone Length | Test Phone | full_name | address | Expected Result |
|---|---|---|---|---|---|---|
| TC_FR04_B1 | Lower OFF | 9 | `012345678` | Nguyễn Văn A | 123 Lê Lợi | Bị từ chối — Lỗi độ dài |
| TC_FR04_B2 | Lower ON | 10 | `0123456789` | Nguyễn Văn A | 123 Lê Lợi | Cập nhật thành công |
| TC_FR04_B3 | Upper ON | 11 | `01234567890` | Nguyễn Văn A | 123 Lê Lợi | Cập nhật thành công |
| TC_FR04_B4 | Upper OFF | 12 | `012345678901` | Nguyễn Văn A | 123 Lê Lợi | Bị từ chối — Lỗi độ dài |

### Step 6 & 7 — Coverage check & Reconcile
- Đã cover toàn bộ điểm biên.
