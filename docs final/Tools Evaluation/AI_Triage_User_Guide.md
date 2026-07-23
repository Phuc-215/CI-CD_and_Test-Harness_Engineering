# AI Failure-Triage — User Guide

How to add **AI-assisted triage of CI failures** to a project. Written so a first-time reader
can follow it end to end, and generic enough to reuse in **any repository that already has a CI
pipeline** (a "source under test" — tests, build, lint, anything that can fail).

**The main flow is the cloud API path (Part 1).** It is what runs in GitHub Actions and what you
demo. The local model (Part 2) is only a way to *prove the flow works* without a cloud key —
same input, same report format, but offline.

Replace these placeholders with your own values:

| Placeholder | Meaning | This repo |
|-------------|---------|-----------|
| `<owner>/<repo>` | your GitHub repository | `Phuc-215/CI-CD_and_Test-Harness_Engineering` |
| `<default-branch>` | the repo's default branch | `demo` |
| `<pipeline-name>` | the `name:` of your existing CI workflow | `CI/CD Pipeline` |

---

## 0. Concepts (read once, 60 seconds)

- **Input = the failed run's log.** Triage never changes code. It reads a log and asks an LLM to
  explain it. GitHub keeps run logs ~90 days, so you can re-run triage anytime.
- **Any provider works.** The triage step needs four values: `llm-provider`, `llm-model`,
  `llm-api-key`, and (for OpenAI-compatible vendors) `llm-base-url`. Change those to use OpenAI,
  Groq, Gemini, Anthropic, a company gateway, or a local model. Nothing else changes.
- **Non-blocking.** Triage is a *separate* workflow and its AI step is `continue-on-error`, so a
  broken or rate-limited model never turns your pipeline red.
- **Secrets are redacted** before the log reaches the model (the action uses `detect-secrets`).
- **Verify, don't trust.** LLMs can invent facts. Confirm any file/line/error the model cites is
  actually in the log. See §5.

---

## Part 1 — Cloud API triage on GitHub Actions (the main flow)

**What happens, fully automatic:**

```
you push a commit  OR  open a Pull Request
        │
        ▼
your CI pipeline (<pipeline-name>) runs the tests
        │
        ▼  (if it fails)
the AI Triage workflow starts automatically,
fetches the failed run's log, and sends it to the LLM API
        │
        ▼
you read the "Workflow Failure Analysis" in the run Summary (and PR comment)
```

Nobody runs a command — **push or open a PR** is the trigger.

### 1.1 Your existing CI workflow — `.github/workflows/ci.yml`

This is the pipeline you already have; triage only needs its **`name:`**. Below is this repo's
actual file, condensed, with comments marking what changes in another repo:

```yaml
name: CI/CD Pipeline            # <-- REPLACEABLE: this string is your <pipeline-name>.
                                #     Part 1.2 must reference it exactly.
on:
  push:
    branches: ['**']            # run on a push to any branch
  pull_request:
    branches: ['**']            # run when a PR is opened/updated
  workflow_dispatch:            # allow manual runs from the Actions tab

jobs:
  # --- REPLACEABLE: these jobs are specific to THIS repo (Node.js + mocha).
  #     In your repo they are simply "whatever your CI already does". Triage does
  #     not care what the jobs are — only whether the run as a whole failed. ---
  backend-guard:                # must-pass gate: asserts current behavior + coverage + badge
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'npm' }
      - run: npm ci
      - run: npm run test:coverage
  backend-spec:                 # allowed-fail: documents known bugs (uploads JUnit)
    runs-on: ubuntu-latest
    continue-on-error: true
    steps: [ ... npm run test:spec ... ]
  flaky-watch:                  # allowed-fail: the intentional flaky test
    runs-on: ubuntu-latest
    continue-on-error: true
    steps: [ ... npm run test:flaky ... ]
  web-smoke:                    # Playwright smoke (matrix: frontend-web, frontend-admin)
    strategy: { matrix: { app: [frontend-web, frontend-admin] } }
    runs-on: ubuntu-latest
    steps: [ ... npx playwright test ... ]
  mobile-smoke:                 # Jest smoke for the mobile app
    runs-on: ubuntu-latest
    steps: [ ... npm test ... ]
```

> You do not edit `ci.yml` to add triage. Triage is a **second, separate file** (next section).

### 1.2 The triage workflow — `.github/workflows/ai-triage.yml`

Add this one file. It does not run on push; it runs **after** the pipeline finishes and only if
it **failed**. This is this repo's actual file, with replaceable parts marked:

```yaml
name: AI Triage (auto, exploratory)

on:
  workflow_run:
    workflows: ["CI/CD Pipeline"]   # <-- REPLACEABLE: must equal your <pipeline-name>
    types: [completed]
  workflow_dispatch:                # optional: run by hand against a chosen run id (testing)
    inputs:
      run_id:
        description: "Workflow run ID of a failed pipeline run to analyze"
        required: true

permissions:
  contents: read
  pull-requests: write     # so the analysis can be posted as a PR comment
  actions: read            # so the action can read the failed run's logs

jobs:
  ai-triage:
    # Auto path: only when the pipeline failed. Manual path: always.
    if: ${{ github.event_name == 'workflow_dispatch' || github.event.workflow_run.conclusion == 'failure' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: AI failure analysis
        uses: calebevans/gha-failure-analysis@v0.2.0   # ready-made action that calls the LLM
        continue-on-error: true                        # triage must NEVER break the pipeline
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}    # auto-provided; used to fetch the log
          run-id: ${{ github.event.inputs.run_id || github.event.workflow_run.id }}
          # ---- REPLACEABLE: these four lines pick the LLM. Change them to use ANY key. ----
          llm-provider: openai
          llm-model: llama-3.1-8b-instant
          llm-api-key: ${{ secrets.MODEL_API_KEY }}
          llm-base-url: https://api.groq.com/openai/v1
          # --------------------------------------------------------------------------------
          analyze-pr-context: 'true'                   # correlate the failure with the PR diff
          post-pr-comment: 'true'
```

Three ideas that make this safe at scale:
- **`workflow_run` chaining** — one workflow triggers another after it completes; the trigger is
  the pipeline result, not a person.
- **`if: ... conclusion == 'failure'`** — spend AI only on failed runs.
- **`continue-on-error: true`** — quota/model failure never affects the pipeline.

> GitHub rule: `ai-triage.yml` must be on the repo's **default branch** for the automatic
> `workflow_run` trigger to fire. Merge it to `<default-branch>` first.

### 1.3 Add your API key (any provider)

Store your key as the repo secret `MODEL_API_KEY`
(**Settings → Secrets and variables → Actions → New repository secret**), then set the four
provider lines in 1.2 from this table:

| Provider (your key) | `llm-provider` | `llm-base-url` | `llm-model` (example) |
|---------------------|----------------|----------------|------------------------|
| **OpenAI** | `openai` | `https://api.openai.com/v1` | `gpt-4o` |
| **Groq** (free tier) | `openai` | `https://api.groq.com/openai/v1` | `llama-3.1-8b-instant` |
| **Google Gemini** | `gemini` | *(leave unset)* | `gemini-2.5-flash` |
| **Anthropic** | `anthropic` | *(leave unset)* | `claude-3-5-sonnet-20241022` |
| **Together / OpenRouter / gateway** | `openai` | that vendor's `/v1` URL | any model it serves |

`secrets.GITHUB_TOKEN` (used to download the log) is provided automatically — you never create
it. Only `MODEL_API_KEY` is yours to add. **Free, zero-setup start:** get a key at
<https://console.groq.com> and keep the Groq row (Groq keys are not tied to a model — you pick
the model in the YAML).

### 1.4 Trigger it — push or open a PR

```bash
git add -A
git commit -m "trigger CI"
git push
```
…or open a Pull Request. Either starts `<pipeline-name>`. When it finishes with a failing job,
**AI Triage** starts by itself seconds later.

> Tip: in this repo the `backend-spec` job is *designed* to fail (it documents known bugs), so a
> normal push already gives the AI something real to analyze — no need to break anything.

### 1.5 Read the result — what the output looks like

On GitHub → **Actions** → the **AI Triage** run → open the job → **Summary**. The action writes a
structured *Workflow Failure Analysis*. This is the exact shape you get (values from a real run
of this repo):

````markdown
# 🔍 Workflow Failure Analysis

| | |
|---|---|
| **Workflow** | `CI/CD Pipeline` |
| **Run ID** | [#29894801422](https://github.com/owner/repo/actions/runs/29894801422) |
| **Category** | 🧪 Test |

---

## 🎯 Root Cause

The pipeline failed because backend tests could not start (`Cannot find module 'express'`) and
`npm ci` rejected an out-of-sync lock file.

## 🔬 Technical Details

### Immediate Cause
`Error: Cannot find module 'express'` in the backend test job, and
`npm error code EUSAGE — npm ci can only install packages when package.json and
package-lock.json are in sync`.

### Contributing Factors
Backend dependencies were not installed before the tests ran, and a frontend lock file was out
of date (`@emnapi/*` entries missing / mismatched).

## 📊 Evidence

### ❌ Backend Spec Tests (allowed-fail)

**Category:** Test

**Root Cause:** Missing dependency + lock file drift

<details>
<summary>📋 View Detailed Evidence</summary>

```
Exception during run: Error: Cannot find module 'express'
##[error]Process completed with exit code 1.
npm error `npm ci` can only install packages when your package.json and package-lock.json ... are in sync.
npm error Missing: @emnapi/core@1.11.2 from lock file
```
</details>

## ✅ Recommended Next Checks
1. Install backend deps before tests (`cd backend && npm ci`).
2. Confirm `express` is in `backend/package.json`.
3. Refresh the frontend lock file (`npm install`) to clear the `@emnapi/*` drift.
````

If the run came from a Pull Request, the same report is also posted as a **PR comment**, and a
**PR Impact Assessment** section rates whether your diff caused the failure.

### 1.6 What to expect (and known limits)

- First run is slow (~a few minutes): the action pulls a Docker image and a log-embedding model.
  Normal.
- **Rate limits / cost:** free tiers cap tokens per day. If the Summary shows
  `RateLimitError ... tokens per day`, switch to a lighter model, use another key, or use the
  local proof (Part 2). Always having a fallback is the discipline you want at scale.
- **Optional manual trigger** (test without a new push): the `workflow_dispatch` block lets you
  run triage against a chosen run id, from the Actions **Run workflow** button or the CLI:
  ```bash
  gh workflow run ai-triage.yml -R <owner>/<repo> --ref <default-branch> -f run_id=<failed-run-id>
  ```

---

## Part 2 — Local model, to prove the flow works (offline, no key)

This is **not** the main path. It exists to show the *same flow and the same report format* when
you have no API key, the cloud quota is gone, or you're fully offline. It runs a local model via
[Ollama](https://ollama.com) and uses the same prompt, so the output matches Part 1's format.

### 2.1 Get the failed log (no key needed)

```bash
mkdir -p logs
# (a) from a real CI run, via gh:
gh run view <run-id> -R <owner>/<repo> --log-failed > logs/ci_fail.log
# (b) or from the browser: Actions → the failed run → gear icon → "Download log archive"
# (c) or fully offline — just run the failing command locally and capture it:
#     npm test > logs/ci_fail.log 2>&1
```
Optional — trim to the decisive lines so a small model stays fast and in-context:
```bash
grep -iE 'fail|error|assert|exception|not found|exit code' logs/ci_fail.log | head -60 > logs/ci_fail_trim.log
```

### 2.2 Run the local triage

```bash
# needs Ollama running with a chat model (see §6). Tested with qwen2.5:7b-instruct.
node scripts/ai-triage-local.js logs/ci_fail_trim.log
```
It feeds the same prompt (`docs/ai-triage-prompt.md`) plus your log to the local model and prints
the same **Workflow Failure Analysis** report shown in §1.5. The script forces CPU
(`num_gpu: 0`) so it works without a GPU. If you hit `failed to allocate ... buffer`, free RAM or
use `OLLAMA_MODEL=qwen2.5:1.5b-instruct`.

Save it for the demo:
```bash
node scripts/ai-triage-local.js logs/ci_fail_trim.log > logs/sample_triage_output.md
```

---

## 5. Failure modes (3 real ways the AI can mislead)

Always verify before acting. On this project we observed:

- **FM-1 — Hallucinated facts on oversized logs.** When a log exceeds the model's context window
  it silently truncates and can fabricate file names, line numbers, or error codes not present in
  the input. *Mitigation:* send only the failing block (`--log-failed` or the trim step above),
  and enforce the prompt rule "write NOT IN LOG when a fact is absent"; cross-check every cited
  `file:line` against the repo before acting.
- **FM-2 — Blind to private/self-hosted context.** The model only sees the text log. It cannot
  see a self-hosted runner's Docker network, a firewall, or a missing system library, so it may
  blame code for what is really an environment problem. *Mitigation:* treat any "environment /
  infrastructure" root cause as needing a human check (`docker logs`, `curl`, runner config),
  never an auto-fix.
- **FM-3 — Confident but wrong on flaky failures.** Given a single failing run, the model may
  report a deterministic bug when the true cause is timing variance across runs. *Mitigation:*
  give it the 10-run pass/fail history, not one log, and require a confidence line plus the
  supporting log line so weak evidence is visible.

---

## 6. Installing Ollama (only for Part 2)

1. Download from <https://ollama.com/download> and install; it serves `http://localhost:11434`.
2. Pull a **chat** model (embedding models like `bge-m3` don't work for triage):
   `ollama pull qwen2.5:7b-instruct` (or `qwen2.5:1.5b-instruct` for low RAM).
3. Sanity check:
   ```bash
   curl -s http://localhost:11434/api/chat \
     -d '{"model":"qwen2.5:7b-instruct","messages":[{"role":"user","content":"Reply OK"}],"stream":false,"options":{"num_gpu":0}}'
   ```

---

## 7. Why this design scales (important properties)

- **Isolation / non-blocking:** triage is a separate workflow with `continue-on-error`.
- **Reproducibility:** the failed log is the single durable input; any model can re-analyze it.
- **Provider independence:** four config values switch vendors; no lock-in to one key.
- **Fallback path:** cloud API (main) + local model (proof) — no single point of failure.
- **Cost / rate-limit awareness:** free-tier caps are handled by switching models or going local.
- **Security:** secrets are redacted before any log leaves the runner.
- **Human-in-the-loop:** every AI conclusion is verified against the log before action.

---

## 8. Quick reference

```bash
# ---- MAIN: cloud API on GitHub Actions (no command needed) ----
# 1) add .github/workflows/ai-triage.yml (see 1.2) on <default-branch>
# 2) add repo secret MODEL_API_KEY = your LLM key (see 1.3)
# 3) push or open a PR — triage runs on failure; read it in Actions > Summary / PR comment

# optional manual trigger
gh workflow run ai-triage.yml -R <owner>/<repo> --ref <default-branch> -f run_id=<failed-run-id>

# ---- PROOF: local model, offline, no key ----
gh run view <run-id> -R <owner>/<repo> --log-failed > logs/ci_fail.log   # or download / run locally
node scripts/ai-triage-local.js logs/ci_fail.log
```
