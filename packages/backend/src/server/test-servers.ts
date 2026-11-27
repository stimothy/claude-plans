/**
 * What the server tests share: a data directory for each test, servers that are stopped after it, and requests.
 *
 * @packageDocumentation
 */
import { mkdtempSync, rmSync } from "node:fs";
import { request } from "node:http";
import { type AddressInfo, createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { shutdownContract } from "@claude-plans/domain";
import { afterEach, beforeEach, type Mock, vi } from "vitest";

import { type RunningServer, startServer } from "./server.ts";

/** Returns a port that was free a moment ago, for a server that must be given one. */
export async function freePort(): Promise<number> {
  const holder = createServer();
  await new Promise<void>((resolve, reject) => {
    holder.once("error", reject);
    holder.listen(0, "127.0.0.1", resolve);
  });
  const { port } = holder.address() as AddressInfo;
  await new Promise((resolve) => holder.close(resolve));
  return port;
}

/** What a server answered. */
export interface Answer {
  readonly status: number | undefined;
  readonly body: unknown;
}

/** Sends a request on a connection of its own. Unlike fetch, this can send any Host header. */
function send(port: number, method: string, path: string, headers: Record<string, string> = {}): Promise<Answer> {
  return new Promise((resolve, reject) => {
    // A connection of its own never reuses one to a server that has stopped.
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

/** Servers for one test file. */
export interface TestServers {
  /** The data directory of the current test, which a server creates. */
  readonly directory: () => string;
  /** A logger that records what is written to it. */
  readonly log: Readonly<Record<"error" | "warn" | "info" | "debug", Mock>>;
  /** Starts a server on the data directory, on any free port unless one is given. */
  readonly start: (port?: number, dataDirectory?: string) => Promise<RunningServer>;
  /** Leaves a server out of the cleanup, because it could not stop cleanly. */
  readonly forget: (server: RunningServer) => void;
  readonly send: typeof send;
  readonly shutDown: (port: number, headers: Record<string, string>) => Promise<Answer>;
}

/** Gives each test a new temporary data directory, and stops its servers afterward. */
export function useTestServers(): TestServers {
  let temporary = "";
  const running = new Set<RunningServer>();
  const log = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() };
  const directory = (): string => join(temporary, "data");
  beforeEach(() => {
    temporary = mkdtempSync(join(tmpdir(), "claude-plans-server-"));
    vi.resetAllMocks();
  });
  afterEach(async () => {
    await Promise.all([...running].map((server) => server.close()));
    running.clear();
    rmSync(temporary, { recursive: true, force: true });
  });
  return {
    directory,
    log,
    start: async (port = 0, dataDirectory = directory()) => {
      const server = await startServer({ dataDirectory, version: "1.2.3", port, log });
      running.add(server);
      return server;
    },
    forget: (server) => running.delete(server),
    send,
    shutDown: (port, headers) => send(port, shutdownContract.shutDown.method, shutdownContract.path, headers),
  };
}
