# EShop — Project Documentation

Reference documentation for the `CI-CD_and_Test-Harness_Engineering` repo: what it is, how to
run it locally, how its test suites work, and how its three CI/CD pipelines (GitHub Actions,
Jenkins, GitLab CI) are wired.

---

## 1. Project Overview

### 1.1 What it is

EShop is a deliberately-buggy e-commerce system used as the **System Under Test (SUT)** for a
software-testing / CI-CD-engineering course (T07 seminar, HW02). It is a monorepo with four
runnable apps plus a test harness:

- A functional e-commerce flow (browse → cart → checkout → coupon → order status).
- An admin back-office (products, categories, coupons, orders, users).
- A mobile client (Expo/React Native) covering the same core flows.
- **12 intentionally-planted bugs** (`docs/BugReport.md`) spanning broken auth logic,
  privilege escalation, SQL injection surface, a wrong discount formula, and missing
  input validation. Tests exist to *document* these bugs, not hide them — see
  [§3.2](#32-two-suite-bug-policy-specguard).

The `README.md` at repo root is the System Requirements Specification (Vietnamese, FR-01…FR-24
+ SEC-01…SEC-07) — the ground truth that test cases are written against. `docs/CI-CD_Handoff.md`
is the design/build handoff for the test-harness + CI work and is the most detailed internal doc;
this file summarizes and extends it for onboarding.

### 1.2 Architecture

```
                       ┌─────────────────────────┐
                       │   backend/ (Express 5)   │
                       │  server.js → app.js      │  SQLite (database.sqlite)
                       │  JWT auth, REST API      │  no ORM, raw sqlite3 driver
                       └───────────┬─────────────┘
                                   │ HTTP (localhost:3000)
        ┌──────────────────────────┼──────────────────────────┐
        │                          │                          │
┌───────▼────────┐       ┌─────────▼────────┐        ┌────────▼────────┐
│ frontend-web    │       │ frontend-admin   │        │ frontend-mobile │
│ React 19 + Vite │       │ React 19 + Vite  │        │ Expo / RN 0.81  │
│ :5173           │       │ :5174 (skeleton) │        │ LAN IP:3000     │
└─────────────────┘       └──────────────────┘        └─────────────────┘

                    tests/  (separate from the apps)
                    ├── api/spec    — mocha+chai+supertest, asserts the SPEC (allowed-fail)
                    ├── api/guard   — asserts CURRENT behavior, characterization (must-pass)
                    ├── api/legacy  — raw Node http scripts, self-writes docs/test-results/*.md
                    ├── api/flaky   — intentional non-deterministic test (CI teaching aid)
                    └── helpers/    — reseed.js (DB reset), supertest-app.js (in-process app)
```

Key architectural point: `backend/app.js` exports the Express `app` **without** calling
`.listen()`; `backend/server.js` only listens when run as the entrypoint
(`require.main === module`). This lets the test suites `require()` the app and drive it
in-process via `supertest`, with no real server/port needed for API tests.

### 1.3 Tech stack

| Layer | Stack | Notes |
|---|---|---|
| Backend | Node.js, Express 5, `sqlite3` (raw), `jsonwebtoken`, `cors`, `body-parser` | No test script of its own; tested from the root harness |
| Frontend Web | React 19, Vite 8, React Router 7, Tailwind CSS, axios | Full shopping flow (Login/Register/Home/ProductDetail/Cart/Checkout/Profile/ForgotPassword) |
| Frontend Admin | React 19, Vite 8, Tailwind CSS | Skeleton app (`App.jsx` + `main.jsx`); scaffold/smoke only |
| Mobile | Expo ~54, React Native 0.81 | Single-file `App.js`, hardcodes a LAN IP for the API base URL |
| API test harness | Mocha 10, Chai 4, Supertest 6, `mocha-junit-reporter`, `nyc` (Istanbul), `cross-env` | Root-level `package.json`; CJS-only (Chai pinned to v4 because v5 is ESM-only) |
| Web/Admin E2E | Playwright | `webServer` auto-boots `npm run dev` per app |
| Mobile tests | Jest 30 + `jest-expo` preset + React Native Testing Library | Mocks `fetch` (App fetches on mount) |
| CI/CD | GitHub Actions, Jenkins (Declarative Pipeline), GitLab CI | Three parallel, stage-for-stage equivalent pipelines — see §4 |

### 1.4 Modules

- **`backend/`** — `app.js` (all routes), `server.js` (listen wrapper), `database.js` (schema +
  seed, path driven by `DB_PATH` env var), `test_profile.js`, `database.sqlite` (dev DB).
- **`frontend-web/`** — pages under `src/pages/`, `AuthContext`/`CartContext` for state,
  Playwright e2e under `e2e/`.
- **`frontend-admin/`** — near-empty Vite scaffold; Playwright "boots" smoke test only.
- **`frontend-mobile/`** — single `App.js`; Jest smoke test mocks the network call.
- **`tests/`** — the framework-based harness (see §3) plus the original raw-script harness
  kept for grading continuity.
- **`docs/`** — SRS is at repo root `README.md`; `docs/` holds API spec, bug report, per-feature
  test cases/results, user guide, and process docs (checklist, handoff, seminar plan).

---

## 2. Local Setup & Run

### 2.1 Prerequisites

- Node.js ≥ 18 (CI pins Node 20; use 20 locally to match).
- npm (bundled with Node).
- Optional: Expo Go app on a phone (or an Android/iOS emulator) for the mobile client.

### 2.2 Install & seed the backend

```bash
cd backend
npm install
node database.js        # creates + seeds database.sqlite (run once, or to reset data)
node server.js           # http://localhost:3000 — keep this terminal open
```

Default accounts seeded: `admin@eshop.com` / `Admin123!` (admin), `test@eshop.com` /
`Test1234!` (user).

### 2.3 Run the frontends (each in its own terminal)

```bash
cd frontend-web && npm install && npm run dev      # http://localhost:5173
cd frontend-admin && npm install && npm run dev     # http://localhost:5174
cd frontend-mobile && npm install && npx expo start # scan QR with Expo Go, or press a/i
```

`run_servers.sh` at repo root is a convenience script to boot backend + web together.

### 2.4 Environment configuration

- **`DB_PATH`** — points `backend/database.js` (and `tests/helpers/reseed.js`) at a SQLite
  file. Dev default: `backend/database.sqlite`. Tests always override this to
  `backend/test.sqlite` (via `cross-env DB_PATH=backend/test.sqlite ...`) to avoid clobbering
  dev data.
- **`PORT`** — backend listen port, default `3000`.
- **`SECRET_KEY`** — JWT signing secret; currently hardcoded in `app.js` (`"super_secret_key..."`)
  — a known weakness, not something to "fix" in this repo (see BUG list / SEC requirements,
  which the bug-hunting exercise is meant to surface).
- No `.env` file is used; there's nothing to copy/rename before running.

### 2.5 Install the root test harness (needed for CI-equivalent local runs)

```bash
npm install            # root package.json: mocha, chai, supertest, nyc, cross-env, reporters
```

---

## 3. Test Suites

### 3.1 Layout

| Suite | Path | Framework | Gate |
|---|---|---|---|
| Backend guard | `tests/api/guard/` | Mocha + Chai + Supertest | **must-pass** |
| Backend spec | `tests/api/spec/` | Mocha + Chai + Supertest | allowed-fail |
| Backend flaky | `tests/api/flaky/` | Mocha + Chai | allowed-fail (teaching aid) |
| Backend legacy | `tests/api/legacy/` | raw Node `http` scripts | not run in CI |
| Web/Admin E2E | `frontend-web/e2e/`, `frontend-admin/e2e/` | Playwright | must-pass |
| Mobile | `frontend-mobile/__tests__/` | Jest + `jest-expo` + RNTL | must-pass |

### 3.2 Two-suite bug policy (spec/guard)

Because the backend has 12 known bugs and the goal is to *document* them, not silently "fix"
them via test avoidance, the harness splits backend API tests into two suites with opposite
intents (see `docs/CI-CD_Handoff.md` §4):

- **`spec/`** (`tests/api/spec/FR04.spec.js`, `FR09.spec.js`, `FR15.spec.js`, `FR20.spec.js`) —
  asserts what the SRS *says should happen*. E.g. `FR04.spec.js` expects an invalid phone number
  to be rejected with 4xx — it currently fails, because the backend has no phone validation
  (BUG-05). This suite is **allowed to fail**; its red output is the bug evidence, uploaded as a
  JUnit artifact for review.
- **`guard/`** (`tests/api/guard/behavior.guard.spec.js`) — asserts the CURRENT, actual (buggy)
  behavior as a characterization test, e.g. "posting `role: 'admin'` as a normal user actually
  does escalate the role today" (BUG-04). This is **must-pass**: if a future change accidentally
  fixes or worsens behavior, this suite catches the regression immediately, independent of
  whether that behavior is "correct."

Both suites share `tests/helpers/supertest-app.js` (in-process Express app, no server needed)
and call `reseed()` (`tests/helpers/reseed.js`) in `beforeEach` to reset SQLite to seed state —
critical because all suites share one `DB_PATH=backend/test.sqlite` file and must not leak state
across tests (e.g. a phone number changed by an FR-04 test must not affect an FR-20 login-lock
count).

### 3.3 Flaky suite (`tests/api/flaky/timing.flaky.test.js`)

A deliberately non-deterministic test: it sleeps a random 0–80ms and asserts completion under a
50ms budget (~40% failure rate). It is isolated in its own directory and **never** part of the
must-pass gate — its purpose is pedagogical, to give students a real flaky-CI signal to triage
(see `docs/Activity_Worksheet.md`, the "Paired Triage: Manual vs AI" exercise) without it ever
blocking a merge.

### 3.4 Legacy suite (`tests/api/legacy/`)

The original hand-rolled scripts (`FR04_profile.test.js`, `FR09_coupon.test.js`,
`FR15_product.test.js`, `FR20_login.test.js`) predate the framework harness. They use the raw
`http` module against a *running* server, never throw/exit non-zero (so they can't gate CI), and
self-write graded result tables to `docs/test-results/<FR>_TestResults.md`. They are preserved
and kept runnable for that reporting purpose, but excluded from CI gating.

### 3.5 Frontend suites

- **Playwright** (`frontend-web/e2e/home.smoke.spec.js`, `frontend-admin/e2e/boots.smoke.spec.js`):
  config auto-starts `npm run dev` as a `webServer` and points `baseURL` at the app's dev port.
  Web smoke visits `/` and checks the product grid/heading render, and that `/login` shows
  email+password fields. Admin smoke just checks the skeleton app boots. Scope is intentionally
  scaffold + smoke only — no full E2E flows yet (see handoff §4).
- **Jest/RNTL** (`frontend-mobile/__tests__/App.smoke.test.js`): mocks `global.fetch` (the app
  fetches on mount against a hardcoded LAN IP) and asserts the component renders without
  throwing.

### 3.6 Running tests

```bash
# Root-level (needs root `npm install` first, and a seeded backend/test.sqlite via reseed):
npm run test:guard      # must-pass backend suite
npm run test:spec       # allowed-fail backend suite, writes reports/spec.xml
npm run test:coverage   # guard suite + Istanbul coverage (html/json-summary/cobertura/text)
npm run test:flaky      # flaky demo suite, writes reports/flaky.xml

# Per-frontend Playwright:
cd frontend-web && npx playwright test
cd frontend-admin && npx playwright test

# Mobile Jest:
cd frontend-mobile && npm test

# Legacy raw-http scripts (needs a running backend, run from repo root):
node backend/database.js && node backend/server.js &
node tests/api/legacy/FR04_profile.test.js
node tests/api/legacy/FR09_coupon.test.js
node tests/api/legacy/FR15_product.test.js
node tests/api/legacy/FR20_login.test.js   # waits 31s to verify auto-unlock
```

---

## 4. CI/CD Configs

Three pipelines exist side by side, deliberately built stage-for-stage equivalent so they serve
as a comparison exercise (GitHub Actions "modern CI" vs Jenkins "traditional CI" vs GitLab CI).
All three: install Node deps, run the must-pass guard suite, run the allowed-fail spec/flaky
suites, then run Playwright smoke tests (web+admin) and the mobile Jest smoke test.

### 4.1 GitHub Actions — `.github/workflows/ci.yml`

Triggers: `push` to any branch, `pull_request` to any branch, and manual `workflow_dispatch`.

| Job | Gate | What it does |
|---|---|---|
| `backend-guard` | must-pass | `npm ci` → `npm run test:coverage` → generates a coverage badge (`npx make-coverage-badge`) → **commits `coverage/badge.svg` back to the branch** via `stefanzweifel/git-auto-commit-action`, with `[skip ci]` in the message to avoid a trigger loop. Needs `permissions: contents: write`. |
| `backend-spec` | `continue-on-error: true` | Runs `npm run test:spec`; always uploads `reports/spec.xml` as a build artifact (`spec-test-results`), even on failure, via `actions/upload-artifact` + `if: always()`. |
| `flaky-watch` | `continue-on-error: true` | Runs the flaky suite once per CI run; uploads `reports/flaky.xml` under a run-numbered artifact name (`flaky-run-${{ github.run_number }}`) so ten separate workflow runs produce ten separate downloadable artifacts — the mechanism behind the "10-run flaky capture" exercise. |
| `web-smoke` | must-pass | `strategy.matrix: app: [frontend-web, frontend-admin]` fans this job into two parallel runs. Installs root + app deps, installs Playwright browsers (`--with-deps`), starts the backend in the background (`DB_PATH=backend/test.sqlite node backend/server.js &`), then runs `npx playwright test` inside the app dir. |
| `mobile-smoke` | must-pass | Installs mobile deps, runs `npm test` (Jest). |

Notes:
- `actions/setup-node@v4` with `cache: 'npm'` caches `node_modules` keyed on the lockfile —
  the main source of GHA's speed advantage over the other two pipelines here.
- The coverage-badge auto-commit is GHA-specific (needs a first-party token with write access);
  it is intentionally **not** replicated in Jenkins/GitLab — see their coverage handling instead.

### 4.2 Jenkins — `Jenkinsfile` (Declarative Pipeline)

Explicitly documented in its header comment as mirroring `ci.yml` stage-for-stage, with two
named GHA→Jenkins feature translations:
`continue-on-error: true` → `catchError(stageResult: 'UNSTABLE')`, and
`upload-artifact` → `junit` + the Coverage plugin.

```
Checkout → NPM Install → Guard (must-pass) → Coverage (Cobertura)
         → Spec (allowed-fail) → Flaky x10 (evidence) → Web & Admin Smoke (matrix) → Mobile Smoke
```

| Stage | Behavior |
|---|---|
| `tools { nodejs 'node20' }` | Requires a NodeJS tool named exactly `node20` configured in *Manage Jenkins → Tools* — Jenkins has no built-in Node runtime like GHA's `setup-node`. |
| `NPM Install` | `npm ci --cache .npm-cache --prefer-offline`. Cache parity note in comments: GHA's cache is lockfile-keyed via `setup-node`; Jenkins instead reuses the persistent `jenkins_home` mount plus a local `.npm-cache` dir — coarser but functionally similar across builds on the same agent. |
| `Guard (must-pass)` | `npm run test:guard` with a JUnit reporter writing `reports/guard.xml` (unlike the GHA guard job, which doesn't emit JUnit since it only needs a pass/fail exit code). |
| `Coverage (Cobertura)` | Separate `nyc --reporter=cobertura` invocation over the guard suite, feeding the Jenkins **Coverage plugin** in `post { always { recordCoverage(...) } }`. |
| `Spec (allowed-fail)` | Wrapped in `catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE')` — the stage shows amber/UNSTABLE rather than failing the whole build, Jenkins' equivalent of GHA's `continue-on-error`. |
| `Flaky x10 (evidence)` | Unlike GHA (one flaky run per workflow trigger, aggregated across 10 manual triggers), Jenkins runs the flaky suite **10 times in a single stage** via a shell loop, writing `reports/flaky/run-<n>.xml` each time — a single build produces the full 10-run evidence set. |
| `Web & Admin Smoke Tests` | Uses a Jenkins **`matrix` block** (`axis APP: 'frontend-web', 'frontend-admin'`) as the direct equivalent of GHA's `strategy.matrix`. |
| `Mobile Smoke Tests` | `dir('frontend-mobile') { sh 'npm ci'; sh 'npm test' }`. |
| `post.always` | `junit allowEmptyResults: true, testResults: 'reports/**/*.xml'` + `recordCoverage(...)` — collects results regardless of stage outcome, same intent as GHA's `if: always()` artifact upload. |
| `options` | `timestamps()` for log readability, `timeout(time: 20, unit: 'MINUTES')` as a hard ceiling (no equivalent hard timeout is set in the GHA workflow, which defaults to GitHub's 6-hour job cap). |

Operational gotchas (from `docs/checklist.md`): Jenkins needs a GitHub **PAT credential**
manually added — it has no first-party `GITHUB_TOKEN` equivalent — and, for a local/demo
Jenkins controller reachable by a GitHub webhook, needs an `ngrok` tunnel plus a
`.../github-webhook/` push registered on the repo.

### 4.3 GitLab CI — `.gitlab-ci.yml` (adapted for this repo)

No GitLab remote is required to use this — the file works against any GitLab instance the repo
is pushed to. It was written to complete the three-way comparison, translating the same stage
set using GitLab-native primitives:

```
stages: [test, smoke]
  test:  backend-guard | backend-spec (allow_failure) | flaky-watch (allow_failure)
  smoke: web-smoke (parallel:matrix) | mobile-smoke
```

| GHA / Jenkins concept | GitLab CI equivalent used here |
|---|---|
| `continue-on-error` / `catchError(UNSTABLE)` | `allow_failure: true` on `backend-spec` and `flaky-watch` |
| `upload-artifact` (spec/flaky JUnit XML) | `artifacts.reports.junit: reports/spec.xml` (and `flaky.xml`) — GitLab renders these natively in the MR "Tests" tab |
| Jenkins Coverage plugin / Cobertura | `artifacts.reports.coverage_report` (`coverage_format: cobertura`, `path: coverage/cobertura-coverage.xml`) — same Cobertura file `test:coverage` already produces for Jenkins, reused here; plus a `coverage:` regex against nyc's text-reporter output so the merge-request coverage badge populates |
| `strategy.matrix` / Jenkins `matrix` block | `parallel: matrix: - APP: [frontend-web, frontend-admin]` on `web-smoke` |
| `actions/setup-node cache: npm` | top-level `cache: key: files: [package-lock.json], paths: [.npm/]`, paired with `npm ci --cache .npm --prefer-offline` in a YAML anchor (`.npm_ci`) shared by every job |
| `DB_PATH=backend/test.sqlite node backend/server.js &` (backgrounded before Playwright) | identical shell pattern, unchanged — GitLab's shell executor backgrounds jobs the same way |

The image is pinned to `node:20` (Docker executor) to match the Node 20 used by GHA
(`actions/setup-node@v4, node-version: 20`) and Jenkins (`nodejs 'node20'` tool), keeping all
three pipelines on the same runtime for a fair comparison. As with the other two pipelines, only
`backend-guard`, `web-smoke`, and `mobile-smoke` gate the pipeline; `backend-spec` and
`flaky-watch` are allowed to go red without blocking a merge.

### 4.4 Cross-pipeline comparison summary

| Concern | GitHub Actions | Jenkins | GitLab CI |
|---|---|---|---|
| Config location | `.github/workflows/ci.yml` | `Jenkinsfile` (repo root) | `.gitlab-ci.yml` (repo root) |
| Node runtime | `actions/setup-node@v4` | `tools { nodejs 'node20' }` (manual setup) | `image: node:20` |
| Allowed-fail mechanism | `continue-on-error: true` | `catchError(stageResult: 'UNSTABLE')` | `allow_failure: true` |
| Matrix jobs | `strategy.matrix` | `matrix { axes { axis ... } }` | `parallel: matrix:` |
| Test result reporting | `upload-artifact` (raw XML) | `junit` step + Coverage plugin | `artifacts.reports.junit` / `.coverage_report` (native MR UI) |
| Dependency cache | lockfile-keyed via `setup-node` | reused `jenkins_home` + local dir | lockfile-keyed via `cache.key.files` |
| Coverage badge | auto-committed to branch (`make-coverage-badge` + git-auto-commit-action) | Coverage plugin trend graph only | MR coverage badge via `coverage:` regex |
| CI credential needs | none (built-in `GITHUB_TOKEN`) | manual PAT credential | none (built-in `CI_JOB_TOKEN`) |
