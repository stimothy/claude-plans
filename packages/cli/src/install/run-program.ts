/**
 * Runs the other programs that installing needs, and waits for them.
 *
 * @packageDocumentation
 */
import { spawnSync, type SpawnSyncReturns } from "node:child_process";

// Git variables, which a Git hook sets, would point Git at another repository than the one in its directory. These
// npm variables, which an npm script sets, would do the same to npm.
const misleading = /^(GIT_|npm_config_(local_prefix|workspaces?|include_workspace_root)$)/;

function environment(): NodeJS.ProcessEnv {
  return Object.fromEntries(Object.entries(process.env).filter(([name]) => !misleading.test(name)));
}

function outputOf(name: string, ended: SpawnSyncReturns<string>): string {
  if (ended.error !== undefined) {
    throw new Error(`Cannot run ${name}.`, { cause: ended.error });
  }
  if (ended.status !== 0) {
    const said = ended.stderr.trim();
    throw new Error(said === "" ? `${name} failed.` : said);
  }
  return ended.stdout.trim();
}

/**
 * Runs a program in a directory, and returns what it printed. A failure gives what it said was wrong. A report is
 * given what the program printed even then, because a program that was stopped may have said nothing else.
 */
export function runProgram(
  program: string,
  given: readonly string[],
  directory: string,
  report?: (printed: string) => void,
): string {
  const ended = spawnSync(program, given, { cwd: directory, env: environment(), encoding: "utf8" });
  // One that could not be started printed nothing.
  const printed = ended.error === undefined ? ended.stdout.trim() : "";
  if (printed !== "") {
    report?.(printed);
  }
  return outputOf(program, ended);
}

/** Runs Git in a directory, and returns what it printed. */
export function runGit(directory: string, given: readonly string[]): string {
  return runProgram("git", given, directory);
}

/**
 * Runs an npm command in a directory, and returns what it printed. Windows needs a shell to run npm, so the
 * command must be fixed text. Nothing that a person typed, and no path, may be put into it.
 */
export function runNpm(command: string, directory: string): string {
  const options = { cwd: directory, env: environment(), encoding: "utf8", shell: true } as const;
  return outputOf("npm", spawnSync(command, options));
}
