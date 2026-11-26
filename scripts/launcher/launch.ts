/**
 * Starts the repository's Python scripts the same way on every operating system,
 * and stops a command that runs past its time limit.
 *
 * @packageDocumentation
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

import { findPython, probeVersion, type Probe } from "./interpreter.ts";

const usage = "Usage: launch.ts setup | system <arguments...> | (python|node) [--time-limit <seconds>] <arguments...>";

/** What the launcher needs to know about the machine it runs on. */
export interface Surroundings {
  /** The repository's top-level directory. */
  readonly root: string;
  /** The operating system. */
  readonly platform: NodeJS.Platform;
  /** The environment variables. */
  readonly environment: NodeJS.ProcessEnv;
  /** Asks a Python command for its version. */
  readonly probe: Probe;
  /** Reports whether a file exists. */
  readonly exists: (path: string) => boolean;
}

/** A command to run. */
export interface Plan {
  /** The program followed by its arguments. */
  readonly command: readonly string[];
  /** How long the command may run before it fails. */
  readonly timeLimitSeconds?: number;
}

function environmentPython({ root, platform, exists }: Surroundings): string {
  const location = platform === "win32" ? ["Scripts", "python.exe"] : ["bin", "python"];
  const python = join(root, ".venv", ...location);
  if (!exists(python)) {
    throw new Error("The Python environment is missing. Run `npm run setup:python` first.");
  }
  return python;
}

/** Turns the launcher's arguments into the command to run. */
export function plan(argumentList: readonly string[], surroundings: Surroundings): Plan {
  const [mode, ...rest] = argumentList;
  if (mode === "setup" || mode === "system") {
    const python = findPython(surroundings.environment, surroundings.probe);
    return { command: [...python, ...(mode === "setup" ? ["-m", "scripts.environment.create"] : rest)] };
  }
  if (mode !== "python" && mode !== "node") {
    throw new Error(usage);
  }
  const program = mode === "node" ? process.execPath : environmentPython(surroundings);
  if (rest[0] !== "--time-limit") {
    return { command: [program, ...rest] };
  }
  const timeLimitSeconds = Number(rest[1]);
  if (!Number.isFinite(timeLimitSeconds) || timeLimitSeconds <= 0) {
    throw new Error("--time-limit needs a number of seconds above zero.");
  }
  return { command: [program, ...rest.slice(2)], timeLimitSeconds };
}

/** Runs a planned command in a directory and returns its exit code. */
export function execute({ command, timeLimitSeconds }: Plan, directory: string): number {
  const [program = "", ...programArguments] = command;
  const result = spawnSync(program, programArguments, {
    cwd: directory,
    stdio: "inherit",
    ...(timeLimitSeconds && { timeout: Math.ceil(timeLimitSeconds * 1000), killSignal: "SIGKILL" }),
  });
  if (result.error) {
    const timedOut = "code" in result.error && result.error.code === "ETIMEDOUT";
    console.error(
      timedOut ? `The command exceeded its time limit of ${String(timeLimitSeconds)} seconds.` : result.error.message,
    );
    return 1;
  }
  if (result.signal) {
    console.error(`The command was ended by ${result.signal}.`);
  }
  return result.status ?? 1;
}

if (import.meta.main) {
  const root = resolve(import.meta.dirname, "../..");
  try {
    const surroundings = {
      root,
      platform: process.platform,
      environment: process.env,
      probe: probeVersion,
      exists: existsSync,
    };
    process.exitCode = execute(plan(process.argv.slice(2), surroundings), root);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
