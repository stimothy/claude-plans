/**
 * Records in the data directory how to reach the running server.
 *
 * @packageDocumentation
 */
import { renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { type ServerRecord, serverRecordFileName } from "@claude-plans/domain";

function location(dataDirectory: string): string {
  return join(dataDirectory, serverRecordFileName);
}

/** Removes the record, if there is one. */
export function removeServerRecord(dataDirectory: string): void {
  rmSync(location(dataDirectory), { force: true });
}

/**
 * Writes the record so that only its owner can read it, because its token allows a shutdown. On Windows, the
 * directory's own permissions apply instead.
 */
export function writeServerRecord(dataDirectory: string, record: ServerRecord): void {
  const unfinished = `${location(dataDirectory)}.new`;
  // A file that already exists would keep its permissions, so it is removed first.
  rmSync(unfinished, { force: true });
  writeFileSync(unfinished, `${JSON.stringify(record)}\n`, { mode: 0o600, flag: "wx" });
  // A client never finds half of a record.
  renameSync(unfinished, location(dataDirectory));
}
