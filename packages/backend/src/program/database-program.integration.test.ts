import { spawnSync } from "node:child_process";
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

// Runs the program, and gives its exit code, what it reported, and what it said was wrong.
async function run(given: string[], migrations = oneStep) {
  const output: string[] = [];
  const errors: string[] = [];
  const code = await runDatabaseProgram({
    arguments: given,
    print: (line) => output.push(line),
    printError: (line) => errors.push(line),
    migrations,
  });
  return { code, output: output.join("\n"), errors: errors.join("\n") };
}

const action = (name: string, dataDirectory = directory()): string[] => [name, "--data-directory", dataDirectory];

describe("the database program's check", () => {
  it("accepts a directory without a database, and creates nothing", async () => {
    const missing = join(directory(), "missing");

    await expect(run(action("check", missing))).resolves.toMatchObject({ code: 0, errors: "" });
    expect(existsSync(missing)).toBe(false);
  });

  it("refuses a newer database", async () => {
    migrate(directory(), oneStep);

    const checked = await run(action("check"), []);

    expect(checked.code).toBe(1);
    expect(checked.errors).toContain("The database is at version 1, which is newer than version 0");
  });

  // Only migrating, which opens the database for writing, can tell whether it can be repaired.
  it("leaves a database that it cannot read for migrating to judge", async () => {
    writeFileSync(databaseFile(directory()), "not a database".repeat(100));

    await expect(run(action("check"))).resolves.toMatchObject({ code: 0, errors: "" });
  });
});

describe("the database program's migration", () => {
  it("creates the data directory and brings the database up to date", async () => {
    const missing = join(directory(), "missing");

    await expect(run(action("migrate", missing))).resolves.toMatchObject({ code: 0, errors: "" });
    expect(readSchemaVersion(missing)).toBe(1);
  });

  it("backs up a database before changing it, and reports where", async () => {
    migrate(directory(), []);

    const migrated = await run(action("migrate"));

    expect(migrated.code).toBe(0);
    expect(migrated.output).toContain(`Backed up the database to ${directory()}`);
  });

  it("changes nothing while a server holds the data directory", async () => {
    const release = lockDataDirectory(directory());

    const migrated = await run(action("migrate"));
    release();

    expect(migrated.code).toBe(1);
    expect(migrated.errors).toContain("A server is already running");
    expect(existsSync(databaseFile(directory()))).toBe(false);
  });

  it("releases the data directory when it is done, even after a failure", async () => {
    await run(action("migrate"), [statements(1, "not SQL")]);

    expect(() => {
      lockDataDirectory(directory())();
    }).not.toThrow();
  });

  it("says why a migration failed", async () => {
    const migrated = await run(action("migrate"), [statements(1, "not SQL")]);

    expect(migrated.code).toBe(1);
    expect(migrated.errors).toMatch(/Migration 1 \(step 1\) failed\.[^]*syntax error/);
  });
});

// install shows only what the program prints to its standard output.
describe("the database program that install runs", () => {
  it("prints where the backup is", () => {
    writeFileSync(databaseFile(directory()), "");
    const program = join(import.meta.dirname, "database-main.ts");

    const ran = spawnSync(process.execPath, [program, ...action("migrate")], { encoding: "utf8" });

    expect(ran.status).toBe(0);
    expect(ran.stdout).toContain(`Backed up the database to ${directory()}`);
  });
});

describe("the database program's arguments", () => {
  it.each([
    { given: [], problem: "check or migrate" },
    { given: ["drop"], problem: "check or migrate" },
    { given: ["check", "migrate"], problem: "check or migrate" },
  ])("refuses $given", async ({ given, problem }) => {
    mkdirSync(directory(), { recursive: true });

    const result = await run([...given, "--data-directory", directory()]);

    expect(result.code).toBe(1);
    expect(result.errors).toContain(problem);
  });

  // A relative path would be taken from the current directory, which could be the one with the real data.
  it.each(["", ".claude-plans"])("refuses the data directory %j, which is not a full path", async (dataDirectory) => {
    const result = await run(action("migrate", dataDirectory));

    expect(result.errors).toContain("full path");
  });
});
