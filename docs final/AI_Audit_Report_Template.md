# AI Audit Report — T07 CI/CD & Test-Harness Engineering

> Purpose: document every material use of AI in this project, verify each AI output against
> ground truth, and disclose where AI helped, where it erred, and how we checked it.

---

## 1. Group Information

| Field | Value |
|-------|-------|
| Course | CS423 / CSC15003 — Software Testing |
| Seminar topic | T07 — CI/CD & Test-Harness Engineering |
| Project (SUT) | EShop |
| Team |  |
| Author of this report | `23127xxx-Ngô Huỳnh Gia Thoại · 23127249-Nguyễn Phạm Thiện Phúc · 23127xxxNguyễn Thiên Phúc` |
| AI tools used | Claude Code (Opus 4.8); Groq `llama-3.1-8b-instant` and local Ollama `qwen2.5` for log triage |
| Raw transcript(s) | `AI-Audit-<name>.md` (full prompt/response log) |

---

## 2. Audit Table

Grouped per team member (by student ID). Each row is one material AI interaction. **Verification**
states how the AI output was checked against ground truth (running the code, reading the source,
checking the log) before use.

| Student ID | Name | Purpose (task) | Output used | Verification | Prompt log |
|------------|------|----------------|-------------|--------------|------------|
| 23127249 | Nguyễn Phạm Thiện Phúc | Set up the test harness, CI, and AI-triage workflow; automated AI log triage of CI failures | **Test suites** `tests/api/{spec,guard,flaky,legacy}/*`, `tests/helpers/*`; **CI** `.github/workflows/ci.yml`; **AI-triage workflow** `.github/workflows/ai-triage.yml` + `scripts/ai-triage-local.js`; **docs** `AI_Triage_User_Guide.md`, `GHA_Failure_Analysis_Evaluation.md`, `Diffblue_Agents_Evaluation.md`, `Datadog_Evaluation.md` | Student cross-checked the output against available sources and own knowledge, and reused existing resources to write the tests | [prompt_log](../AI-Audit-ThienPhuc.md) |
| `<MSSV-2>` | Ngô Huỳnh Gia Thoại | `<task, e.g. flaky test + 10-run experiment>` | `<output used>` | `<how verified>` | [log](`<AI-Audit-Thoai.md>`) |
| `<MSSV-3>` |  | `<task, e.g. AI-vs-manual triage comparison>` | `<output used>` | `<how verified>` | [log](`<AI-Audit-ThienPhuc2.md>`) |

Add rows per member as needed. Keep each member's rows together so per-person AI usage is clear.

---

## 3. AI Accuracy Summary

| Metric | Count |
|--------|-------|
| Total AI interactions audited | `<N>` |
| ✅ Accurate (used as-is) | `<a>` |
| ⚠️ Partially correct (edited before use) | `<b>` |
| ❌ Wrong / hallucinated (discarded) | `<c>` |
| **Accuracy rate** (✅ / total) | `<a/N = ...%>` |
| **Usable rate** ((✅+⚠️) / total) | `<(a+b)/N = ...%>` |

Hallucinations observed (facts the AI stated that were not in the source):
- `<e.g. cited error code X where the log said Y — caught by verification>`
- `<...>`

---

## 4. Conclusion

- **Where AI helped most:** `<e.g. scaffolding CI/test config, drafting docs, compressing long
  logs into a ranked hypothesis tree>`.
- **Where AI was weak / risky:** `<e.g. hallucinating facts on oversized logs; blind to
  environment/self-hosted context; confident-but-wrong on flaky single runs>`.
- **Net assessment:** AI accelerated setup and documentation, but every output was treated as a
  proposal requiring verification against running code / source / logs before acceptance. No AI
  output was committed unverified.

---

## 5. Disclosure (AI-02 / AI-03 / AI-04)

- **[AI-02] Tools & scope.** AI assistants (Claude Code; Groq/Ollama LLMs for log triage) were
  used for: `<framework selection, CI/YAML scaffolding, test authoring, documentation, log
  triage>`. They were **not** used for: `<...>`.
- **[AI-03] Human oversight & verification.** Every AI-generated artifact was reviewed and
  verified by a team member (running tests, reading source, checking logs) before use. Verified
  claims and corrections are recorded in §2. Contributions remain attributable via Git commit
  history.
- **[AI-04] No unverified/hallucinated content.** AI outputs were cross-checked against
  ground truth; hallucinated or unverifiable claims were corrected or discarded (see §2 and the
  hallucination list in §3). Prompts enforced a "state NOT IN LOG when a fact is absent" rule for
  log triage to limit fabrication.

_Signed:_ `<name>` · `<date>`
