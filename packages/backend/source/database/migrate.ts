/**
 * Moves the database forward. Only installing the application is meant to do this.
 *
 * @packageDocumentation
 */
import { mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

import type { Migration } from "./migration.ts";
import { migrations } from "./migrations/index.ts";
import { requireSupportedDatabase } from "./readiness.ts";
import { busyTimeoutMilliseconds, databaseFile, versionOf } from "./schema-version.ts";

const trackingTable = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL
  ) STRICT
`;

function checkNumbers(list: readonly Migration[]): void {
  if (list.some((migration, position) => migration.version !== position + 1)) {
    throw new Error("Migrations must be numbered 1, 2, 3, and so on, in order.");
  }
}

function inTransaction(database: DatabaseSync, change: () => void): void {
  // Taking the write lock at the start keeps another program from changing what is read here.
  database.exec("BEGIN IMMEDIATE");
  try {
    change();
    database.exec("COMMIT");
  } catch (error) {
    if (database.isTransaction) {
      database.exec("ROLLBACK");
    }
    throw error;
  }
}

function run(database: DatabaseSync, migration: Migration, newest: number): void {
  inTransaction(database, () => {
    // Another program may have run migrations since the last look.
    const version = versionOf(database) ?? 0;
    requireSupportedDatabase(version, newest);
    if (migration.version <= version) {
      return;
    }
    migration.apply(database);
    // Otherwise the record would be saved by itself, even for a migration that rolled back its changes.
    if (!database.isTransaction) {
      throw new Error("The migration ended its own transaction.");
    }
    // Enforcement is off, so this is what stops a migration from leaving broken references.
    if (database.prepare("PRAGMA foreign_key_check").all().length > 0) {
      throw new Error("The migration left rows that refer to rows that do not exist.");
    }
    database
      .prepare("INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)")
      .run(migration.version, migration.name, new Date().toISOString());
  });
}

/**
 * Creates the database if needed, runs the migrations that it does not have, and returns its schema version.
 * Each runs in its own transaction, so a failed one leaves no changes, and those before it stay. A database
 * that is newer than the list is an error, and is not changed.
 */
export function migrate(dataDirectory: string, list: readonly Migration[] = migrations): number {
  checkNumbers(list);
  const newest = list.length;
  mkdirSync(dataDirectory, { recursive: true });
  // It opens for writing before any look, because only that can recover from an interrupted write. Foreign keys
  // must be off before a transaction starts, or rebuilding a table would delete the rows that refer to it.
  const database = new DatabaseSync(databaseFile(dataDirectory), {
    timeout: busyTimeoutMilliseconds,
    enableForeignKeyConstraints: false,
  });
  try {
    inTransaction(database, () => {
      requireSupportedDatabase(versionOf(database), newest);
      database.exec(trackingTable);
    });
    for (const migration of list) {
      try {
        run(database, migration, newest);
      } catch (error) {
        throw new Error(`Migration ${String(migration.version)} (${migration.name}) failed.`, { cause: error });
      }
    }
    return newest;
  } finally {
    database.close();
  }
}
