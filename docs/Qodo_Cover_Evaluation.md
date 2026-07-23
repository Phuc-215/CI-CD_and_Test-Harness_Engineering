# Qodo Cover — Tool Evaluation

Upstream: <https://github.com/qodo-ai/qodo-ci>, <https://docs.qodo.ai/>
Companion how-to: [`Self_Hosted_Runner_Ollama_Setup.md`](./Self_Hosted_Runner_Ollama_Setup.md)

We evaluated Qodo Cover as an autonomous unit-test-generation tool for the EShop backend, as the
JavaScript-capable counterpart to Diffblue Agents (see
[`Diffblue_Agents_Evaluation.md`](./Diffblue_Agents_Evaluation.md), not adopted because it does
not support JavaScript). This note records what the tool is, how it is configured in our pipeline,
and what we observed from one real run against PR #52 (branch `qodo-cover-test`, labeled
`qodo-cover`), which modified `backend/app.js`.

## 1. What it is

Qodo Cover is an AI agent for autonomous **coverage-driven unit-test generation** — given an
existing test suite and a coverage target, it iteratively generates new test cases, runs them
against the real test command, and keeps only tests that compile, pass, and increase measured
coverage. Like Diffblue Agents it belongs to the "AI that produces tests" branch of testing
tooling, but unlike Diffblue it supports JavaScript, which is why it fills the role Diffblue could
not for this project.

## 2. How it works

1. **Trigger** — the `Qodo Cover` workflow (`.github/workflows/qodo-cover.yml`) runs only on a
   pull request targeting `demo` that is labeled `qodo-cover`, and only when the PR is from the
   same repository, open, and not a draft — a deliberate opt-in gate rather than a run-on-every-PR
   check.
2. **Execution environment** — it runs on a self-hosted runner against a **local Ollama** model
   (`qwen2.5-coder:7b`), the same offline setup used by our automated GHA-failure-triage workflow
   (see [`GHA_Failure_Analysis_Evaluation.md`](./GHA_Failure_Analysis_Evaluation.md)) — no paid
   LLM API key required.
3. **Scope** — it is pointed at `tests/api/guard` as the target test folder and
   `npm run test:coverage` (an `nyc`-instrumented Mocha run emitting a Cobertura report) as the
   command it uses to measure coverage after each generation attempt.
4. **Iteration** — it targets 80% coverage (`desired_coverage: 80`) over at most 3 iterations
   (`max_iterations: 3`), running each generated test separately (`run_each_test_separately: true`)
   so a failing test can be attributed and dropped individually rather than invalidating a whole
   batch.
5. **Guardrails via instructions** — `additional_instructions` constrains it to the existing
   Mocha/Chai/Supertest conventions, to add tests only (no production-code changes), and to avoid
   calling real external services.

This is architecturally close to Diffblue's "commit only what verifies" model — generated tests
are only useful if they actually pass against the real command — but Qodo Cover drives an LLM
directly against a coverage signal rather than orchestrating a separate coding-agent CLI.

## 3. Observations from our run

The workflow triggered correctly end to end on runner `ntp`: checkout, `npm ci` for both root and
`backend`, and the Ollama preflight (`curl .../api/tags`, `ollama show qwen2.5-coder:7b`) all
succeeded before the action itself ran. The action's own log then showed:

1. **Diff detection worked.** It correctly identified `backend/app.js` as the only file changed by
   the PR.
2. **Static analysis ran.** It initialized a language-server session and indexed "33 files in the
   repository" before reasoning about the change.
3. **Test-file matching found nothing to extend.** It logged `Finding test files for source file:
   .../backend/app.js` followed by an empty `Filtered test files:` result.
4. **No generation attempt was made.** Immediately after, it logged `No coverage improvements
   found.` and exited — `git status` showed a clean working tree; nothing was committed. Total
   action runtime was ~34 seconds (12:29:28–12:30:02Z), too fast to represent a full
   generate-run-measure iteration loop.
5. **The job reported success** (`outcome=success`) despite generating zero tests — a no-op is not
   an error state for this tool.

We cannot yet tell apart two explanations for step 3–4 from this single run:

- **Benign:** `backend/app.js` is already covered above the 80% target by the existing
  `tests/api/guard` suite, so there was genuinely nothing to add — correct, conservative behavior.
- **Gap:** the tool's test-file matching only extends an *existing* test file it can pair with the
  source file, and found none it considered a match for `app.js` under `tests/api/guard` — in
  which case it may never generate a *new* test file on its own, only extend existing ones.

Distinguishing these needs a follow-up run with the actual coverage percentage checked
before/after (from `coverage/cobertura-coverage.xml`, produced by `npm run test:coverage`
regardless of Qodo Cover), or a diff against a source file with deliberately low coverage.

## 4. Suitability for this project

Unlike Diffblue Agents, Qodo Cover is not blocked by language support (JavaScript is supported)
or by licensing (it runs against a free, local Ollama model, consistent with the department having
no paid AI budget). Its label-gated trigger is a good fit for an opt-in, human-reviewed
test-generation step rather than an always-on gate. The open question from our one run is whether
it only *extends* matched test files or can also *create* new ones — that determines how much of
the codebase it can actually help cover.

## 5. Verdict

**Ran successfully; inconclusive on generation capability.** Infrastructure, trigger, and
environment integration all work end to end on the free local-LLM setup. The one real run produced
no tests and no error, which is consistent with either "already adequate coverage" or "no matching
test file to extend" — not yet distinguishable from a single log. Next step: rerun against a change
to a source file with a known, deliberately low-coverage existing test file, and check the
coverage delta directly, before calling this tool adopted or not.
