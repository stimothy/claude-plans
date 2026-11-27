// These tests run the real server program, each on its own temporary data directory and a free port.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
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
});

describe("a server program that stands in for the real one", () => {
  // Long enough for a busy machine to start the program.
  const startTime = 3000;
  const identifier = (): string => join(dataDirectory, "identifier");
  const signalled = (): string => join(dataDirectory, "signalled");
  const ready = "process.send({ state: 'listening', port: 1 });";
  const stay = "setInterval(() => {}, 1000);";

  // Starts a program that first records its process, and then does what the body says.
  async function start(
    body: string,
    { readyTimeoutMilliseconds = 5000, detached = true, terminal = recordingTerminal() } = {},
  ): Promise<number> {
    const program = join(dataDirectory, "program.mjs");
    const source = `import { writeFileSync } from "node:fs";
      process.on("SIGTERM", () => { writeFileSync(${JSON.stringify(signalled())}, ""); process.exit(); });
      writeFileSync(${JSON.stringify(identifier())}, String(process.pid));
      ${body}`;
    writeFileSync(program, source);
    const launch = { runtime: process.execPath, program, readyTimeoutMilliseconds };
    return startServer(options(detached), terminal, launch);
  }

  const running = (): number => Number(readFileSync(identifier(), "utf8"));
  // Signal 0 only asks whether the process exists.
  const expectRunning = (): void => {
    expect(process.kill(running(), 0)).toBe(true);
  };
  async function expectEnded(): Promise<void> {
    await vi.waitFor(() => {
      expect(() => process.kill(running(), 0)).toThrow("ESRCH");
    });
  }

  it.each([
    ["ends first", "process.exitCode = 1;", "stopped before it was ready"],
    ["sends something else", `process.send({ state: 'ready' }); ${stay}`, "not understood"],
  ])("fails when it %s, says where the logs are, and leaves nothing running", async (_, body, problem) => {
    await expect(start(body)).rejects.toThrow(`${problem}. See the logs in ${join(dataDirectory, "logs")}.`);

    await expectEnded();
  });

  it("is ended when it takes too long", async () => {
    await expect(start(stay, { readyTimeoutMilliseconds: startTime })).rejects.toThrow("was not ready in time");

    await expectEnded();
  });

  it("is left running once it is ready, even after the time that it was given", async () => {
    await expect(start(`${ready} ${stay}`, { readyTimeoutMilliseconds: startTime })).resolves.toBe(0);

    await new Promise((resolve) => setTimeout(resolve, startTime + 200));

    expectRunning();
    process.kill(running());
  });

  // A server in the background has a process group of its own, so Ctrl+C does not reach it.
  it("is ended when the command is interrupted before it is ready", async () => {
    const terminal = recordingTerminal(false);
    const started = expect(start(stay, { terminal })).rejects.toThrow("stopped before it was ready");
    await vi.waitFor(() => {
      expect(running()).toBeGreaterThan(0);
    }, startTime);

    terminal.signal("SIGTERM");

    await started;
    await expectEnded();
  });

  it("is not sent a signal that the terminal also gives it", async () => {
    const terminal = recordingTerminal(false);
    const exited = start(`${ready} ${stay}`, { detached: false, terminal });
    await vi.waitFor(() => {
      expect(terminal.output).toHaveLength(1);
    }, startTime);

    terminal.signal("SIGTERM");
    // Long enough for a signal that was wrongly sent to take effect.
    await new Promise((resolve) => setTimeout(resolve, 200));

    expectRunning();
    expect(existsSync(signalled())).toBe(false);
    process.kill(running(), "SIGKILL");
    await exited;
  });

  it("fails when it cannot be run at all", async () => {
    const launch = { runtime: join(dataDirectory, "missing"), program: "", readyTimeoutMilliseconds: 5000 };

    await expect(startServer(options(true), recordingTerminal(), launch)).rejects.toThrow("ENOENT");
  });
});
