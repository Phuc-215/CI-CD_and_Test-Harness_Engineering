# GitHub Actions Failure Analysis — Tool Evaluation

Upstream: <https://github.com/calebevans/gha-failure-analysis>
Companion how-to: [`AI_Triage_User_Guide.md`](./AI_Triage_User_Guide.md)

We evaluated `gha-failure-analysis` as an automated, AI-assisted approach to triaging
continuous-integration failures on a Node.js codebase. This note records what the tool is, how
it works internally, and how it behaved in practice on our project.

## 1. What it is

`gha-failure-analysis` is a GitHub Action that performs automated root-cause analysis of failed
CI runs using a large language model. On a failed workflow it retrieves the run's logs,
correlates them with the associated pull-request diff, and emits a structured analysis —
failure category, root cause, supporting evidence, and suggested next checks — to the run summary
and, optionally, as a PR comment.

It occupies the "LLM-based log triage" position in the space of CI-quality tooling: rather than
detecting flakiness statistically over many runs (as flaky-test analytics products do) or
generating tests (as test-generation tools do), it reasons over the textual evidence of a single
failure the way an engineer reading the log would.

## 2. How it works

1. **Log retrieval** — fetches run metadata, the set of failed jobs, and their logs through the
   GitHub API using the workflow token.
2. **Semantic preprocessing** — passes the logs through *cordon*, a transformer-based anomaly
   detector, to isolate the relevant failure regions from otherwise large, noisy logs. This is
   the step that keeps the LLM's input within a useful context budget.
3. **LLM analysis** — sends the distilled evidence to a model (via DSPy/LiteLLM) to infer root
   causes for the failed steps and tests.
4. **Change correlation** — compares the failure against the PR diff to estimate whether the
   code change is the likely cause, at the commit that actually triggered the run.
5. **Secret redaction** — runs `detect-secrets` over all output so credentials surfaced in logs
   are not leaked into summaries, comments, or the JSON report.
6. **Reporting** — writes a job summary, an optional PR comment, and a machine-readable JSON
   report.

Three architectural choices stood out during evaluation:

- **Provider independence.** The model is selected by four inputs (`llm-provider`, `llm-model`,
  `llm-api-key`, `llm-base-url`), so any OpenAI-compatible endpoint works. We ran it against
  Groq's free tier and, offline, against a local Ollama model with no code change.
- **Decoupled triggering.** It can run in the same workflow (`if: failure()`) or as a separate
  `workflow_run` workflow that fires after the pipeline completes. The separate mode isolates
  triage from the pipeline entirely.
- **Failure containment.** The analysis step is expected to run under `continue-on-error`, so a
  model outage or rate-limit degrades gracefully rather than failing the build.

## 3. Observations from our runs

- **Output quality** was good on concrete, deterministic failures (missing module, lock-file
  drift): it named the correct immediate cause and cited the right log lines.
- **Cost / latency.** A cold run is dominated by pulling the action's container image and the
  log-embedding model — several minutes. Steady-state cost is one LLM call per failed run; on a
  free tier this is capped by a daily token budget, which we hit with a larger model and
  resolved by switching to a smaller one.
- **Hallucination risk is real.** On oversized logs the model can cite facts absent from the
  input. In practice this made verification (checking every cited `file:line` against the log)
  a required step, not an optional one — a limitation we treat as inherent to LLM triage rather
  than a defect of this tool.
- **Blind spots.** Being text-only, it cannot see environment state (self-hosted runner
  networking, missing system libraries), so it can misattribute an infrastructure failure to
  code.

## 4. Suitability for this project

The tool fit our constraints well: it is language-agnostic (it reasons over logs, not source),
so it works on a JavaScript/Node.js repository despite most test-oriented AI tooling targeting
the JVM; it needs only a free API key; and it produces concrete, inspectable artifacts. Its main
cost is the verification discipline its hallucination risk demands — acceptable, and arguably
educational, for our purposes.

Install, configuration, the two workflow files, provider/key setup, the push/PR trigger flow, a
sample output, and the offline Ollama fallback are documented in
[`AI_Triage_User_Guide.md`](./AI_Triage_User_Guide.md).

## 5. Verdict

**Adopted.** For a JavaScript project with no paid AI budget, automated LLM log triage was the
most practical AI-quality mechanism available: it runs on our stack, costs nothing on a free
tier, contains its own failures, and its limitations are transparent enough to reason about. A
test-generation tool would have complemented it, but the one we tried (Diffblue Agents) does not
support JavaScript — see [`Diffblue_Agents_Evaluation.md`](./Diffblue_Agents_Evaluation.md).
