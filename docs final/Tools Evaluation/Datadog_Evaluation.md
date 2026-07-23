# Datadog — Tool Evaluation

Reference: <https://docs.datadoghq.com/getting_started/agent/>

We evaluated **Datadog** — specifically its Test Optimization / Flaky Test Management capability —
as a way to detect and triage flaky tests in CI. This note records what the platform is, how it
works, and why it was not a practical fit for a small course project.

## 1. What it is

Datadog is a large, commercial **observability and monitoring platform**. It spans infrastructure
monitoring, application performance monitoring (APM), log management, real-user monitoring, CI
Visibility, and — relevant here — **Test Optimization / Flaky Test Management**, which detects
tests that pass and fail non-deterministically across runs, tracks their history, and surfaces
analytics and quarantine workflows.

Its flaky-test angle is statistical and historical: it recognizes flakiness by observing a test's
outcomes over many executions, in contrast to the log-triage approach (reasoning over a single
failure's evidence) that we ultimately adopted.

## 2. How it works

- **Agent-based collection.** Datadog centers on the **Datadog Agent**, monitoring software
  deployed on each host / container / cluster. It "collects events and metrics from hosts and
  sends them to Datadog," gathering system metrics by default and logs/traces with additional
  configuration.
- **Account + keys.** Using it requires a Datadog account, an **API key** (a required field in
  `datadog.yaml`), and a chosen Datadog site/region. Setup is via in-app Fleet Automation or
  manual YAML; containers configure through environment variables and Autodiscovery.
- **Test data ingestion.** For flaky-test management specifically, the CI/test runner must be
  instrumented to report test results into Datadog's CI Visibility / Test Optimization product,
  which then builds the per-test history that flakiness detection depends on.

## 3. Observations and constraints

- **Built for scale.** Datadog is aimed at engineering organizations running substantial, ongoing
  workloads across many hosts and services; its value comes from continuous data across a fleet.
  A single course repository with occasional CI runs does not exercise the model it is designed
  for.
- **Configuration surface is large.** The platform is broad by design — many products, each with
  its own agent checks, integrations, keys, and instrumentation. Getting *only* flaky-test
  detection working still means standing up the account, agent/CI instrumentation, and result
  reporting. That breadth is a strength in production but heavy setup for a short demonstration.
- **Not demo-friendly.** Because meaningful output depends on accumulated run history and a
  configured pipeline integration, there is little to show in a self-contained, few-minute demo —
  unlike a tool that produces a visible result from a single failing run.
- **Commercial / regional availability.** It is a paid SaaS (the department provides no paid
  accounts; only free tiers/trials are allowed), and its local presence and support in Vietnam
  have only matured relatively recently — a practical adoption consideration for a local team,
  though not a technical blocker in itself.

## 4. Verdict

**Not adopted.** Datadog is a strong, mature platform and its Flaky Test Management is a
legitimate answer to the flaky-test problem — but it is scoped for large engineering teams with
continuous, high-volume workloads. Its configuration breadth, dependence on accumulated run
history, paid/enterprise model, and limited fit for a short, self-contained demonstration made it
impractical for this project.

