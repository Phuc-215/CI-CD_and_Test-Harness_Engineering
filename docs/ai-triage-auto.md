# Automated AI Triage (exploratory layer)

Contrast piece for the seminar's manual structured-prompt triage. Uses
[`calebevans/gha-failure-analysis`](https://github.com/calebevans/gha-failure-analysis) as a
GitHub Action that auto-analyzes a FAILED pipeline run with an LLM (Claude).

## What it is / is not
- **Is:** automated, post-hoc AI triage. Fires on `workflow_run` after "CI/CD Pipeline"
  completes with `conclusion == failure`. Non-blocking (separate workflow).
- **Is NOT:** a replacement for the graded manual structured-prompt (`docs/ai-triage-prompt.md`).
  Manual triage stays the primary AI deliverable (3-level hypothesis tree + AI-02/03/04
  disclosures). This is the "platform-analytics tier" exploratory add-on.

## Setup (one-time)
1. Get a **free Groq API key** at console.groq.com (Groq is OpenAI-compatible, free tier).
2. Repo → Settings → Secrets and variables → Actions → New secret:
   `MODEL_API_KEY = gsk_...`
3. Merge this branch (`feat/ai-triage-auto`) so `.github/workflows/ai-triage.yml` lands on the
   default branch — `workflow_run` triggers only fire from workflows on the default branch.

Provider config in the workflow: `llm-provider: openai`, `llm-base-url:
https://api.groq.com/openai/v1`, `llm-model: llama-3.3-70b-versatile`. Groq keys are not tied
to a model at creation — the model is chosen per request via `llm-model`. Swap to
`llama-3.1-8b-instant` for a faster/lighter run. Unlike local Ollama, Groq runs on the
GitHub-hosted runner (no self-hosted runner needed).

## How it runs
- Trigger: main pipeline fails → this workflow starts automatically.
- Reads the failed run's logs, correlates with the PR diff, calls `claude-sonnet-5`.
- Outputs: `category` + `summary` in the job summary; full JSON as artifact `ai-triage-report`;
  optional PR comment (`post-pr-comment: true`).

## Seminar use (Rule of Pairing, three-way)
| Layer | What | Deliverable |
|-------|------|-------------|
| Traditional | manual log reading | worksheet Part 1 |
| AI (manual) | structured prompt, 3-level tree | `docs/ai-triage-prompt.md` |
| AI (automated) | this action, auto on failure | job summary + JSON artifact |

**Demo talking point (slide 12 — AI adds value/noise):** the flaky test has NO code change,
so the automated tool's PR-correlation can MISattribute the failure to unrelated diffs —
concrete evidence for Failure Modes FM-2 (blind to runner/timing context) and FM-3 (confident
wrong on non-determinism). Show its output next to the manual triage that correctly names
timing variance.

## Cost / risk
- Each failed run = one Claude API call (small; sonnet). Guard failures on every push could add
  up — scope to PRs if noisy by narrowing the `workflows:`/branch conditions.
- Never blocks the pipeline (`continue-on-error` + separate workflow).
