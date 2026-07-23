# Trunk.io — Installation Report

## 1. Objective and Scope

Trunk.io was integrated into the project to provide two capabilities:

- **Code Quality:** run existing source-checking tools consistently, both on the local machine and
  in GitHub Actions.
- **Flaky Tests:** collect JUnit reports from the whole test suite to analyze test stability.

The rollout scope covers GitHub Actions and local configuration inside the repository. Jenkins was
not touched. Quarantine is not enabled, so Trunk is not allowed to change any test's pass/fail
result.

## 2. Baseline Survey

The project is a JavaScript monorepo consisting of:

- An Express/SQLite backend, tested with Mocha.
- Two React/Vite frontends, linted with ESLint and smoke-tested with Playwright.
- An Expo/React Native mobile app, tested with Jest.
- Two CI systems: GitHub Actions and Jenkins.

Before this rollout, the repository had no Trunk CLI and no `.trunk` directory. Both frontends
already had their own ESLint config; the backend spec and flaky suites already produced JUnit, but
guard, Playwright, and Jest did not yet produce a Trunk-compatible report.

## 3. Installing the Trunk CLI

The Trunk launcher was added to the root project via npm:

```powershell
npm install --save-dev @trunkio/launcher
```

Versions used:

```text
@trunkio/launcher 1.3.4
Trunk CLI 1.25.0
```

The following scripts were added to `package.json`:

```json
{
  "scripts": {
    "trunk": "trunk",
    "lint": "trunk check",
    "lint:all": "trunk check --all"
  }
}
```

Usage:

```powershell
npm run trunk -- --version
npm run lint
npm run lint:all
```

## 4. Configuring Trunk Code Quality

The first `trunk init` scan took too long across the monorepo because the workspace contains many
dependencies and build artifacts. The automatic scan was stopped and the configuration was scoped
down to the chosen set of checks.

`.trunk/trunk.yaml` was configured with:

- Trunk CLI `1.25.0`.
- Trunk plugin `v1.10.2`.
- Base branch `main` for Trunk's hold-the-line comparison.
- Node runtime `22.16.0`.
- `eslint@10.3.0` for both frontends.
- `actionlint@1.7.8` for GitHub Actions workflows.
- `git-diff-check` to catch conflict markers and whitespace errors.

Auto-generated directories are excluded, including `node_modules`, `coverage`, `reports`,
`.nyc_output`, `dist`, `playwright-report`, and `test-results`.

ESLint is scoped to `frontend-web` and `frontend-admin`; the Trunk config does not apply any new
ESLint rule to the backend, tests, or mobile app.

`.trunk/setup-ci/action.yaml` was added to install both frontends' dependencies before Trunk runs
ESLint in GitHub Actions:

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

## 5. Setting Up the Code Quality Workflow

The `.github/workflows/trunk-check.yml` workflow was created to run when:

- A pull request targets `main`.
- A push lands on `main`.
- The workflow is triggered manually.

The job uses the official action:

```yaml
- name: Run Trunk Code Quality
  uses: trunk-io/trunk-action@v1
  with:
    post-annotations: true
```

The job's permissions are scoped to:

```yaml
permissions:
  checks: write
  contents: read
```

The workflow is a required quality gate at the job level: if the changed code introduces a new
issue, the Trunk job fails. To block merging a PR when this job fails, the repository needs the
`Trunk Code Quality` check added to `main`'s branch protection or ruleset.

## 6. Standardizing JUnit Reports

### 6.1 Backend Mocha

The `test:coverage` script was extended with `mocha-junit-reporter` so it produces both coverage
and a report at the same time:

```text
reports/guard.xml
```

Two reports that already existed were kept unchanged:

```text
reports/spec.xml
reports/flaky.xml
```

### 6.2 Playwright

`frontend-web/playwright.config.js` and `frontend-admin/playwright.config.js` were configured so
that when `CI=true`, Playwright uses both the `list` and `junit` reporters together:

```javascript
reporter: process.env.CI
  ? [['list'], ['junit', { outputFile: '../reports/playwright.xml' }]]
  : 'list'
```

Each matrix job runs on an isolated runner, so both jobs can share the same
`reports/playwright.xml` path without colliding.

### 6.3 Mobile Jest

The `jest-junit@17.0.0` package and the following script were added to
`frontend-mobile/package.json`:

```json
{
  "scripts": {
    "test:ci": "jest --ci --reporters=default --reporters=jest-junit"
  }
}
```

The reporter writes `reports/mobile.xml`. The `reportTestSuiteErrors` option is enabled so that an
error preventing Jest from even starting a test suite still shows up as `errors=1` instead of
producing an empty report.

## 7. Integrating Trunk Flaky Tests into GitHub Actions

An uploader step was added to `.github/workflows/ci.yml` after each of the five test job groups:

1. Backend guard.
2. Backend spec.
3. Flaky suite.
4. Playwright web/admin.
5. Mobile Jest.

Uploader configuration template:

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

`continue-on-error` only applies to the upload step. Test exit codes and the existing
must-pass/allowed-fail policy are not changed by Trunk.

No real token is committed to the repository. GitHub needs two secrets configured:

```text
TRUNK_ORG_URL_SLUG
TRUNK_API_TOKEN
```

## 8. Issues Found and Fixed

### 8.1 Backend dependencies not installed in GitHub Actions

The backend jobs previously ran only `npm ci` at the root, while Express, SQLite, and the other
backend dependencies live in `backend/package.json`. An `npm ci` step with
`working-directory: backend` was added to every job that runs the backend or backend tests.

### 8.2 How the backend is started in the web smoke job

The workflow previously invoked `cross-env` directly from the shell. This step was changed to run
Node directly and pass `DB_PATH` and `PORT` through GitHub Actions' `env`.

### 8.3 Out-of-sync frontend lockfiles

Both `frontend-web/package-lock.json` and `frontend-admin/package-lock.json` were out of sync with
their `package.json`, which made `npm ci` fail. Both lockfiles were re-synced without changing any
version declared in `package.json`. `npm ci` then ran successfully for both frontends.

### 8.4 Mobile peer dependency

The mobile app has a pre-existing Expo/React peer-dependency conflict. GitHub Actions uses:

```powershell
npm ci --legacy-peer-deps
```

This matches the policy already used in the Jenkinsfile and does not force an upgrade of React or
Expo.

### 8.5 Wrong Playwright admin port

Vite admin runs on port `5174`, but Playwright admin was previously waiting on port `5173`.
`baseURL` and `webServer.url` were fixed to `http://localhost:5174`. After this change, the admin
smoke test passed.

### 8.6 ESLint not recognizing Node globals

After adding the `process.env.CI` check, ESLint reported `process is not defined` in the Playwright
config. Both `eslint.config.js` files were given Node globals scoped specifically to
`playwright.config.js`.

### 8.7 Coverage artifacts modified during testing

Running coverage locally updated the tracked artifacts in `coverage` and `.nyc_output`. These
auto-generated changes were reverted since they are out of scope for the Trunk integration.

## 9. Acceptance Results

### 9.1 Trunk Code Quality

Command to check the changed portion:

```powershell
npm run lint
```

Result:

```text
Checked 76 modified files
No issues
```

Command to check the whole repository:

```powershell
npm run lint:all
```

Result: 28 pre-existing ESLint issues found in the frontends. These were not fixed or mass-formatted;
hold-the-line only blocks new issues introduced in the changed portion.

### 9.2 Tests and JUnit

| Test suite | Result | JUnit status |
|---|---:|---|
| Backend guard | 11 pass, 0 failure | Valid |
| Backend spec | 14 tests, 14 pre-existing failures | Valid |
| Flaky suite | 1 pass | Valid |
| Admin Playwright | 1 pass | Valid |
| Web Playwright | 1 pass, 1 pre-existing failure | Valid |
| Mobile Jest | Pre-existing Jest/Expo compatibility error | Valid, `errors=1` |

Web Playwright still catches the login input missing `type="email"`. Mobile still has a runtime
conflict between Jest 30 and the Expo preset. These are pre-existing application issues and were
not fixed as part of the Trunk installation.

## 10. Safety and Dependency Checks

- No real Trunk token or organization slug in the source code.
- Quarantine is not enabled.
- The Jenkinsfile was not modified.
- No pre-existing untracked user documents were modified.
- `npm audit fix` was not run, since it could upgrade dependencies outside this scope.

Current `npm audit` results:

- Root: 4 vulnerabilities.
- Each of frontend web/admin: 7 vulnerabilities.
- Mobile: 18 vulnerabilities.

These warnings belong to the current dependency tree and should be addressed in a separate change.

## 11. Remaining Work on GitHub and Trunk.io

The following steps need the repository owner's account information, so they have not been done
locally:

1. Create or select an organization on Trunk.io.
2. Connect the GitHub repository to that organization.
3. Create the GitHub Actions secrets `TRUNK_ORG_URL_SLUG` and `TRUNK_API_TOKEN`.
4. Push the changes and run the GitHub Actions workflow.
5. Confirm the uploads show up in Trunk Flaky Tests.
6. Add the `Trunk Code Quality` check to `main`'s branch protection or ruleset if you want it
   enforced as a merge gate.

## 12. Key Files Changed

- `.trunk/trunk.yaml`
- `.trunk/setup-ci/action.yaml`
- `.github/workflows/trunk-check.yml`
- `.github/workflows/ci.yml`
- `package.json` and root `package-lock.json`
- `frontend-web/eslint.config.js`
- `frontend-web/playwright.config.js`
- `frontend-web/package-lock.json`
- `frontend-admin/eslint.config.js`
- `frontend-admin/playwright.config.js`
- `frontend-admin/package-lock.json`
- `frontend-mobile/package.json`
- `frontend-mobile/package-lock.json`
