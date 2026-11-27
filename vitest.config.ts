import { readdirSync } from "node:fs";
import { join } from "node:path";

import { configDefaults, defineConfig } from "vitest/config";

const minimumCoverage = { lines: 80, branches: 80, functions: 80, statements: 80 };

// Each package must meet the minimum by itself, so that a well-tested one cannot make up for another.
const packageMinimums = Object.fromEntries(
  readdirSync(join(import.meta.dirname, "packages")).map((name) => [`packages/${name}/**`, minimumCoverage]),
);

const tests = ["scripts/**/*.test.ts", "packages/*/src/**/*.test.ts"];
// An integration test uses a real database, runs a server, or starts another program.
const integrationTests = tests.map((pattern) => pattern.replace(".test.ts", ".integration.test.ts"));
// Starting npm, Git, or a server can take seconds on a busy machine. Each suite also has a time limit of its own.
const integrationTimeout = 30_000;

// A suite that saves its results to be merged covers only part of the code. The merged report, and any other run,
// must meet the minimums. The first entries apply to everything together.
const savesPartOfTheCoverage = process.argv.includes("--reporter=blob");
const thresholds = savesPartOfTheCoverage ? {} : { thresholds: { ...minimumCoverage, ...packageMinimums } };

/** Test settings for the Node.js scripts and the packages. */
export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: { name: "unit", include: tests, exclude: [...configDefaults.exclude, ...integrationTests] },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: integrationTests,
          testTimeout: integrationTimeout,
          hookTimeout: integrationTimeout,
        },
      },
    ],
    // Lists every test with its duration, and highlights the slow ones.
    reporters: ["verbose"],
    slowTestThreshold: 300,
    allowOnly: false,
    coverage: {
      include: ["scripts/**/*.ts", "packages/*/src/**/*.ts"],
      ...thresholds,
    },
  },
});
