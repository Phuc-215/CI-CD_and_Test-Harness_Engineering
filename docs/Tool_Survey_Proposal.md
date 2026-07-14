**Topic code:** T07 — CI/CD & Test-Harness Engineering.

### Survey A — CI/CD Orchestrator (≥3 candidates: 1 traditional, 1 backup, 1 exploratory)

| Axis | Jenkins (traditional) | GitHub Actions (backup) | GitLab CI (exploratory) |
|------|-----------------------|-------------------------|-------------------------|
| Cost | Free OSS, self-host infra cost | Free tier, hosted | Free tier |
| Learning curve | Steep (Groovy, plugins) | Gentle (YAML) | Moderate |
| EShop fit | Full control, local SQLite ok | Native to our GitHub repo | Needs repo mirror |
| AI ability | Plugins only | Marketplace AI actions | Built-in AI (paid) |
| Community | Very large, mature | Large, growing | Medium |

### Survey B — AI Triage / Observability (≥3 candidates: 1+ AI, 1 traditional, 1 backup)

| Axis | ChatGPT/Claude (AI) | Datadog FTM (AI observability, exploratory) | Manual log reading (traditional/backup) |
|------|---------------------|---------------------------------------------|------------------------------------------|
| Cost | Low (chat tier) | High (per-host SaaS) | Zero |
| Learning curve | Prompt design | Agent + dashboards | None |
| EShop fit | Paste any JUnit log | Needs agent in CI | Works everywhere |
| AI ability | Strong reasoning | Strong anomaly detection | None |
| Community | Massive | Enterprise | n/a |

### 3-bullet rationale (required)
- **Jenkins as traditional CI** — mandatory per brief; gives a controlled, self-hosted baseline for a clean 1-to-1 comparison against our existing GitHub Actions config.
- **ChatGPT/Claude as AI triage** — lowest cost, zero-infra, ingests our JUnit/Cobertura logs directly; Datadog FTM surveyed as the exploratory enterprise alternative.
- **EShop fit dominates** — both winners run against the current Node.js/mocha/Jest harness with no code rewrite, keeping S2 demo risk low.

*(AI Disclosure AI-02: this survey's candidate list was drafted with AI assistance and human-verified against tool docs; no fabricated metrics — costs/curves are qualitative.)*
