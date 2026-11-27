import type { HealthReport } from "@claude-plans/domain";
import { describe, expect, it } from "vitest";

import { Refusal } from "../install/refusal.ts";
import { recordingTerminal } from "../recording-terminal.ts";
import { answer, useStandInServers } from "../server/stand-in-server.ts";
import { reportHealth } from "./health.ts";

const servers = useStandInServers();
const healthy: HealthReport = { status: "ok", version: "1.2.3", database: { accessible: true, migrationVersion: 0 } };
const broken: HealthReport = {
  status: "error",
  version: "1.2.3",
  database: { accessible: false, migrationVersion: null },
};

async function serveReport(report: unknown): Promise<void> {
  await servers.serve((_, response) => {
    answer(response, report);
  });
}

// Runs the command, and gives its exit code and what it printed.
async function check(json: boolean) {
  const terminal = recordingTerminal();
  const code = await reportHealth({ dataDirectory: servers.directory(), version: "1.2.3", json }, terminal);
  return { code, output: terminal.output, errors: terminal.errors };
}

describe("the health command", () => {
  it.each([
    [healthy, 0, ["Status: ok", "Version: 1.2.3", "Database: accessible", "Migration version: 0"]],
    [broken, 1, ["Status: error", "Version: 1.2.3", "Database: not accessible", "Migration version: unknown"]],
  ])("prints a readable report of %j", async (report, expected, lines) => {
    await serveReport(report);

    await expect(check(false)).resolves.toMatchObject({ code: expected, output: lines });
  });

  it("prints the same report as JSON when asked", async () => {
    await serveReport(broken);

    const { code, output } = await check(true);

    expect(code).toBe(1);
    expect(output.map((line) => JSON.parse(line) as unknown)).toEqual([broken]);
  });

  it("says that no server is running, apart from the report", async () => {
    const errors = [`No server is running on ${servers.directory()}.`];

    await expect(check(true)).resolves.toEqual({ code: 1, output: [], errors });
  });

  it("fails on a report that it does not understand", async () => {
    await serveReport({ version: "1.2.3", status: "fine" });

    await expect(check(false)).rejects.toThrow("status");
  });

  // Its report may not have the shape that this command expects, so the version is compared first.
  it.each([healthy, { version: "1.2.3" }])("refuses a server of another version, which reports %j", async (report) => {
    await serveReport({ ...report, version: "1.2.4" });

    const attempt = check(false);

    await expect(attempt).rejects.toThrow(
      "The running server is version 1.2.4, but this command is version 1.2.3. " +
        "Stop the server, run install, and start the server again.",
    );
    await expect(attempt).rejects.toBeInstanceOf(Refusal);
  });
});
