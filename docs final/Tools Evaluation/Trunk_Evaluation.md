# Trunk.io — Tool Evaluation

Upstream: <https://trunk.io/>
Companion how-to: [`Trunk_IO_User_Guide.md`](./Trunk_IO_User_Guide.md)

We evaluated Trunk.io as a unified code-quality gate and flaky-test-analytics layer for the EShop
monorepo. This note records what the tool is, how it works, and how it behaved once wired into
our GitHub Actions pipeline. Full installation steps, configuration files, and every issue fixed
along the way are documented separately in
[`Trunk_IO_User_Guide.md`](./Trunk_IO_User_Guide.md); this note stays at the
evaluation level.

## 1. What it is

Trunk.io is a meta-linter and test-analytics platform with two capabilities we adopted
independently:

- **Code Quality** — a single CLI (`trunk check`) that wraps existing linters (ESLint,
  `actionlint`, `git-diff-check`, …) behind one config and one command, both locally and in CI.
- **Flaky Tests** — a JUnit-ingesting analytics service that tracks test stability across runs,
  independent of which test runner produced the report.

It occupies the "unified quality gate" position in our tooling: rather than adding an AI layer,
it standardizes and enforces checks we already had (ESLint) and adds visibility (flakiness) we
didn't have, across a monorepo with three separate test runners (Mocha, Playwright, Jest).

## 2. How it works

1. **Local/CI parity** — the same `trunk.yaml` config and CLI version run identically on a
   developer machine and in GitHub Actions, so "passes locally" and "passes in CI" mean the same
   thing.
2. **Hold-the-line** — `trunk check` diffs against a base branch (`main`) and only fails on issues
   introduced by the change under review; pre-existing issues elsewhere in the repo are reported
   but non-blocking. This lets a partially-linted monorepo adopt a hard gate without a mass
   reformat first.
3. **JUnit ingestion** — a separate uploader action (`trunk-io/analytics-uploader`) reads any
   JUnit XML produced by a test job and pushes it to Trunk's Flaky Tests dashboard; it does not
   participate in pass/fail decisions.
4. **Composable scope** — both capabilities are opt-in per tool/directory (e.g., ESLint scoped to
   the two frontends, not the backend or mobile app), so adoption can be partial and incremental.

Two design choices stood out during evaluation:

- **Non-invasive by default.** Code Quality is a separate CI job that can gate merges via branch
  protection; Flaky Tests upload runs with `continue-on-error: true` and never changes a test's
  own exit code. Trunk cannot silently alter what "pass" means for existing suites.
- **Runner-agnostic analytics.** Because ingestion is JUnit-based, it works uniformly across
  Mocha, Playwright, and Jest once each is configured to emit JUnit — no runner-specific
  integration code.

## 3. Observations from our runs

- **Hold-the-line worked as intended.** `npm run lint` (diff-scoped) reported 76 modified files
  checked, 0 issues. `npm run lint:all` (whole-repo) surfaced 28 pre-existing ESLint issues in the
  frontends; hold-the-line correctly did not fail on these since they predate the change.
- **JUnit normalization was the real integration cost.** Of five test jobs (backend guard,
  backend spec, flaky suite, Playwright web/admin, mobile Jest), only two already emitted
  Trunk-compatible JUnit; the other three needed reporter configuration
  (`mocha-junit-reporter`, the Playwright `junit` reporter, `jest-junit`). This was the bulk of
  the integration effort, not the Trunk config itself.
- **Existing CI defects surfaced along the way**, unrelated to Trunk itself: missing
  `working-directory: backend` on `npm ci`, an out-of-sync Playwright admin port, and out-of-date
  frontend lockfiles. These were pre-existing pipeline bugs that integration work exposed, fixed
  as prerequisites, and are detailed in
  [`Trunk_IO_User_Guide.md`](./Trunk_IO_User_Guide.md#8-issues-found-and-fixed).
- **Pre-existing app/test defects remain, correctly unmasked.** Web Playwright still fails on a
  missing `type="email"` input; mobile Jest still fails on a Jest 30 / Expo preset
  incompatibility; backend spec has 14 pre-existing failures. Trunk reports these as-is rather
  than hiding or "fixing" them — expected behavior for a gate that only judges new changes.

## 4. Suitability for this project

The tool fit our constraints well: it layers over three heterogeneous test runners without
runner-specific code, its hold-the-line model lets a partially-linted monorepo adopt a hard gate
without a disruptive mass reformat, and both capabilities (lint gate, flaky analytics) are
independently useful even before the other is fully configured. Its cost was almost entirely
JUnit-reporter plumbing per test runner, not Trunk-specific complexity.

## 5. Verdict

**Adopted.** For a JavaScript monorepo with multiple test runners and an already-partially-linted
codebase, Trunk gave us a single CI gate and a runner-agnostic flakiness view without rewriting
any existing test or lint setup. Organization/token setup and enabling the branch-protection check
are account-level steps still pending on GitHub and Trunk.io — see
[`Trunk_IO_User_Guide.md`](./Trunk_IO_User_Guide.md#11-remaining-work-on-github-and-trunkio).
