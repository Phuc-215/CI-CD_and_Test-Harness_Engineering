# Self-Hosted Runner Setup — Local Qwen (Ollama) for Qodo Cover

A step-by-step guide to setting up a **self-hosted GitHub Actions runner** with a **local Ollama
model** so that the `Qodo Cover` workflow (`.github/workflows/qodo-cover.yml`) can generate tests
with no paid LLM API key. The same runner and model also serve the `AI Triage` workflow — see
[`AI_Triage_User_Guide.md`](./AI_Triage_User_Guide.md) — so you only need to set this up once.
Findings from an actual run on this setup are recorded in
[`Qodo_Cover_Evaluation.md`](./Qodo_Cover_Evaluation.md).

---

## 0. Concepts (read once)

- **Why self-hosted, not GitHub-hosted runners:** GitHub-hosted runners cannot reach a model
  running on `localhost`. Ollama has to run on the same machine as the job, so the job itself must
  run on a machine you control.
- **Ollama, not an API key.** `qodo-cover.yml` passes `model: ollama_chat/qwen2.5-coder:7b`
  (LiteLLM's `ollama_chat/<model>` provider prefix) and takes no `llm-api-key` input at all — the
  action talks to Ollama's local HTTP API directly, so there is nothing to put in GitHub Secrets
  for this workflow.
- **The runner labels must match.** `qodo-cover.yml` declares `runs-on: [self-hosted, Linux,
  X64]`. A runner only picks up jobs whose labels are a subset of the labels it was registered
  with, so registration must include exactly these three.
- **Fork PRs cannot trigger this.** The workflow's `if:` already requires
  `github.event.pull_request.head.repo.full_name == github.repository`, so a self-hosted runner
  (which executes arbitrary job code) is not exposed to untrusted fork PRs through this workflow.
  Do not remove that condition.

---

## 1. Prerequisites

- A Linux x86_64 machine you control (physical, VM, or persistent cloud instance — not an
  ephemeral CI container), reachable enough to stay online while jobs run.
- `sudo`/admin access on that machine.
- Repo admin access on GitHub (**Settings → Actions → Runners**) to get a runner registration
  token.
- Enough RAM/disk for a 7B Q4 model: ~8 GB RAM free and ~5 GB disk. A GPU is optional but speeds
  up generation significantly; the model runs on CPU if none is present.

---

## 2. Install Ollama and pull the model

```bash
curl -fsSL https://ollama.com/install.sh | sh
sudo systemctl enable --now ollama     # keep it running across reboots/logins
ollama pull qwen2.5-coder:7b
```

Verify it's up and the model is present — this mirrors the exact preflight check
`qodo-cover.yml` and `ai-triage.yml` run before every job:

```bash
curl --fail --silent --show-error http://127.0.0.1:11434/api/tags > /dev/null
ollama show qwen2.5-coder:7b
```

`ollama show` should report architecture `qwen2`, ~7.6B parameters, `Q4_K_M` quantization. If the
`curl` fails, Ollama isn't listening — check `systemctl status ollama`.

---

## 3. Register the self-hosted runner

1. On GitHub: **Settings → Actions → Runners → New self-hosted runner**, choose **Linux / x64**.
   GitHub shows a one-time registration token and download commands.
2. On the machine:
   ```bash
   mkdir actions-runner && cd actions-runner
   curl -o actions-runner-linux-x64.tar.gz -L \
     https://github.com/actions/runner/releases/download/<version>/actions-runner-linux-x64-<version>.tar.gz
   tar xzf actions-runner-linux-x64.tar.gz
   ./config.sh --url https://github.com/<org>/CI-CD_and_Test-Harness_Engineering --token <TOKEN>
   ```
3. When `config.sh` asks for **runner group**, accept the default (`Default`). When asked for
   **labels**, accept the default set — self-hosted runners are auto-tagged `self-hosted`,
   `Linux`, `X64` from their OS/architecture, which is exactly what `runs-on: [self-hosted, Linux,
   X64]` needs. You do not need to add custom labels for this workflow.
4. Give the runner a recognizable **name** when prompted (shown in Actions logs as `Runner name`).

Run it as a service so it survives logout/reboot, instead of `./run.sh` in a terminal:

```bash
sudo ./svc.sh install
sudo ./svc.sh start
sudo ./svc.sh status
```

---

## 4. Verify end to end

Confirm the runner is **Idle** under **Settings → Actions → Runners** on GitHub, then trigger a
real job:

```bash
# open a PR that touches backend code, then:
gh pr edit <PR_NUMBER> -R <org>/CI-CD_and_Test-Harness_Engineering --add-label qodo-cover
gh run list -R <org>/CI-CD_and_Test-Harness_Engineering --workflow "Qodo Cover" --limit 3
gh run watch <run-id> -R <org>/CI-CD_and_Test-Harness_Engineering
```

In the job log you should see, in order: `actions/checkout`, two `npm ci` steps (root and
`backend`), the Ollama preflight (`ollama show qwen2.5-coder:7b` printing the model card), then
the `qodo-ai/qodo-ci` step itself. If any step before the Ollama preflight fails, it's a runner
setup issue (Node/npm), not a model issue.

---

## 5. Troubleshooting

- **`curl: (7) Failed to connect ... 11434`** — Ollama isn't running or was started under a
  different user than the runner service. Re-check `sudo systemctl status ollama` and that the
  runner service user can reach `localhost:11434`.
- **Job never picked up (stays "Queued")** — label mismatch or the runner is offline. Confirm the
  runner shows **Idle** (not offline) in **Settings → Actions → Runners**, and that its labels
  include `self-hosted`, `Linux`, `X64`.
- **PR from a fork never triggers the job** — expected and intentional; see §0. Test with a
  branch on the main repo, not a fork, as in the §4 example.
- **Action finishes fast (~30s) and reports "No coverage improvements found" with nothing
  committed** — this is not a setup failure; the job still reports `success`. It means the model
  found no test file it judged a match to extend, or coverage was already at target. See
  [`Qodo_Cover_Evaluation.md`](./Qodo_Cover_Evaluation.md#3-observations-from-our-run) for how we
  investigated this on a real run.
- **Slow generation / CPU maxed out** — expected without a GPU; a 7B model on CPU is materially
  slower per iteration. Lower `max_iterations` in `qodo-cover.yml` if turnaround matters more than
  thoroughness.

---

## 6. Quick reference

```bash
# Ollama
curl -fsSL https://ollama.com/install.sh | sh
sudo systemctl enable --now ollama
ollama pull qwen2.5-coder:7b
curl --fail --silent --show-error http://127.0.0.1:11434/api/tags > /dev/null
ollama show qwen2.5-coder:7b

# Runner service
sudo ./svc.sh install
sudo ./svc.sh start
sudo ./svc.sh status

# Trigger Qodo Cover on a real PR
gh pr edit <PR_NUMBER> -R <org>/CI-CD_and_Test-Harness_Engineering --add-label qodo-cover
gh run watch <run-id> -R <org>/CI-CD_and_Test-Harness_Engineering
```
