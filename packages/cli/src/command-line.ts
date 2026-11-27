/**
 * The claude-plans command line: reads what was typed, and runs the command that it names.
 *
 * @packageDocumentation
 */
import { existsSync } from "node:fs";
import { parseArgs, type ParseArgsOptionsConfig } from "node:util";

import { createLogger } from "@claude-plans/logging";

import { reportHealth } from "./commands/health.ts";
import { installApplication } from "./commands/install.ts";
import { startServer } from "./commands/start.ts";
import { stopServer } from "./commands/stop.ts";
import { errorMessage } from "./error-message.ts";
import { requireCurrentBuild } from "./install/outdated-build.ts";
import { Refusal } from "./install/refusal.ts";
import { type Surroundings, targetDirectory } from "./surroundings.ts";
import type { Terminal } from "./terminal.ts";

const usageMistake = 2;

const usage = `Usage:
  claude-plans install [--data-directory <path>]
  claude-plans start [--data-directory <path>] [--detached] [--port <number>] [--log-level <level>]
  claude-plans stop [--data-directory <path>]
  claude-plans health [--data-directory <path>] [--json]

An installed command uses the data directory that it was installed in unless another is given. The repository's
own copy, run with npm run claude-plans, always needs one, and never takes the real one. The first install of the
real application is: npm run install:studio`;

type Values = Readonly<Record<string, unknown>>;

interface Command {
  readonly options: ParseArgsOptionsConfig;
  /** Whether an outdated build refuses it. Installing and stopping always work. */
  readonly needsCurrentBuild?: true;
  readonly run: (dataDirectory: string, values: Values, terminal: Terminal, from: Surroundings) => Promise<number>;
}

const text = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);

const commands = new Map<string, Command>([
  [
    "install",
    {
      options: { studio: { type: "boolean" } },
      run: (dataDirectory, _, terminal, { repository }) => installApplication({ dataDirectory, repository }, terminal),
    },
  ],
  [
    "start",
    {
      options: { detached: { type: "boolean" }, port: { type: "string" }, "log-level": { type: "string" } },
      needsCurrentBuild: true,
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
      needsCurrentBuild: true,
      run: (dataDirectory, values, terminal, { version }) =>
        reportHealth({ dataDirectory, version, json: values["json"] === true }, terminal),
    },
  ],
]);

function readValues(command: Command, given: readonly string[], surroundings: Surroundings) {
  const options: ParseArgsOptionsConfig = { ...command.options, "data-directory": { type: "string" } };
  const values: Values = parseArgs({ args: [...given], options }).values;
  const target = { typed: text(values["data-directory"]), studio: values["studio"] === true };
  return { dataDirectory: targetDirectory(surroundings, target), values };
}

interface Invocation {
  readonly name: string;
  readonly command: Command;
  readonly given: readonly string[];
}

// Only a plain install's copy is meant to keep up with master. Any other copy was made to try particular code.
function checkBuild({ needsCurrentBuild }: Command, surroundings: Surroundings, terminal: Terminal): void {
  if (needsCurrentBuild === true && surroundings.installation?.real === true) {
    requireCurrentBuild(surroundings, (line) => {
      terminal.printError(line);
    });
  }
}

async function runCommand(invocation: Invocation, terminal: Terminal, surroundings: Surroundings): Promise<number> {
  const { name, command, given } = invocation;
  let read;
  try {
    read = readValues(command, given, surroundings);
  } catch (error) {
    terminal.printError(`${errorMessage(error)}\n\n${usage}`);
    return usageMistake;
  }
  const { dataDirectory, values } = read;
  try {
    checkBuild(command, surroundings, terminal);
    return await command.run(dataDirectory, values, terminal, surroundings);
  } catch (error) {
    terminal.printError(errorMessage(error));
    // A directory that does not exist is not created only to hold this entry.
    if (!(error instanceof Refusal) && existsSync(dataDirectory)) {
      createLogger({ dataDirectory, program: "cli", level: "info" }).error(`The ${name} command failed`, error);
    }
    return 1;
  }
}

/** Runs what was typed after "claude-plans", and returns the exit code: 2 if it could not be understood. */
export async function runCommandLine(
  given: readonly string[],
  terminal: Terminal,
  surroundings: Surroundings,
): Promise<number> {
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
  return runCommand({ name, command, given: rest }, terminal, surroundings);
}
