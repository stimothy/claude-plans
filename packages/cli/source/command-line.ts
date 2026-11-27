/**
 * The claude-plans command line: reads what was typed, and runs the command that it names.
 *
 * @packageDocumentation
 */
import { existsSync } from "node:fs";
import { isAbsolute } from "node:path";
import { parseArgs, type ParseArgsOptionsConfig } from "node:util";

import { createLogger } from "@claude-plans/logging";

import { reportHealth } from "./commands/health.ts";
import { startServer } from "./commands/start.ts";
import { stopServer } from "./commands/stop.ts";
import type { Terminal } from "./terminal.ts";

const usageMistake = 2;

const usage = `Usage:
  claude-plans start --data-directory <path> [--detached] [--port <number>] [--log-level <level>]
  claude-plans stop --data-directory <path>
  claude-plans health --data-directory <path> [--json]`;

type Values = Readonly<Record<string, unknown>>;

interface Command {
  readonly options: ParseArgsOptionsConfig;
  readonly run: (dataDirectory: string, values: Values, terminal: Terminal) => Promise<number>;
}

const text = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);

const commands = new Map<string, Command>([
  [
    "start",
    {
      options: { detached: { type: "boolean" }, port: { type: "string" }, "log-level": { type: "string" } },
      run: (dataDirectory, values, terminal) => {
        const detached = values["detached"] === true;
        const logLevel = text(values["log-level"]);
        return startServer({ dataDirectory, detached, port: text(values["port"]), logLevel }, terminal);
      },
    },
  ],
  ["stop", { options: {}, run: (dataDirectory, _, terminal) => stopServer(dataDirectory, terminal) }],
  [
    "health",
    {
      options: { json: { type: "boolean" } },
      run: (dataDirectory, values, terminal) => reportHealth(dataDirectory, values["json"] === true, terminal),
    },
  ],
]);

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error));

function readValues(command: Command, given: readonly string[]): { dataDirectory: string; values: Values } {
  const options: ParseArgsOptionsConfig = { ...command.options, "data-directory": { type: "string" } };
  const values: Values = parseArgs({ args: [...given], options }).values;
  const dataDirectory = text(values["data-directory"]) ?? "";
  if (!isAbsolute(dataDirectory)) {
    // There is no default yet, so that code under development cannot reach the real data.
    throw new Error("--data-directory must give a full path. It has no default until the command is installed.");
  }
  return { dataDirectory, values };
}

async function runCommand(
  name: string,
  command: Command,
  given: readonly string[],
  terminal: Terminal,
): Promise<number> {
  let read;
  try {
    read = readValues(command, given);
  } catch (error) {
    terminal.printError(`${message(error)}\n\n${usage}`);
    return usageMistake;
  }
  const { dataDirectory, values } = read;
  try {
    return await command.run(dataDirectory, values, terminal);
  } catch (error) {
    terminal.printError(message(error));
    // A directory that does not exist is not created only to hold this entry.
    if (existsSync(dataDirectory)) {
      createLogger({ dataDirectory, program: "cli", level: "info" }).error(`The ${name} command failed`, error);
    }
    return 1;
  }
}

/** Runs what was typed after "claude-plans", and returns the exit code: 2 if it could not be understood. */
export async function runCommandLine(given: readonly string[], terminal: Terminal): Promise<number> {
  const [name = "", ...rest] = given;
  if (name === "help" || given.includes("--help")) {
    terminal.print(usage);
    return 0;
  }
  const command = commands.get(name);
  if (command === undefined) {
    terminal.printError(usage);
    return usageMistake;
  }
  return runCommand(name, command, rest, terminal);
}
