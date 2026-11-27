import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { describe, expect, it, vi } from "vitest";

import { migrate } from "../database/migrate.ts";
import type { Migration } from "../database/migration.ts";
import { databaseFile, readSchemaVersion } from "../database/schema-version.ts";
import { queryRows, statements, step, useTestDirectory } from "../database/test-database.ts";
import { migrateWithBackup } from "./migrate-with-backup.ts";

const directory = useTestDirectory();
const first = statements(1, "CREATE TABLE plans (title TEXT); INSERT INTO plans VALUES ('kept')");
const second = statements(2, "DELETE FROM plans");
const failing = statements(3, "not SQL");

const backupsDirectory = (): string => join(directory(), "backups");
const backupNames = (): string[] => (existsSync(backupsDirectory()) ? readdirSync(backupsDirectory()) : []);
// Each backup is read as a data directory's database is, from a directory of its own.
function titlesIn(file: string): unknown[] {
  const database = new DatabaseSync(file, { readOnly: true });
  const rows = database
    .prepare("SELECT title FROM plans")
    .all()
    .map((row) => row["title"]);
  database.close();
  return rows;
}
const titles = (): unknown[] => titlesIn(databaseFile(directory()));

async function run(migrations: readonly Migration[]) {
  const reports: string[] = [];
  await migrateWithBackup(directory(), migrations, (line) => reports.push(line));
  return reports.join("\n");
}

describe("backing up before a migration", () => {
  it("saves the database as it was, and says where", async () => {
    migrate(directory(), [first]);

    const report = await run([first, second]);

    const [name = ""] = backupNames();
    expect(name).toMatch(/^\d{8}T\d{6}Z-version-1-[\da-f]{8}\.sqlite$/);
    expect(report).toContain(join(backupsDirectory(), name));
    expect(titlesIn(join(backupsDirectory(), name))).toEqual(["kept"]);
    expect(titles()).toEqual([]);
  });

  it("never overwrites an earlier backup, even within the same second", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    migrate(directory(), [first]);
    // A failure puts the database back, so both backups are of the same version.
    const unchanged = [first, statements(2, "not SQL")];

    await expect(run(unchanged)).rejects.toThrow("restored");
    await expect(run(unchanged)).rejects.toThrow("restored");

    vi.useRealTimers();
    expect(backupNames()).toHaveLength(2);
  });

  it("backs up a database that does not yet track migrations", async () => {
    const database = new DatabaseSync(databaseFile(directory()));
    database.exec("CREATE TABLE other (id INTEGER)");
    database.close();

    await run([]);

    expect(backupNames()).toEqual([expect.stringContaining("-version-0-")]);
  });

  it.each([
    ["there is no database yet", [] as Migration[]],
    ["there is nothing to migrate", [first]],
  ])("makes no backup when %s", async (_, earlier) => {
    if (earlier.length > 0) {
      migrate(directory(), earlier);
    }

    await expect(run([first])).resolves.toBe("");

    expect(backupNames()).toEqual([]);
    expect(readSchemaVersion(directory())).toBe(1);
  });

  it("makes none for a newer database, which it refuses", async () => {
    migrate(directory(), [first]);

    await expect(run([])).rejects.toThrow("newer than version 0");

    expect(backupNames()).toEqual([]);
  });
});

describe("a backup that fails", () => {
  it("stops the migration", async () => {
    migrate(directory(), [first]);
    // A file where the directory belongs.
    writeFileSync(backupsDirectory(), "");

    await expect(run([first, second])).rejects.toThrow("could not be backed up, so nothing was migrated");

    expect(titles()).toEqual(["kept"]);
    expect(readSchemaVersion(directory())).toBe(1);
  });

  it("leaves no part of a backup behind", async () => {
    writeFileSync(databaseFile(directory()), "not a database".repeat(100));

    await expect(run([first])).rejects.toThrow("could not be backed up");

    expect(backupNames()).toEqual([]);
  });
});

describe("a migration that fails", () => {
  it("restores the database to how it was before every migration, and keeps the backup", async () => {
    migrate(directory(), [first]);

    const attempt = run([first, second, failing]);

    await expect(attempt).rejects.toThrow(/the database was restored from the backup[^]*backups/);
    await expect(attempt).rejects.toMatchObject({ cause: { message: "Migration 3 (step 3) failed." } });
    expect(titles()).toEqual(["kept"]);
    expect(queryRows(directory(), "SELECT version FROM schema_migrations")).toEqual([{ version: 1 }]);
    expect(backupNames()).toHaveLength(1);
  });

  it("says where the backup is when the database cannot be restored", async () => {
    migrate(directory(), [first]);
    // It makes the restore fail, by leaving something that is not a database in the database's place.
    const wrecking = step(2, () => {
      writeFileSync(databaseFile(directory()), "not a database".repeat(100));
      throw new Error("The disk failed.");
    });

    const attempt = run([first, wrecking]);

    await expect(attempt).rejects.toThrow(/could not be restored[^]*The backup[^]*backups/);
    // Copying the file over the database could damage it.
    await expect(attempt).rejects.toThrow("restore it with SQLite, such as with the .restore command of sqlite3");
    const [name = ""] = backupNames();
    await expect(attempt).rejects.toThrow(join(backupsDirectory(), name));
    expect(titlesIn(join(backupsDirectory(), name))).toEqual(["kept"]);
  });

  it("gives only the failure when there was no database to back up", async () => {
    await expect(run([statements(1, "not SQL")])).rejects.toThrow(/^Migration 1 \(step 1\) failed\.$/);

    expect(backupNames()).toEqual([]);
  });
});
