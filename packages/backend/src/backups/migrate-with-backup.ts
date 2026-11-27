/**
 * Migrates a database in a way that can be undone: an existing one is backed up first, and restored if a
 * migration fails.
 *
 * @packageDocumentation
 */
import { migrate } from "../database/migrate.ts";
import type { Migration } from "../database/migration.ts";
import { useExistingDatabase, versionOf } from "../database/schema-version.ts";
import { restoreBackup, saveBackup } from "./database-backup.ts";

// Returns the path of the backup, or nothing if there is no database or nothing to migrate in it.
function backUpBeforeMigrating(dataDirectory: string, newest: number): string | undefined {
  // It opens for writing, because only that can recover from an interrupted write.
  return useExistingDatabase(dataDirectory, { readOnly: false }, (database) => {
    const version = versionOf(database);
    // Migrating changes nothing in one that is current, and refuses a newer one. One without the table that tracks
    // migrations is changed even when there are none to run.
    const changes = version === undefined || version < newest;
    return changes ? saveBackup(database, dataDirectory, version ?? 0) : undefined;
  });
}

function backUp(dataDirectory: string, newest: number): string | undefined {
  try {
    return backUpBeforeMigrating(dataDirectory, newest);
  } catch (error) {
    throw new Error("The database could not be backed up, so nothing was migrated.", { cause: error });
  }
}

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error));

// Returns why the database could not be restored, if it could not.
async function restoreProblem(file: string, dataDirectory: string): Promise<string | undefined> {
  try {
    await restoreBackup(file, dataDirectory);
    return undefined;
  } catch (error) {
    return message(error);
  }
}

// A journal that an interrupted write left could later be applied to a file that was copied over the database.
const byHand =
  "To restore it, stop the server and restore it with SQLite, such as with the .restore command of sqlite3.";

// Always throws, with the failed migration as the cause of what happened to the database.
async function undo(failure: unknown, file: string, dataDirectory: string): Promise<never> {
  const problem = await restoreProblem(file, dataDirectory);
  const outcome =
    problem === undefined
      ? `the database was restored from the backup made before it, which is in ${file}.`
      : `the database could not be restored (${problem}). The backup made before migrating is in ${file}. ${byHand}`;
  throw new Error(`Migrating failed, and ${outcome}`, { cause: failure });
}

/**
 * Migrates the database in a data directory, which no server may be using. A database that exists and would be
 * changed is backed up first, and nothing is migrated if that fails. If a migration then fails, the database is
 * restored from the backup. The report says where a backup was saved.
 */
export async function migrateWithBackup(
  dataDirectory: string,
  migrations: readonly Migration[],
  report: (line: string) => void,
): Promise<void> {
  const file = backUp(dataDirectory, migrations.length);
  if (file !== undefined) {
    report(`Backed up the database to ${file} before migrating it.`);
  }
  try {
    migrate(dataDirectory, migrations);
  } catch (error) {
    if (file === undefined) {
      throw error;
    }
    await undo(error, file, dataDirectory);
  }
}
