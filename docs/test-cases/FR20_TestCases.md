# FR-20 (Pool D — Mobile App): Đăng nhập & Khóa tài khoản - Test Design

> **Pool D — Mobile.** Ứng dụng Mobile (React Native) dùng chung luồng đăng nhập với Web qua
> API `POST /api/login` (FR-20). Các ràng buộc nghiệp vụ đăng nhập & khóa tài khoản được đặc
> tả tại FR-02 và áp dụng nguyên vẹn cho Mobile.

## Yêu cầu hệ thống (Trích xuất từ README.md — FR-02, áp dụng cho Mobile FR-20)

- Người dùng nhập Email và Mật khẩu.
- Sau mỗi lần đăng nhập sai, hệ thống tăng bộ đếm lên **đúng 1 đơn vị**.
- Nếu đăng nhập sai từ **3 lần trở lên** liên tiếp, tài khoản bị tạm khóa **30 giây** (demo).
- Đăng nhập thành công trả về JWT Token.
- Trường email dùng `type="email"` (validate định dạng HTML5 ở tầng giao diện — FR-22).

---

## Phần 1: Domain Testing Workflow

### Step 1 — Variable inventory

| Variable | Type | Rule | Status |
|----------|------|------|--------|
| `email` | string | Bắt buộc; tồn tại trong DB. Định dạng validate ở UI (FR-22) | verified |
| `password` | string | Bắt buộc; khớp với email | verified |
| `login_attempts` | state (Ordered) | Tăng đúng +1 mỗi lần sai; khóa khi `>= 3` | verified |
| `locked_until` | state (Ordered) | Nếu có, thời điểm mở khóa = thời điểm khóa + 30s | verified |

### Step 2 — Partition into equivalence classes

- **`email`**:
  - `EC-V1`: Tồn tại trong hệ thống.
  - `EC-I1`: Định dạng sai (VD `test_eshop.com`) — *validate ở UI; tại API = không tồn tại*.
  - `EC-I2`: Đúng định dạng nhưng không tồn tại (`fake@eshop.com`).
  - `EC-I3`: Bỏ trống.
- **`password`**:
  - `EC-V2`: Khớp với email.
  - `EC-I4`: Sai mật khẩu.
  - `EC-I5`: Bỏ trống.
- **`login_attempts`**:
  - `EC-V3`: `attempts < 3` (chưa khóa).
  - `EC-I6`: `attempts >= 3` (đang khóa).
- **`locked_until`**:
  - `EC-V4`: `locked_until < now` (đã hết khóa).
  - `EC-I7`: `locked_until >= now` (đang trong 30s khóa).

### Step 3 & 4 — Representative & Expected results

| Class | Representative | Expected |
|-------|----------------|----------|
| `EC-V1..V4` | Email đúng, pass đúng, chưa khóa | 200 + JWT |
| `EC-I1` | `test_eshop.com` | **Tại API**: 401 (giống không tồn tại). Định dạng chặn ở UI (FR-22) |
| `EC-I2` | `fake@eshop.com` | 401 — "Sai email hoặc mật khẩu" (không lộ nguyên nhân) |
| `EC-I3` | `""` | 401 |
| `EC-I4` | `WrongPass` | 401 |
| `EC-I5` | `""` (password) | 401 |
| `EC-I6, I7` | Đang khóa | 403 — Tài khoản tạm khóa |

> **Ghi chú QA (reclassify `EC-I1`):** Đặc tả đặt việc validate *định dạng* email ở tầng UI
> (`type="email"`, FR-22), không phải ở API `/api/login`. Vì vậy việc API trả 401 cho email
> sai định dạng là **đúng**, không tính là bug. Case UI cần được kiểm ở test giao diện.

### Step 5 — Domain matrix (Single-fault)

| TC_ID | Target Class | Email | Password | Trạng thái | Expected |
|---|---|---|---|---|---|
| TC_FR20_D1 | V1,V2,V3 | `test@eshop.com` | `Test1234!` | attempts=0 | 200 + JWT |
| TC_FR20_D2 | I1 (UI-layer) | `test_eshop.com` | `Test1234!` | attempts=0 | 401 (định dạng chặn ở UI) |
| TC_FR20_D3 | I2 | `fake@eshop.com` | `Test1234!` | attempts=0 | 401 |
| TC_FR20_D4 | I4 | `test@eshop.com` | `WrongPass` | attempts=0 | 401 |
| TC_FR20_D5 | I3 | `""` | `Test1234!` | attempts=0 | 401 |
| TC_FR20_D6 | I5 | `test@eshop.com` | `""` | attempts=0 | 401 |
| TC_FR20_D7 | I6, I7 | `test@eshop.com` | `Test1234!` | attempts=3, locked_until >= now | 403 Tài khoản đang bị tạm khóa |


---

## Phần 2: Boundary Value Analysis (BVA) Workflow

### Step 1 — Select
Biến thứ tự: `login_attempts` (ngưỡng khóa) và bước tăng bộ đếm.

### Step 2 — Bounds
- Bước tăng bộ đếm: **đúng +1** mỗi lần sai (bất biến cần kiểm trực tiếp).
- Ngưỡng khóa `login_attempts`: `[3, +∞)`, **inclusive lower** (`>= 3`), step = 1 lần sai.
- Thời lượng khóa: **30 giây**.

### Step 3 — Enumerate (ON/OFF + bất biến bộ đếm)
- **Bộ đếm**: sau 1 lần sai, `login_attempts` phải = **1** (không phải 2).
- **Ngưỡng khóa `>= 3`**:
  - **OFF (2 lần sai)**: chưa khóa → đăng nhập đúng phải **thành công**.
  - **ON (lần sai thứ 3)**: response vẫn 401 nhưng kích hoạt khóa; **request thứ 4** bị chặn 403.
- **Thời lượng**: chờ 31s (> 30s) → phải tự mở khóa.

### Step 4 & 5 — Boundary matrix

| TC_ID | Target | Hành động | Expected |
|---|---|---|---|
| TC_FR20_B_COUNT | Bước đếm | Reseed; sai 1 lần; đọc `login_attempts` qua admin API | `login_attempts = 1` |
| TC_FR20_B1 | OFF | Reseed; sai lần 1 | 401, chưa khóa |
| TC_FR20_B2 | OFF | Sai lần 2 | 401, chưa khóa |
| TC_FR20_B3 | OFF-verify | Đăng nhập **đúng** sau 2 lần sai | **200 thành công** (mới sai 2 < 3) |
| TC_FR20_B4 | ON | Reseed; sai đúng lần 3 | 401 (response của lần kích hoạt khóa) |
| TC_FR20_B5 | Robust | Request thứ 4 khi đã khóa | 403 tạm khóa |
| TC_FR20_B6 | Duration | Chờ 31s; đăng nhập đúng | 200 (khóa 30s đã hết) |

### Step 6 & 7 — Check & Reconcile
- **Bẫy lỗi trọng tâm:** nếu DEV code `attempts + 2` (thay vì `+1`) hoặc khóa ở ngưỡng sai,
  thì: (a) `TC_FR20_B_COUNT` lộ bộ đếm nhảy 2; (b) `TC_FR20_B3` lộ việc bị khóa quá sớm (sau
  2 lần thay vì 3). Bộ test cũ chỉ kiểm HTTP status ở lần thứ 3 nên **không phát hiện** được
  hai lỗi này — đã bổ sung để đóng điểm mù.
- Điểm OFF (2) khớp class `EC-V3`; điểm ON (>=3) khớp `EC-I6/I7`.
