/**
 * Decides whether this version of the application can use a database.
 *
 * @packageDocumentation
 */
import { migrations } from "./migrations/index.ts";
import { readSchemaVersion } from "./schema-version.ts";

/** Refuses a database that is newer than the newest schema version that is known. */
export function requireSupportedDatabase(version: number | undefined, newest: number): void {
  if (version !== undefined && version > newest) {
    throw new Error(
      `The database is at version ${String(version)}, which is newer than version ${String(newest)}, ` +
        "the newest that this application supports. Install a newer version of the application.",
    );
  }
}

function currentVersion(dataDirectory: string): number | undefined {
  try {
    return readSchemaVersion(dataDirectory);
  } catch (error) {
    // Installing opens the database for writing, which recovers from an interrupted write.
    throw new Error("Cannot read the database. Running claude-plans install may repair it.", { cause: error });
  }
}

/** Refuses a data directory unless its database is at exactly the newest schema version. It changes nothing. */
export function requireCurrentDatabase(dataDirectory: string, newest = migrations.length): void {
  const version = currentVersion(dataDirectory);
  requireSupportedDatabase(version, newest);
  if (version !== newest) {
    throw new Error("The database is not ready for this version of the application. Run claude-plans install.");
  }
}
