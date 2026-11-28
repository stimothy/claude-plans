/**
 * Installs this copy of the application into a temporary data directory, as a person would install it, and runs
 * its server on a free port. It never uses the real data, and leaves the command on the path alone.
 *
 * @packageDocumentation
 */
import { execFile } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { test as base } from "@playwright/test";

import { freePort } from "../packages/cli/src/server/free-port.ts";

const repository = join(import.meta.dirname, "..");
// Playwright skips a fixture's cleanup when setting it up uses all of the fixture's time. Each command therefore
// has a shorter limit of its own, so that one that hangs fails while there is still time to clean up. Setting up
// runs an install and a start. Cleaning up may wait for the stop and start of an unfinished restart, and then
// stops. Installing runs npm and builds the page. Starting and stopping give up by themselves sooner than their
// limit.
const installTimeLimit = 90_000;
const commandTimeLimit = 40_000;
const studioTimeLimit = installTimeLimit + 4 * commandTimeLimit + 10_000;
const run = promisify(execFile);

/** A studio that is installed and running. */
export interface Studio {
  /** The address of its page. */
  readonly url: string;
  /** Runs its installed claude-plans command, and returns what it printed. */
  readonly command: (...given: string[]) => Promise<string>;
  /** Stops its server and starts it again, on the same port. */
  readonly restart: () => Promise<void>;
}

// Waiting without blocking lets Playwright's time limits end the wait.
async function node(program: string, given: readonly string[], timeout = commandTimeLimit): Promise<string> {
  const options = { cwd: repository, timeout, killSignal: "SIGKILL" } as const;
  const { stdout } = await run(process.execPath, [program, ...given], options);
  return stdout;
}

async function withStudio(dataDirectory: string, use: (studio: Studio) => Promise<void>): Promise<void> {
  const cli = join(repository, "packages", "cli", "src", "main.ts");
  await node(cli, ["install", `--data-directory=${dataDirectory}`], installTimeLimit);
  const installed = join(dataDirectory, "app", "command", "main.js");
  const command = (...given: string[]): Promise<string> => node(installed, given);
  const port = String(await freePort());
  const start = async (): Promise<void> => {
    await command("start", "--detached", `--port=${port}`);
  };
  const stopThenStart = async (): Promise<void> => {
    await command("stop");
    await start();
  };
  let restarting = Promise.resolve();
  const restart = (): Promise<void> => {
    restarting = stopThenStart();
    return restarting;
  };
  try {
    await start();
    await use({ url: `http://127.0.0.1:${port}`, command, restart });
  } finally {
    // A test that runs out of time goes on running. A restart that it began would otherwise start a server after
    // this stop, and leave it running. The test reports a restart that fails.
    await Promise.allSettled([restarting]);
    await command("stop");
  }
}

// Stopping a command does not stop the programs that it started, so an install that ran out of time may still be
// writing here. Failing to delete must not take the place of the failure that says why.
function remove(directory: string): void {
  try {
    rmSync(directory, { recursive: true, force: true });
  } catch (error) {
    console.warn(`Could not delete ${directory}.`, error);
  }
}

/** Playwright's test function, with a studio that the tests of one run share. */
export const test = base.extend<object, { studio: Studio }>({
  studio: [
    // The directory's name says which browser's run it belongs to.
    async ({ browserName }, use) => {
      const prefix = join(tmpdir(), `claude-plans-end-to-end-${browserName}-`);
      const directory = realpathSync.native(mkdtempSync(prefix));
      try {
        await withStudio(join(directory, "data"), use);
      } finally {
        remove(directory);
      }
    },
    { scope: "worker", timeout: studioTimeLimit },
  ],
});
