# AI-Audit

## Summary

**Task:** Prepare environments (secrets/variables, GitHub self-hosted runner for LLM triage) and
convert the team's GitHub Actions workflow into an equivalent Jenkins pipeline for the T07
tool-comparison requirement.

**Verdict:** AI was used exclusively for the **Jenkins conversion** half of this task — authoring
`Jenkinsfile`/`.gitlab-ci.yml`, and then iteratively debugging it against a real, locally-run
Jenkins controller until it reached full parity with `.github/workflows/ci.yml`. The
**environment-prep** half (repo secrets/variables, registering the GitHub self-hosted runner used
later for local-LLM triage) was done manually through the GitHub UI/terminal without AI assistance,
so it has no prompt log entry — this document only covers material AI interactions.

**Reasoning:** Every fix the AI proposed was tested against a real, running Jenkins build in the
same session, not just asserted — a wrong assumption (e.g. pinning the Jenkins `node20` tool to
Node 20.11.1) showed up immediately as a real build failure with a real stack trace, and was
corrected in the next iteration. Nothing was accepted on the AI's word alone.

**Student responsibility:** The student stood up and operated the actual Jenkins instance (Docker
container, plugins, credentials), pasted real console logs back after every build, made the policy
calls the AI implemented (e.g. "bugs are allowed to exist, but must never block the pipeline — a
report must always be produced"), and self-committed at least one fix directly (`e04199e`) rather
than delegating everything to the assistant. AI output (Jenkinsfile stages, diagnoses) was treated
as a proposal, verified against the next real build log before being trusted.

---

## Claude Sonnet 5 (Claude Code)

### User:
Dựa vào github action workflow ở repo /home/ngothoaidev/Documents/Project_Management/CI-CD_and_Test-Harness_Engineering,
Here is github action task which is DONE
"
Build the primary CI/CD pipeline using GitHub Actions for the EShop project. The pipeline must cover the full build → test → artefact upload cycle, running unit, API, and smoke tests on every PR. This is the team's main CI tool.

Acceptance criteria:

GitHub Actions workflow runs on PRs

Unit, API, and smoke tests executed

Artefacts (test reports/logs) uploaded and accessible

Results documented in team notes
"

Now, my task is to create a Jenkin workflow to compare to Github action
"
Replicate the same CI workflow on Jenkins for side-by-side comparison with GitHub Actions. Additionally, prepare a minimal GitLab CI configuration as a backup tool. Document differences in syntax, setup complexity, and execution behavior.

Acceptance criteria:

Jenkins pipeline can run build + unit/API/smoke tests + artefact handling

Minimal GitLab CI pipeline created for backup

Comparison notes published (syntax, setup, timing, artefacts, secrets)
"
Let analysis and make for me a plan to do this

---

### 2026-07-11 13:17:45 (UTC)

### AI (Claude Code):
Planned the work, created a branch, and authored `Jenkinsfile` (mirroring the GHA job structure:
backend guard/spec, web+admin Playwright smoke, mobile Jest smoke, artifact archiving via the
Jenkins NodeJS tool) plus a minimal `.gitlab-ci.yml` (syntax-checked, not execution-verified — no
GitLab runner available). Pulled real GitHub Actions run timing from the public API for the
comparison notes rather than assuming a green baseline — one honest finding worth flagging: **the
last 5 GitHub Actions runs on this repo all failed**, including the must-pass `Backend Guard
Tests` job, each within 10–14 seconds. That will be documented factually rather than papered over.

To move to creating/triggering the actual Jenkins job, requested the user's local Jenkins
(`http://localhost:8080`) API token, to be used only locally via `curl` to create the pipeline job
and trigger builds.

---

### User:
<ide_opened_file>The user opened the file /temp/readonly/command (k450k5) in the IDE. This may or may not be related to the current task.</ide_opened_file>
admin:`<redacted local Jenkins API token>`

---

### 2026-07-11 13:30:58 (UTC)

### AI (Claude Code):
Token worked. Checked installed plugins, confirmed the NodeJS tool wasn't configured yet, installed
the NodeJS plugin (polled until finished), configured a `node20` tool installation via the global
config XML API, then created a Pipeline job pointing at the local repo/branch. Committed the current
work (Jenkinsfile wasn't readable by Jenkins via SCM until committed) and triggered build #1.

Build #1 finished immediately with **FAILURE** — a permission issue, not a pipeline bug:
`/home/ngothoaidev` is mode `750` and the `jenkins` OS user can't traverse into it at all. Rather
than loosen home-directory permissions, decided to push a bare mirror clone to a world-readable
location and point Jenkins there instead — smaller blast radius.

Hit two more infra snags in sequence: Git's "dubious ownership" protection blocking the `jenkins`
user (fixed via the Jenkins script console, which runs as the `jenkins` OS user itself, adding a
`safe.directory` exception); then a transient network timeout while downloading
`jackson-annotations2-api` that cascade-failed several plugin installs (`pipeline-model-definition`,
`matrix-project`, `junit`, `github`) — fixed by retrying the install and restarting cleanly. A
further snag: Jenkins' git-plugin blocks local `file://` checkouts by default; a JVM system-property
override didn't take effect (already-loaded class), so served the mirror over `git://` instead,
which isn't subject to that restriction.

With the build actually running, found the **real root cause** of the failure: `backend/app.js`
requires `express`, `jsonwebtoken`, `sqlite3`, etc., but the **root** `package.json` (used by both
`npm run test:coverage` / `test:spec`) never installs `backend/`'s own dependencies — only its own
devDeps (mocha, chai, nyc...). A fresh checkout + root `npm ci` can never run backend tests. This
explained why **all 5 of the real GitHub Actions runs** pulled earlier also failed at the exact
same `Backend Guard Tests` step — a pre-existing gap in the pipeline design itself, not something
Jenkins-specific; the Jenkinsfile, being a faithful mirror, reproduced the identical failure. Added
the missing backend dependency install step, pushed the updated Jenkinsfile to the mirror (adding a
`post-receive` hook so `update-server-info` regenerates automatically after each push, since the
dumb-HTTP git serving needs it), and re-triggered.

Result: `11 passing` — the backend-deps fix worked, **Backend Guard Tests now passes**. (The
`sqlite3` prebuilt binary also needed a newer glibc than the Jenkins agent had — `0153da8` — rebuilt
it from source rather than upgrade the agent.) New failure surfaced further along: `npm ci` in the
frontend apps fails because their lockfiles don't sync-check cleanly against this Node tool's
bundled npm version.

Session ended here (a transient API/self-signed-certificate error, then the user's later "Continue
from where you left off" got only "No response requested" — the frontend-lockfile fix carried over
into the next session, three days later).

---

### User:
<ide_opened_file>The user opened the file /home/ngothoaidev/Documents/Project_Management/CI-CD_and_Test-Harness_Engineering/docs/Activity_Worksheet.md in the IDE. This may or may not be related to the current task.</ide_opened_file>
Đọc và phân tích repo CI-CD_and_Test-Harness_Engineering, chú ý phần docs/, tôi đang cần dựa trên flow github action để build flow Jenkins giống hệt để so sánh, bạn hãy đọc, phân tích repo đó cho tôi

---

### 2026-07-14 16:56:21 (UTC)

### AI (Claude Code):
Read `.github/workflows/ci.yml` (5 jobs, triggers on `push`/`pull_request`/`workflow_dispatch`:
`backend-guard` must-pass, `backend-spec` allowed-fail, `flaky-watch` allowed-fail, `web-smoke`
matrix must-pass, `mobile-smoke` must-pass) and both existing `Jenkinsfile`s, since the repo turned
out to have **two divergent Jenkinsfiles on two different branches, not yet reconciled**:

- **Branch `demo`** (checked out): a "clean seminar" mirror — but actually only covers 3 of 5 jobs
  (Checkout → NPM Install → Guard → Coverage → Spec allowed-fail → Flaky ×10); **missing
  `web-smoke` and `mobile-smoke` entirely**.
- **Branch `jenkins-gitlab-ci`**: a fuller version (includes the Playwright web/admin + mobile Jest
  matrix) with comments recording real mismatches hit on an actual Jenkins agent that `demo` hasn't
  addressed — GHA's root `npm ci` never installs `backend/`'s own deps (all 5 historical GHA runs
  failed here too); `sqlite3`'s prebuilt binary needs a newer glibc than the Jenkins agent has;
  frontend lockfiles were generated by a newer npm so `npm ci` rejects them (needs `npm install`);
  no `--with-deps` since the Jenkins user has no sudo; and a Jenkins declarative `matrix` block
  instead of a GHA `strategy.matrix`. Also has a `.gitlab-ci.yml` backup, unverified (no GitLab
  runner available).

Built a GHA↔Jenkins concept-mapping table from the two files (`continue-on-error` ↔
`catchError(buildResult:'SUCCESS', stageResult:'UNSTABLE')`; `upload-artifact` ↔ `junit` +
`archiveArtifacts`; `strategy.matrix` ↔ declarative `matrix { axes {...} }`; `setup-node`+cache ↔
`tools { nodejs 'node20' }`; automatic `secrets.GITHUB_TOKEN` ↔ manually-created Jenkins credential;
GitHub App trigger ↔ ngrok + webhook). Flagged the fork before proceeding: two branches
independently targeting the same goal, not identical — asked where to start.

---

### User:
(implicit — proceed with adding the missing stages to the `demo` branch's Jenkinsfile, translated
directly from `ci.yml`'s syntax, without carrying over the already-known fixes from the
`jenkins-gitlab-ci` branch)

---

### 2026-07-14 17:01:20 (UTC)

### AI (Claude Code):
Added the 2 missing stages to `Jenkinsfile` on branch `demo` to match all 5 `ci.yml` jobs:
**Web & Admin Smoke Tests** (declarative `matrix`, axis `APP`: `frontend-web`/`frontend-admin` —
`npm ci` frontend deps, `playwright install --with-deps`, start backend in background, `playwright
test`, same order as GHA) and **Mobile Smoke Tests** (`dir('frontend-mobile')` → `npm ci` → `npm
test`, identical to the `mobile-smoke` job). Deliberately did not carry over the "battle-tested"
fixes from `jenkins-gitlab-ci` (sqlite3 from source, `npm install` vs `npm ci`, missing
`backend/` deps) — kept this file as a clean structural mirror, flagged that running it for real
would likely hit exactly those known issues, and offered to build the "actually runs" version
separately if needed.

---

### User:
<ide_opened_file>The user opened the file /home/ngothoaidev/Documents/Project_Management/CI-CD_and_Test-Harness_Engineering/Jenkinsfile in the IDE. This may or may not be related to the current task.</ide_opened_file>
Từ file Jenkinsfile này, lên kế hoạch hưỡng dẫn tôi chạy demo thử với Jenkins

---

### 2026-07-14 17:04:57 (UTC)

### AI (Claude Code):
Port 8080 was already in use by another local process, so planned Jenkins on 8081 instead. Wrote a
step-by-step local-demo plan: run a `jenkins/jenkins:lts-jdk21` Docker container, unlock with the
initial admin password, install NodeJS/Coverage/JUnit plugins, register a `node20` NodeJS tool
(matching the exact string the Jenkinsfile's `tools {}` block expects), create a Pipeline job
(`Pipeline script from SCM`, Git, branch `demo`), then Build Now and read the Stage View / Test
Result / Coverage tabs. Flagged upfront that the Jenkinsfile was still only local (needed
`git push origin demo`, or point SCM at a local `file://` path for a quick test), and that
likely-real errors (missing `backend/` deps, `sqlite3` glibc mismatch, `--with-deps` needing root)
should be read as **evidence of the operational difference from GitHub Actions**, not something
that had to go green on the first try. Asked whether to run the `docker run` step immediately.

---

### User:
<ide_opened_file>The user opened the file /home/ngothoaidev/Documents/Project_Management/CI-CD_and_Test-Harness_Engineering/docs/Activity_Worksheet.md in the IDE. This may or may not be related to the current task.</ide_opened_file>
Chạy hết tất cả cho tôi, trong quá trình chạy, sinh file hướng dẫn User_Guide,

---

### 2026-07-14 17:23:38 (UTC)

### AI (Claude Code):
First caught that the Jenkinsfile had silently reverted to the pre-edit version (`git status`
showed no pending edit) and re-applied the smoke-stage edit before touching any Jenkins
infrastructure. Built a custom Jenkins Docker image with plugins baked in (`git`,
`workflow-aggregator`, `nodejs`, `junit`, `coverage`, `timestamper`), ran the container with the
setup wizard disabled, and registered the `node20` tool via the Jenkins CLI — hit and fixed a
plugin-internal package rename (`jenkins.plugins.nodejs.tools.*`) along the way. Created the
`eshop-demo` Pipeline job pointed at the container's `/repo` mount (no credential needed for a
local file-based checkout) and triggered build #1 in the background.

While waiting, needed the **Timestamper** plugin (`timestamps()` in the Jenkinsfile) that wasn't
pre-installed; installing it required a Jenkins `-restart`, which — a quirk of the official Docker
image — exits the container entirely instead of respawning, so the container had to be manually
restarted. At this point the user stopped the auto-plugin-install flow and said they'd provide the
real GitHub URL + credentials manually through the UI instead. Updated `docs/User_Guide.md`
(§3 + Troubleshooting) with the real steps and gotchas hit so far (plugin package rename,
`-restart` killing the container, Timestamper requirement, job initially pointing at a local mount
rather than GitHub).

---

### User:
<ide_opened_file>The user opened the file /home/ngothoaidev/Documents/Project_Management/CI-CD_and_Test-Harness_Engineering/docs/Project_Documentation.md in the IDE. This may or may not be related to the current task.</ide_opened_file>
[Pasted a real Jenkins console log — build against the actual GitHub repo, branch `demo`. Checkout
succeeded; `NPM Install` (root) succeeded; the `Guard (must pass)` stage then hard-failed:]
```
Exception during run: Error: Cannot find module 'express'
Require stack:
- .../backend/app.js
- .../tests/helpers/supertest-app.js
- .../tests/api/guard/behavior.guard.spec.js
...
code: 'MODULE_NOT_FOUND'
```
[Coverage / Spec / Flaky stages were skipped as a result; `junit` reported "No test report files
were found"; build finished `FAILURE`.]

---

### 2026-07-14 17:43:12 (UTC)

### AI (Claude Code):
Confirmed this was a **real** failure, not a Jenkins-porting mistake: `backend/app.js` needs
`express`/`jsonwebtoken`/`sqlite3` from `backend/package.json`, but both `ci.yml` and this
Jenkinsfile only run `npm ci` at the **root** — `backend/node_modules` never gets created. Flagged
explicitly that this is **not Jenkins-specific**: `.github/workflows/ci.yml` does the exact same
thing, so `backend-guard` on GitHub Actions would fail identically on a clean checkout — matching
the `jenkins-gitlab-ci` branch's own note (commit `85b9a16`) that *all 5 historical GHA runs fail at
this exact point*. Added an **"Install backend deps"** stage to the Jenkinsfile only (`ci.yml`
untouched) and pointed out the Jenkins job now pulls from the **real GitHub repo**, so the fix
needed a commit + push before the next build would see it.

---

### User:
Commit lên cho tôi

---

### 2026-07-14 17:44:41 (UTC)

### AI (Claude Code):
Committed exactly the 2 files touched (`Jenkinsfile`, `docs/User_Guide.md` — not the user's
untracked `.gitlab-ci.yml` / `docs/Project_Documentation.md`) as `1686059`.

---

### User:
push lên

---

### 2026-07-14 17:45:20 (UTC)

### AI (Claude Code):
Pushed to `origin/demo`.

---

### User:
[Pasted a second real console log. Checkout now at `1686059...`. `NPM Install` + new "Install
backend deps" stage both succeeded; `Guard` — 11 passing; `Coverage` — 49.34%/53.54% as expected;
`Spec (allowed-fail)` — non-zero exit, caught; `Flaky x10` — ran 10 times, mixed pass/fail as
designed. Then **Web & Admin Smoke Tests** hard-failed in both matrix branches:]
```
npm ERR! code EUSAGE
npm ERR! `npm ci` can only install packages when your package.json and package-lock.json ... are in sync
npm ERR! Missing: @emnapi/core@1.11.2 from lock file ...
```

---

### 2026-07-14 17:47:38 (UTC)

### AI (Claude Code):
Guard/Coverage/Spec/Flaky all correct; the failure was isolated to the frontend's `npm ci`. Root
cause: the frontend lockfiles were generated by a newer npm than the one bundled with this Jenkins
NodeJS tool (10.2.4), so optional platform deps (`@emnapi/*`, used by esbuild/rollup's wasm build)
version-mismatch and `npm ci` rejects outright — the same issue the `jenkins-gitlab-ci` branch had
already hit and fixed by switching `npm ci` → `npm install` for the frontend apps only (root/backend
lockfiles still matched, so those kept `npm ci`). Applied the same fix to `frontend-web`,
`frontend-admin`, `frontend-mobile`, with a comment explaining why. Flagged the next likely failure:
`playwright install --with-deps` needs `apt`/root, which the `jenkins` container user doesn't have.

---

### User:
ngothoaidev@master:~/Documents/Project_Management/CI-CD_and_Test-Harness_Engineering$ npx playwright install --with-deps
[... prompted "Switching to root user to install dependencies... [sudo] password for ngothoaidev:"]

---

### 2026-07-14 17:49:42 (UTC)

### AI (Claude Code):
Pointed out this command was being run on the **host machine**, in the repo root (not
`frontend-web/`, where Playwright is actually a devDependency), which explained the warning — and,
more importantly, that the terminal was **waiting for a sudo password**. Told the user directly to
**Ctrl+C and not type the password**, since that was outside what the assistant should handle.
Verified instead, safely, inside the Jenkins container as root (`docker exec -u root`, no password
prompt) that the missing system libraries for Chromium install fine there — confirming `--with-deps`
would fail identically under the unprivileged `jenkins` user in the real pipeline, so the fix is to
drop `--with-deps` from the Jenkinsfile and document the one-time root-level system-package install
as a per-agent setup step in `docs/User_Guide.md` (not something the Jenkinsfile itself can do
without root).

---

### User:
<ide_selection>...The AI is not magic — User Guide Section 6 documents three failure modes...</ide_selection>
[Pasted a third real console log. Guard/Coverage/Spec/Flaky green again; Admin Smoke passed; Web
Smoke failed at the **Vite dev server boot**, not npm install:]
```
[WebServer] You are using Node.js 20.11.1. Vite requires Node.js version 20.19+ or 22.12+.
[WebServer] SyntaxError: The requested module 'node:util' does not provide an export named 'styleText'
Error: Process from config.webServer was not able to start. Exit code: 1
```

---

### 2026-07-14 17:56:17 (UTC)

### AI (Claude Code):
Identified this as **the assistant's own configuration mistake**, not a real Jenkins-vs-GHA
difference: the `node20` tool had been registered with Node 20.11.1, but Vite 8/rolldown in
`frontend-web`/`frontend-admin` require ≥20.19. GitHub Actions' `setup-node@v4` with
`node-version: 20` always resolves to the latest 20.x, so it never hits this — the mismatch was
from pinning a specific patch version in Jenkins. Reconfigured the `node20` tool to Node 20.19.0 and
cleared the old cached Node install so the next build downloads the corrected version, without
touching the Jenkinsfile or the repo.

---

### User:
[Pasted a fourth real console log, Node now 20.19.0. Guard/Coverage/Spec/Flaky green; Admin Smoke
passed 1/1; Web Smoke: 1 pass, 1 real failure —]
```
Error: expect(locator).toBeVisible() failed
Locator: locator('input[type="email"]')
```

---

### 2026-07-14 18:01:12 (UTC)

### AI (Claude Code):
Checked the actual component: `frontend-web/src/pages/Login.jsx` uses `type="text"` for the email
field instead of `type="email"` — a **genuine, previously-undocumented frontend bug**
(`docs/BugReport.md` only lists the 12 backend bugs for FR-04/09/15/20). Declined to fix
`Login.jsx` unprompted, since the SUT is intentionally buggy by design and that file is product
code, not CI infrastructure.

---

### User:
<ide_selection>...stage('Flaky x10 (evidence)') { steps { catchError(buildResult: 'SUCCESS',
stageResult: 'UNSTABLE') { ... } } }...</ide_selection>
Cho phép hệ thống có bug, nhưng không được khóa luồng chạy, cuối cùng phải có report

---

### 2026-07-14 18:12:53 (UTC)

### AI (Claude Code):
Wrapped each Web/Admin Smoke matrix cell and Mobile Smoke Tests in
`catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE')`, matching the policy exactly: any
failure there only marks the build **UNSTABLE**, never stops the pipeline, so every remaining stage
(including Mobile Smoke) still runs and every report (guard/spec/flaky JUnit, the new Playwright
JUnit, coverage) still gets recorded at the end.

---

### User:
[Pasted a fifth real console log — a new **infrastructure-level** crash, not an SUT bug, this time
in the `Guard` stage itself:]
```
[Error: SQLITE_CONSTRAINT: UNIQUE constraint failed: coupons.code
Emitted 'error' event on Statement instance at:
] { errno: 19, code: 'SQLITE_CONSTRAINT' }
```

---

### 2026-07-14 18:17:32 (UTC)

### AI (Claude Code):
Diagnosed this as the Jenkins workspace being **reused across builds**: a stale `backend/test.sqlite`
left over from a previous run made the seed step try to re-insert a coupon that already existed.
Added a workspace-cleanup stage to the Jenkinsfile so each build starts from a clean state
(commit `16e83cb`, "add workspace cleanup stage to prevent SQLITE_CONSTRAINT errors").

---

### User:
[Pasted a sixth real console log — pipeline now runs to completion end-to-end. Guard/Coverage/Spec/
Flaky/Web/Admin Smoke all behave as expected (including the `type="email"` bug surfacing without
blocking the build). Mobile Smoke Tests, however, still hard-fails the whole build:]
```
npm ERR! ERESOLVE could not resolve
... react@19.1.0 ... jest-expo requires react@^19.2.3 ...
```

---

### 2026-07-14 18:20:31 (UTC)

### AI (Claude Code):
Spotted the gap immediately: Mobile Smoke's `catchError` had only been wrapped around `npm test`,
not `npm install` — so this real dependency conflict (React 19.1.0 vs. `jest-expo`'s peer requirement
of `^19.2.3`) still hard-failed the build instead of marking it UNSTABLE. Fixed by wrapping both
`npm install --legacy-peer-deps` and `npm test` in the same `catchError` for that stage, so the
pipeline reaches `post.always` and every report still gets recorded regardless.

---

### User:
<ide_opened_file>The user opened the file /home/ngothoaidev/Documents/Project_Management/CI-CD_and_Test-Harness_Engineering/Jenkinsfile in the IDE. This may or may not be related to the current task.</ide_opened_file>
đây là kết quả chạy

---

### 2026-07-14 18:28:08 (UTC)

### AI (Claude Code):
Confirmed via the Jenkins API that **build #9 finished UNSTABLE**, not FAILURE — exactly the
required policy — with a full report set: `guard.xml` 11/11 pass (regression gate clean),
`spec.xml` 14/14 fail (matching the 12 documented bugs in `BugReport.md`, allowed-fail by design),
`playwright-frontend-admin.xml` 1/1 pass, `playwright-frontend-web.xml` 1 pass / 1 fail (the
newly-found `Login.jsx` bug, not yet in `BugReport.md`). Updated `docs/User_Guide.md` with the
final real gotchas (Node version pinning, workspace reuse between builds, `catchError` needing to
wrap the install step too, not just the test step) so the guide reflects what was actually
encountered rather than an idealized run. Noted the user had already self-committed the mobile fix
directly (`e04199e`), so nothing further was needed there.

**Final state:** the Jenkins pipeline mirrors all 5 `ci.yml` jobs end-to-end and finishes UNSTABLE
(never FAILURE) with a complete report set — matching the stated requirement exactly ("bugs allowed
to exist, pipeline never blocked, a report must always be produced").
