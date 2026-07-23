# AI Failure-Triage — User Guide

A step-by-step guide to running **AI-assisted triage** of CI failures for this project.
Written for someone who has never touched the repo before. You can follow it top to bottom.

There are **two ways** to run triage, and the guide covers both:

| Path | Where it runs | LLM | When to use |
|------|---------------|-----|-------------|
| **A. Remote (automated)** | GitHub Actions | Groq (cloud, free tier) | The real demo. Fires automatically when the pipeline fails. |
| **B. Local (manual)** | Your machine | Ollama `qwen2.5` (offline) | Backup when the cloud quota is used up, or fully offline. |

Both paths take the **same input** — the log of a failed CI run — and produce the **same shape
of output**: a 3-level root-cause hypothesis tree plus concrete next checks. That symmetry is
the point: you can compare a cloud model, a local model, and a human on identical evidence.

---

## 0. Concepts (read once, 60 seconds)

- **The only durable input is the failed run's log.** GitHub keeps run logs ~90 days. Triage
  never changes your code — it only *reads a log* and asks a model to explain it. So you can
  re-run triage with any model, any time, without re-running the pipeline.
- **Non-blocking by design.** Triage runs in a *separate* workflow and every AI step is
  `continue-on-error`. A broken or rate-limited model can never turn your pipeline red. This is
  essential on large systems: observability tooling must not gate delivery.
- **Secrets are redacted.** The remote action strips secrets from logs before sending them to
  the LLM. Never paste raw secrets into any model yourself.
- **Verify, don't trust.** LLMs can invent facts ("hallucinate"). Always check that any file,
  line number, or error code the model cites actually appears in the log. See §5.

---

## 1. Prerequisites

- A GitHub account with access to the repo `Phuc-215/CI-CD_and_Test-Harness_Engineering`.
- `git` and **Node.js 20+** installed.
- **GitHub CLI** (`gh`) — install: `winget install --id GitHub.cli` (Windows) or see cli.github.com.
- For the local path only: **Ollama** running with a chat model (details in §4).

Clone and enter the repo:
```bash
git clone https://github.com/Phuc-215/CI-CD_and_Test-Harness_Engineering.git
cd CI-CD_and_Test-Harness_Engineering
gh auth login          # choose GitHub.com → HTTPS → open browser, paste the code
```

---

## 2. Path A — Remote AI triage on GitHub Actions (the real demo)

### 2.1 One-time setup: add the API key

The remote triage uses **Groq** (free, OpenAI-compatible). Groq API keys are **not tied to a
model** — you pick the model in the workflow, not when creating the key.

1. Create a free key at <https://console.groq.com> → API Keys.
2. In the repo: **Settings → Secrets and variables → Actions → New repository secret**.
3. Name it exactly `GROQ_API_KEY`, paste the `gsk_...` value, save.

The workflow that uses it is `.github/workflows/ai-triage.yml`. It must live on the repo's
**default branch** (currently `demo`) — GitHub only lets you trigger a workflow that exists on
the default branch. It is already there; you do not need to change it.

### 2.2 Get a failed run to analyze

Triage needs a *failed* pipeline run. List recent runs and copy the ID of a failed one:
```bash
gh run list -R Phuc-215/CI-CD_and_Test-Harness_Engineering --workflow "CI/CD Pipeline" --limit 5
```
The number in the `DATABASE_ID` / URL (e.g. `29894801422`) is the **run id**.

> Tip: the `backend-spec` job is *designed* to fail (it documents known bugs), so almost any
> recent run has a failure to analyze.

### 2.3 Run the triage

Two ways it triggers:

- **Automatic:** whenever "CI/CD Pipeline" finishes with a failure, triage starts on its own.
- **Manual (for the demo):** dispatch it against a specific run id:
  ```bash
  gh workflow run ai-triage.yml \
    -R Phuc-215/CI-CD_and_Test-Harness_Engineering \
    --ref demo \
    -f run_id=29894801422
  ```

### 2.4 Watch it and read the result

```bash
# find the triage run
gh run list -R Phuc-215/CI-CD_and_Test-Harness_Engineering --workflow ai-triage.yml --limit 3
# follow it to completion
gh run watch <triage-run-id> -R Phuc-215/CI-CD_and_Test-Harness_Engineering
```
Open the run in the browser (or `gh run view <id> --web`). The analysis appears in the job's
**Summary** — category + root-cause narrative written by the model.

### 2.5 What to expect (and known limits)

- First run is slow (~several minutes): the action pulls a Docker image and a log-embedding
  model. This is normal.
- **Free-tier rate limit:** Groq caps tokens per day. If you see
  `RateLimitError ... tokens per day (TPD)`, the daily budget is used up. Fixes: wait for the
  daily reset, switch `llm-model` to the lighter `llama-3.1-8b-instant` (already the default in
  the workflow), or use **Path B** below. This is exactly the kind of quota limit you plan for
  on large systems — always have a fallback triage path.

---

## 3. Path B — Local AI triage with your Ollama `qwen2.5` (offline, free)

Use this when the cloud quota is gone or you want zero external calls. It runs entirely on your
machine, so there is **no API key and no cost**.

### 3.1 Export the failed log from GitHub

```bash
mkdir -p logs
gh run view 29894801422 -R Phuc-215/CI-CD_and_Test-Harness_Engineering --log-failed > logs/ci_fail.log
```

Optional but recommended — trim to the decisive lines so a small local model stays fast and
inside its context window:
```bash
grep -iE 'failing|AssertionError|Error:|npm ERR|exit code|Cannot|not found' logs/ci_fail.log \
  | sed -E 's/^[^\t]*\t[^\t]*\t[0-9T:.Z-]+ //' | head -60 > logs/ci_fail_trim.log
```

### 3.2 Make sure Ollama has a chat model

```bash
curl -s http://localhost:11434/api/tags        # list installed models
```
You need a **chat** model (embedding models like `bge-m3` do not work for triage). This project
was tested with `qwen2.5:7b-instruct`. If you don't have it: `ollama pull qwen2.5:7b-instruct`.
Lighter option for low-RAM machines: `qwen2.5:1.5b-instruct`.

### 3.3 Run the triage script

```bash
node scripts/ai-triage-local.js logs/ci_fail_trim.log
```
That's it. The script feeds the same structured prompt (`docs/ai-triage-prompt.md`) plus your
log to the local model and prints the 3-level hypothesis tree.

Useful overrides:
```bash
# pick a different local model / host, and save the output
OLLAMA_MODEL=qwen2.5:1.5b-instruct node scripts/ai-triage-local.js logs/ci_fail_trim.log > logs/triage_qwen_output.md
```

The script forces CPU (`num_gpu: 0`) so it works without a GPU. If you hit
`failed to allocate ... buffer`, your machine is low on free RAM — close other apps or use the
1.5b model.

---

## 4. Installing Ollama (only if you don't have it)

1. Download from <https://ollama.com/download> and install.
2. Start it (it runs a local server on `http://localhost:11434`).
3. Pull a chat model: `ollama pull qwen2.5:7b-instruct`.
4. Sanity check:
   ```bash
   curl -s http://localhost:11434/api/chat \
     -d '{"model":"qwen2.5:7b-instruct","messages":[{"role":"user","content":"Reply OK"}],"stream":false,"options":{"num_gpu":0}}'
   ```
   A JSON reply containing `"content":"OK"` means you're ready.

---

## 5. Comparing outputs & verifying (the part that matters)

Whichever path you used, do this before trusting anything — it is also the graded "AI
disclosure" discipline and the habit that keeps AI safe on large systems:

1. **Read the log yourself first** (manual triage). Note the real error string and how long it
   took you.
2. **Read the AI output.** Fill a small comparison table:

   | Criterion | Human | AI |
   |-----------|-------|----|
   | Time to first hypothesis | | |
   | Correct root cause? | | |
   | Reached level-3 depth? | | |
   | Hallucinations (facts NOT in the log) | | |
   | Actionable next checks | | |

3. **Hunt for hallucinations.** For every file, line, or error code the model cites, confirm it
   appears in the log. Real example from this project: on a real CI log the model reported error
   code `ERESOLVE`, but the log actually said `EUSAGE` — a fabricated fact caught only by
   checking against the source. On a large system, one wrong "confident" root cause can send a
   team down the wrong path; verification is non-negotiable.

---

## 6. Why this design scales (important properties)

Even though the demo is small, the setup keeps the properties you need in production:

- **Isolation / non-blocking:** triage is a separate workflow with `continue-on-error`, so
  observability never blocks delivery.
- **Reproducibility:** the failed log is the single durable input; any model can re-analyze it
  later, so results are repeatable and model-agnostic.
- **Fallback path:** cloud (Groq) for convenience, local (Ollama) for when quota/network fails —
  no single point of failure for triage.
- **Cost / rate-limit awareness:** free-tier token caps are explicit and handled by switching
  models or going local, not by silently failing.
- **Security:** secrets are redacted before any log leaves the runner.
- **Human-in-the-loop:** every AI conclusion is verified against the log before action.

---

## 7. Quick reference

```bash
# REMOTE (Groq, on GitHub Actions)
gh run list -R Phuc-215/CI-CD_and_Test-Harness_Engineering --workflow "CI/CD Pipeline" --limit 5
gh workflow run ai-triage.yml -R Phuc-215/CI-CD_and_Test-Harness_Engineering --ref demo -f run_id=<ID>
gh run watch <triage-id> -R Phuc-215/CI-CD_and_Test-Harness_Engineering

# LOCAL (Ollama qwen2.5, offline)
gh run view <ID> -R Phuc-215/CI-CD_and_Test-Harness_Engineering --log-failed > logs/ci_fail.log
node scripts/ai-triage-local.js logs/ci_fail.log
```
