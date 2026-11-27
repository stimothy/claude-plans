/**
 * Writes log entries to the data directory, as one line of JSON each.
 *
 * @packageDocumentation
 */
import { join } from "node:path";

import { appendLine, deleteOldFiles, utcDate } from "./log-files.ts";
import { stackTrace } from "./stack-trace.ts";

/** The log levels, from the one that is always written to the one with the most detail. */
export const logLevels = ["error", "warn", "info", "debug"] as const;

/** How much detail the logs hold, or how serious one entry is. */
export type LogLevel = (typeof logLevels)[number];

/** Where a logger writes, and what it writes. */
export interface LoggerOptions {
  readonly dataDirectory: string;
  // Each program writes its own files.
  readonly program: "backend" | "cli";
  readonly level: LogLevel;
  readonly now?: () => Date;
}

/**
 * Writes one entry. Give what was thrown to add its stack trace. A message must never hold a secret or the body
 * of a request or response.
 */
export type Log = (message: string, thrown?: unknown) => void;

/** A way to write an entry at each level. */
export type Logger = Readonly<Record<LogLevel, Log>>;

/**
 * Makes a logger that writes to logs/ in the data directory. Entries with more detail than the chosen level are
 * dropped. A log that cannot be written is reported on the error output, and the program carries on.
 */
export function createLogger(options: LoggerOptions): Logger {
  const { dataDirectory, program, level, now = () => new Date() } = options;
  const directory = join(dataDirectory, "logs");
  let checked = "";

  const write = (entryLevel: LogLevel, message: string, thrown: unknown): void => {
    if (logLevels.indexOf(entryLevel) > logLevels.indexOf(level)) {
      return;
    }
    const time = now();
    const stack = thrown === undefined ? undefined : stackTrace(thrown);
    const line = JSON.stringify({ time: time.toISOString(), level: entryLevel, message, stack });
    try {
      appendLine(directory, program, time, line);
      // Old files are looked for with the first entry of each day, so a server that runs for weeks deletes them.
      if (utcDate(time) !== checked) {
        checked = utcDate(time);
        deleteOldFiles(directory, program, time);
      }
    } catch (error) {
      process.stderr.write(`Cannot write the log: ${String(error)}\n`);
    }
  };

  const at =
    (entryLevel: LogLevel): Log =>
    (message, thrown) => {
      write(entryLevel, message, thrown);
    };
  return { error: at("error"), warn: at("warn"), info: at("info"), debug: at("debug") };
}
