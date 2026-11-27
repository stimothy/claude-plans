// What must stay safe when a migration is interrupted, rebuilds a table, or shares the database.
import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { expect, it, vi } from "vitest";

import { migrate } from "./migrate.ts";
import type { Migration } from "./migration.ts";
import { databaseFile, readSchemaVersion } from "./schema-version.ts";
import { queryRows, statements, step, useTestDirectory } from "./test-database.ts";

const directory = useTestDirectory();

const record = (version: number): string => `INSERT INTO schema_migrations VALUES (${String(version)}, 'other', '')`;

const createFamily = statements(
  1,
  `CREATE TABLE parents (id INTEGER PRIMARY KEY);
   CREATE TABLE children (parent INTEGER REFERENCES parents (id) ON DELETE CASCADE);
   INSERT INTO parents VALUES (1);
   INSERT INTO children VALUES (1)`,
);

const count = (table: string): number => queryRows(directory(), `SELECT * FROM ${table}`).length;

// Copies a database in the middle of a write, which leaves what a program that was killed would leave.
function interruptedDatabase(): string {
  const crashed = join(directory(), "crashed");
  mkdirSync(crashed);
  migrate(directory(), [statements(1, "CREATE TABLE notes (text TEXT)")]);
  const writer = new DatabaseSync(databaseFile(directory()));
  // A small cache makes SQLite write to the database before the transaction ends.
  writer.exec("PRAGMA cache_size = 1; BEGIN IMMEDIATE");
  const insert = writer.prepare("INSERT INTO notes VALUES (?)");
  for (let row = 0; row < 100; row += 1) {
    insert.run("lost".repeat(500));
  }
  copyFileSync(databaseFile(directory()), databaseFile(crashed));
  copyFileSync(`${databaseFile(directory())}-journal`, `${databaseFile(crashed)}-journal`);
  writer.close();
  return crashed;
}

it("recovers a database whose last write was interrupted, which only reading cannot", () => {
  const crashed = interruptedDatabase();

  expect(() => readSchemaVersion(crashed)).toThrow("attempt to write a readonly database");
  expect(migrate(crashed, [statements(1, "SELECT 1")])).toBe(1);
  expect(readSchemaVersion(crashed)).toBe(1);
});

it("keeps the rows that refer to a table which a migration rebuilds", () => {
  const rebuild = statements(
    2,
    `CREATE TABLE rebuilt (id INTEGER PRIMARY KEY);
     INSERT INTO rebuilt SELECT id FROM parents;
     DROP TABLE parents;
     ALTER TABLE rebuilt RENAME TO parents`,
  );

  migrate(directory(), [createFamily, rebuild]);

  expect(count("children")).toBe(1);
});

it("undoes a migration that leaves a row referring to nothing", () => {
  const orphan = statements(2, "DELETE FROM parents");

  expect(() => migrate(directory(), [createFamily, orphan])).toThrow("Migration 2 (step 2) failed.");
  expect(count("parents")).toBe(1);
  expect(readSchemaVersion(directory())).toBe(1);
});

it("keeps other programs from writing while a migration runs", () => {
  const checkLock = step(1, () => {
    const other = new DatabaseSync(databaseFile(directory()), { timeout: 0 });
    expect(() => {
      other.exec("BEGIN IMMEDIATE");
    }).toThrow("database is locked");
    other.close();
  });

  expect(migrate(directory(), [checkLock])).toBe(1);
});

it("skips a migration that another program ran in the meantime", () => {
  const apply = vi.fn<Migration["apply"]>();

  migrate(directory(), [statements(1, record(2)), step(2, apply)]);

  expect(apply).not.toHaveBeenCalled();
});

it("stops when another program makes the database newer in the meantime", () => {
  const list = [statements(1, record(3)), statements(2, "SELECT 1")];

  expect(() => migrate(directory(), list)).toThrow("Migration 2 (step 2) failed.");
});

it("refuses a newer database even when it has no migrations to run", () => {
  migrate(directory(), [statements(1, "SELECT 1")]);

  expect(() => migrate(directory(), [])).toThrow("The database is at version 1, and the newest known is 0.");
});
