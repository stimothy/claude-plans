import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { migrate } from "./migrate.ts";
import type { Migration } from "./migration.ts";
import { databaseFile, readSchemaVersion } from "./schema-version.ts";
import { useTestDirectory } from "./test-directory.ts";

const testDirectory = useTestDirectory();
// The data directory does not exist until something creates it.
let directory = "";

beforeEach(() => {
  directory = join(testDirectory(), "data");
});

afterEach(() => {
  vi.useRealTimers();
});

function query(sql: string): unknown[] {
  const database = new DatabaseSync(databaseFile(directory), { readOnly: true });
  // Rows have no prototype, which would make comparisons hard to read.
  const rows = database
    .prepare(sql)
    .all()
    .map((row) => ({ ...row }));
  database.close();
  return rows;
}

const tables = (): unknown[] => query("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name");

function migration(version: number, sql: string): Migration {
  const apply: Migration["apply"] = (database) => {
    database.exec(sql);
  };
  return { version, name: `step ${String(version)}`, apply };
}

const createNotes = migration(1, "CREATE TABLE notes (text TEXT); INSERT INTO notes VALUES ('first')");
const changeNotes = migration(2, "UPDATE notes SET text = 'second'");

it("makes a new database that has only the tracking table", () => {
  const version = migrate(directory);

  expect(version).toBe(0);
  expect(tables()).toEqual([{ name: "schema_migrations" }]);
  expect(readSchemaVersion(directory)).toBe(0);
});

it("runs the migrations in order and records each one with its UTC time", () => {
  vi.useFakeTimers({ now: new Date("2026-03-15T12:00:00.000Z") });

  const version = migrate(directory, [createNotes, changeNotes]);

  expect(version).toBe(2);
  expect(query("SELECT text FROM notes")).toEqual([{ text: "second" }]);
  expect(query("SELECT * FROM schema_migrations ORDER BY version")).toEqual([
    { version: 1, name: "step 1", applied_at: "2026-03-15T12:00:00.000Z" },
    { version: 2, name: "step 2", applied_at: "2026-03-15T12:00:00.000Z" },
  ]);
});

it("runs only the migrations that a database does not have", () => {
  migrate(directory, [createNotes]);

  // Running the first one again would fail, because its table exists.
  expect(migrate(directory, [createNotes, changeNotes])).toBe(2);
  expect(query("SELECT version FROM schema_migrations ORDER BY version")).toEqual([{ version: 1 }, { version: 2 }]);
});

it("undoes all of a failed migration, and keeps the ones before it", () => {
  const broken = migration(2, "CREATE TABLE extra (id INTEGER); DELETE FROM notes; INSERT INTO absent VALUES (1)");

  const run = (): number => migrate(directory, [createNotes, broken]);

  expect(run).toThrow(
    expect.objectContaining({
      message: "Migration 2 (step 2) failed.",
      cause: expect.objectContaining({ message: "no such table: absent" }) as unknown,
    }) as Error,
  );
  expect(readSchemaVersion(directory)).toBe(1);
  expect(tables()).toEqual([{ name: "notes" }, { name: "schema_migrations" }]);
  expect(query("SELECT text FROM notes")).toEqual([{ text: "first" }]);
});

it("does not record a migration that ends its own transaction", () => {
  const commits = migration(1, "COMMIT");

  expect(() => migrate(directory, [commits])).toThrow("Migration 1 (step 1) failed.");
  expect(readSchemaVersion(directory)).toBe(0);
});

it("changes nothing in a database that is newer than it supports", () => {
  migrate(directory, [createNotes, changeNotes]);
  const before = readFileSync(databaseFile(directory));

  expect(() => migrate(directory, [createNotes])).toThrow("The database is at version 2, and the newest known is 1.");
  expect(readFileSync(databaseFile(directory))).toEqual(before);
});

it.each([
  { problem: "starts after 1", versions: [2] },
  { problem: "has a gap", versions: [1, 3] },
  { problem: "repeats a number", versions: [1, 1] },
  { problem: "is out of order", versions: [2, 1] },
])("creates nothing when the list of migrations $problem", ({ versions }) => {
  const list = versions.map((version) => migration(version, "SELECT 1"));

  expect(() => migrate(directory, list)).toThrow("Migrations must be numbered 1, 2, 3, and so on, in order.");
  expect(existsSync(directory)).toBe(false);
});
