// These tests run the real server program, each on its own temporary data directory and a free port.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { recordingTerminal } from "../recording-terminal.ts";
import { findServer } from "../server/running-server.ts";
import { freePort, useStandInServers } from "../server/stand-in-server.ts";
import { startServer, type StartOptions } from "./start.ts";
import { stopServer } from "./stop.ts";

const servers = useStandInServers();
let dataDirectory = "";
let port = "";

beforeEach(async () => {
  dataDirectory = servers.directory();
  port = String(await freePort());
});
// This runs before the cleanup above removes the directory.
afterEach(async () => {
  await stopServer(dataDirectory, recordingTerminal());
});

const options = (detached: boolean): StartOptions => ({ dataDirectory, detached, port, logLevel: "debug" });
const url = (): string => `http://127.0.0.1:${port}`;

describe("the start command with a server in the background", () => {
  it("returns once the server is ready, and leaves it running", async () => {
    const terminal = recordingTerminal();

    const code = await startServer(options(true), terminal);

    expect(code).toBe(0);
    expect(terminal.output).toEqual([`The server is running in the background at ${url()}`]);
    await expect(findServer(dataDirectory)).resolves.toMatchObject({ port: Number(port) });
  });

  it("explains why the server did not start, which the server also logs", async () => {
    await startServer(options(true), recordingTerminal());
    const terminal = recordingTerminal();

    const code = await startServer(options(true), terminal);

    expect(code).toBe(1);
    expect(terminal.errors).toEqual([expect.stringContaining("already running")]);
    const logs = join(dataDirectory, "logs");
    const written = readdirSync(logs).map((name) => readFileSync(join(logs, name), "utf8"));
    expect(written.join("")).toContain("The server did not start");
  });
});

describe("the start command with a server in the foreground", () => {
  async function startInForeground(terminal = recordingTerminal()) {
    const exited = startServer(options(false), terminal);
    await vi.waitFor(() => {
      expect(terminal.output).toEqual([`The server is listening at ${url()}. Press Ctrl+C to stop it.`]);
    }, 5000);
    return { exited, terminal };
  }

  it("ends when the server stops", async () => {
    const { exited } = await startInForeground();

    await stopServer(dataDirectory, recordingTerminal());

    await expect(exited).resolves.toBe(0);
  });

  it("passes a signal on to the server where the terminal needs it", async () => {
    const { exited, terminal } = await startInForeground();

    terminal.signal("SIGTERM");

    // Windows cannot send a signal that a program handles, so there it ends the server at once.
    await expect(exited).resolves.toBe(process.platform === "win32" ? 1 : 0);
  });

  it("does not pass a signal on where the server gets it too", async () => {
    const { exited, terminal } = await startInForeground(recordingTerminal(false));

    terminal.signal("SIGTERM");

    await expect(findServer(dataDirectory)).resolves.toBeDefined();
    await stopServer(dataDirectory, recordingTerminal());
    await expect(exited).resolves.toBe(0);
  });
});

describe("a server program that does not report", () => {
  async function start(source: string, readyTimeoutMilliseconds = 5000): Promise<number> {
    const program = join(dataDirectory, "program.mjs");
    writeFileSync(program, source);
    const launch = { runtime: process.execPath, program, readyTimeoutMilliseconds };
    return startServer(options(true), recordingTerminal(), launch);
  }

  it.each([
    ["ends first", "process.exitCode = 1;", "stopped before it was ready"],
    ["sends something else", "process.send({ state: 'ready' }); setInterval(() => {}, 1000);", "not understood"],
  ])("fails when it %s, and says where the logs are", async (_, source, problem) => {
    await expect(start(source)).rejects.toThrow(`${problem}. See the logs in ${join(dataDirectory, "logs")}.`);
  });

  it("is ended when it takes too long", async () => {
    const identifier = join(dataDirectory, "identifier");
    const source = `import { writeFileSync } from "node:fs";
      writeFileSync(${JSON.stringify(identifier)}, String(process.pid));
      setInterval(() => {}, 1000);`;

    await expect(start(source, 1000)).rejects.toThrow("was not ready in time");

    const running = Number(readFileSync(identifier, "utf8"));
    // Signal 0 only asks whether the process exists.
    await vi.waitFor(() => {
      expect(() => process.kill(running, 0)).toThrow("ESRCH");
    });
  });

  it("fails when it cannot be run at all", async () => {
    const launch = { runtime: join(dataDirectory, "missing"), program: "", readyTimeoutMilliseconds: 5000 };

    await expect(startServer(options(true), recordingTerminal(), launch)).rejects.toThrow("ENOENT");
  });
});
