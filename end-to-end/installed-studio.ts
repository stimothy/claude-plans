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
// Installing runs npm and builds the page.
const installTimeLimit = 120_000;
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

// Waiting without blocking lets Playwright's time limits end a command that hangs.
async function node(program: string, given: readonly string[]): Promise<string> {
  const { stdout } = await run(process.execPath, [program, ...given], { cwd: repository });
  return stdout;
}

async function withStudio(dataDirectory: string, use: (studio: Studio) => Promise<void>): Promise<void> {
  const cli = join(repository, "packages", "cli", "src", "main.ts");
  await node(cli, ["install", `--data-directory=${dataDirectory}`]);
  const installed = join(dataDirectory, "app", "command", "main.js");
  const command = (...given: string[]): Promise<string> => node(installed, given);
  const port = String(await freePort());
  const start = async (): Promise<void> => {
    await command("start", "--detached", `--port=${port}`);
  };
  await start();
  const restart = async (): Promise<void> => {
    await command("stop");
    await start();
  };
  try {
    await use({ url: `http://127.0.0.1:${port}`, command, restart });
  } finally {
    await command("stop");
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
        rmSync(directory, { recursive: true, force: true });
      }
    },
    { scope: "worker", timeout: installTimeLimit },
  ],
});
