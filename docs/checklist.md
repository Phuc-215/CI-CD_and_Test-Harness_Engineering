# T07 — Execution Checklist (for the next agent / teammate)

> Purpose: hand-off checklist to finish the T07 seminar. The **demo-critical code is already
> implemented and verified** (see §A). Remaining work is Jenkins-live, the 10-run capture, AI
> triage, and the report/deliverables (see §B–§E). Check items off in order. Owners: A/B/C.
>
> Compliance reminder (2026 briefing): Jenkins mandatory, Rule of Pairing (traditional + AI per
> demo), S1 survey strict format, User_Guide 7 sections incl. Failure Modes, AI disclosures
> AI-02/03/04 graded, no hallucinations, Mermaid diagrams, no LaTeX in code blocks.

---

## A. DONE — already implemented & verified in this repo (do NOT redo)

- [x] `.github/workflows/ci.yml` live — `push` + `pull_request` + **`workflow_dispatch`**.
- [x] Jobs: `backend-guard` (must-pass + coverage + badge), `backend-spec` (allowed-fail,
      JUnit artifact), **`flaky-watch`** (allowed-fail, uploads `flaky-run-<n>`), `web-smoke`
      (matrix), `mobile-smoke`.
- [x] `tests/api/flaky/timing.flaky.test.js` — intentional timing flake. **Verified locally:
      6 PASS / 4 FAIL over 10 runs.**
- [x] `package.json` scripts: `test:flaky`, and `test:coverage` now emits **Cobertura**
      (`coverage/cobertura-coverage.xml`) for Jenkins parity.
- [x] `Jenkinsfile` (repo root) — mirrors `ci.yml` stage-for-stage.

Sanity re-verify anytime:
```bash
npm ci
for i in $(seq 1 10); do npm run test:flaky >/dev/null 2>&1 && echo PASS || echo FAIL; done
```

---

## B. Jenkins live (Engineer A) — traditional CI, mandatory

- [ ] Start controller:
  ```bash
  docker run -d --name jenkins -p 8080:8080 -p 50000:50000 \
    -v jenkins_home:/var/jenkins_home jenkins/jenkins:lts-jdk21
  docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
  ```
- [ ] Install plugins: **NodeJS**, **JUnit**, **Coverage** (Cobertura), **GitHub**.
- [ ] Manage Jenkins → Tools → add NodeJS 20 named exactly **`node20`**.
- [ ] Create a **Pipeline** job → *Pipeline script from SCM* → point at this repo + branch
      `github-actions`, script path `Jenkinsfile`.
- [ ] Expose + webhook: `ngrok http 8080`; add GitHub webhook
      `https://<id>.ngrok-free.app/github-webhook/` (Pushes + PRs); enable *GitHub hook trigger*.
- [ ] Add a **PAT credential** (Manage Jenkins → Credentials) — Jenkins has no auto
      `GITHUB_TOKEN`; record this asymmetry for the report.
- [ ] Run once → confirm green **guard**, **UNSTABLE** spec/flaky stages, JUnit + Coverage
      visible in the build UI.

## C. 10-run flaky capture (Engineer B) — evidence for slides/worksheet

- [ ] GitHub Actions batch:
  ```bash
  for i in $(seq 1 10); do gh workflow run "CI/CD Pipeline" --ref github-actions; sleep 20; done
  gh run list --workflow "CI/CD Pipeline" --limit 10
  ```
- [ ] Capture a FAILING flaky log:
  ```bash
  gh run view <run-id> --log-failed > logs/flaky_fail.log
  gh run download <run-id> -n flaky-run-<n>
  ```
- [ ] Jenkins batch: the `Flaky x10` stage already loops 10×; open the build console + JUnit
      trend graph for the same evidence.
- [ ] Record a **10-row pass/fail table per CI** (run #, result, elapsed ms).
- [ ] Fill the **telemetry table**: first-build setup time, warm run time, cache efficiency,
      feedback latency — for both Jenkins and GHA.

## D. AI triage vs manual (Engineer C) — Rule of Pairing

- [ ] Save the frozen system prompt to `docs/ai-triage-prompt.md` (copy from the execution
      plan §3). Must include the AI-DISCLOSURE output line.
- [ ] Run AI triage: paste `logs/flaky_fail.log` into ChatGPT/Claude → capture the 3-level
      hypothesis tree + 3 next-checks.
- [ ] Run manual triage in parallel: human writes their own tree, **timestamp the duration**.
- [ ] Fill the comparison matrix (time, correct root cause, L3 depth, hallucinations,
      actionable next-checks).
- [ ] Verify **no hallucinations**: every `file:line` the AI cites must exist in the repo/log;
      mark any invented fact (grades AI-03/04).

## E. Deliverables (report done later — this checklist is the source of truth)

- [ ] `Tool_Survey_Proposal.md` (A) — topic code T07, Survey A (Jenkins/GHA/GitLab) + Survey B
      (ChatGPT-Claude/Datadog FTM/manual), 5-axis matrix each, 3-bullet rationale, AI-02.
- [ ] `User_Guide.md` (A) — **exactly 7 sections**, Section 6 = Failure Modes (FM-1/2/3 from
      the plan), AI-03/04 disclosures.
- [ ] `Activity_Worksheet.md` (C) — "Pipeline Postmortem": give students `flaky_fail.log`,
      have them build a hypothesis tree, compare to AI output.
- [ ] `Seminar_Slides.pptx` (C) — export Mermaid diagram as PNG; embed telemetry + triage
      tables.
- [ ] `Demo_Screencast.mp4` (B) — record per `docs/script-demo.md`; upload to YouTube; commit
      the link + storyboard.

## F. Commit hygiene (graded via GitHub logs)

- [ ] Each engineer works on their own branch: `feat/jenkins-A`, `test/flaky-B`, `docs/triage-C`.
- [ ] Conventional Commits (`feat:` / `test:` / `docs:` / `chore:`).
- [ ] Merge via PR; no squashes that bury authorship on shared files.
- [ ] Every AI-assisted artifact carries its AI-disclosure line.

---

### Definition of Done (S2 ready)
Jenkins + GHA both produce green-guard / unstable-flaky builds with JUnit + Cobertura; a
10-run flakiness table exists for both CIs; one AI-vs-manual triage comparison is complete with
zero un-flagged hallucinations; all five deliverables checked in with clean per-author commits.
