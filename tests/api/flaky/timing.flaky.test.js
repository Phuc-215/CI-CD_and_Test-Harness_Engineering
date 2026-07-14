// T07 Seminar — INTENTIONAL flaky test (Phase 2: Flaky Inoculation).
// This test is deliberately non-deterministic. It is isolated in tests/api/flaky/ and is
// NEVER part of the guard (must-pass) gate, so it cannot block real merges.
//
// Mechanism: a timing budget. Simulated work sleeps a random 0-80ms; the assertion demands
// it finish under a 50ms budget. Event-loop jitter on a shared CI runner makes the outcome
// vary run-to-run (~40% failure rate) — exactly the behavior the seminar asks us to observe
// over 10 sequential pipeline runs.
const { expect } = require("chai");

describe("FLAKY: timing budget (intentional, isolated)", () => {
  it("completes simulated work within the 50ms budget", async () => {
    const start = Date.now();
    const work = Math.random() * 80; // 0-80ms of "work"
    await new Promise((resolve) => setTimeout(resolve, work));
    const elapsed = Date.now() - start;

    // Log the measurement so each run's value is visible in the CI log / JUnit output.
    console.log(`[flaky] simulated work=${work.toFixed(1)}ms, elapsed=${elapsed}ms, budget=50ms`);

    expect(elapsed, "elapsed time exceeded the 50ms budget (flaky by design)").to.be.lessThan(50);
  });
});
