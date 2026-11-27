/**
 * Saves a copy of a database in the data directory's backups directory, and puts one back.
 *
 * @packageDocumentation
 */
import { randomBytes } from "node:crypto";
import { closeSync, fsyncSync, mkdirSync, openSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import { backup, DatabaseSync } from "node:sqlite";

import { busyTimeoutMilliseconds, databaseFile } from "../database/schema-version.ts";

const uniqueBytes = 4;

// The random part keeps two backups that are made within one second apart.
function newName(version: number): string {
  const time = new Date().toISOString().replace(/[-:]|\.\d+/g, "");
  return `${time}-version-${String(version)}-${randomBytes(uniqueBytes).toString("hex")}.sqlite`;
}

// SQLite does not wait for the copy to reach the disk.
function flush(file: string): void {
  const descriptor = openSync(file, "r+");
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

/**
 * Saves a copy of an open database of the given version, and returns the copy's path. It never writes over a file
 * that exists. The copy gets its name only once it is complete.
 */
export function saveBackup(database: DatabaseSync, dataDirectory: string, version: number): string {
  const directory = join(dataDirectory, "backups");
  mkdirSync(directory, { recursive: true });
  const file = join(directory, newName(version));
  const partial = `${file}.partial`;
  try {
    // This fails if the file exists, and if any part of the database cannot be read.
    database.prepare("VACUUM INTO ?").run(partial);
    flush(partial);
    renameSync(partial, file);
  } catch (error) {
    rmSync(partial, { force: true });
    throw error;
  }
  return file;
}

// SQLite's backup interface does not wait for a database that another program is using, so this does first.
function waitUntilFree(file: string): void {
  const database = new DatabaseSync(file, { timeout: busyTimeoutMilliseconds });
  try {
    database.exec("BEGIN EXCLUSIVE; ROLLBACK");
  } finally {
    database.close();
  }
}

/**
 * Replaces the contents of the database in a data directory with a backup. SQLite writes them, so that what an
 * interrupted write left behind is not applied to them later, as it could be to a file that was copied.
 */
export async function restoreBackup(file: string, dataDirectory: string): Promise<void> {
  waitUntilFree(databaseFile(dataDirectory));
  const saved = new DatabaseSync(file, { readOnly: true, timeout: busyTimeoutMilliseconds });
  try {
    await backup(saved, databaseFile(dataDirectory));
  } finally {
    saved.close();
  }
}
