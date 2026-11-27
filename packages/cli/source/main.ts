/**
 * The command's entry point, which connects it to the process that it runs in.
 *
 * @packageDocumentation
 */
import { join } from "node:path";

import { runCommandLine } from "./command-line.ts";
import { surroundingsOf } from "./surroundings.ts";

const signals = ["SIGINT", "SIGTERM", "SIGHUP"] as const;

const surroundings = surroundingsOf(join(import.meta.dirname, "..", "..", ".."));

process.exitCode = await runCommandLine(
  process.argv.slice(2),
  {
    print: (line) => {
      console.log(line);
    },
    printError: (line) => {
      console.error(line);
    },
    passesSignalsOn: process.platform !== "win32",
    onSignal: (listener) => {
      for (const signal of signals) {
        process.on(signal, listener);
      }
      return () => {
        for (const signal of signals) {
          process.off(signal, listener);
        }
      };
    },
  },
  surroundings,
);
