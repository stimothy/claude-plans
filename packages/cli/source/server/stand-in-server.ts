/**
 * What the command's tests share: a data directory for each test, and servers that stand in for the real one.
 *
 * @packageDocumentation
 */
import { once } from "node:events";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { serverContract, serverRecordFileName } from "@claude-plans/domain";
import { afterEach, beforeEach } from "vitest";

/** Returns a port that was free a moment ago, for a server that must be given one. */
export async function freePort(): Promise<number> {
  const holder = createServer().listen(0, "127.0.0.1");
  await once(holder, "listening");
  const { port } = holder.address() as AddressInfo;
  holder.close();
  await once(holder, "close");
  return port;
}

/** The token that a stand-in server's record holds. */
export const standInToken = "stand-in-token";

/** Answers one request. */
export type Handler = (request: IncomingMessage, response: ServerResponse) => void;

/** Answers with JSON. */
export function answer(response: ServerResponse, body: unknown, status = 200): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

/** Stand-in servers for one test file. */
export interface StandInServers {
  /** The current test's data directory, which exists, as the disk names it. */
  readonly directory: () => string;
  /** Writes the record of a server on this port. */
  readonly record: (port: number, token?: string) => void;
  /** Starts a server that answers every request with the handler, and returns its port. */
  readonly listen: (handler: Handler) => Promise<number>;
  /**
   * Starts a server and records it. It names the test's data directory unless another is given, and answers the
   * other requests with the handler.
   */
  readonly serve: (handler?: Handler, named?: string) => Promise<number>;
}

/** Gives each test a new temporary data directory, and stops its stand-in servers afterward. */
export function useStandInServers(): StandInServers {
  let directory = "";
  const servers: Server[] = [];
  beforeEach(() => {
    directory = join(realpathSync.native(mkdtempSync(join(tmpdir(), "claude-plans-cli-"))), "data");
    mkdirSync(directory);
  });
  afterEach(() => {
    for (const server of servers.splice(0)) {
      server.close();
      server.closeAllConnections();
    }
    rmSync(join(directory, ".."), { recursive: true, force: true });
  });
  const record = (port: number, token = standInToken): void => {
    writeFileSync(join(directory, serverRecordFileName), JSON.stringify({ port, token }));
  };
  const listen = async (handler: Handler): Promise<number> => {
    const server = createServer(handler);
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    return (server.address() as AddressInfo).port;
  };
  const serve = async (handler?: Handler, named?: string): Promise<number> => {
    const port = await listen((request, response) => {
      if (request.url === serverContract.path) {
        answer(response, { dataDirectory: named ?? directory });
      } else {
        handler?.(request, response);
      }
    });
    record(port);
    return port;
  };
  return { directory: () => directory, record, listen, serve };
}
