import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { migrate } from "./migrate.ts";
import { databaseFile, readSchemaVersion } from "./schema-version.ts";
import { queryRows, statements, useTestDirectory } from "./test-database.ts";

const testDirectory = useTestDirectory();
// The data directory does not exist until something creates it.
let directory = "";

beforeEach(() => {
  directory = join(testDirectory(), "data");
});

afterEach(() => {
  vi.useRealTimers();
});

const query = (sql: string): unknown[] => queryRows(directory, sql);

const tables = (): unknown[] => query("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name");

const createNotes = statements(1, "CREATE TABLE notes (text TEXT); INSERT INTO notes VALUES ('first')");
const changeNotes = statements(2, "UPDATE notes SET text = 'second'");

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
  const broken = statements(2, "CREATE TABLE extra (id INTEGER); DELETE FROM notes; INSERT INTO absent VALUES (1)");

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
  const commits = statements(1, "COMMIT");

  expect(() => migrate(directory, [commits])).toThrow(
    expect.objectContaining({
      cause: expect.objectContaining({ message: "The migration ended its own transaction." }) as unknown,
    }) as Error,
  );
  expect(readSchemaVersion(directory)).toBe(0);
});

it("changes nothing in a database that is newer than it supports", () => {
  migrate(directory, [createNotes, changeNotes]);
  const before = readFileSync(databaseFile(directory));

  expect(() => migrate(directory, [createNotes])).toThrow(
    "The database is at version 2, which is newer than version 1",
  );
  expect(readFileSync(databaseFile(directory))).toEqual(before);
});

it.each([
  { problem: "starts after 1", versions: [2] },
  { problem: "has a gap", versions: [1, 3] },
  { problem: "repeats a number", versions: [1, 1] },
  { problem: "is out of order", versions: [2, 1] },
])("creates nothing when the list of migrations $problem", ({ versions }) => {
  const list = versions.map((version) => statements(version, "SELECT 1"));

  expect(() => migrate(directory, list)).toThrow("Migrations must be numbered 1, 2, 3, and so on, in order.");
  expect(existsSync(directory)).toBe(false);
});
