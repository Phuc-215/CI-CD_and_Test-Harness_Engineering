#!/usr/bin/env node
/*
 * Non-blocking Jenkins failure triage using GitHub Models. It intentionally
 * sends a redacted, bounded console tail rather than the whole workspace.
 * Required env: GITHUB_TOKEN (GitHub Models permission). Optional --pr adds
 * the report as a comment to that pull request.
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
const token = process.env.GITHUB_TOKEN;

if (!logFile || !fs.existsSync(logFile)) throw new Error(`Missing log file: ${logFile}`);
if (!token) throw new Error('GITHUB_TOKEN is required for GitHub Models triage');

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
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {}),
    },
  });
  if (!response.ok) throw new Error(`GitHub API ${response.status}: ${await response.text()}`);
  return response.json();
}

(async () => {
  const response = await fetch('https://models.github.ai/inference/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'openai/gpt-4.1', temperature: 0,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    }),
  });
  if (!response.ok) throw new Error(`GitHub Models ${response.status}: ${await response.text()}`);
  const body = await response.json();
  const analysis = body.choices?.[0]?.message?.content;
  if (!analysis) throw new Error('GitHub Models response did not contain analysis text');

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
