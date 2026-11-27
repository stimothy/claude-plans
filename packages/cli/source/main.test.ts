// These tests run the command as a process of its own, as a person or Claude does.
import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { text } from "node:stream/consumers";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { stopServer } from "./commands/stop.ts";
import { recordingTerminal } from "./recording-terminal.ts";
import { freePort, readyDatabase, useStandInServers } from "./server/stand-in-server.ts";

const servers = useStandInServers();
beforeEach(() => {
  readyDatabase(servers.directory());
});
// This runs before the cleanup above removes the directory.
afterEach(async () => {
  await stopServer(servers.directory(), recordingTerminal());
});

const repositoryCommand = join(import.meta.dirname, "main.ts");

function launch(...given: string[]) {
  return spawn(process.execPath, [repositoryCommand, ...given, `--data-directory=${servers.directory()}`]);
}

// Waits for the command to end and for its output to close, which a server holding the output would prevent.
async function run(...given: string[]) {
  return finish(launch(...given));
}

async function finish(child: ReturnType<typeof launch>) {
  const closed = once(child, "close");
  const [output, errors] = await Promise.all([text(child.stdout), text(child.stderr)]);
  const [code] = (await closed) as [number | null];
  return { code, output, errors };
}

// Windows cannot send SIGHUP.
const signals: NodeJS.Signals[] =
  process.platform === "win32" ? ["SIGINT", "SIGTERM"] : ["SIGINT", "SIGTERM", "SIGHUP"];

describe("the claude-plans program", () => {
  it("returns from a start in the background, and gives each command's exit code", async () => {
    const started = await run("start", "--detached", `--port=${String(await freePort())}`);
    const health = await run("health");
    const stopped = await run("stop");

    expect([started.code, health.code, stopped.code]).toEqual([0, 0, 0]);
    expect([started.errors, health.output, stopped.output]).toEqual([
      "",
      expect.stringContaining("Status: ok"),
      "The server stopped.\n",
    ]);
  });

  it("installs a copy that runs the server on its own data directory, without being told which", async () => {
    const installed = await run("install");
    const launcher = join(servers.directory(), "app", "command", "main.js");
    const runInstalled = (...given: string[]) => finish(spawn(process.execPath, [launcher, ...given]));

    const started = await runInstalled("start", "--detached", `--port=${String(await freePort())}`);
    const health = await runInstalled("health");
    const stopped = await runInstalled("stop");

    expect(installed).toMatchObject({ code: 0, errors: "" });
    expect([started.errors, health.output, stopped.output]).toEqual([
      "",
      expect.stringContaining("Status: ok"),
      "The server stopped.\n",
    ]);
  }, 20_000);

  it.each(signals)("stops its server in the foreground when it is sent %s", async (signal) => {
    const child = launch("start", `--port=${String(await freePort())}`);
    let output = "";
    child.stdout.on("data", (chunk) => (output += String(chunk)));
    await vi.waitFor(() => {
      expect(output).toContain("listening");
    }, 5000);
    const exited = once(child, "exit");

    child.kill(signal);

    // Windows ends the program at once, so nothing removes the record there.
    const clean = process.platform !== "win32";
    await expect(exited).resolves.toEqual(clean ? [0, null] : [null, signal]);
    expect(existsSync(join(servers.directory(), "server.json"))).toBe(!clean);
  });
});
