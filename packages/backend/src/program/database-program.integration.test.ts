import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { migrate } from "../database/migrate.ts";
import { databaseFile, readSchemaVersion } from "../database/schema-version.ts";
import { statements, useTestDirectory } from "../database/test-database.ts";
import { lockDataDirectory } from "../instance-lock/instance-lock.ts";
import { runDatabaseProgram } from "./database-program.ts";

const directory = useTestDirectory();
const oneStep = [statements(1, "CREATE TABLE a (id INTEGER)")];

// Runs the program, and gives its exit code and what it said was wrong.
function run(given: string[], migrations = oneStep) {
  const errors: string[] = [];
  const code = runDatabaseProgram({ arguments: given, printError: (line) => errors.push(line), migrations });
  return { code, errors: errors.join("\n") };
}

const action = (name: string, dataDirectory = directory()): string[] => [name, "--data-directory", dataDirectory];

describe("the database program's check", () => {
  it("accepts a directory without a database, and creates nothing", () => {
    const missing = join(directory(), "missing");

    expect(run(action("check", missing))).toEqual({ code: 0, errors: "" });
    expect(existsSync(missing)).toBe(false);
  });

  it("refuses a newer database", () => {
    migrate(directory(), oneStep);

    const checked = run(action("check"), []);

    expect(checked.code).toBe(1);
    expect(checked.errors).toContain("The database is at version 1, which is newer than version 0");
  });

  // Only migrating, which opens the database for writing, can tell whether it can be repaired.
  it("leaves a database that it cannot read for migrating to judge", () => {
    writeFileSync(databaseFile(directory()), "not a database".repeat(100));

    expect(run(action("check"))).toEqual({ code: 0, errors: "" });
  });
});

describe("the database program's migration", () => {
  it("creates the data directory and brings the database up to date", () => {
    const missing = join(directory(), "missing");

    expect(run(action("migrate", missing))).toEqual({ code: 0, errors: "" });
    expect(readSchemaVersion(missing)).toBe(1);
  });

  it("changes nothing while a server holds the data directory", () => {
    const release = lockDataDirectory(directory());

    const migrated = run(action("migrate"));
    release();

    expect(migrated.code).toBe(1);
    expect(migrated.errors).toContain("A server is already running");
    expect(existsSync(databaseFile(directory()))).toBe(false);
  });

  it("releases the data directory when it is done, even after a failure", () => {
    run(action("migrate"), [statements(1, "not SQL")]);

    expect(() => {
      lockDataDirectory(directory())();
    }).not.toThrow();
  });

  it("says why a migration failed", () => {
    const migrated = run(action("migrate"), [statements(1, "not SQL")]);

    expect(migrated.code).toBe(1);
    expect(migrated.errors).toMatch(/Migration 1 \(step 1\) failed\.[^]*syntax error/);
  });
});

describe("the database program's arguments", () => {
  it.each([
    { given: [], problem: "check or migrate" },
    { given: ["drop"], problem: "check or migrate" },
    { given: ["check", "migrate"], problem: "check or migrate" },
  ])("refuses $given", ({ given, problem }) => {
    mkdirSync(directory(), { recursive: true });

    const result = run([...given, "--data-directory", directory()]);

    expect(result.code).toBe(1);
    expect(result.errors).toContain(problem);
  });

  // A relative path would be taken from the current directory, which could be the one with the real data.
  it.each(["", ".claude-plans"])("refuses the data directory %j, which is not a full path", (dataDirectory) => {
    const result = run(action("migrate", dataDirectory));

    expect(result.errors).toContain("full path");
  });
});
