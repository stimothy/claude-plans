/**
 * Finds the running server for a data directory, and sends it requests.
 *
 * @packageDocumentation
 */
import { readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";

import { type ServerRecord, serverContract, serverRecordFileName, serverRecordSchema } from "@claude-plans/domain";

const answerTimeoutMilliseconds = 5000;

/** A running server that has confirmed its data directory. */
export interface FoundServer extends ServerRecord {
  /** The data directory as the disk names it. */
  readonly dataDirectory: string;
}

// Returns what the read gives, or nothing if what it reads does not exist.
function unlessMissing<Value>(read: () => Value): Value | undefined {
  try {
    return read();
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

/** Returns what the data directory's server record holds, or nothing if there is no record. */
export function readServerRecord(dataDirectory: string): ServerRecord | undefined {
  const path = join(dataDirectory, serverRecordFileName);
  const text = unlessMissing(() => readFileSync(path, "utf8"));
  if (text === undefined) {
    return undefined;
  }
  try {
    return serverRecordSchema.parse(JSON.parse(text));
  } catch (error) {
    // The cause is left out of the message, because it can quote the record's token.
    throw new Error(`The server record ${path} is not valid. If no server is running, delete it.`, { cause: error });
  }
}

/** Sends a request to the server on this computer's port. A redirect is a failure, so nothing is sent elsewhere. */
export function askServer(
  port: number,
  path: string,
  request: RequestInit = {},
  timeout = answerTimeoutMilliseconds,
): Promise<Response> {
  const signal = AbortSignal.timeout(timeout);
  return fetch(`http://127.0.0.1:${String(port)}${path}`, { ...request, redirect: "error", signal });
}

// Asks what listens on the port which data directory it uses. Anything but a server's answer gives nothing.
async function namedDirectory(port: number, timeout: number): Promise<string | undefined> {
  try {
    const response = await askServer(port, serverContract.path, {}, timeout);
    const body: unknown = response.ok ? await response.json() : undefined;
    return serverContract.read.response.safeParse(body).data?.dataDirectory;
  } catch (error) {
    // A server that is stuck is not the same as no server.
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new Error(`The program on port ${String(port)} did not answer in time.`, { cause: error });
    }
    return undefined;
  }
}

/**
 * Returns the running server for a data directory, or nothing if there is none. A server counts only if it says
 * that it uses this directory, because a record left by a crash can name a port that another program now holds.
 */
export async function findServer(directory: string, timeout?: number): Promise<FoundServer | undefined> {
  // The server names its directory this way, however either path was typed.
  const dataDirectory = unlessMissing(() => realpathSync.native(directory));
  if (dataDirectory === undefined) {
    return undefined;
  }
  const record = readServerRecord(dataDirectory);
  if (record === undefined) {
    return undefined;
  }
  const named = await namedDirectory(record.port, timeout ?? answerTimeoutMilliseconds);
  return named === dataDirectory ? { ...record, dataDirectory } : undefined;
}
