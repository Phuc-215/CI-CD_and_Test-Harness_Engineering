# T07 — Demo Screencast Script (5–8 min, YouTube)

> Format: `Demo_Screencast.mp4`, 5–8 minutes, hosted on YouTube.
> **Rule of Pairing is the backbone of this script** — every segment shows ONE traditional
> feature beside ONE AI feature:
> - CI: **Jenkins (traditional)** ‖ **GitHub Actions (backup/comparison)**
> - Triage: **manual log reading (traditional)** ‖ **ChatGPT/Claude (AI)**
>
> Target total ≈ 7:00. Times are cumulative. Record at 1080p, terminal font ≥ 16pt.

---

## Pre-flight (before you hit record)

- [ ] Jenkins running (`docker ps` shows `jenkins`), a green build already in history.
- [ ] `gh auth status` OK; repo on branch `github-actions`.
- [ ] `logs/flaky_fail.log` already captured (a real failing run).
- [ ] Two browser tabs open: GitHub Actions runs page, Jenkins dashboard.
- [ ] ChatGPT/Claude open with the frozen system prompt from `docs/ai-triage-prompt.md`.
- [ ] Terminal at repo root, screen clean, notifications off.

---

## Segment 1 — Intro & architecture (0:00 → 0:45)

- **Say:** "Topic T07, CI/CD and Test-Harness Engineering for the EShop Node.js app. We pair a
  traditional CI, Jenkins, against GitHub Actions, and a traditional manual triage against an
  AI triage with ChatGPT/Claude."
- **Show:** the Mermaid diagram from `T07_Seminar_Execution_Plan.md` §1 (dual CI + dual triage).
- **Name the team:** Engineer A = Jenkins/report, B = flaky/telemetry, C = AI triage.

## Segment 2 — The test harness (0:45 → 1:45)

- **Say:** "Backend uses mocha + chai + supertest with an nyc coverage gate; mobile uses Jest;
  web uses Playwright. Two backend suites: a must-pass **guard**, and an allowed-fail **spec**
  that documents 12 known bugs."
- **Show terminal:**
  ```bash
  npm run test:guard      # green, must-pass gate
  ```
- **Show** `docs/BugReport.md` scrolling briefly — "spec suite turns these into evidence, red
  by design, without blocking merges."

## Segment 3 — PAIR 1: Jenkins ‖ GitHub Actions (1:45 → 3:30)

- **Traditional (Jenkins):** open the Jenkins job → "Build Now" (or show last build). Point at:
  Checkout → NPM Install (cached) → Guard green → Spec/Flaky **UNSTABLE** (amber) → JUnit +
  Cobertura in the UI.
- **Backup (GitHub Actions):** switch tab → `gh workflow run "CI/CD Pipeline"` or show a recent
  run → same 4 lanes: `backend-guard` green, `backend-spec` allowed-fail, `flaky-watch`,
  smoke.
- **Say the comparison out loud:** "Same stages, two orchestrators. Jenkins needs a manual PAT
  credential and an ngrok webhook; GitHub Actions injects `GITHUB_TOKEN` and triggers natively.
  Caching: lockfile-hash key on GHA versus the mounted `~/.npm` on Jenkins." (This is the
  telemetry table.)

## Segment 4 — PAIR context: the flaky test (3:30 → 4:45)

- **Say:** "We intentionally inoculated a timing-based flaky test to study non-determinism."
- **Show the code** `tests/api/flaky/timing.flaky.test.js` (the 50ms budget vs 0–80ms work).
- **Run it live 10×:**
  ```bash
  for i in $(seq 1 10); do npm run test:flaky >/dev/null 2>&1 && echo "run $i PASS" || echo "run $i FAIL"; done
  ```
- **Point at the mix** (e.g. 6 PASS / 4 FAIL): "Same code, same commit, different result — this
  is flakiness, and it is isolated so it never blocks the guard gate."

## Segment 5 — PAIR 2: manual triage ‖ AI triage (4:45 → 6:30)

- **Traditional (manual):** open `logs/flaky_fail.log`, read the assertion aloud, sketch a
  quick root-cause guess. Mention: "this took me ~90 seconds and I stopped at one hypothesis."
- **AI (ChatGPT/Claude):** paste the same log under the frozen system prompt. Show the output:
  the **3-level hypothesis tree**, **3 next-checks**, the **CONFIDENCE line**, and the
  **AI-DISCLOSURE line**.
- **Say (grading-critical):** "Note the prompt forbids invented facts — anything not in the log
  is marked NOT IN LOG. We verified every cited line exists. That's our AI-03/04 disclosure."
- **Show** the comparison matrix (time, correct root cause, depth, hallucinations, next-checks).

## Segment 6 — Failure modes & close (6:30 → 7:00)

- **Say:** "The AI is not magic — User Guide Section 6 documents three failure modes: it
  hallucinates stack traces when logs exceed the context window, it's blind to the private
  Jenkins Docker subnet, and it sounds confident on flaky non-determinism from a single run.
  Each has a mitigation."
- **Close:** "Traditional plus AI, paired at every step. Full checklist and report structure
  are in `docs/checklist.md`. Thanks."

---

## On-screen lower-thirds (optional captions)

| Time | Caption |
|------|---------|
| 0:00 | T07 — CI/CD & Test-Harness Engineering |
| 1:45 | PAIR 1 — Jenkins (traditional) ‖ GitHub Actions |
| 3:30 | Intentional flaky test — 10 runs |
| 4:45 | PAIR 2 — Manual ‖ AI triage |
| 6:30 | Failure Modes (User Guide §6) |

## Recording tips
- Do the 10× flaky loop for real on camera — the live PASS/FAIL mix is the strongest evidence.
- If a live Jenkins build is slow, pre-run it and show the completed build to stay under 8 min.
- Keep the AI paste-and-response unedited to prove no hallucination cherry-picking.
- Upload unlisted/public to YouTube; commit the link in `docs/` (Engineer B).
