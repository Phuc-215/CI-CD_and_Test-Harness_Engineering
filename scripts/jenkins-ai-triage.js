#!/usr/bin/env node
/*
 * Non-blocking Jenkins failure triage using NVIDIA NIM. It intentionally
 * sends a redacted, bounded console tail rather than the whole workspace.
 * Required env: NVIDIA_NIM_API_KEY. GITHUB_TOKEN is only needed when --pr is
 * supplied, so the resulting report can be posted as a PR comment.
 */
const fs = require('fs');

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : '';
}

const logFile = argument('--log');
const outputFile = argument('--output') || 'reports/ai-triage.md';
const repositoryArg = argument('--repository');
const pullRequest = argument('--pr');
const githubToken = process.env.GITHUB_TOKEN;
const nimToken = process.env.NVIDIA_NIM_API_KEY;
const nimBaseUrl = process.env.NVIDIA_NIM_API_BASE || 'https://integrate.api.nvidia.com/v1';
const nimModel = process.env.NVIDIA_NIM_MODEL || 'nvidia/llama-3.3-nemotron-super-49b-v1.5';

if (!logFile || !fs.existsSync(logFile)) throw new Error(`Missing log file: ${logFile}`);
if (!nimToken) throw new Error('NVIDIA_NIM_API_KEY is required for AI triage');
if (pullRequest && !githubToken) throw new Error('GITHUB_TOKEN is required to comment on a pull request');

function repositoryFromRemote(value) {
  const remote = value.trim().replace(/\.git$/, '');
  const https = remote.match(/github\.com[/:]([^/]+\/[^/]+)$/);
  return https ? https[1] : '';
}

function redact(value) {
  return value
    .replace(/(gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})/g, '[REDACTED_GITHUB_TOKEN]')
    .replace(/(Authorization:\s*Bearer\s+)[^\s]+/gi, '$1[REDACTED]')
    .replace(/\b([A-Z][A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|API_KEY))=\S+/g, '$1=[REDACTED]');
}

const system = fs.readFileSync('docs/ai-triage-prompt.md', 'utf8');
const log = redact(fs.readFileSync(logFile, 'utf8')).slice(-24000);
const repository = repositoryFromRemote(repositoryArg);
const user = `Analyze this failed Jenkins build. Use only evidence in the log.\n\n===LOG START===\n${log}\n===LOG END===`;

async function api(path, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${githubToken}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {}),
    },
  });
  if (!response.ok) throw new Error(`GitHub API ${response.status}: ${await response.text()}`);
  return response.json();
}

(async () => {
  const response = await fetch(`${nimBaseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${nimToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: nimModel, temperature: 0,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    }),
  });
  if (!response.ok) throw new Error(`NVIDIA NIM ${response.status}: ${await response.text()}`);
  const body = await response.json();
  const analysis = body.choices?.[0]?.message?.content;
  if (!analysis) throw new Error('NVIDIA NIM response did not contain analysis text');

  const report = `# Jenkins AI triage\n\n${analysis.trim()}\n`;
  fs.mkdirSync(require('path').dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, report);

  if (repository && pullRequest) {
    await api(`/repos/${repository}/issues/${encodeURIComponent(pullRequest)}/comments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: `<!-- jenkins-ai-triage -->\n${report}` }),
    });
  }
  console.log(`AI triage written to ${outputFile}`);
})().catch((error) => {
  console.error(`AI triage failed: ${error.message}`);
  process.exitCode = 1;
});
