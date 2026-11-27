/**
 * A terminal for tests, which keeps what a command prints.
 *
 * @packageDocumentation
 */
import { runCommandLine } from "./command-line.ts";
import type { Surroundings } from "./surroundings.ts";
import type { Terminal } from "./terminal.ts";

/** A terminal that records its output, and can send the signals that a real one would. */
export interface RecordingTerminal extends Terminal {
  readonly output: string[];
  readonly errors: string[];
  /** Sends a signal to whoever is listening. */
  readonly signal: (signal: NodeJS.Signals) => void;
}

/** Runs what was typed as a copy of the command would, and returns its exit code and what it printed. */
export async function runRecorded(surroundings: Surroundings, given: readonly string[]) {
  const terminal = recordingTerminal();
  const code = await runCommandLine(given, terminal, surroundings);
  return { code, output: terminal.output.join("\n"), errors: terminal.errors.join("\n") };
}

/** Makes a terminal that records. It passes signals on, as terminals outside Windows need, unless told not to. */
export function recordingTerminal(passesSignalsOn = true): RecordingTerminal {
  const output: string[] = [];
  const errors: string[] = [];
  const listeners = new Set<(signal: NodeJS.Signals) => void>();
  return {
    output,
    errors,
    print: (line) => void output.push(line),
    printError: (line) => void errors.push(line),
    passesSignalsOn,
    onSignal: (listener) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    signal: (signal) => {
      for (const listener of listeners) {
        listener(signal);
      }
    },
  };
}
