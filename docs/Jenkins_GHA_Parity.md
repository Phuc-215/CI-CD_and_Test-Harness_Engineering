# Jenkins / GitHub Actions parity

`Jenkinsfile` is the Jenkins implementation of the CI behavior in
`.github/workflows/ci.yml`; it deliberately does not upload anything to Trunk.io.

## Jenkins setup

Use a **Multibranch Pipeline** with GitHub Branch Source and configure the GitHub
webhook. This gives Jenkins the relevant source revision for pushes and pull requests.
The Jenkins controller/agent needs these plugins:

```
git
workflow-aggregator
nodejs
junit
coverage
timestamper
credentials-binding
```

Configure a NodeJS tool named `node20` (a current Node 20 release). The Linux agent image
must have Playwright's OS dependencies installed once, because the unprivileged Jenkins
build installs Chromium but cannot run `playwright install --with-deps`.

## Credentials

The test pipeline runs without cloud credentials. Add these optional **Secret text**
credentials only to enable its GitHub side effects:

| ID | Purpose | GitHub permissions |
| --- | --- | --- |
| `github-api-token` | Commit the generated coverage badge for successful non-PR builds | Contents read/write |
| `github-models-token` | AI failure triage and an optional PR comment | Contents read, pull requests write, models read |

AI triage is enabled by the `ENABLE_AI_TRIAGE` build parameter. It redacts and bounds the
Jenkins console tail, writes `reports/ai-triage.md`, and is non-blocking: a model, network,
or credential error never changes the original build failure.

If the Pipeline is executed in Jenkins' Groovy sandbox, an administrator may need to approve
the `Run.getLog(int)` signature under **Manage Jenkins → In-process Script Approval** before
the first failure triage can read the console tail.

## Behavior mapping

| GitHub Actions job | Jenkins behavior |
| --- | --- |
| `backend-guard` | Blocking coverage run; publishes Guard JUnit, Cobertura and badge |
| `backend-spec` | Allowed failure, shown as `UNSTABLE` |
| `flaky-watch` | Allowed failure, shown as `UNSTABLE`; runs once to match `ci.yml` |
| `web-smoke` matrix | Web then Admin smoke stages, sequentially to isolate backend port 3000 and SQLite |
| `mobile-smoke` | Blocking Jest CI run |
| `ai-triage.yml` | Jenkins `post { failure }` runs GitHub Models triage |

Web and Admin JUnit files use unique names in Jenkins so that one result never overwrites
the other. GitHub Actions keeps its existing default output name because its matrix runners
have separate filesystems.

## Qodo Cover and AI triage

The Jenkins Generic Webhook Trigger recognizes eligible pull-request events and invokes
Qodo Cover for an internal, open, non-draft PR targeting `demo`. Qodo may add only guard
tests, validates coverage, then creates a patch PR. It requires secret-text credential
`github-ci-pat` with repository write access and GitHub Models access.

The same credential is used by `post { unsuccessful }` AI triage. This covers both
`FAILURE` and `UNSTABLE` builds, writes `reports/ai-triage.md`, and comments on a PR when
one is known. Qodo or model failures are reported but do not overwrite the original CI result.
