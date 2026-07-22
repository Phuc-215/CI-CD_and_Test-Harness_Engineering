#!/usr/bin/env node
// Local AI triage using Ollama (qwen2.5) instead of a paid Claude API key.
// Feeds the frozen system prompt + a failing log to a local model, prints the analysis.
// Zero cost, offline, demo-safe. Forces CPU (num_gpu:0) to dodge GPU OOM on the 7B model.
//
// Usage:  node scripts/ai-triage-local.js [logFile]
//   logFile defaults to logs/flaky_fail.log
//   env: OLLAMA_MODEL (default qwen2.5:7b-instruct), OLLAMA_HOST (default http://localhost:11434)
const fs = require("fs");

const MODEL = process.env.OLLAMA_MODEL || "qwen2.5:7b-instruct";
const HOST = process.env.OLLAMA_HOST || "http://localhost:11434";
const promptFile = "docs/ai-triage-prompt.md";
const logFile = process.argv[2] || "logs/flaky_fail.log";

for (const f of [promptFile, logFile]) {
  if (!fs.existsSync(f)) {
    console.error(`missing ${f}`);
    process.exit(1);
  }
}

const system = fs.readFileSync(promptFile, "utf8");
const log = fs.readFileSync(logFile, "utf8");
const user = `Analyze this failing CI log:\n\n===LOG START===\n${log}\n===LOG END===`;

(async () => {
  console.error(`>> Model: ${MODEL} (CPU)  Log: ${logFile}`);
  console.error(`>> POST ${HOST}/api/chat ...`);
  const res = await fetch(`${HOST}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      stream: false,
      options: { num_gpu: 0, temperature: 0 },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    console.error(`HTTP ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  const data = await res.json();
  console.log(data.message?.content ?? JSON.stringify(data));
})().catch((e) => {
  console.error("error:", e.message);
  process.exit(1);
});
