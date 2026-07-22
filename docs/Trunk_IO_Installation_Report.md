# Báo cáo cài đặt Trunk.io

## 1. Mục tiêu và phạm vi

Trunk.io được tích hợp vào dự án nhằm cung cấp hai khả năng:

- **Code Quality:** chạy thống nhất các công cụ kiểm tra mã nguồn ở máy local và GitHub Actions.
- **Flaky Tests:** thu thập báo cáo JUnit từ toàn bộ test suite để phân tích độ ổn định của test.

Phạm vi triển khai gồm GitHub Actions và cấu hình local trong repository. Jenkins không được thay đổi. Cơ chế quarantine chưa được bật nên Trunk không được phép thay đổi kết quả pass/fail của test.

## 2. Khảo sát hiện trạng

Dự án là một monorepo JavaScript gồm:

- Backend Express/SQLite, kiểm thử bằng Mocha.
- Hai frontend React/Vite, kiểm tra mã nguồn bằng ESLint và smoke test bằng Playwright.
- Ứng dụng mobile Expo/React Native, kiểm thử bằng Jest.
- Hai hệ thống CI: GitHub Actions và Jenkins.

Trước khi triển khai, repository chưa có Trunk CLI hoặc thư mục `.trunk`. Hai frontend đã có cấu hình ESLint riêng; backend spec và flaky suite đã tạo JUnit, nhưng guard, Playwright và Jest chưa tạo báo cáo tương thích với Trunk.

## 3. Cài đặt Trunk CLI

Trunk launcher được thêm vào root project bằng NPM:

```powershell
npm install --save-dev @trunkio/launcher
```

Các phiên bản được sử dụng:

```text
@trunkio/launcher 1.3.4
Trunk CLI 1.25.0
```

Các script sau được thêm vào `package.json`:

```json
{
  "scripts": {
    "trunk": "trunk",
    "lint": "trunk check",
    "lint:all": "trunk check --all"
  }
}
```

Cách sử dụng:

```powershell
npm run trunk -- --version
npm run lint
npm run lint:all
```

## 4. Cấu hình Trunk Code Quality

Lần chạy `trunk init` đầu tiên quét monorepo quá lâu do workspace chứa nhiều dependency và artifact. Quá trình quét tự động được dừng và cấu hình được giới hạn theo bộ kiểm tra đã lựa chọn.

File `.trunk/trunk.yaml` được cấu hình với:

- Trunk CLI `1.25.0`.
- Plugin Trunk `v1.10.2`.
- Base branch `main` để Trunk thực hiện hold-the-line.
- Node runtime `22.16.0`.
- `eslint@10.3.0` cho hai frontend.
- `actionlint@1.7.8` cho GitHub Actions workflow.
- `git-diff-check` để phát hiện conflict marker và lỗi whitespace.

Các thư mục sinh tự động được bỏ qua, gồm `node_modules`, `coverage`, `reports`, `.nyc_output`, `dist`, `playwright-report` và `test-results`.

ESLint được giới hạn ở `frontend-web` và `frontend-admin`; cấu hình Trunk không áp quy tắc ESLint mới lên backend, tests hoặc mobile.

File `.trunk/setup-ci/action.yaml` được thêm để cài dependency của hai frontend trước khi Trunk chạy ESLint trên GitHub Actions:

```yaml
name: Set up Trunk Code Quality
description: Install the existing frontend ESLint dependencies before Trunk runs.
runs:
  using: composite
  steps:
    - name: Install frontend-web dependencies
      shell: bash
      run: npm ci --prefix frontend-web
    - name: Install frontend-admin dependencies
      shell: bash
      run: npm ci --prefix frontend-admin
```

## 5. Thiết lập Code Quality workflow

Workflow `.github/workflows/trunk-check.yml` được tạo để chạy khi:

- Có pull request vào `main`.
- Có push lên `main`.
- Workflow được chạy thủ công.

Job sử dụng action chính thức:

```yaml
- name: Run Trunk Code Quality
  uses: trunk-io/trunk-action@v1
  with:
    post-annotations: true
```

Quyền của job được giới hạn ở:

```yaml
permissions:
  checks: write
  contents: read
```

Workflow là quality gate bắt buộc ở cấp job: nếu phần thay đổi tạo lỗi mới, job Trunk sẽ thất bại. Để ngăn merge PR khi job này fail, repository cần thêm check `Trunk Code Quality` vào branch protection hoặc ruleset của `main`.

## 6. Chuẩn hóa báo cáo JUnit

### 6.1. Backend Mocha

Script `test:coverage` được bổ sung `mocha-junit-reporter` để đồng thời tạo coverage và báo cáo:

```text
reports/guard.xml
```

Hai báo cáo đã có từ trước được giữ nguyên:

```text
reports/spec.xml
reports/flaky.xml
```

### 6.2. Playwright

`frontend-web/playwright.config.js` và `frontend-admin/playwright.config.js` được cấu hình để khi `CI=true`, Playwright dùng đồng thời reporter `list` và `junit`:

```javascript
reporter: process.env.CI
  ? [['list'], ['junit', { outputFile: '../reports/playwright.xml' }]]
  : 'list'
```

Mỗi matrix job chạy trong runner độc lập nên có thể dùng cùng đường dẫn `reports/playwright.xml` mà không gây xung đột.

### 6.3. Jest mobile

Package `jest-junit@17.0.0` và script sau được thêm vào `frontend-mobile/package.json`:

```json
{
  "scripts": {
    "test:ci": "jest --ci --reporters=default --reporters=jest-junit"
  }
}
```

Reporter xuất `reports/mobile.xml`. Tùy chọn `reportTestSuiteErrors` được bật để lỗi khiến Jest không khởi động được test suite vẫn xuất hiện dưới dạng `errors=1` thay vì tạo báo cáo rỗng.

## 7. Tích hợp Trunk Flaky Tests vào GitHub Actions

Workflow `.github/workflows/ci.yml` được bổ sung uploader sau năm nhóm test job:

1. Backend guard.
2. Backend spec.
3. Flaky suite.
4. Playwright web/admin.
5. Mobile Jest.

Mẫu cấu hình uploader:

```yaml
- name: Upload test results to Trunk.io
  if: ${{ !cancelled() }}
  continue-on-error: true
  uses: trunk-io/analytics-uploader@v1
  with:
    junit-paths: reports/example.xml
    org-slug: ${{ secrets.TRUNK_ORG_URL_SLUG }}
    token: ${{ secrets.TRUNK_API_TOKEN }}
```

`continue-on-error` chỉ áp dụng cho bước upload. Exit code của test và chính sách must-pass/allowed-fail hiện có không bị Trunk thay đổi.

Không có token thật nào được ghi vào repository. GitHub cần được cấu hình hai secrets:

```text
TRUNK_ORG_URL_SLUG
TRUNK_API_TOKEN
```

## 8. Các vấn đề được phát hiện và xử lý

### 8.1. Backend dependency chưa được cài trong GitHub Actions

Các backend job trước đây chỉ chạy `npm ci` ở root, trong khi Express, SQLite và các dependency backend nằm trong `backend/package.json`. Bước `npm ci` với `working-directory: backend` được thêm vào các job cần chạy backend hoặc backend test.

### 8.2. Cách khởi động backend trong web smoke job

Workflow trước đây gọi trực tiếp `cross-env` từ shell. Bước này được đổi thành chạy Node và truyền `DB_PATH`, `PORT` qua `env` của GitHub Actions.

### 8.3. Lockfile frontend không đồng bộ

Cả `frontend-web/package-lock.json` và `frontend-admin/package-lock.json` không đồng bộ với `package.json`, khiến `npm ci` thất bại. Hai lockfile được đồng bộ lại mà không thay đổi version khai báo trong `package.json`. Sau đó `npm ci` đã chạy thành công cho cả hai frontend.

### 8.4. Peer dependency của mobile

Mobile có xung đột peer dependency Expo/React tồn tại từ trước. GitHub Actions dùng:

```powershell
npm ci --legacy-peer-deps
```

Cách xử lý này thống nhất với chính sách đã được dùng trong Jenkinsfile và không ép nâng cấp React hoặc Expo.

### 8.5. Sai cổng Playwright admin

Vite admin chạy ở cổng `5174`, nhưng Playwright admin trước đây chờ cổng `5173`. `baseURL` và `webServer.url` được sửa sang `http://localhost:5174`. Sau thay đổi, admin smoke test đã pass.

### 8.6. ESLint không nhận biết Node globals

Sau khi thêm kiểm tra `process.env.CI`, ESLint báo `process is not defined` trong Playwright config. Hai file `eslint.config.js` được bổ sung Node globals riêng cho `playwright.config.js`.

### 8.7. Artifact coverage bị thay đổi trong lúc kiểm thử

Chạy coverage cục bộ đã cập nhật các artifact được track trong `coverage` và `.nyc_output`. Các thay đổi sinh tự động này được hoàn nguyên vì không thuộc phạm vi tích hợp Trunk.

## 9. Kết quả nghiệm thu

### 9.1. Trunk Code Quality

Lệnh kiểm tra phần thay đổi:

```powershell
npm run lint
```

Kết quả:

```text
Checked 76 modified files
No issues
```

Lệnh kiểm kê toàn bộ repository:

```powershell
npm run lint:all
```

Kết quả phát hiện 28 lỗi ESLint có sẵn trong frontend. Các lỗi này không được sửa hoặc format hàng loạt; hold-the-line chỉ ngăn lỗi mới xuất hiện trong phần thay đổi.

### 9.2. Test và JUnit

| Test suite | Kết quả | Trạng thái JUnit |
|---|---:|---|
| Backend guard | 11 pass, 0 failure | Hợp lệ |
| Backend spec | 14 test, 14 failure có sẵn | Hợp lệ |
| Flaky suite | 1 pass | Hợp lệ |
| Admin Playwright | 1 pass | Hợp lệ |
| Web Playwright | 1 pass, 1 failure có sẵn | Hợp lệ |
| Mobile Jest | Lỗi tương thích Jest/Expo có sẵn | Hợp lệ, `errors=1` |

Web Playwright vẫn phát hiện lỗi login input chưa có `type="email"`. Mobile vẫn có xung đột runtime giữa Jest 30 và preset Expo. Đây là các vấn đề có sẵn của ứng dụng và không được sửa trong phạm vi cài Trunk.

## 10. Kiểm tra an toàn và dependency

- Không có Trunk token hoặc organization slug thật trong mã nguồn.
- Không bật quarantine.
- Không sửa Jenkinsfile.
- Không sửa các tài liệu chưa track có sẵn của người dùng.
- Không chạy `npm audit fix` vì thao tác này có thể nâng cấp dependency ngoài phạm vi.

NPM audit hiện báo:

- Root: 4 vulnerability.
- Mỗi frontend web/admin: 7 vulnerability.
- Mobile: 18 vulnerability.

Các cảnh báo này thuộc dependency tree hiện tại và cần được xử lý trong một thay đổi riêng.

## 11. Việc còn lại trên GitHub và Trunk.io

Các bước cần thông tin tài khoản của chủ repository nên chưa được thực hiện cục bộ:

1. Tạo hoặc chọn organization trên Trunk.io.
2. Kết nối GitHub repository với organization.
3. Tạo GitHub Actions secrets `TRUNK_ORG_URL_SLUG` và `TRUNK_API_TOKEN`.
4. Push thay đổi và chạy GitHub Actions workflow.
5. Xác nhận các lần upload xuất hiện trong Trunk Flaky Tests.
6. Thêm check `Trunk Code Quality` vào branch protection hoặc ruleset của `main` nếu muốn bắt buộc quality gate trước khi merge.

## 12. Danh sách file chính được thay đổi

- `.trunk/trunk.yaml`
- `.trunk/setup-ci/action.yaml`
- `.github/workflows/trunk-check.yml`
- `.github/workflows/ci.yml`
- `package.json` và root `package-lock.json`
- `frontend-web/eslint.config.js`
- `frontend-web/playwright.config.js`
- `frontend-web/package-lock.json`
- `frontend-admin/eslint.config.js`
- `frontend-admin/playwright.config.js`
- `frontend-admin/package-lock.json`
- `frontend-mobile/package.json`
- `frontend-mobile/package-lock.json`
