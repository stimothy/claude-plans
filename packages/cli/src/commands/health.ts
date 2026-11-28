/**
 * The health command, which reports whether the server for a data directory works.
 *
 * @packageDocumentation
 */
import { healthContract, type HealthReport } from "@claude-plans/domain";

import { Refusal } from "../install/refusal.ts";
import { askServer, findServer } from "../server/running-server.ts";
import type { Terminal } from "../terminal.ts";

function readable({ status, version, database }: HealthReport): string[] {
  return [
    `Status: ${status}`,
    `Version: ${version}`,
    `Database: ${database.accessible ? "accessible" : "not accessible"}`,
    `Migration version: ${String(database.migrationVersion ?? "unknown")}`,
  ];
}

/** What the health command was asked for. */
export interface HealthOptions {
  readonly dataDirectory: string;
  /** The command's own version, which the server's has to match. */
  readonly version: string;
  /** Whether to print the report as JSON. */
  readonly json: boolean;
}

// Only the version is read, because a server of another version may report the rest differently.
function requireSameVersion(body: unknown, own: string): void {
  const { version } = healthContract.read.response.pick({ version: true }).parse(body);
  if (version !== own) {
    throw new Refusal(
      `The running server is version ${version}, but this command is version ${own}. ` +
        "Stop the server, run install, and start the server again.",
    );
  }
}

/**
 * Prints the server's health report, readable or as JSON, and returns the exit code, which is 0 only when
 * everything works. It never starts a server, and it refuses one of another version.
 */
export async function reportHealth(options: HealthOptions, terminal: Terminal): Promise<number> {
  const { dataDirectory, version, json } = options;
  const server = await findServer(dataDirectory);
  if (server === undefined) {
    // This goes to the error output, so that the output holds only a report.
    terminal.printError(`No server is running on ${dataDirectory}.`);
    return 1;
  }
  const { body } = await askServer(server.port, healthContract.path);
  requireSameVersion(body, version);
  const report = healthContract.read.response.parse(body);
  for (const line of json ? [JSON.stringify(report)] : readable(report)) {
    terminal.print(line);
  }
  return report.status === "ok" ? 0 : 1;
}
