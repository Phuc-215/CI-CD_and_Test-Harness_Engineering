# Diffblue Agents — Tool Evaluation

Reference: <https://docs.diffblue.com/>

We evaluated **Diffblue Agents** as an autonomous unit-test-generation tool for the EShop
codebase. This note records what the tool is, how it works, and the concrete reasons it could not
be applied to our project.

## 1. What it is

Diffblue Agents is a platform for autonomous **regression unit-test generation** — its Testing
Agent writes unit tests that pin down a program's current behavior, so later changes that alter
that behavior surface as failing tests. It is the successor to Diffblue Cover and represents the
"AI that produces tests" branch of testing tooling, as distinct from log-triage or
flaky-analytics tools.

## 2. How it works

- It runs **locally** as two parts: a server that orchestrates workflows and manages licensing,
  and a CLI (`diffblue-agents`) that submits requests.
- Rather than calling a model directly, it **drives an existing AI coding-agent platform**
  (GitHub Copilot CLI, Claude Code, …) as its execution engine.
- A run **analyzes the project, partitions the work**, and processes each partition in an
  isolated **temporary git worktree**.
- **Only validated output is committed** — generated tests that fail to compile or pass are
  rolled back. This "commit only what verifies" model is the tool's central safety guarantee and
  its most interesting design idea.

## 3. Supported languages

The Testing Agent supports **Java and Python** projects. The EShop system under test is
**Node.js / JavaScript** end to end (Express backend, React / React Native frontends, mocha and
Jest tests). JavaScript is outside the tool's supported set, so it cannot analyze or generate
tests for this codebase.

## 4. Installation and what we observed

The CLI drives the whole flow from the project root:

```powershell
diffblue-agents install                     # configure the agent + underlying AI platform
diffblue-agents run regression-unit-tests   # run the test-generation workflow
```

`install` completed and reported that it had configured Claude Code as the underlying agent.
The `run` step, however, did not proceed, for three independent reasons — any one of which is
sufficient to block use:

1. **Licensing.** The Diffblue API key available to us was not valid. Because the local server
   gates workflows on licensing, an invalid key stops the Testing Agent before it starts. (The
   department provides no paid AI licenses; only free tiers were available to us.)
2. **Agent launcher on Windows.** `install` pointed the agent at
   `C:\Users\ADMIN\AppData\Roaming\npm\claude`, which is the extension-less Unix shim rather than
   a Windows executable. Execution failed with:
   ```
   Failed to start CLI process: CreateProcess error=193, %1 is not a valid Win32 application
   ```
   (On Windows the runnable entry points are `claude.cmd` / `claude.ps1`, not the bare `claude`
   shim — an environment-integration gap.)
3. **Language mismatch.** Even with a valid license and a corrected launcher, the tool supports
   only Java/Python and would not have been able to process our JavaScript project.

## 5. Verdict

**Not adopted.** Diffblue Agents is a well-designed tool — the worktree-isolated, commit-only-if-
verified generation model is genuinely appealing — but it is a poor match for this project:
its language support (Java/Python) excludes our JavaScript stack, it requires a valid paid
license we did not have, and its Windows agent integration failed out of the box. For the
test-generation role it would have filled, we fell back to hand-written mocha/Jest unit tests;
for the AI angle we instead used automated LLM log triage
(see [`GHA_Failure_Analysis_Evaluation.md`](./GHA_Failure_Analysis_Evaluation.md)).
