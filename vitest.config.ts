import { readdirSync } from "node:fs";
import { join } from "node:path";

import { defineConfig } from "vitest/config";

const minimumCoverage = { lines: 80, branches: 80, functions: 80, statements: 80 };

// Each package must meet the minimum by itself, so that a well-tested one cannot make up for another.
const packageMinimums = Object.fromEntries(
  readdirSync(join(import.meta.dirname, "packages")).map((name) => [`packages/${name}/**`, minimumCoverage]),
);

/** Test settings for the Node.js scripts and the packages. */
export default defineConfig({
  test: {
    include: ["scripts/**/*.test.ts", "packages/*/src/**/*.test.ts"],
    // Lists every test with its duration, and highlights the slow ones.
    reporters: ["verbose"],
    slowTestThreshold: 300,
    allowOnly: false,
    coverage: {
      include: ["scripts/**/*.ts", "packages/*/src/**/*.ts"],
      // The first entries apply to everything together.
      thresholds: { ...minimumCoverage, ...packageMinimums },
    },
  },
});
