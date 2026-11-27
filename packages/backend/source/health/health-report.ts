/**
 * Works out whether the studio works.
 *
 * @packageDocumentation
 */
import type { HealthReport } from "@claude-plans/domain";
import type { Log } from "@claude-plans/logging";

import { migrations } from "../database/migrations/index.ts";
import { readSchemaVersion } from "../database/schema-version.ts";

// Nothing means that the database cannot be read, whether it was never set up or reading it failed.
function schemaVersion(dataDirectory: string, logError: Log): number | undefined {
  try {
    return readSchemaVersion(dataDirectory);
  } catch (error) {
    logError("Cannot read the database", error);
    return undefined;
  }
}

/**
 * Returns the health report for a data directory. It is ok only if the database is at the schema version that this
 * application has. It never creates or changes the database.
 */
export function healthReport(dataDirectory: string, version: string, logError: Log): HealthReport {
  const found = schemaVersion(dataDirectory, logError);
  return {
    status: found === migrations.length ? "ok" : "error",
    version,
    database: { accessible: found !== undefined, migrationVersion: found ?? null },
  };
}
