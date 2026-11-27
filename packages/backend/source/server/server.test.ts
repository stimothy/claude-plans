import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { request } from "node:http";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { healthContract, serverContract, serverRecordSchema, shutdownContract } from "@claude-plans/domain";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { migrate } from "../database/migrate.ts";
import { type RunningServer, startServer } from "./server.ts";

let temporary = "";
let directory = "";
let running: RunningServer[] = [];
const log = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() };

beforeEach(() => {
  temporary = mkdtempSync(join(tmpdir(), "claude-plans-server-"));
  directory = join(temporary, "data");
  vi.resetAllMocks();
});

afterEach(async () => {
  await Promise.all(running.map((server) => server.close()));
  running = [];
  rmSync(temporary, { recursive: true, force: true });
});

// Port 0 asks the system for a free port.
async function start(port = 0): Promise<RunningServer> {
  const server = await startServer({ dataDirectory: directory, version: "1.2.3", port, log });
  running.push(server);
  return server;
}

const recordFile = (): string => join(directory, "server.json");
const record = (): { port: number; token: string } =>
  serverRecordSchema.parse(JSON.parse(readFileSync(recordFile(), "utf8")));

interface Answer {
  readonly status: number | undefined;
  readonly body: unknown;
}

// Unlike fetch, this can send any Host header.
function send(port: number, method: string, path: string, headers: Record<string, string> = {}): Promise<Answer> {
  return new Promise((resolve, reject) => {
    // Each request has its own connection, so that none reuses one to a server that has stopped.
    const sent = request({ host: "127.0.0.1", port, method, path, headers, agent: false }, (response) => {
      let text = "";
      response.on("data", (chunk) => (text += String(chunk)));
      response.on("end", () => {
        resolve({ status: response.statusCode, body: JSON.parse(text) as unknown });
      });
    });
    sent.on("error", reject);
    sent.end();
  });
}

const shutDown = (port: number, headers: Record<string, string>): Promise<Answer> =>
  send(port, shutdownContract.request.method, shutdownContract.path, headers);

it("reports its health, the application's version, and the database", async () => {
  migrate(directory);
  const { port } = await start();

  const answer = await send(port, "GET", healthContract.path);

  const database = { accessible: true, migrationVersion: 0 };
  expect(answer).toEqual({ status: 200, body: { status: "ok", version: "1.2.3", database } });
});

it("does not set up a database that is missing", async () => {
  const { port } = await start();

  const answer = await send(port, "GET", healthContract.path);

  expect(answer.body).toMatchObject({ status: "error", database: { accessible: false } });
  expect(existsSync(join(directory, "database.sqlite"))).toBe(false);
});

it("says which data directory it uses", async () => {
  const { port } = await start();

  const answer = await send(port, "GET", serverContract.path);

  expect(answer.body).toEqual({ dataDirectory: realpathSync(directory) });
});

it.each([
  { header: "host", value: "example.com" },
  { header: "origin", value: "http://example.com" },
])("refuses every request with a foreign $header", async ({ header, value }) => {
  const { port } = await start();

  const answers = await Promise.all([
    send(port, "GET", healthContract.path, { [header]: value }),
    send(port, "GET", "/api/missing", { [header]: value }),
    shutDown(port, { [header]: value, authorization: `Bearer ${record().token}` }),
  ]);

  expect(answers.map((answer) => answer.status)).toEqual([403, 403, 403]);
  expect((await send(port, "GET", healthContract.path)).status).toBe(200);
});

it("listens only on the local computer's own address", async () => {
  const server = await start();

  expect(server.address).toBe("127.0.0.1");
});

it("records its port and a new token, which only the owner can read", async () => {
  const first = await start();
  const { port, token } = record();
  const mode = statSync(recordFile()).mode & 0o777;
  await first.close();
  await start();

  expect(port).toBe(first.port);
  expect(token).toMatch(/^[0-9a-f]{64}$/);
  expect(record().token).not.toBe(token);
  // Windows does not have these permissions.
  expect(mode).toBe(process.platform === "win32" ? 0o666 : 0o600);
});

it.each([{}, { authorization: "Bearer wrong" }, { authorization: `Bearer ${"0".repeat(64)}` }])(
  "does not shut down for %j",
  async (headers) => {
    const { port } = await start();

    const answer = await shutDown(port, headers);

    expect(answer.status).toBe(401);
    expect((await send(port, "GET", healthContract.path)).status).toBe(200);
  },
);

it("shuts down for the recorded token, and removes its record", async () => {
  const server = await start();

  const answer = await shutDown(server.port, { authorization: `Bearer ${record().token}` });
  await server.closed;

  expect(answer.status).toBe(202);
  expect(existsSync(recordFile())).toBe(false);
  await expect(send(server.port, "GET", healthContract.path)).rejects.toThrow("ECONNREFUSED");
  await expect(start()).resolves.toBeDefined();
});

it("refuses a second server on the same data directory, and keeps the first one's record", async () => {
  await start();
  const before = record();

  await expect(start()).rejects.toThrow("A server is already running on this data directory.");

  expect(record()).toEqual(before);
});

it("reports a port that is taken, and leaves nothing behind", async () => {
  const other = createServer();
  const port = await new Promise<number>((resolve) => {
    other.listen(0, "127.0.0.1", () => {
      resolve((other.address() as { port: number }).port);
    });
  });

  await expect(start(port)).rejects.toThrow(`Port ${String(port)} is already in use.`);
  other.close();

  expect(existsSync(recordFile())).toBe(false);
  expect(log.error).toHaveBeenCalledWith("The server did not start", expect.any(Error));
  await expect(start()).resolves.toBeDefined();
});

it("replaces the record that a crashed server left", async () => {
  const earlier = await start();
  await earlier.close();
  writeFileSync(recordFile(), "left over");

  const { port } = await start();

  expect(record().port).toBe(port);
});

it("logs that it started and stopped, without its token", async () => {
  const server = await start();
  const { token } = record();

  await server.close();
  await server.close();

  expect(log.info.mock.calls).toEqual([
    [`The server is listening on port ${String(server.port)}`],
    ["The server stopped"],
  ]);
  expect(JSON.stringify(Object.values(log).map((write) => write.mock.calls))).not.toContain(token);
});
