/**
 * A terminal for tests, which keeps what a command prints.
 *
 * @packageDocumentation
 */
import type { Terminal } from "./terminal.ts";

/** A terminal that records its output, and can send the signals that a real one would. */
export interface RecordingTerminal extends Terminal {
  readonly output: string[];
  readonly errors: string[];
  /** Sends a signal to whoever is listening. */
  readonly signal: (signal: NodeJS.Signals) => void;
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
