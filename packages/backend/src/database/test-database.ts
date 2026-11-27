/**
 * What the database tests share: a directory for each test, migrations to run, and a way to read the results.
 *
 * @packageDocumentation
 */
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { afterEach, beforeEach } from "vitest";

import { migrate } from "./migrate.ts";
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

/**
 * Makes a database at version 1, and copies it in the middle of a write, which leaves what a program that was
 * killed would leave. Returns the data directory of the copy.
 */
export function interruptedDatabase(dataDirectory: string): string {
  const crashed = join(dataDirectory, "crashed");
  mkdirSync(crashed);
  migrate(dataDirectory, [statements(1, "CREATE TABLE notes (text TEXT)")]);
  const writer = new DatabaseSync(databaseFile(dataDirectory));
  // A small cache makes SQLite write to the database before the transaction ends.
  writer.exec("PRAGMA cache_size = 1; BEGIN IMMEDIATE");
  const insert = writer.prepare("INSERT INTO notes VALUES (?)");
  for (let row = 0; row < 100; row += 1) {
    insert.run("lost".repeat(500));
  }
  copyFileSync(databaseFile(dataDirectory), databaseFile(crashed));
  copyFileSync(`${databaseFile(dataDirectory)}-journal`, `${databaseFile(crashed)}-journal`);
  writer.close();
  return crashed;
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
