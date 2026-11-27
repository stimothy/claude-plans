import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { ServerStartReport } from "@claude-plans/domain";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { migrate } from "../database/migrate.ts";
import { freePort, useTestServers } from "../server/test-servers.ts";
import { runServerProgram } from "./server-program.ts";

const servers = useTestServers();
let port = 0;

beforeEach(async () => {
  port = await freePort();
  migrate(servers.directory());
});

function writeSettings(text: string): void {
  mkdirSync(servers.directory(), { recursive: true });
  writeFileSync(join(servers.directory(), "settings.yaml"), text);
}

function logged(): string {
  const logs = join(servers.directory(), "logs");
  return readdirSync(logs)
    .map((name) => readFileSync(join(logs, name), "utf8"))
    .join("");
}

// Runs the program, and gives what it reported, its exit code, and the way to ask it to stop.
function run(options: string[], dataDirectory = servers.directory()) {
  const { promise: reported, resolve } = Promise.withResolvers<ServerStartReport>();
  const onStopRequest = vi.fn<(stop: () => void) => void>();
  const exited = runServerProgram({
    arguments: ["--data-directory", dataDirectory, ...options],
    version: "1.2.3",
    report: resolve,
    onStopRequest,
  });
  const stop = (): void => {
    onStopRequest.mock.calls[0]?.[0]();
  };
  return { reported, exited, stop };
}

// Waits for a program to listen on the test's port, then stops it.
async function expectToListen(program: ReturnType<typeof run>): Promise<void> {
  await expect(program.reported).resolves.toEqual({ state: "listening", port });
  program.stop();
  await program.exited;
}

// Waits for a program that must refuse to start, and checks what it says is wrong.
async function expectRefusal(program: ReturnType<typeof run>, problem: string): Promise<void> {
  const message = expect.stringContaining(problem) as string;
  await expect(program.reported).resolves.toEqual({ state: "failed", message });
  await expect(program.exited).resolves.toBe(1);
}

describe("the server program", () => {
  it("serves on the given port until it is asked to stop", async () => {
    const program = run(["--port", String(port)]);

    await expect(program.reported).resolves.toEqual({ state: "listening", port });
    await expect(servers.send(port, "GET", "/api/health")).resolves.toMatchObject({ body: { version: "1.2.3" } });
    program.stop();

    await expect(program.exited).resolves.toBe(0);
    expect(logged()).toContain("The server stopped");
  });

  it("takes the port and the log level from the settings file", async () => {
    writeSettings(`port: ${String(port)}\nlogLevel: error\n`);

    await expectToListen(run([]));

    expect(() => logged()).toThrow("ENOENT");
  });

  it("lets its options override the settings file", async () => {
    writeSettings("port: 1\nlogLevel: error\n");

    await expectToListen(run(["--port", String(port), "--log-level", "info"]));

    expect(logged()).toContain("The server is listening");
  });

  it("reports and logs settings that are not valid", async () => {
    writeSettings("prot: 1\n");

    const program = run(["--port", String(port)]);

    await expectRefusal(program, "is not valid");
    expect(logged()).toContain("The server did not start");
  });

  it("reports a server that cannot start", async () => {
    const first = run(["--port", String(port)]);
    await first.reported;

    const second = run(["--port", String(port)]);

    await expectRefusal(second, "already running");
    first.stop();
    await first.exited;
  });

  it("refuses a data directory whose database is not ready, and lets go of it", async () => {
    rmSync(join(servers.directory(), "database.sqlite"));

    await expectRefusal(run(["--port", String(port)]), "Run claude-plans install");
    expect(logged()).toContain("The server did not start");
    migrate(servers.directory());
    await expectToListen(run(["--port", String(port)]));
  });

  it("ends with a failure, and says why in the log, when it cannot stop cleanly", async () => {
    const program = run(["--port", String(port)]);
    await program.reported;
    rmSync(join(servers.directory(), "server.json"));
    mkdirSync(join(servers.directory(), "server.json"));

    program.stop();

    await expect(program.exited).resolves.toBe(1);
    expect(logged().match(/The server did not stop cleanly/g)).toHaveLength(1);
  });

  it.each([
    [["--port", "0"], "--port"],
    [["--port", "nine"], "--port"],
    [["--port", "4e3"], "--port"],
    [["--port", "0x10e7"], "--port"],
    [["--port", " 4311"], "--port"],
    [["--log-level", "loud"], "--log-level"],
    [["--prot", "4311"], "--prot"],
  ])("refuses the options %j", async (options, named) => {
    await expectRefusal(run(options), named);
  });

  // A relative path would be taken from the current directory, which could be the one with the real data.
  it.each(["", ".claude-plans"])("refuses the data directory %j, which is not a full path", async (dataDirectory) => {
    await expectRefusal(run([], dataDirectory), "full path");
  });
});
