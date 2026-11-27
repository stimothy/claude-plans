/**
 * What the database tests share: a directory for each test, migrations to run, and a way to read the results.
 *
 * @packageDocumentation
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { afterEach, beforeEach } from "vitest";

import type { Migration } from "./migration.ts";
import { databaseFile } from "./schema-version.ts";

/** Makes a new temporary directory for each test, removes it afterward, and returns how to get its path. */
export function useTestDirectory(): () => string {
  let directory = "";
  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "claude-plans-database-"));
  });
  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });
  return () => directory;
}

/** Makes a migration that runs the given function. */
export function step(version: number, apply: Migration["apply"]): Migration {
  return { version, name: `step ${String(version)}`, apply };
}

/** Makes a migration that runs SQL. */
export function statements(version: number, sql: string): Migration {
  return step(version, (database) => {
    database.exec(sql);
  });
}

/** Returns the rows that a query finds in the database in a data directory. */
export function queryRows(dataDirectory: string, sql: string): unknown[] {
  const database = new DatabaseSync(databaseFile(dataDirectory), { readOnly: true });
  // Rows have no prototype, which would make comparisons hard to read.
  const rows = database
    .prepare(sql)
    .all()
    .map((row) => ({ ...row }));
  database.close();
  return rows;
}
