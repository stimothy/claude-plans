/**
 * Finds the database and reads which schema version it has.
 *
 * @packageDocumentation
 */
import { statSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { z } from "zod";

const countSchema = z.object({ count: z.int() });
const versionSchema = z.object({ version: z.int().nonnegative() });

/** How long to wait while another program is using the database. */
export const busyTimeoutMilliseconds = 5000;

/** Returns the path of the database in a data directory. */
export function databaseFile(dataDirectory: string): string {
  return join(dataDirectory, "database.sqlite");
}

/**
 * Returns the number of the last migration that an open database recorded, which is 0 before the first. Returns
 * nothing if the database does not have the table that tracks them.
 */
export function versionOf(database: DatabaseSync): number | undefined {
  const tracking = database
    .prepare("SELECT count(*) AS count FROM sqlite_schema WHERE type = 'table' AND name = 'schema_migrations'")
    .get();
  if (countSchema.parse(tracking).count === 0) {
    return undefined;
  }
  const row = database.prepare("SELECT coalesce(max(version), 0) AS version FROM schema_migrations").get();
  return versionSchema.parse(row).version;
}

/**
 * Returns the schema version of the database in a data directory, or nothing if no database has been set up
 * there. It never creates or changes one. A database that cannot be read is an error. That includes one whose
 * last write was interrupted, until something opens it for writing, as migrating does.
 */
export function readSchemaVersion(dataDirectory: string): number | undefined {
  const file = databaseFile(dataDirectory);
  // Unlike a check that the file exists, this fails when the file cannot be looked at.
  if (statSync(file, { throwIfNoEntry: false }) === undefined) {
    return undefined;
  }
  const database = new DatabaseSync(file, { readOnly: true, timeout: busyTimeoutMilliseconds });
  try {
    return versionOf(database);
  } finally {
    database.close();
  }
}
