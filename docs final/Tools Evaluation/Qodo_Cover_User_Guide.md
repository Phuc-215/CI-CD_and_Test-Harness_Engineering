# Qodo Cover — User Guide

How to add **AI-driven, coverage-verified unit-test generation** to a project. Written so a
first-time reader can wire it up end to end. Infrastructure setup (self-hosted runner + local
Ollama model) is a one-time prerequisite covered in a companion guide, not repeated here:
[`Self_Hosted_Runner_Ollama_User_Guide.md`](./Self_Hosted_Runner_Ollama_User_Guide.md).
Findings from a real run against this repo are in
[`Qodo_Cover_Evaluation.md`](./Qodo_Cover_Evaluation.md).

---

## 0. Concepts (read once, 60 seconds)

- **Opt-in, not always-on.** Qodo Cover only runs when a human adds the `qodo-cover` label to an
  open PR — it is a deliberate, reviewed step, not a check on every push.
- **Commits only what verifies.** Every generated test is run against your real test command; a
  test is kept only if it compiles, passes, and increases measured coverage. A no-op (zero tests
  generated) is not an error — it just means nothing cleared that bar.
- **Coverage report drives it, not vibes.** The action reads a Cobertura XML coverage report
  before/after each attempt — whatever your `test_command` produces.
- **No paid API key required.** It talks to a local Ollama model over `ollama_chat/<model>`, so
  the only cost is the machine that runs it (a self-hosted runner).
- **Verify, don't trust.** Generated tests still need review before merging — see §5.

---

## 1. Prerequisites

- A self-hosted GitHub Actions runner with a local Ollama model already reachable at
  `http://127.0.0.1:11434` — set this up once via
  [`Self_Hosted_Runner_Ollama_User_Guide.md`](./Self_Hosted_Runner_Ollama_User_Guide.md). Qodo
  Cover and the AI Triage workflow share the same runner and model.
- Repo permission to add labels to PRs, and (for setup) to add/edit workflow files.
- An existing, runnable coverage command in the target project (something that emits a Cobertura
  or LCOV report) — Qodo Cover measures against that, it does not invent one.

---

## 2. The workflow file — `.github/workflows/qodo-cover.yml`

This repo's actual file, with the parts you'd change in another project marked:

```yaml
name: Qodo Cover

on:
  pull_request:
    branches:
      - demo               # <-- REPLACEABLE: your default/target branch
    types:
      - labeled            # only fires when a label is added, not on every push

permissions:
  contents: write          # the action commits generated test files
  pull-requests: write     # and can comment on the PR

jobs:
  generate-tests:
    if: >-
      github.event.label.name == 'qodo-cover' &&
      github.event.pull_request.head.repo.full_name == github.repository &&
      github.event.pull_request.state == 'open' &&
      github.event.pull_request.draft == false
    runs-on: [self-hosted, Linux, X64]   # matches the runner from §1

    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci                       # <-- REPLACEABLE: your install steps
      - working-directory: backend
        run: npm ci

      - name: Verify local Ollama model
        run: |
          curl --fail --silent --show-error http://127.0.0.1:11434/api/tags > /dev/null
          ollama show qwen2.5-coder:7b

      - name: Generate tests with Qodo Cover
        uses: qodo-ai/qodo-ci/.github/actions/qodo-cover-pr@v0.1.16
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          branch: demo                        # <-- REPLACEABLE: same branch as above
          diff_coverage: false
          project_language: javascript        # <-- REPLACEABLE: your project's language
          project_root: .
          source_folder: .
          test_folder: tests/api/guard        # <-- REPLACEABLE: where your tests live
          test_command: bash scripts/qodo-test-coverage.sh   # <-- REPLACEABLE: your coverage command
          code_coverage_report_path: coverage/cobertura-coverage.xml
          coverage_type: cobertura
          model: ollama_chat/qwen2.5-coder:7b # <-- REPLACEABLE: swap for any LiteLLM model string
          desired_coverage: 80
          max_iterations: 3
          run_each_test_separately: true
          additional_instructions: >-
            Follow the existing Mocha, Chai, and Supertest conventions.
            Add tests only; do not modify production code.
            Do not call real external services.
```

Key inputs explained:

| Input | Meaning |
|-------|---------|
| `test_folder` | Where the action looks for an existing test file to extend for a changed source file. |
| `test_command` | Exact shell command it runs to (re)measure coverage after each attempt. Must emit the report at `code_coverage_report_path`. |
| `desired_coverage` / `max_iterations` | Stop conditions — target percentage, and a cap on generate-run-measure loops so a stuck run doesn't run forever. |
| `run_each_test_separately` | Runs each generated test in isolation so one failing test doesn't sink an otherwise-good batch. |
| `additional_instructions` | Plain-English guardrails — this repo forbids production-code edits and real network calls. |
| `model` | Any LiteLLM model string. `ollama_chat/<model>` for local; swap for `gpt-4o`, `groq/llama-3.3-70b-versatile`, etc. if you have a paid/free cloud key instead of a local runner. |

Why a *test command* wrapper script (`scripts/qodo-test-coverage.sh`) instead of calling
`npm run test:coverage` directly: PyInstaller-bundled tools (like the Qodo Cover CLI) prepend their
own libraries to `LD_LIBRARY_PATH`, which can break Node's native modules (e.g. `sqlite3`). The
script restores the runner's original `LD_LIBRARY_PATH` before running the real coverage command —
copy this pattern if you see native-module load errors under the action but not when you run the
same command by hand.

---

## 3. Trigger it — label a PR

```bash
# open or update a PR against the branch configured above, then:
gh pr edit <PR_NUMBER> -R <owner>/<repo> --add-label qodo-cover
gh run list -R <owner>/<repo> --workflow "Qodo Cover" --limit 3
gh run watch <run-id> -R <owner>/<repo>
```

Or from the GitHub UI: open the PR → **Labels** → add `qodo-cover`. Removing and re-adding the
label re-triggers the job (useful after fixing something and wanting another attempt).

---

## 4. Read the result

- **Tests generated:** new test file(s) are committed to the PR branch automatically (the job has
  `contents: write`); refresh the PR's **Files changed** tab.
- **`No coverage improvements found` and nothing committed, job still shows `success`:** not a
  failure. It means either coverage was already at `desired_coverage`, or the action found no
  existing test file under `test_folder` it judged a match to extend for the changed source file.
  See [`Qodo_Cover_Evaluation.md`](./Qodo_Cover_Evaluation.md#3-observations-from-our-run) for how
  we distinguished these on a real run — check the coverage report before/after directly if it
  matters which one happened.
- Always **review generated tests like any other PR diff** before merging — "passes and raises
  coverage" is not the same as "tests the right thing".

---

## 5. Failure modes / things to verify before trusting a result

- **A passing generated test can still assert the wrong behavior.** Coverage-driven generation
  optimizes for "hits new lines and doesn't fail", not for "asserts the behavior you actually
  want". Read the assertions, don't just check the diff is green.
- **"No improvement" is ambiguous** (see §4) — don't read a no-op run as proof the code is fully
  tested without checking the coverage number yourself.
- **Runs are gated to same-repo PRs only** (`head.repo.full_name == github.repository`) — a fork
  PR will never trigger this job, by design, since it executes on a self-hosted runner.

---

## 6. Quick reference

```bash
# label a PR to trigger generation
gh pr edit <PR_NUMBER> -R <owner>/<repo> --add-label qodo-cover

# watch it
gh run list -R <owner>/<repo> --workflow "Qodo Cover" --limit 3
gh run watch <run-id> -R <owner>/<repo>

# re-run after a fix: remove then re-add the label
gh pr edit <PR_NUMBER> -R <owner>/<repo> --remove-label qodo-cover
gh pr edit <PR_NUMBER> -R <owner>/<repo> --add-label qodo-cover
```

Runner/Ollama not responding? That's an infrastructure problem, not a Qodo Cover problem — see
[`Self_Hosted_Runner_Ollama_User_Guide.md` §5 Troubleshooting](./Self_Hosted_Runner_Ollama_User_Guide.md#5-troubleshooting).
