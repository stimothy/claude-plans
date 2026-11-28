import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SlowTestReporter from "./slow-test-reporter.ts";

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
});

// What the reporter prints for a run of tests that took this long each.
function report(durations: Record<string, number>): unknown[] {
  const reporter = new SlowTestReporter({ thresholdMilliseconds: 5000 });
  for (const [name, duration] of Object.entries(durations)) {
    // Playwright's first title is the empty one of the whole run.
    reporter.onTestEnd({ titlePath: () => ["", "chromium", "studio.spec.ts", name] }, { duration });
  }
  reporter.onEnd();
  return vi.mocked(console.log).mock.calls.map(([line]) => line as unknown);
}

describe("the report of slow end-to-end tests", () => {
  it("names each test that took longer than the threshold, slowest first", () => {
    const lines = report({ quick: 400, slow: 6000, slower: 12_345 });

    expect(lines).toEqual([
      "Tests that took longer than 5 seconds:",
      "  12.3s  chromium › studio.spec.ts › slower",
      "  6.0s  chromium › studio.spec.ts › slow",
    ]);
  });

  it("says nothing when no test took longer, even one that took as long", () => {
    expect(report({ quick: 400, "at the threshold": 5000 })).toEqual([]);
  });

  it("leaves the printing of the run to the other reporters", () => {
    expect(new SlowTestReporter({ thresholdMilliseconds: 5000 }).printsToStdio()).toBe(false);
  });
});
