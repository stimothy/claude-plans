/**
 * The stop command, which asks the server for a data directory to shut down.
 *
 * @packageDocumentation
 */
import { join } from "node:path";
import { setTimeout as pause } from "node:timers/promises";

import { shutdownContract } from "@claude-plans/domain";

import { askServer, findServer, type FoundServer, readServerRecord } from "../server/running-server.ts";
import type { Terminal } from "../terminal.ts";

const stopTimeoutMilliseconds = 10_000;
const checkEveryMilliseconds = 50;
const accepted = 202;

// A server removes its record when it has stopped. Another server may then have written its own.
async function untilStopped(server: FoundServer, timeout: number): Promise<void> {
  const deadline = Date.now() + timeout;
  while (readServerRecord(server.dataDirectory)?.token === server.token) {
    if (Date.now() > deadline) {
      const logs = join(server.dataDirectory, "logs");
      throw new Error(`The server on port ${String(server.port)} did not finish stopping. See the logs in ${logs}.`);
    }
    await pause(checkEveryMilliseconds);
  }
}

/** Stops the server for a data directory, and returns the exit code. It succeeds when no server is running. */
export async function stopServer(
  dataDirectory: string,
  terminal: Terminal,
  timeout = stopTimeoutMilliseconds,
): Promise<number> {
  const server = await findServer(dataDirectory);
  if (server === undefined) {
    terminal.print(`No server is running on ${dataDirectory}.`);
    return 0;
  }
  const { method } = shutdownContract.shutDown;
  const headers = { authorization: `Bearer ${server.token}` };
  const response = await askServer(server.port, shutdownContract.path, { method, headers });
  if (response.status !== accepted) {
    throw new Error(`The server refused to stop, with status ${String(response.status)}.`);
  }
  await untilStopped(server, timeout);
  terminal.print("The server stopped.");
  return 0;
}
