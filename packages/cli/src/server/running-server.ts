/**
 * Finds the running server for a data directory, and sends it requests.
 *
 * @packageDocumentation
 */
import { readFileSync, realpathSync } from "node:fs";
import { type IncomingMessage, request } from "node:http";
import { join } from "node:path";
import { text } from "node:stream/consumers";

import { type ServerRecord, serverContract, serverRecordFileName, serverRecordSchema } from "@claude-plans/domain";

// Longer than the 5 seconds that the server may wait for a busy database before it can answer.
const answerTimeoutMilliseconds = 10_000;
const ok = 200;

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
  const written = unlessMissing(() => readFileSync(path, "utf8"));
  if (written === undefined) {
    return undefined;
  }
  const record = serverRecordSchema.safeParse(parsed(written));
  if (!record.success) {
    // The parser's error is not kept, because it can quote the token, and errors are logged with their causes.
    throw new Error(`The server record ${path} is not valid. If no server is running, delete it.`);
  }
  return record.data;
}

// Returns what the JSON holds, or nothing if it is not JSON.
function parsed(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return undefined;
  }
}

/** What a request is, apart from where it goes. */
export interface ServerRequest {
  readonly method?: string;
  readonly headers?: Readonly<Record<string, string>>;
}

/** What a program on a port answered. The body is what its JSON holds, or nothing if it is not JSON. */
export interface ServerAnswer {
  readonly status: number | undefined;
  readonly body: unknown;
}

/**
 * Sends a request to what listens on this computer's port. It follows no redirect, so nothing is sent elsewhere.
 * Unlike fetch, it reaches every port that a server can listen on.
 */
export async function askServer(
  port: number,
  path: string,
  { method = "GET", headers = {} }: ServerRequest = {},
  timeout = answerTimeoutMilliseconds,
): Promise<ServerAnswer> {
  const signal = AbortSignal.timeout(timeout);
  try {
    const { promise, resolve, reject } = Promise.withResolvers<IncomingMessage>();
    // A connection of its own never reuses one to a server that has stopped.
    const sent = request({ host: "127.0.0.1", port, path, method, headers, signal, agent: false }, resolve);
    sent.on("error", reject);
    sent.end();
    const response = await promise;
    return { status: response.statusCode, body: parsed(await text(response)) };
  } catch (error) {
    // A server that is stuck is not the same as no server.
    if (signal.aborted) {
      throw new NoAnswerInTime(`The program on port ${String(port)} did not answer in time.`, { cause: error });
    }
    throw error;
  }
}

// A server that is stuck is not the same as no server, so this is told apart from other failures.
class NoAnswerInTime extends Error {}

// Asks what listens on the port which data directory it uses. Anything but a server's answer gives nothing.
async function namedDirectory(port: number, timeout: number): Promise<string | undefined> {
  try {
    const { status, body } = await askServer(port, serverContract.path, {}, timeout);
    return status === ok ? serverContract.read.response.safeParse(body).data?.dataDirectory : undefined;
  } catch (error) {
    if (error instanceof NoAnswerInTime) {
      throw error;
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
