/**
 * The start command, which runs the backend's server program as a separate process.
 *
 * @packageDocumentation
 */
import { type ChildProcess, spawn } from "node:child_process";
import { join } from "node:path";

import { type ServerStartReport, serverStartReportSchema } from "@claude-plans/domain";

import type { Terminal } from "../terminal.ts";

/** What the start command was asked for. */
export interface StartOptions {
  readonly dataDirectory: string;
  /** Whether the server runs in the background. */
  readonly detached: boolean;
  /** The port and log level as they were typed, which the server program checks. */
  readonly port?: string | undefined;
  readonly logLevel?: string | undefined;
}

/** How to run a server program. */
export interface Launch {
  /** The program that runs it, such as Node.js. */
  readonly runtime: string;
  readonly program: string;
  /** How long the server may take to be ready. */
  readonly readyTimeoutMilliseconds: number;
}

// The command may not import the backend, so it only names the file that it runs.
const serverProgram: Launch = {
  runtime: process.execPath,
  program: join(import.meta.dirname, "..", "..", "..", "backend", "src", "program", "main.ts"),
  readyTimeoutMilliseconds: 30_000,
};

function programArguments({ dataDirectory, port, logLevel }: StartOptions): string[] {
  // Joining each name to its value keeps a value that starts with a dash from being read as another option.
  const given = Object.entries({ "data-directory": dataDirectory, port, "log-level": logLevel });
  return given.flatMap(([name, value]) => (value === undefined ? [] : [`--${name}=${value}`]));
}

function run(options: StartOptions, launch: Launch): ChildProcess {
  const shared = options.detached ? "ignore" : "inherit";
  // The last channel carries the program's report. A detached program has its own process group, so that closing
  // this terminal does not stop it.
  return spawn(launch.runtime, [launch.program, ...programArguments(options)], {
    detached: options.detached,
    stdio: [shared, shared, shared, "ipc"],
    windowsHide: options.detached,
  });
}

function firstReport(child: ChildProcess, timeout: number, dataDirectory: string): Promise<ServerStartReport> {
  const { promise, resolve, reject } = Promise.withResolvers<ServerStartReport>();
  const fail = (problem: string): void => {
    reject(new Error(`${problem} See the logs in ${join(dataDirectory, "logs")}.`));
  };
  // A program that is given up on is ended, so that it cannot go on to serve after the command has failed.
  const abandon = (problem: string): void => {
    child.kill();
    fail(problem);
  };
  const timer = setTimeout(abandon, timeout, "The server was not ready in time.");
  child.once("message", (message) => {
    const report = serverStartReportSchema.safeParse(message);
    if (report.success) {
      resolve(report.data);
    } else {
      abandon("The server program's report was not understood.");
    }
  });
  // The channel closes only after every message on it has arrived.
  child.once("disconnect", () => {
    fail("The server stopped before it was ready.");
  });
  child.once("error", reject);
  return promise.finally(() => {
    clearTimeout(timer);
  });
}

// Waits for the report, and then for a server in the foreground. A signal in the meantime is passed on where only
// this program may have been sent it. A server in the background has its own process group, so it gets none from
// the terminal, and it is ended if the command is interrupted before it is ready.
async function follow(child: ChildProcess, options: StartOptions, terminal: Terminal, launch: Launch) {
  const { promise: exited, resolve } = Promise.withResolvers<number>();
  child.once("exit", (code) => {
    resolve(code ?? 1);
  });
  const stopListening = terminal.onSignal((signal) => {
    if (options.detached || terminal.passesSignalsOn) {
      child.kill(signal);
    }
  });
  try {
    const report = await firstReport(child, launch.readyTimeoutMilliseconds, options.dataDirectory);
    return await conclude(report, options.detached, terminal, exited);
  } finally {
    stopListening();
    // A server in the background carries on after this command ends.
    child.unref();
  }
}

async function conclude(report: ServerStartReport, detached: boolean, terminal: Terminal, exited: Promise<number>) {
  if (report.state === "failed") {
    terminal.printError(report.message);
    return 1;
  }
  const url = `http://127.0.0.1:${String(report.port)}`;
  if (detached) {
    terminal.print(`The server is running in the background at ${url}`);
    return 0;
  }
  terminal.print(`The server is listening at ${url}. Press Ctrl+C to stop it.`);
  return exited;
}

/**
 * Starts a server, and returns the exit code. In the background, it returns once the server is ready. In the
 * foreground, it returns when the server has stopped.
 */
export async function startServer(options: StartOptions, terminal: Terminal, launch = serverProgram): Promise<number> {
  return follow(run(options, launch), options, terminal, launch);
}
