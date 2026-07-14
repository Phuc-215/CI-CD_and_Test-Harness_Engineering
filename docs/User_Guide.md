# CI/CD & Test Harness User Guide

## 1. Prerequisites
- Node.js 20
- Docker Desktop (for Jenkins)
- ngrok (for webhooks)
- GitHub CLI (`gh`)

## 2. Running GitHub Actions
The GitHub Actions workflow is defined in `.github/workflows/ci.yml`. It triggers automatically on:
- `push` to any branch
- `pull_request` to any branch
- `workflow_dispatch` (manual trigger)

You can view runs via the GitHub web interface under the "Actions" tab, or via the GitHub CLI:
```bash
gh run list --workflow "CI/CD Pipeline"
gh run view <run-id>
```
To inspect artifacts like the JUnit report for the backend-spec job, download it directly from the run summary.

## 3. Running Jenkins
Jenkins serves as the traditional CI orchestrator and must be run locally via Docker.

**Start the controller:**
```bash
docker run -d --name jenkins -p 8080:8080 -p 50000:50000 \
  -v jenkins_home:/var/jenkins_home jenkins/jenkins:lts-jdk21
```
Unlock Jenkins:
```bash
docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```
**Setup:**
1. Install plugins: **NodeJS**, **JUnit**, **Coverage** (Cobertura), **GitHub**.
2. Go to **Manage Jenkins** → **Tools** and add a NodeJS 20 installation named exactly `node20`.
3. Add a Personal Access Token (PAT) credential for GitHub in Manage Jenkins → Credentials.
4. Expose your Jenkins instance using ngrok (`ngrok http 8080`) and register the `https://<ngrok-id>.ngrok-free.app/github-webhook/` webhook in your GitHub repository settings.
5. Create a Pipeline job pointing to this repository and branch.

You can view the JUnit trend and Cobertura coverage reports directly in the Jenkins UI after a build.

## 4. Test suites
The testing harness consists of various layers, isolated by `DB_PATH`:
- **Guard Suite (`test:guard`)**: Asserts the ACTUAL behavior of the API. This is a must-pass gate in CI that catches regressions. It runs fast.
- **Spec Suite (`test:spec`)**: Asserts the intended SPEC behavior. It is intentionally allowed to fail (`continue-on-error`) since the repository contains 12 documented bugs. The red test output serves as bug evidence.
- **Flaky Suite (`test:flaky`)**: Contains intentional timing-based flakiness for study.
- **Frontend Smoke Tests**: Playwright for web and admin; Jest for mobile.

Frameworks in use: `mocha + chai + supertest` (backend API), `Playwright` (web + admin), `Jest + RNTL` (mobile).

## 5. AI-triage workflow
When a CI pipeline fails, triage can be assisted with AI (ChatGPT or Claude) using a frozen structured prompt:
1. Extract the failing log from CI (e.g., `gh run view <run-id> --log-failed > logs/flaky_fail.log`).
2. Open the AI interface and paste the frozen system prompt from `docs/ai-triage-prompt.md`.
3. Paste the contents of `flaky_fail.log` at the designated `===LOG START===` block.
4. The AI will output a 3-level hypothesis tree, 3 next-checks, a confidence score, and an AI disclosure statement.

## 6. Failure Modes
- **FM-1 — Hallucinated stack traces on oversized logs.** When a pasted CI log exceeds the model's context window, ChatGPT/Claude may truncate silently and fabricate file names or line numbers not present in the input. *Mitigation:* paste only the failing block (`gh run view --log-failed`), and enforce the prompt rule "write NOT IN LOG when a fact is absent"; cross-check every cited `file:line` against the repo before acting.
- **FM-2 — Blind to private-network bottlenecks.** The AI cannot see inside the local Jenkins Docker subnet, so it misattributes a webhook/ngrok timeout or a container DNS failure to a code bug. *Mitigation:* feed it the Jenkins system log too, and treat any "network" L1 hypothesis as requiring a human `docker logs jenkins` / `curl` check, never an auto-fix.
- **FM-3 — Confident wrong root cause on flaky non-determinism.** Given one failing run, the model may declare a deterministic bug when the true cause is timing variance across runs. *Mitigation:* always supply the 10-run pass/fail table, not a single log; require the CONFIDENCE line + supporting log line so low-evidence claims are visible.

*(AI Disclosures AI-03/04: Failure Modes were identified from observed behavior during our own triage runs; each mitigation is verified against our actual pipeline, not assumed.)*

## 7. Troubleshooting
- **Webhook not firing:** Check your `ngrok` URL; the free tier URL changes every time you restart ngrok. Update the GitHub webhook settings.
- **Allowed-fail vs must-pass:** If the entire GitHub Actions pipeline fails because of `backend-spec`, ensure the job contains `continue-on-error: true`.
- **Coverage badge not updating:** Coverage is only updated from the main branch. Check if the latest run generated the Cobertura report properly in the `backend-guard` step.
- **Network timeouts in Jenkins:** If Jenkins cannot reach GitHub, ensure the container has DNS resolution. You may need to restart Docker Desktop.
