# CI/CD + Test Harness — Context & Implementation Handoff

> Handoff doc for the agent implementing GitHub Actions CI/CD and framework-based test
> suites for the EShop repo. Read this fully before writing code. Design is **approved in
> principle** (spec-suite + guard-suite policy, FE scaffold+smoke only); confirm with the
> user before deleting or rewriting any graded deliverable.

---

## 1. Repo reality (what exists today)

Monorepo, 4 apps + a hand-rolled API test harness. **Intentionally-buggy SUT** — this is a
QA course deliverable (HW02). The bugs are the point; tests document them.

| Path | Stack | Notes |
|------|-------|-------|
| `backend/` | Express 5 + sqlite3 + JWT | `server.js` monolith, `database.js` seeds. **No test script.** |
| `frontend-web/` | React 19 + Vite + axios + react-router | Full app: Login/Register/Home/ProductDetail/Cart/Checkout/Profile/ForgotPassword pages |
| `frontend-admin/` | React 19 + Vite | Near-empty skeleton (`App.jsx` + `main.jsx` only) |
| `frontend-mobile/` | Expo + React Native 0.81 | Single monolith `App.js`; fetches on mount to hardcoded LAN IP |
| `tests/api/` | raw Node `http` scripts | 4 suites, NOT a framework. See §3. |
| `tests/helpers/reseed.js` | sqlite3 direct | Resets DB to seed state; adds `LOCKEDCODE` coupon for EC-I2 |
| `docs/test-cases/` | markdown | Domain-testing + BVA design per feature (the "test plan") |
| `docs/test-results/` | markdown | PASS/FAIL(BUG) tables, auto-written by the raw scripts |
| `docs/BugReport.md` | markdown | BUG-01..12, severity, source line, GitHub issue links |

Branches: `main` (default), `github-actions` (current working branch), `phucnotphuc`, others.
No `.github/` dir yet. No root `package.json`.

### Test plan = the 4 FR feature docs
- **FR-04** (`docs/test-cases/FR04_TestCases.md`) — Profile update. Phone validation
  (prefix `0`, len 10–11), no role/email change, no data loss on partial update.
- **FR-09** (`FR09_TestCases.md`) — Apply coupon. 5 conditions C1–C5, percent/fixed formulas,
  `>=` threshold, per-user usage limit, auth required.
- **FR-15** (`FR15_TestCases.md`) — Product CRUD. name 1–255, price `>0`, category must exist,
  admin-only writes (FR-12).
- **FR-20** (`FR20_TestCases.md`) — Mobile login & account lock. Counter +1 per fail, lock at
  `>=3` fails for 30s.

## 2. The 12 documented bugs (see `docs/BugReport.md`)

Spec-asserting tests FAIL against these. Do NOT "fix" the backend to make tests pass — the
red is intentional evidence.

| Bug | Feature | Sev | Essence | Source |
|-----|---------|-----|---------|--------|
| BUG-01 | FR-20 | High | login counter `+2` not `+1` | server.js:54 |
| BUG-02 | FR-20 | High | locks after 2 fails not 3 | server.js:54,56 |
| BUG-03 | FR-20 | Med | lock 180s not 30s | server.js:57 |
| BUG-04 | FR-04 | **Crit** | privilege escalation: client can set `role`→admin | server.js:124-127 |
| BUG-05 | FR-04 | High | no phone validation | server.js:118-135 |
| BUG-06 | FR-09 | **Crit** | percent discount formula `total*(1-value)` → negative discount | server.js:399 |
| BUG-07 | FR-09 | High | apply-coupon missing auth | server.js:363 |
| BUG-08 | FR-09 | Med | threshold `>` not `>=` (off-by-one) | server.js:379 |
| BUG-09 | FR-15 | **Crit** | no access control on product POST/PUT/DELETE | server.js:167,179,191 |
| BUG-10 | FR-15 | High | no product input validation | server.js:167-177 |
| BUG-11 | FR-04 | High | partial update wipes fields (NULL) | server.js:120-128 |
| BUG-12 | FR-09 | **Crit** | guest coupon bypass (no `user_id` → else branch) | server.js:416 |

Ambiguities (NOT bugs): AMB-01 (empty name/address on update), AMB-02 (coupon at exact
`expired_at` millisecond).

## 3. Existing test harness — how it works now (and its limits)

`tests/api/FR0X_*.test.js` are plain Node scripts using the `http` module. Each:
1. Requires a **running** server at `localhost:3000` + a seeded `database.sqlite`.
2. Calls `await reseed()` before blocks for isolation.
3. Self-writes a markdown table to `docs/test-results/<FR>_TestResults.md`.
4. Labels rows `✅ PASS` / `❌ FAIL (BUG)` — **FAIL is expected/documented**, script never throws.

**Limitation for CI:** these never set a non-zero exit code, so they cannot gate a pipeline.
FR-20 also `sleep(31000)` to test unlock. That's why we move to a framework.

## 4. Decisions locked with the user

- **Frameworks (one per layer):** `mocha + chai + supertest` (backend API),
  `Playwright` (web + admin), `Jest + RNTL` (mobile). All three, per user.
- **CI bug policy — two backend suites:**
  - **spec** — asserts correct/spec behavior. CI `continue-on-error: true` (allowed-fail).
    Its red output is the bug evidence.
  - **guard** — asserts CURRENT actual behavior (characterization). **must-pass.** Catches
    real regressions. Keep it fast (no 31s sleeps).
- **Frontend scope:** scaffold + smoke tests only (configs, CI jobs, a few boots/renders).
  No full E2E flows this pass.
- **CI triggers:** `push` + `pull_request` (broadest). Narrow later if desired.
- **Preserve** the legacy raw-http scripts (they generate graded `docs/test-results` md) —
  move to `tests/api/legacy/`, keep runnable, keep OUT of CI gating.

## 5. Target structure

```
package.json                      # NEW root: mocha/chai/supertest/reporter devDeps + scripts
.github/workflows/ci.yml          # NEW
backend/
  app.js                          # NEW: express app factory, exports `app`, no listen
  server.js                       # MODIFIED: require('./app'); listen only if require.main===module
  database.js                     # MODIFIED: path from process.env.DB_PATH (default database.sqlite)
tests/
  api/
    spec/  FR04|FR09|FR15|FR20 .spec.js   # NEW mocha+chai+supertest, assert SPEC (allowed-fail)
    guard/ behavior.guard.spec.js         # NEW, assert ACTUAL behavior (must-pass)
    legacy/ FR04|FR09|FR15|FR20 .test.js  # MOVED from tests/api/, unchanged
  helpers/
    reseed.js                     # MODIFIED: use process.env.DB_PATH
    supertest-app.js              # NEW: require backend app + expose for suites
frontend-web/
  playwright.config.js            # NEW
  e2e/home.smoke.spec.js          # NEW
frontend-admin/
  playwright.config.js            # NEW
  e2e/boots.smoke.spec.js         # NEW
frontend-mobile/
  jest.config.js                  # NEW (jest-expo preset)
  __tests__/App.smoke.test.js     # NEW (RNTL, mocked fetch)
```

## 6. Implementation steps (ordered)

### Step A — backend refactor for in-process supertest
1. Create `backend/app.js`: move everything from `server.js` EXCEPT the `app.listen(...)` call;
   `module.exports = app;`.
2. `backend/server.js` becomes:
   ```js
   const app = require("./app");
   const PORT = process.env.PORT || 3000;
   if (require.main === module) {
     app.listen(PORT, () => console.log(`Server on http://localhost:${PORT}`));
   }
   ```
3. `backend/database.js`: replace fixed `dbPath` with
   `const dbPath = process.env.DB_PATH || path.resolve(__dirname, "database.sqlite");`
4. `tests/helpers/reseed.js`: replace `DB_PATH` const with the same `process.env.DB_PATH || ...`.
5. Verify: `DB_PATH=backend/test.sqlite node backend/server.js` boots; existing legacy scripts
   still pass against it.

### Step B — root package.json + backend suites
1. Root `package.json` devDeps: `mocha`, `chai@4` (CJS), `supertest`, `mocha-junit-reporter`,
   `cross-env`. Scripts:
   ```json
   "test:spec":  "cross-env DB_PATH=backend/test.sqlite mocha tests/api/spec --reporter mocha-junit-reporter --reporter-options mochaFile=reports/spec.xml --timeout 60000",
   "test:guard": "cross-env DB_PATH=backend/test.sqlite mocha tests/api/guard --timeout 20000"
   ```
2. `tests/helpers/supertest-app.js`: `module.exports = require("../../backend/app");` and export
   `reseed` for convenience. Suites do `const request = require("supertest"); const app = require("../../helpers/supertest-app");`
3. **spec/** suites: port each row from the FR docs. `beforeEach(async () => await reseed())`.
   Assert the SPEC (e.g. FR-04 phone `9912345678` → expect 4xx; role change → expect role
   unchanged). These WILL fail on the bugs — that's correct.
4. **guard/** suite: assert the current ACTUAL behavior for the same endpoints so regressions
   break the build (e.g. login after 1 wrong password → `login_attempts === 2` today). Keep
   fast; do not wait 31s — assert lock-state via admin API read instead.

### Step C — move legacy scripts
`git mv tests/api/FR0X_*.test.js tests/api/legacy/`. Update `tests/README.md` run paths.
These stay runnable to regenerate `docs/test-results/*.md`; not in CI.

### Step D — Playwright (web + admin)
1. In each of `frontend-web`, `frontend-admin`: `npm i -D @playwright/test`, add
   `playwright.config.js` (baseURL `http://localhost:5173`, `webServer` runs `npm run dev`).
2. `e2e/home.smoke.spec.js` (web): visit `/`, expect product list / heading visible; visit
   `/login`, expect email+password inputs. Web talks to backend — CI job starts backend first.
3. `e2e/boots.smoke.spec.js` (admin): visit `/`, expect root node renders (skeleton).

### Step E — Jest + RNTL (mobile)
1. `frontend-mobile`: `npm i -D jest jest-expo @testing-library/react-native react-test-renderer`.
2. `jest.config.js`: `preset: "jest-expo"`, `setupFilesAfterEnv` for RNTL matchers.
3. `__tests__/App.smoke.test.js`: mock `global.fetch` (App fetches on mount), `render(<App/>)`,
   assert a static label renders. Add `"test": "jest"` to mobile package.json.

### Step F — GitHub Actions
`.github/workflows/ci.yml`, triggers `push` + `pull_request`. Jobs (Node 20, `npm ci`):

| Job | Gate | Key steps |
|-----|------|-----------|
| `backend-guard` | must-pass | root `npm ci`; `npm run test:guard` |
| `backend-spec` | `continue-on-error: true` | `npm run test:spec`; `actions/upload-artifact` reports/spec.xml |
| `web-smoke` (matrix web,admin) | must-pass | install app deps; `npx playwright install --with-deps`; start backend bg (`DB_PATH=backend/test.sqlite node backend/server.js &`) for web; run `npx playwright test` |
| `mobile-smoke` | must-pass | mobile `npm ci`; `npm test` |
| `lint` | must-pass (optional) | `npm run lint` in FE apps |

Cache: `actions/setup-node` npm cache + Playwright browser cache keyed on lockfile.

## 7. Gotchas

- **chai v5 is ESM-only.** Repo backend is CommonJS. Use `chai@4` or `expect`-style via
  `chai` dynamic import. Simplest: `chai@4`.
- **DB isolation:** every suite MUST `reseed()` in `beforeEach`; suites share one sqlite file.
  Never point tests at dev `database.sqlite` — always `DB_PATH=backend/test.sqlite`.
- **FR-20 31s unlock test:** only in the spec suite (allowed-fail), `this.timeout(60000)`.
  Never in guard.
- **Mobile App.js** hardcodes `http://192.168.10.13:3000/api` and calls fetch on mount — MUST
  mock fetch in RNTL or the smoke test hangs/errors.
- **`.gitignore`:** add `test.sqlite`, `reports/`, `node_modules/`, `playwright-report/`,
  `test-results/` (playwright's, distinct from `docs/test-results/`).
- **Do not modify `backend/server.js` logic** beyond the listen/export split — the bugs stay.
- **Windows dev, Linux CI:** use `cross-env` for env vars in npm scripts; avoid `killall`.

## 8. Definition of done

- `npm run test:guard` green locally + CI.
- `npm run test:spec` runs, reports JUnit, red where bugs exist, uploaded as artifact.
- Playwright smoke green for web + admin; Jest smoke green for mobile.
- `.github/workflows/ci.yml` runs all jobs on push + PR; only `backend-spec` allowed to fail.
- Legacy scripts still regenerate `docs/test-results/*.md`.
- README/tests/README updated with new run commands.
