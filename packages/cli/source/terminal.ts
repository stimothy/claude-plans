/**
 * What a command uses to talk to the person who runs it.
 *
 * @packageDocumentation
 */

/** Where a command prints, and how it hears from the terminal. */
export interface Terminal {
  readonly print: (line: string) => void;
  readonly printError: (line: string) => void;
  /** Whether a signal must be passed on to a server in the foreground. Windows gives it to both programs. */
  readonly passesSignalsOn: boolean;
  /** Listens for the signals that ask a program to stop, until the returned function is called. */
  readonly onSignal: (listener: (signal: NodeJS.Signals) => void) => () => void;
}
