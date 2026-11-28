/**
 * Settings for the web page's component tests, which run in a browser. They are apart from the other tests, which
 * need no browser. They run from the repository's top directory, which the paths below start at.
 *
 * @packageDocumentation
 */
import { join } from "node:path";

import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

const minimumCoverage = { lines: 80, branches: 80, functions: 80, statements: 80 };

// Each project needs a browser instance with a name of its own.
const browser = (name: string) => ({
  enabled: true,
  headless: true,
  provider: playwright(),
  instances: [{ browser: "chromium" as const, name }],
});

/** Test settings for the stories, and for the page's other tests. */
export default defineConfig({
  test: {
    allowOnly: false,
    reporters: ["verbose"],
    projects: [
      {
        plugins: [storybookTest({ configDir: join(import.meta.dirname, ".storybook") })],
        test: { name: "stories", browser: browser("stories") },
      },
      {
        plugins: [react()],
        test: { name: "page", include: ["packages/frontend/src/**/*.test.tsx"], browser: browser("page") },
      },
    ],
    coverage: {
      include: ["packages/frontend/src/**/*.{ts,tsx}"],
      exclude: ["**/*.stories.tsx", "**/*.test.{ts,tsx}"],
      thresholds: minimumCoverage,
    },
  },
});
