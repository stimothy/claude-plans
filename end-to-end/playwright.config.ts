/**
 * Settings for the end-to-end tests, which use an installed studio as a person does, in Chromium.
 *
 * @packageDocumentation
 */
import { defineConfig, devices } from "@playwright/test";

const minute = 60_000;

/** The end-to-end test settings. */
export default defineConfig({
  testDir: ".",
  outputDir: "../test-results",
  // The whole run's time limit. Playwright still closes the browser and stops the studio when it passes, which
  // ending the process from outside would not.
  globalTimeout: 5 * minute,
  forbidOnly: true,
  retries: 0,
  // The tests share one installed studio, so they run one at a time.
  workers: 1,
  // Lists every test with its duration, then names the test files that were slow, slowest first.
  reporter: [["list"]],
  reportSlowTests: { max: 0, threshold: 5000 },
  projects: [{ name: "chromium", use: devices["Desktop Chrome"] }],
});
