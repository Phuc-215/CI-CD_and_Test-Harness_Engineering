# AI Failure-Triage — User Guide

A step-by-step guide to adding **AI-assisted triage** of CI failures to a project. Written so
someone who has never seen the repo can follow it top to bottom, and generic enough to drop
into **any repository that already has a CI pipeline** (a "source under test" — tests, build,
lint, anything that can fail).

Throughout, replace the placeholders with your own values:

| Placeholder | Meaning | Example in this repo |
|-------------|---------|----------------------|
| `<owner>/<repo>` | your GitHub repository | `Phuc-215/CI-CD_and_Test-Harness_Engineering` |
| `<default-branch>` | the repo's default branch | `demo` |
| `<pipeline-name>` | the `name:` of your existing CI workflow | `CI/CD Pipeline` |

There are **two ways** to run triage. **Both accept any LLM API key you already have** — you do
not need a specific vendor. Groq and Ollama below are just the two cheapest examples (one free
cloud key, one fully local).

| Path | Where it runs | LLM | Needs a key? |
|------|---------------|-----|--------------|
| **A. Remote (automatic)** | GitHub Actions | **any** OpenAI-compatible API key | yes — any key you have |
| **B. Local (manual)** | Your machine | Ollama (local model) | no key, offline |

Both take the **same input** — the log of a failed CI run — and produce the **same output
shape**: a 3-level root-cause hypothesis tree plus concrete next checks. That symmetry lets you
compare a cloud model, a local model, and a human on identical evidence.

---

## 0. Concepts (read once, 60 seconds)

- **The only durable input is the failed run's log.** GitHub keeps run logs ~90 days. Triage
  never changes your code — it *reads a log* and asks a model to explain it. You can re-run it
  with any model, any time, without re-running the pipeline.
- **Any provider works.** The triage step just needs three things: a provider name, an API
  base URL, and a model name — plus your key. Swap those four values to use OpenAI, Groq,
  Together, OpenRouter, Anthropic, a company-internal gateway, or a local model. Nothing else
  changes.
- **Non-blocking by design.** Triage runs in a *separate* workflow and every AI step is
  `continue-on-error`. A broken or rate-limited model can never turn your pipeline red.
- **Secrets are redacted** before the log is sent to the model. Never paste raw secrets into any
  model yourself.
- **Verify, don't trust.** LLMs invent facts ("hallucinate"). Always confirm any file, line, or
  error code the model cites actually appears in the log. See §5.

---

## 1. Prerequisites

- A GitHub repository that **already has at least one CI workflow** under `.github/workflows/`
  (something that runs on push/PR and can fail). If yours doesn't, any workflow that runs tests
  works.
- `git` and **Node.js 20+** installed (Node only needed for the local Path B).
- **An LLM API key** for Path A — *any* provider you have access to (see §2.2 for a preset
  table, including a free option).
- **GitHub CLI** (`gh`) — *optional*. Path A is automatic via push/PR + a browser; `gh` is only
  for the optional manual trigger. Install: `winget install --id GitHub.cli` or cli.github.com.
- For Path B only: **Ollama** with a local chat model (see §4).

---

## 2. Path A — Remote AI triage on GitHub Actions

**The intended flow (fully automatic):**

```
you push a commit  OR  open a Pull Request
        │
        ▼
your CI pipeline (<pipeline-name>) runs
        │
        ▼  (if it fails)
the AI Triage workflow starts automatically,
grabs the failed run's log, and sends it to the LLM
        │
        ▼
you read the root-cause analysis in the run Summary (or PR comment)
```

Nobody runs a command — pushing or opening a PR is the trigger. §2.1 shows the workflow file to
add, §2.2 wires in *your* API key, §2.3 triggers it, §2.4 reads the result.

### 2.1 Add the triage workflow (one file)

Your repo already has a CI workflow. Note its `name:` — that is `<pipeline-name>`:
```yaml
# .github/workflows/ci.yml  (YOUR existing pipeline — shown only for its name + triggers)
name: CI/CD Pipeline           # <-- this is <pipeline-name>
on:
  push:
    branches: ['**']
  pull_request:
    branches: ['**']
# ... your jobs ...
```

Add **one new file**, `.github/workflows/ai-triage.yml`. It does not run on push; it runs
*after* the pipeline finishes and only if it **failed**:
```yaml
name: AI Triage (auto)
on:
  workflow_run:
    workflows: ["CI/CD Pipeline"]   # <-- must exactly match <pipeline-name>
    types: [completed]
  workflow_dispatch:                # optional: also run by hand for testing
    inputs:
      run_id:
        description: "A failed run id to analyze"
        required: true

permissions:
  actions: read            # read the failed run's logs
  contents: read
  pull-requests: write     # post the analysis as a PR comment

jobs:
  ai-triage:
    # Auto: only when the pipeline failed. Manual: always.
    if: ${{ github.event_name == 'workflow_dispatch' || github.event.workflow_run.conclusion == 'failure' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: AI failure analysis
        uses: calebevans/gha-failure-analysis@v0.2.0   # ready-made action that calls the LLM
        continue-on-error: true                        # triage must NEVER break your pipeline
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}    # auto-provided; used to fetch the log
          run-id: ${{ github.event.inputs.run_id || github.event.workflow_run.id }}
          # ---- provider settings: change these four to use ANY key you have (see 2.2) ----
          llm-provider: openai
          llm-model: llama-3.1-8b-instant
          llm-api-key: ${{ secrets.MODEL_API_KEY }}
          llm-base-url: https://api.groq.com/openai/v1
          # --------------------------------------------------------------------------------
          analyze-pr-context: 'true'                   # correlate the failure with the PR diff
          post-pr-comment: 'true'
```

The three ideas that make this safe on real/large systems:
- **`workflow_run` chaining** — one workflow triggers another *after* it completes; the trigger
  is the pipeline result, not a person.
- **`if: ... conclusion == 'failure'`** — only spend AI on failed runs.
- **`continue-on-error: true`** — if the AI or its quota fails, the pipeline is unaffected.

> GitHub rule: `ai-triage.yml` must be on the repo's **default branch** for the automatic
> `workflow_run` trigger to fire. Merge it to `<default-branch>` first.

### 2.2 Use ANY API key — provider preset table

The action works with any OpenAI-compatible endpoint (and a few native ones). Pick whatever key
you have, set the **four** provider values in the YAML, and store the key as the repo secret
`MODEL_API_KEY` (**Settings → Secrets and variables → Actions → New repository secret**).

| Provider (your key) | `llm-provider` | `llm-base-url` | `llm-model` (example) |
|---------------------|----------------|----------------|------------------------|
| **OpenAI** | `openai` | `https://api.openai.com/v1` | `gpt-4o-mini` |
| **Groq** (free tier) | `openai` | `https://api.groq.com/openai/v1` | `llama-3.1-8b-instant` |
| **Together AI** | `openai` | `https://api.together.xyz/v1` | `meta-llama/Llama-3.3-70B-Instruct-Turbo` |
| **OpenRouter** | `openai` | `https://openrouter.ai/api/v1` | `openai/gpt-4o-mini` |
| **Anthropic** | `anthropic` | *(leave unset)* | `claude-sonnet-5` |
| **Google Gemini** | `gemini` | *(leave unset)* | `gemini-2.0-flash` |
| **Local Ollama** \* | `openai` | `http://localhost:11434/v1` | `qwen2.5:7b-instruct` |

\* Local Ollama in Path A only works on a **self-hosted runner** (a GitHub-hosted runner can't
reach your `localhost`). For a laptop with no self-hosted runner, use **Path B** instead.

> Note: `secrets.GITHUB_TOKEN` (used to download the log) is provided automatically — you never
> create it. Only `MODEL_API_KEY` is yours to add.

**Free, zero-setup starting point:** create a free key at <https://console.groq.com>, keep the
Groq row above. Groq keys are **not tied to a model** — you choose the model in the YAML.

### 2.3 Trigger it the real way — push or open a PR

Normal developer action; no CLI, no special command:
```bash
git add -A
git commit -m "trigger CI"
git push
```
…or open a Pull Request. Either starts `<pipeline-name>`. When it finishes with a failing job,
**AI Triage** starts by itself seconds later.

> Tip: if your pipeline has a job that fails often (e.g. a test that documents a known bug), a
> normal push already gives the AI something to analyze — you don't need to break anything.

### 2.4 Read the result

On GitHub → **Actions** tab:
1. Find the **AI Triage (auto)** run that started after your pipeline.
2. Open the job → read the **Summary**: the failure **category** + a root-cause narrative.
3. If you opened a PR, the same analysis is posted as a **PR comment**.

### 2.5 What to expect (and known limits)

- First run is slow (~a few minutes): the action pulls a Docker image and a log-embedding model.
  Normal.
- **Rate limits / cost:** free tiers cap tokens per day. If the Summary shows a
  `RateLimitError ... tokens per day`, switch to a lighter model, use a different key, or fall
  back to **Path B**. Having a fallback triage path is exactly the discipline you want at scale.
- **Optional manual trigger** (test without a new push): the `workflow_dispatch` block lets you
  run triage against a chosen run id — from the Actions **Run workflow** button, or the CLI:
  ```bash
  gh workflow run ai-triage.yml -R <owner>/<repo> --ref <default-branch> -f run_id=<failed-run-id>
  ```

---

## 3. Path B — Local AI triage with Ollama (offline, no key)

Use this when you have no API key, the cloud quota is gone, or you want zero external calls. It
runs entirely on your machine — **no key, no cost, works offline**.

### 3.1 Get the failed log

Any of these produce a log file; pick what fits (none require an API key):

```bash
# (a) from a real CI run, via gh
gh run view <run-id> -R <owner>/<repo> --log-failed > logs/ci_fail.log

# (b) from the browser: Actions → the failed run → gear icon → "Download log archive" (zip)

# (c) fully offline — just run your failing test/build locally and capture its output
npm test > logs/ci_fail.log 2>&1        # or whatever command your pipeline runs
```

Optional — trim to the decisive lines so a small local model stays fast and in-context:
```bash
grep -iE 'fail|error|assert|exception|not found|exit code' logs/ci_fail.log | head -60 > logs/ci_fail_trim.log
```

### 3.2 Make sure Ollama has a chat model

```bash
curl -s http://localhost:11434/api/tags        # list installed models
```
You need a **chat** model (embedding models like `bge-m3` don't work for triage). Tested with
`qwen2.5:7b-instruct`. If missing: `ollama pull qwen2.5:7b-instruct`. Low-RAM option:
`qwen2.5:1.5b-instruct`.

### 3.3 Run the triage script

```bash
node scripts/ai-triage-local.js logs/ci_fail_trim.log
```
It feeds the same structured prompt (`docs/ai-triage-prompt.md`) plus your log to the local
model and prints the 3-level hypothesis tree.

Useful overrides:
```bash
OLLAMA_MODEL=qwen2.5:1.5b-instruct node scripts/ai-triage-local.js logs/ci_fail_trim.log > logs/triage_output.md
```
The script forces CPU (`num_gpu: 0`) so it works without a GPU. If you hit
`failed to allocate ... buffer`, free RAM (close apps) or use the 1.5b model.

---

## 4. Installing Ollama (only if you don't have it)

1. Download from <https://ollama.com/download> and install.
2. Start it (local server at `http://localhost:11434`).
3. Pull a chat model: `ollama pull qwen2.5:7b-instruct`.
4. Sanity check:
   ```bash
   curl -s http://localhost:11434/api/chat \
     -d '{"model":"qwen2.5:7b-instruct","messages":[{"role":"user","content":"Reply OK"}],"stream":false,"options":{"num_gpu":0}}'
   ```
   A reply containing `"content":"OK"` means you're ready.

---

## 5. Comparing outputs & verifying (the part that matters)

Whichever path you used, do this before trusting anything — it is also the graded "AI
disclosure" discipline and the habit that keeps AI safe at scale:

1. **Read the log yourself first** (manual triage). Note the real error string and your time.
2. **Read the AI output** and fill a small table:

   | Criterion | Human | AI |
   |-----------|-------|----|
   | Time to first hypothesis | | |
   | Correct root cause? | | |
   | Reached level-3 depth? | | |
   | Hallucinations (facts NOT in the log) | | |
   | Actionable next checks | | |

3. **Hunt for hallucinations.** For every file, line, or error code the model cites, confirm it
   is in the log. Real example from this project: on a real CI log the model reported error code
   `ERESOLVE`, but the log actually said `EUSAGE` — a fabricated fact caught only by checking
   the source. At scale, one confident-but-wrong root cause sends a team down the wrong path;
   verification is non-negotiable.

---

## 6. Why this design scales (important properties)

Even for a small demo, the setup keeps the properties you need in production:

- **Isolation / non-blocking:** triage is a separate workflow with `continue-on-error`, so
  observability never blocks delivery.
- **Reproducibility:** the failed log is the single durable input; any model can re-analyze it
  later — repeatable and model-agnostic.
- **Provider independence:** four config values switch vendors; no lock-in to one API key.
- **Fallback path:** cloud for convenience, local for when quota/network fails — no single point
  of failure for triage.
- **Cost / rate-limit awareness:** free-tier caps are explicit and handled by switching models
  or going local, not by silently failing.
- **Security:** secrets are redacted before any log leaves the runner.
- **Human-in-the-loop:** every AI conclusion is verified against the log before action.

---

## 7. Quick reference

```bash
# ---- PATH A: automatic (no command) ----
# 1) add .github/workflows/ai-triage.yml (see 2.1) on <default-branch>
# 2) add repo secret MODEL_API_KEY = your LLM key (see 2.2)
# 3) just push or open a PR — triage runs on failure; read it in Actions > Summary / PR comment

# ---- PATH A: optional manual trigger ----
gh workflow run ai-triage.yml -R <owner>/<repo> --ref <default-branch> -f run_id=<failed-run-id>

# ---- PATH B: local, offline, no key ----
gh run view <run-id> -R <owner>/<repo> --log-failed > logs/ci_fail.log   # or download / run tests locally
node scripts/ai-triage-local.js logs/ci_fail.log
```
