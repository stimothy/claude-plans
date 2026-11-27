// These tests run the command as a process of its own, as a person or Claude does.
import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { text } from "node:stream/consumers";

import { afterEach, describe, expect, it, vi } from "vitest";

import { stopServer } from "./commands/stop.ts";
import { recordingTerminal } from "./recording-terminal.ts";
import { freePort, useStandInServers } from "./server/stand-in-server.ts";

const servers = useStandInServers();
// This runs before the cleanup above removes the directory.
afterEach(async () => {
  await stopServer(servers.directory(), recordingTerminal());
});

function launch(...given: string[]) {
  const command = join(import.meta.dirname, "main.ts");
  return spawn(process.execPath, [command, ...given, `--data-directory=${servers.directory()}`]);
}

// Waits for the command to end and for its output to close, which a server holding the output would prevent.
async function run(...given: string[]) {
  const child = launch(...given);
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

    // Health fails only because nothing has created the database.
    expect([started.code, health.code, stopped.code]).toEqual([0, 1, 0]);
    expect([started.errors, health.output, stopped.output]).toEqual([
      "",
      expect.stringContaining("Status: error"),
      "The server stopped.\n",
    ]);
  });

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
