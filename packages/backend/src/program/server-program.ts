/**
 * Runs a server as a program of its own, which the claude-plans command starts as a separate process.
 *
 * @packageDocumentation
 */
import { parseArgs } from "node:util";

import { portSchema, type ServerStartReport } from "@claude-plans/domain";
import { createLogger, type Logger, type LogLevel } from "@claude-plans/logging";
import { z } from "zod";

import { requireCurrentDatabase } from "../database/readiness.ts";
import { logLevelSchema, type ServerOverrides, serverSettings } from "../server-settings.ts";
import { type RunningServer, startServer } from "../server/server.ts";
import { readSettings } from "../settings-file.ts";
import { requireFullPath } from "./full-path.ts";

/** What the program is given, so that it does not reach for the process that it runs in. */
export interface ServerProgram {
  readonly arguments: readonly string[];
  /** The application's version, which the health report gives. */
  readonly version: string;
  /** The directory that holds the built web page. */
  readonly pageDirectory: string;
  /** Tells whoever started the program whether the server is ready. */
  readonly report: (report: ServerStartReport) => void;
  /** Calls stop whenever the system asks the program to stop. */
  readonly onStopRequest: (stop: () => void) => void;
}

// Number() would also accept forms such as "4e3" or " 4311", which are more likely mistakes than ports.
const typedPortSchema = z.string().regex(/^\d+$/).transform(Number).pipe(portSchema);

interface Options extends ServerOverrides {
  readonly dataDirectory: string;
}

interface Started {
  readonly server: RunningServer;
  readonly log: Logger;
}

// Returns the value of an option that may be left out, or explains which one is wrong.
function optional<Value>(schema: z.ZodType<Value>, value: unknown, problem: string): Value | undefined {
  const checked = schema.optional().safeParse(value);
  if (!checked.success) {
    throw new Error(problem);
  }
  return checked.data;
}

function readOptions(given: readonly string[]): Options {
  const { values } = parseArgs({
    args: [...given],
    options: { "data-directory": { type: "string" }, port: { type: "string" }, "log-level": { type: "string" } },
  });
  return {
    dataDirectory: requireFullPath(values["data-directory"]),
    port: optional(typedPortSchema, values.port, "--port must be a whole number from 1 to 65535."),
    logLevel: optional(logLevelSchema, values["log-level"], "--log-level must be error, warn, info, or debug."),
  };
}

type Application = Pick<ServerProgram, "version" | "pageDirectory">;

async function start(options: Options, { version, pageDirectory }: Application): Promise<Started> {
  const { dataDirectory } = options;
  const logger = (level: LogLevel): Logger => createLogger({ dataDirectory, program: "backend", level });
  let settings;
  try {
    settings = serverSettings(readSettings(dataDirectory), options);
  } catch (error) {
    // The server logs its own failures to start, but it never saw this one.
    logger(options.logLevel ?? "info").error("The server did not start", error);
    throw error;
  }
  const log = logger(settings.logLevel);
  const serving = { dataDirectory, version, pageDirectory, port: settings.port, log };
  return { server: await startServer({ ...serving, checkDataDirectory: requireCurrentDatabase }), log };
}

/** Starts a server, reports whether that worked, and returns the program's exit code once the server has stopped. */
export async function runServerProgram(program: ServerProgram): Promise<number> {
  let started: Started;
  try {
    started = await start(readOptions(program.arguments), program);
  } catch (error) {
    program.report({ state: "failed", message: error instanceof Error ? error.message : String(error) });
    return 1;
  }
  const { server, log } = started;
  // A shutdown request logs its own failure, so only a stop that the system asked for is logged here.
  program.onStopRequest(() => {
    server.close().catch((error: unknown) => {
      log.error("The server did not stop cleanly", error);
    });
  });
  program.report({ state: "listening", port: server.port });
  try {
    await server.closed;
    return 0;
  } catch {
    return 1;
  }
}
