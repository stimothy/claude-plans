import { spawnSync } from "node:child_process";

const candidates: readonly (readonly string[])[] = [
  ["python3.14"],
  ["python3.13"],
  ["python3.12"],
  ["python3"],
  ["python"],
  ["py", "-3"],
];

const versionScript = "import sys; print('%d %d' % sys.version_info[:2])";

/** Returns a Python command's version, such as `3 12`, or nothing if the command does not work. */
export type Probe = (command: readonly string[]) => string | undefined;

/** Asks a Python command for its major and minor version. */
export const probeVersion = ([executable = "", ...options]: readonly string[], timeout = 10_000) => {
  const settings = { encoding: "utf8", timeout, killSignal: "SIGKILL" } as const;
  const result = spawnSync(executable, [...options, "-c", versionScript], settings);
  return result.status === 0 ? result.stdout.trim() : undefined;
};

function isNewEnough(version: string | undefined): boolean {
  const [major = 0, minor = 0] = (version ?? "").split(" ").map(Number);
  return major === 3 && minor >= 12;
}

/**
 * Finds a command that runs Python 3.12 or newer.
 *
 * The `PYTHON` environment variable, when set, is the only command tried.
 */
export function findPython(environment: NodeJS.ProcessEnv, probe: Probe): readonly string[] {
  const chosen = environment["PYTHON"];
  const commands = chosen ? [[chosen]] : candidates;
  const found = commands.find((command) => isNewEnough(probe(command)));
  if (!found) {
    const tried = commands.map((command) => command.join(" ")).join(", ");
    throw new Error(
      `Python 3.12 or newer was not found. Tried: ${tried}. ` +
        "Install it, or set the PYTHON environment variable to its path.",
    );
  }
  return found;
}
