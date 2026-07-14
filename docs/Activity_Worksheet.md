# Pipeline Postmortem Activity Worksheet

**Topic:** T07 — CI/CD & Test-Harness Engineering  
**Activity:** Paired Triage (Manual vs AI)

## Scenario
A recent build failed on the CI pipeline. The failure occurred in the flaky suite job (`tests/api/flaky/timing.flaky.test.js`).

## Instructions
1. Obtain the failing log from the instructor or extract it yourself using:
   `gh run view <run-id> --log-failed`
2. Perform a manual triage before looking at the AI output. Build your hypothesis tree below.
3. Compare your findings with the AI's triage output.

---

## Part 1: Manual Triage (Human)
*Time yourself. Read the stack trace and timing information in the failing log.*

**1. One-Line Symptom:**
*(Write the verbatim assertion/error message here)*

**2. Three-Level Hypothesis Tree:**
- **L1 (Category):** [Timing / Environment / Data / Network]
  - **L2 (Mechanism):**
    - **L3 (Root Cause):**
  - **L2 (Alternative Mechanism):**
    - **L3 (Alternative Root Cause):**

**3. Next-Checks:**
*(What commands or file:line would you inspect next to confirm your hypothesis? List up to 3.)*
a.
b.
c.

**Time Taken:** ______ minutes

---

## Part 2: AI Triage Output
*Paste the AI output (using the frozen system prompt) below.*

**1. ONE-LINE SYMPTOM:** 

**2. THREE-LEVEL HYPOTHESIS TREE:** 

**3. THREE NEXT-CHECKS:** 

**4. CONFIDENCE:** 

**5. AI DISCLOSURE:** 

---

## Part 3: Comparison Matrix
*Compare your manual triage with the AI output across these 5 axes:*

| Criterion | Human (traditional) | AI |
|-----------|---------------------|----|
| Time to first hypothesis | | |
| Correct root cause? | | |
| Reached L3 depth? | | |
| Hallucinations (facts not in log) | | |
| Actionable next-checks | | |

## Discussion Questions
1. Did the AI confidently identify the correct root cause, or did it misattribute the failure due to non-determinism (FM-3)?
2. Did the AI invent any files, line numbers, or timings not present in the log (FM-1)?
3. What is the value of the 10-run pass/fail table compared to diagnosing a single flaky log?
