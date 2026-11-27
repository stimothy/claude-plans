/**
 * Allows only one server for each data directory.
 *
 * @packageDocumentation
 */
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

// SQLite's code for a database that another connection has locked.
const busy = 5;

// Long enough to get past another program that is only trying for the lock at the same moment.
const waitMilliseconds = 250;

function isBusy(error: unknown): boolean {
  return error instanceof Error && "errcode" in error && error.errcode === busy;
}

/**
 * Locks an existing data directory for one server, and returns how to release it. The lock is an unfinished
 * transaction on a database of its own. The operating system releases it when a program ends, however it ends,
 * so a crash never leaves the directory locked.
 */
export function lockDataDirectory(dataDirectory: string): () => void {
  const lock = new DatabaseSync(join(dataDirectory, "server-lock.sqlite"), { timeout: waitMilliseconds });
  try {
    lock.exec("BEGIN EXCLUSIVE");
  } catch (error) {
    lock.close();
    throw isBusy(error) ? new Error("A server is already running on this data directory.", { cause: error }) : error;
  }
  return () => {
    lock.close();
  };
}
