/**
 * The health command, which reports whether the server for a data directory works.
 *
 * @packageDocumentation
 */
import { healthContract, type HealthReport } from "@claude-plans/domain";

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

/**
 * Prints the server's health report, readable or as JSON, and returns the exit code, which is 0 only when
 * everything works. It never starts a server.
 */
export async function reportHealth(dataDirectory: string, json: boolean, terminal: Terminal): Promise<number> {
  const server = await findServer(dataDirectory);
  if (server === undefined) {
    // This goes to the error output, so that the output holds only a report.
    terminal.printError(`No server is running on ${dataDirectory}.`);
    return 1;
  }
  const response = await askServer(server.port, healthContract.path);
  const report = healthContract.read.response.parse(await response.json());
  for (const line of json ? [JSON.stringify(report)] : readable(report)) {
    terminal.print(line);
  }
  return report.status === "ok" ? 0 : 1;
}
