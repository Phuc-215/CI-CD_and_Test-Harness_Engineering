# Activity Worksheet

# Introduction

This activity worksheet is intended to support the hands-on installation session for **GitHub Actions Failure Analysis** in a Continuous Integration/Continuous Deployment (CI/CD) environment. During this session, participants will learn how to integrate the tool into automated software delivery pipelines, configure the required authentication and permissions, and use AI-assisted root cause analysis to investigate failed workflow executions.

The guide provides step-by-step instructions for deploying the tool in **GitHub Actions** workflow. In addition to the installation process, it explains the available configuration parameters, recommends deployment best practices, and describes common troubleshooting scenarios that may be encountered during setup and operation.

By the end of this tutorial, participants should be able to install and configure GitHub Actions Failure Analysis, execute automated failure analysis as part of a CI/CD pipeline, interpret the generated reports, and apply the tool to accelerate debugging and improve software development workflows.

---

# 1. Prerequisites

Before installing **GitHub Actions Failure Analysis**, ensure that your environment satisfies the following requirements.

## 1.1 Supported Platforms

The tool is designed primarily for **GitHub Actions** and integrates directly with GitHub workflow executions. It analyzes workflow logs after a workflow fails and produces an AI-generated root cause analysis.

The action supports:

| Platform | Supported | Notes |
|----------|-----------|------|
| GitHub Actions | ✅ Yes | Native support |
| GitHub Enterprise Cloud | ✅ Yes | Supported with proper permissions |
| GitHub Enterprise Server | ⚠ Depends | Requires API compatibility |
| Jenkins | ⚠ Indirect | See Section 3 |
| Azure DevOps | ❌ No | Not officially supported |
| GitLab CI | ❌ No | Not officially supported |

---

## 1.2 Repository Permissions

The GitHub Action retrieves workflow metadata, job logs, pull request information, and optionally publishes comments on pull requests.

The workflow therefore requires the following permissions.

### Minimum permissions

```yaml
permissions:
  contents: read
```

### Recommended permissions

```yaml
permissions:
  contents: read
  pull-requests: write
```

Explanation:

| Permission | Required | Purpose |
|------------|----------|---------|
| contents: read | Yes | Read workflow information and repository metadata |
| pull-requests: write | Optional | Publish analysis results as PR comments |
| actions: read | Recommended | Read workflow execution logs |
| checks: read | Recommended | Retrieve workflow execution status |

If PR comments are disabled (`post-pr-comment: false`), only read permissions are generally required.

---

## 1.3 GitHub Secrets

The action communicates with an external Large Language Model (LLM). Therefore, an API key must be stored securely using GitHub Secrets.

Navigate to:

```
Repository
    → Settings
        → Secrets and variables
            → Actions
                → New repository secret
```

Common secrets include:

| Secret | Required | Description |
|---------|----------|-------------|
| OPENAI_API_KEY | Yes (OpenAI) | OpenAI API key |
| ANTHROPIC_API_KEY | Yes (Anthropic) | Claude API key |
| GEMINI_API_KEY | Yes (Gemini) | Google AI Studio API key |
| COHERE_API_KEY | Optional | For remote embedding models |
| CUSTOM_API_KEY | Optional | Custom LiteLLM-compatible endpoint |

Only one LLM provider is required.

---

## 1.4 Supported LLM Providers

The action uses **DSPy** together with **LiteLLM**, allowing multiple language model providers to be used without changing the analysis workflow.

Currently supported providers include:

| Provider | Example Model |
|----------|---------------|
| OpenAI | GPT-4o |
| Anthropic | Claude 3.5 Sonnet |
| Google Gemini | Gemini 2.5 Flash |
| Ollama | Llama 3.1 |
| LiteLLM-compatible APIs | Custom deployments |

Example configuration:

```yaml
with:
  llm-provider: openai
  llm-model: gpt-4o
  llm-api-key: ${{ secrets.OPENAI_API_KEY }}
```

---
<!-- 
## 1.5 Optional Components

Although not required, the following components improve analysis quality.

### Cordon

The action uses **Cordon** to preprocess large workflow logs before sending them to the LLM.

Benefits include:

- semantic log filtering
- anomaly detection
- context reduction
- lower LLM token consumption
- faster inference

---

### Remote Embedding Models

Instead of generating embeddings locally, Cordon can request embeddings from cloud providers.

Example:

```yaml
cordon-backend: remote
cordon-model-name: openai/text-embedding-3-small
cordon-api-key: ${{ secrets.OPENAI_API_KEY }}
```

Advantages:

- faster preprocessing
- no local model downloads
- lower memory usage

---

### Local Embedding Models

Organizations that cannot send data to external services may use local embedding models.

Example:

```yaml
cordon-backend: sentence-transformers
cordon-model-name: all-MiniLM-L6-v2
cordon-device: cpu
```

GPU acceleration is supported:

```yaml
cordon-device: cuda
```

or

```yaml
cordon-device: mps
```

--- -->

## 1.5 Installation Checklist

Before continuing, verify the following checklist.

| Requirement | Status |
|------------|--------|
| GitHub repository created | □ |
| GitHub Actions enabled | □ |
| Repository permissions configured | □ |
| LLM API key created | □ |
| GitHub Secret added | □ |
| Workflow permission configured | □ |
| Internet access available | □ |

Once all items are completed, proceed to the installation instructions in the next section.

---

# 2. Installation on GitHub Actions

This section describes how to integrate GitHub Actions Failure Analysis into an existing GitHub Actions workflow.

Two installation methods are supported:

1. Same Workflow (recommended)
2. Separate Workflow using `workflow_run`

---

## 2.1 Configure Repository Secrets

Before using the action, create a repository secret containing the API key of your selected LLM provider.

Example:

```
OPENAI_API_KEY
```

with value:

```
sk-xxxxxxxxxxxxxxxxxxxx
```

Similarly:

```
ANTHROPIC_API_KEY
```

or

```
GEMINI_API_KEY
```

depending on the selected provider.

---

## 2.2 Configure Workflow Permissions

Ensure the workflow grants sufficient permissions.

```yaml
permissions:
  contents: read
  pull-requests: write
```

If your organization restricts the default `GITHUB_TOKEN`, you may instead provide a Personal Access Token (PAT) using the `github-token` input.

---

## 2.3 Generate Workflow Using an AI Assistant (Optional)

Modern AI coding assistants such as ChatGPT, GitHub Copilot, Claude, and Gemini can significantly reduce the time required to create a GitHub Actions workflow. Instead of writing the workflow manually, users can provide a well-structured prompt describing the desired CI/CD pipeline and the configuration required for GitHub Actions Failure Analysis.

When using AI-generated workflows, always review the generated YAML before committing it to the repository to ensure that:

- required permissions are configured correctly;
- repository secrets are referenced instead of hardcoded credentials;
- the workflow triggers match the project's development process;
- the failure analysis job executes only after a failed workflow;
- the selected LLM provider and model are configured correctly.

### Example Prompt

```text
Generate a GitHub Actions workflow for a JavaScript project using npm.

Requirements:
- Trigger on pull requests targeting the main branch.
- Build the project using npm.
- Run all unit tests.
- If the build or tests fail, execute calebevans/gha-failure-analysis@v1.
- Use OpenAI GPT-4o as the LLM.
- Read the API key from OPENAI_API_KEY GitHub Secret.
- Post the analysis as a Pull Request comment.
- Configure the minimum required workflow permissions.
```

The generated workflow should resemble the following architecture:

```
Pull Request
      │
      ▼
 Build Project
      │
      ▼
 Execute Tests
      │
      ▼
Build Failed?
      │
 ┌────┴────┐
 │         │
No        Yes
 │         │
 ▼         ▼
Finish   Failure Analysis
             │
             ▼
      AI Root Cause Report
```

Although AI assistants can generate a valid workflow quickly, manual verification is strongly recommended before using the workflow in production environments.

---

## 2.4 Installation Method 1: Same Workflow (Recommended)

This approach analyzes failures immediately after the workflow fails.

Advantages:

- simplest configuration
- fastest feedback
- no additional workflow
- easier debugging

Example:

```yaml
name: CI

on:
  pull_request:

jobs:

  build:

    runs-on: ubuntu-latest

    steps:

      - uses: actions/checkout@v4

      - name: Install dependencies
        run: npm install

      - name: Run tests
        run: npm test

  analyze:

    needs: build

    if: failure()

    runs-on: ubuntu-latest

    permissions:
      contents: read
      pull-requests: write

    steps:

      - name: Analyze Failure
        uses: calebevans/gha-failure-analysis@v1

        with:

          llm-provider: openai

          llm-model: gpt-4o

          llm-api-key: ${{ secrets.OPENAI_API_KEY }}

          post-pr-comment: true
```

### Workflow Execution

When the build job fails:

```
Build Job
      │
      ▼
Workflow Failure
      │
      ▼
Failure Analysis Action
      │
      ▼
Download Logs
      │
      ▼
LLM Analysis
      │
      ▼
Generate Report
      │
      ├──── Job Summary
      ├──── JSON Report
      └──── PR Comment (optional)
```

---

## 2.5 Installation Method 2: Separate Workflow

Instead of analyzing failures in the same workflow, a dedicated workflow can monitor the completion status of another workflow.

This approach is recommended when:

- multiple CI workflows exist
- analysis should be isolated from build execution
- centralized failure reporting is required

Example:

```yaml
name: Failure Analysis

on:

  workflow_run:

    workflows:

      - "CI"

    types:

      - completed

jobs:

  analyze:

    if: github.event.workflow_run.conclusion == 'failure'

    runs-on: ubuntu-latest

    permissions:

      contents: read

      pull-requests: write

    steps:

      - uses: calebevans/gha-failure-analysis@v1

        with:

          run-id: ${{ github.event.workflow_run.id }}

          llm-provider: openai

          llm-model: gpt-4o

          llm-api-key: ${{ secrets.OPENAI_API_KEY }}
```

Unlike the previous method, the action explicitly receives the failed workflow's `run-id` and retrieves logs from that execution.

---

## 2.6 Selecting an LLM Provider

The action supports multiple LLM providers through a common configuration interface.

### OpenAI

```yaml
with:

  llm-provider: openai

  llm-model: gpt-4o

  llm-api-key: ${{ secrets.OPENAI_API_KEY }}
```

Recommended for:

- highest reasoning quality
- complex build failures
- large projects

---

### Anthropic

```yaml
with:

  llm-provider: anthropic

  llm-model: claude-3-5-sonnet-20241022

  llm-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
```

Recommended for:

- long logs
- detailed explanations
- infrastructure debugging

---

### Google Gemini

```yaml
with:

  llm-provider: gemini

  llm-model: gemini-2.5-flash

  llm-api-key: ${{ secrets.GEMINI_API_KEY }}
```

Recommended for:

- lower inference cost
- fast response time
- general CI pipelines

---

### Ollama

For organizations requiring fully local inference:

```yaml
with:

  llm-provider: ollama

  llm-model: llama3.1:70b
```

No API key is required if Ollama is hosted locally.

---

## 2.7 Verify the Installation

After a failed workflow, the action should automatically perform the following steps:

1. Retrieve workflow metadata.
2. Download failed job logs.
3. Preprocess logs using Cordon.
4. Analyze failures using the configured LLM.
5. Generate a structured root cause analysis.
6. Publish the results.

A successful execution typically produces:

- GitHub Job Summary
- AI-generated failure report
- JSON analysis artifact
- Pull Request comment (optional)

If all of the above artifacts are generated successfully, the installation is complete.

---

# 3. Configuration Reference

This section describes every configurable input supported by GitHub Actions Failure Analysis.

Inputs are divided into four categories:

- Required Parameters
- Optional Parameters
- Cordon Parameters
- Outputs

---

## 3.1 Required Parameters

The following parameters must always be provided.

| Parameter | Description | Example |
|------------|-------------|---------|
| `llm-provider` | LLM service provider | `openai` |
| `llm-model` | Model identifier | `gpt-4o` |
| `llm-api-key` | API key for the selected provider | `${{ secrets.OPENAI_API_KEY }}` |

### llm-provider

Specifies which LLM backend should perform the reasoning.

Supported values include:

- openai
- anthropic
- gemini
- ollama

Example:

```yaml
llm-provider: openai
```

---

### llm-model

Specifies the exact language model.

Example:

```yaml
llm-model: gpt-4o
```

Different providers expose different model names.

---

### llm-api-key

Authentication credential used to access the selected provider.

Example:

```yaml
llm-api-key: ${{ secrets.OPENAI_API_KEY }}
```

Never hardcode API keys in workflow files.

---

## 3.2 Optional Parameters

The following inputs customize the behavior of the analysis.

| Parameter | Default | Description |
|------------|----------|-------------|
| github-token | `${{ github.token }}` | GitHub API authentication |
| run-id | Current workflow | Workflow run to analyze |
| pr-number | Auto-detected | Override PR number |
| llm-base-url | Provider default | Custom LiteLLM endpoint |
| post-pr-comment | false | Publish report to PR |
| analyze-pr-context | true | Analyze changed files |
| pr-context-token-budget | 20 | Context allocation percentage |
| ignored-jobs | None | Ignore selected jobs |
| ignored-steps | None | Ignore selected steps |
| artifact-patterns | None | Analyze uploaded artifacts |

### github-token

Overrides the default GitHub token.

Useful when:

- organizational permission restrictions exist
- GitHub App authentication is required
- Personal Access Tokens are preferred

---

### run-id

Allows analysis of a workflow execution other than the current workflow.

Typically used with:

```
workflow_run
```

events.

---

### pr-number

Manually specifies the Pull Request number.

Normally, the action detects this automatically.

---

### llm-base-url

Used when the organization hosts an internal inference endpoint.

Example:

```yaml
llm-base-url: https://company-llm.internal/api
```

---

### post-pr-comment

When enabled:

```yaml
post-pr-comment: true
```

the generated report is automatically posted as a Pull Request comment.

---

### analyze-pr-context

When enabled, the action analyzes modified source files together with workflow logs.

Benefits include:

- identifying faulty commits
- highlighting changed files
- correlating failures with code modifications

---

### pr-context-token-budget

Controls how much of the model context window is allocated to pull request diffs.

Example:

```yaml
pr-context-token-budget: 20
```

Larger values improve code correlation but reduce space available for log analysis.

---

### ignored-jobs

Comma-separated list of job name patterns to ignore.

Example:

```yaml
ignored-jobs: lint,documentation
```

---

### ignored-steps

Ignore noisy workflow steps.

Example:

```yaml
ignored-steps: Cache,Setup Python
```

---

### artifact-patterns

Specifies additional files to analyze.

Example:

```yaml
artifact-patterns: "*.xml,*.txt"
```

This is particularly useful for:

- JUnit reports
- Test reports
- Crash dumps

---

## 3.3 Outputs

After successful execution, the action exports the following outputs.

| Output | Description |
|----------|-------------|
| summary | Short failure summary |
| category | Failure category |
| report-path | Path to generated JSON report |

### summary

A concise explanation of the detected failure.

---

### category

Possible categories include:

- test
- infrastructure
- configuration
- timeout
- build
- unknown

---

### report-path

Location of the generated JSON report.

Example:

```
analysis/report.json
```

This report can be archived, uploaded, or processed by downstream tools.

---

# 4. Troubleshooting

This section describes common issues encountered during installation and operation.

---

## 4.1 Invalid API Key

### Symptoms

- Authentication failed.
- Unauthorized request.
- HTTP 401 response.
- LLM request rejected.

### Possible Causes

- Incorrect API key.
- Expired API key.
- Wrong secret name.
- Invalid provider configuration.

### Solution

Verify:

- the API key is valid,
- the correct secret is referenced,
- the selected provider matches the API key.

Example:

```yaml
llm-provider: openai
llm-api-key: ${{ secrets.OPENAI_API_KEY }}
```

---

## 4.2 Workflow Cannot Access Logs

### Symptoms

The action reports that workflow logs cannot be retrieved.

### Possible Causes

- Missing permissions.
- Restricted GitHub token.
- Workflow executed from a fork.
- GitHub Enterprise permission restrictions.

### Solution

Ensure the workflow includes:

```yaml
permissions:
  contents: read
```

If organizational policies restrict the default `GITHUB_TOKEN`, configure a Personal Access Token or GitHub App token.

---

## 4.3 Pull Request Comment Is Not Created

### Symptoms

The analysis completes successfully, but no comment appears on the Pull Request.

### Possible Causes

- `post-pr-comment` is disabled.
- Missing `pull-requests: write` permission.
- Workflow was not triggered by a Pull Request.
- Token lacks permission to comment.

### Solution

Enable:

```yaml
post-pr-comment: true
```

and verify:

```yaml
permissions:
  pull-requests: write
```

---

## 4.4 Model Not Found

### Symptoms

The provider returns an error indicating that the requested model does not exist.

### Possible Causes

- Typographical error.
- Unsupported model.
- Deprecated model version.

### Solution

Verify the model name provided by the selected LLM provider.

Example:

```yaml
llm-model: gpt-4o
```

instead of an unavailable model identifier.

---

## 4.5 Ollama Connection Failed

### Symptoms

The action cannot communicate with the local Ollama server.

### Possible Causes

- Ollama service is not running.
- Incorrect base URL.
- Firewall restrictions.
- Model has not been downloaded.

### Solution

Verify:

- Ollama is running,
- the required model has been pulled,
- the endpoint is reachable from the runner.

---

## 4.6 Workflow Timeout

### Symptoms

The analysis job exceeds the workflow timeout.

### Possible Causes

- Extremely large logs.
- Slow LLM response.
- Large Pull Request diffs.
- Resource-constrained runners.

### Solution

Consider:

- ignoring unnecessary jobs,
- reducing PR context size,
- using remote embeddings,
- selecting a faster LLM model.

---

## 4.7 Rate Limit Exceeded

### Symptoms

The provider returns HTTP 429 or similar rate-limit errors.

### Possible Causes

- Too many requests.
- Shared organizational quota.
- Low API usage limits.

### Solution

- Retry after the specified delay.
- Upgrade the provider plan if necessary.
- Reduce analysis frequency.

---

## 4.8 Secret Redaction Issues

### Symptoms

Sensitive values appear in logs or generated reports.

### Possible Causes

- Secrets are not registered with GitHub.
- Values are dynamically generated and cannot be recognized.
- Secret detection patterns do not match the exposed values.

### Solution

- Store sensitive values using GitHub Secrets.
- Avoid printing secrets in build scripts.
- Review generated reports before sharing externally.