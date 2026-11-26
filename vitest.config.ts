import { defineConfig } from "vitest/config";

/** Test settings for the Node.js code that is not part of a package. */
export default defineConfig({
  test: {
    include: ["scripts/**/*.test.ts"],
    // Lists every test with its duration, and highlights the slow ones.
    reporters: ["verbose"],
    slowTestThreshold: 300,
    allowOnly: false,
    coverage: {
      include: ["scripts/**/*.ts"],
      // The command-line entry point only connects the tested functions to this process.
      exclude: ["scripts/**/*.test.ts"],
      thresholds: { lines: 80, branches: 80, functions: 80, statements: 80 },
    },
  },
});
