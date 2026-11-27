import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { describe, expect, it } from "vitest";

import { databaseFile, readSchemaVersion } from "./schema-version.ts";
import { useTestDirectory } from "./test-database.ts";

const directory = useTestDirectory();

function createDatabase(sql: string): void {
  const database = new DatabaseSync(databaseFile(directory()));
  database.exec(sql);
  database.close();
}

describe("databaseFile", () => {
  it("is database.sqlite in the data directory", () => {
    expect(databaseFile(directory())).toBe(join(directory(), "database.sqlite"));
  });
});

describe("readSchemaVersion", () => {
  it("finds no version where there is no database, and creates nothing", () => {
    const missing = join(directory(), "missing");

    const version = readSchemaVersion(missing);

    expect(version).toBeUndefined();
    expect(existsSync(missing)).toBe(false);
  });

  it("finds no version in a database without the tracking table, and leaves it as it was", () => {
    createDatabase("CREATE TABLE other (id INTEGER)");
    const before = readFileSync(databaseFile(directory()));

    const version = readSchemaVersion(directory());

    expect(version).toBeUndefined();
    expect(readFileSync(databaseFile(directory()))).toEqual(before);
  });

  it.each([
    { rows: "", expected: 0 },
    { rows: "INSERT INTO schema_migrations VALUES (2), (1)", expected: 2 },
  ])("reads version $expected from the tracking table", ({ rows, expected }) => {
    createDatabase(`CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY); ${rows}`);

    expect(readSchemaVersion(directory())).toBe(expected);
  });

  it("fails when it cannot look for the database, rather than finding none", () => {
    // No system accepts a path with this character, and a check that a file exists would only answer no.
    expect(() => readSchemaVersion(join(directory(), "\0"))).toThrow("null bytes");
  });

  it("fails for a file that is not a database", () => {
    writeFileSync(databaseFile(directory()), "not a database".repeat(100));

    expect(() => readSchemaVersion(directory())).toThrow("file is not a database");
  });
});
