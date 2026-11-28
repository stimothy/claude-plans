/**
 * A Playwright reporter that names each slow test. Playwright's own report of slow tests names only their files.
 *
 * @packageDocumentation
 */
import type { Reporter, TestCase, TestResult } from "@playwright/test/reporter";

interface SlowTest {
  readonly title: string;
  readonly duration: number;
}

const seconds = (milliseconds: number): string => (milliseconds / 1000).toFixed(1);

/** Lists, when the run ends, the tests that took longer than a threshold, slowest first. */
export default class SlowTestReporter implements Reporter {
  readonly #threshold: number;
  readonly #slow: SlowTest[] = [];

  /** Takes the threshold that the Playwright settings give. */
  constructor({ thresholdMilliseconds }: { readonly thresholdMilliseconds: number }) {
    this.#threshold = thresholdMilliseconds;
  }

  /** Tells Playwright that other reporters show the run's progress. */
  printsToStdio(): boolean {
    return false;
  }

  /** Notes a test that was slow. */
  onTestEnd(test: Pick<TestCase, "titlePath">, { duration }: Pick<TestResult, "duration">): void {
    if (duration > this.#threshold) {
      this.#slow.push({ title: test.titlePath().filter(Boolean).join(" › "), duration });
    }
  }

  /** Prints the slow tests, if there were any. */
  onEnd(): void {
    if (this.#slow.length === 0) {
      return;
    }
    console.log(`Tests that took longer than ${String(this.#threshold / 1000)} seconds:`);
    for (const { title, duration } of this.#slow.toSorted((first, second) => second.duration - first.duration)) {
      console.log(`  ${seconds(duration)}s  ${title}`);
    }
  }
}
