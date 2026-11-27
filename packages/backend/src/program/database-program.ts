/**
 * Checks or migrates a database as a program of its own, which installing the application starts as a separate
 * process.
 *
 * @packageDocumentation
 */
import { mkdirSync, realpathSync } from "node:fs";
import { parseArgs } from "node:util";

import { migrateWithBackup } from "../backups/migrate-with-backup.ts";
import type { Migration } from "../database/migration.ts";
import { migrations as applicationMigrations } from "../database/migrations/index.ts";
import { requireSupportedDatabase } from "../database/readiness.ts";
import { readSchemaVersion } from "../database/schema-version.ts";
import { lockDataDirectory } from "../instance-lock/instance-lock.ts";
import { requireFullPath } from "./full-path.ts";

/** What the program is given, so that it does not reach for the process that it runs in. */
export interface DatabaseProgram {
  readonly arguments: readonly string[];
  /** Tells whoever started the program what it did. */
  readonly print: (line: string) => void;
  /** Says what is wrong, to whoever started the program. */
  readonly printError: (line: string) => void;
  /** The application's migrations, unless a test gives others. */
  readonly migrations?: readonly Migration[];
}

type Action = (dataDirectory: string, migrations: readonly Migration[], print: DatabaseProgram["print"]) => unknown;

// Refuses a newer database before anything is changed, so it must change nothing itself. A database that cannot
// be read passes, because only migrating opens it for writing, which recovers from an interrupted write.
const check: Action = (dataDirectory, migrations) => {
  let version: number | undefined;
  try {
    version = readSchemaVersion(dataDirectory);
  } catch {
    return;
  }
  requireSupportedDatabase(version, migrations.length);
};

// The lock keeps a server from starting, or still running, while the database changes.
const migrateLocked: Action = async (dataDirectory, migrations, print) => {
  mkdirSync(dataDirectory, { recursive: true });
  const release = lockDataDirectory(realpathSync.native(dataDirectory));
  try {
    await migrateWithBackup(dataDirectory, migrations, print);
  } finally {
    release();
  }
};

const actions = new Map<string, Action>([
  ["check", check],
  ["migrate", migrateLocked],
]);

// A failure's causes say more than its own message does.
function explain(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }
  return error.cause === undefined ? error.message : `${error.message} ${explain(error.cause)}`;
}

/** Runs "check" or "migrate" on a data directory, and returns the program's exit code. */
export async function runDatabaseProgram(program: DatabaseProgram): Promise<number> {
  try {
    const { values, positionals } = parseArgs({
      args: [...program.arguments],
      options: { "data-directory": { type: "string" } },
      allowPositionals: true,
    });
    const action = positionals.length === 1 ? actions.get(positionals[0] ?? "") : undefined;
    if (action === undefined) {
      throw new Error("Give one action: check or migrate.");
    }
    const migrations = program.migrations ?? applicationMigrations;
    await action(requireFullPath(values["data-directory"]), migrations, program.print);
    return 0;
  } catch (error) {
    program.printError(explain(error));
    return 1;
  }
}
