# Test Harness — EShop API Suites

API-level domain-testing & BVA suites for the 4 selected features (one per pool).

| Pool | Feature | Suite | Test cases doc | Results |
|------|---------|-------|----------------|---------|
| A | FR-04 Hồ sơ cá nhân | `api/legacy/FR04_profile.test.js` | `docs/test-cases/FR04_TestCases.md` | `docs/test-results/FR04_TestResults.md` |
| B | FR-09 Mã giảm giá | `api/legacy/FR09_coupon.test.js` | `docs/test-cases/FR09_TestCases.md` | `docs/test-results/FR09_TestResults.md` |
| C | FR-15 Quản lý sản phẩm | `api/legacy/FR15_product.test.js` | `docs/test-cases/FR15_TestCases.md` | `docs/test-results/FR15_TestResults.md` |
| D | FR-20 (Mobile) Đăng nhập & Khóa | `api/legacy/FR20_login.test.js` | `docs/test-cases/FR20_TestCases.md` | `docs/test-results/FR20_TestResults.md` |

## Chạy

```bash
# 1. Cài deps backend (một lần)
cd backend && npm install && cd ..

# 2. Seed + khởi động backend (giữ terminal này chạy)
node backend/database.js         # tạo & seed database.sqlite
node backend/server.js           # lắng nghe http://localhost:3000

# 3. Terminal khác — chạy từ THƯ MỤC GỐC của project (đường dẫn ghi kết quả là tương đối)
node tests/api/legacy/FR04_profile.test.js
node tests/api/legacy/FR09_coupon.test.js
node tests/api/legacy/FR15_product.test.js
node tests/api/legacy/FR20_login.test.js   # có chờ 31s để kiểm mở khóa

# 4. CHẠY QUA FRAMEWORK (CI/CD)
# Yêu cầu cài đặt npm install ở gốc dự án
npm run test:spec
npm run test:guard
```

Mỗi suite tự ghi lại file kết quả `docs/test-results/<FR>_TestResults.md` kèm bảng **Tổng kết**.

## Cách ly test (Test isolation)

Mỗi suite gọi `await reseed()` (`tests/helpers/reseed.js`) ở đầu và trước mỗi khối BVA để
đưa database về đúng trạng thái seed, **độc lập với thứ tự chạy**. Điều này khắc phục lỗi
"ô nhiễm dữ liệu chéo" giữa các suite (VD user bị đổi tên/điện thoại từ suite FR-04 làm sai
kết quả FR-20). `reseed()` cũng nạp thêm coupon `LOCKEDCODE` (`is_active=0`) để test lớp
tương đương EC-I2 của FR-09.

## Nhãn kết quả (QA/QC)

- **✅ PASS** — hành vi đúng đặc tả đã *verified*.
- **❌ FAIL (BUG)** — vi phạm một quy tắc **đã xác nhận** → xem `docs/BugReport.md`.
- **⚠️ AMBIGUITY** — đặc tả không quy định rõ; **không** báo là bug, ghi nhận để hỏi chủ sản
  phẩm (kỷ luật: không báo bug trên quy tắc chưa xác nhận).

## Test Summary Report

Thực thi ngày 2026-07-07, backend Node local.

| Feature | Thiết kế | Thực thi | PASS | FAIL (BUG) | AMBIGUITY | Not executed |
|---------|----------|----------|------|------------|-----------|--------------|
| FR-04 | 14 | 14 | 4 | 8 | 2 | 0 |
| FR-09 | 13 | 13 | 10 | 3 | 0 | 0 |
| FR-15 | 19 | 19 | 5 | 14 | 0 | 0 |
| FR-20 | 13 | 13 | 9 | 4 | 0 | 0 |
| **Tổng** | **59** | **59** | **28** | **29** | **2** | **0** |

**Số bug riêng biệt phát hiện: 10** (BUG-01 … BUG-10, xem `docs/BugReport.md`). Nhiều test
FAIL cùng phơi bày một bug gốc (VD 6 test phone FR-04 → BUG-05; 10 test FR-15 → BUG-09/10).

Bug nổi bật (Critical): BUG-04 leo thang quyền role (FR-04), BUG-06 sai công thức giảm giá
(FR-09), BUG-09 thiếu access control Product API (FR-15). FR-20 lần này bắt được lỗi bộ đếm
`+2` và khóa sớm mà bộ test trước bỏ lọt.
