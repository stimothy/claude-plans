import { describe, expect, it } from "vitest";

import { healthContract, healthReportSchema } from "./index.ts";

const healthy = { status: "ok", version: "0.1.0", database: { accessible: true, migrationVersion: 1 } };

describe("a health report", () => {
  it.each([
    healthy,
    { ...healthy, status: "error", database: { accessible: false, migrationVersion: null } },
    { ...healthy, database: { accessible: true, migrationVersion: 0 } },
  ])("may be %j", (report) => {
    expect(healthReportSchema.parse(report)).toEqual(report);
  });

  it.each([
    { ...healthy, status: "fine" },
    { ...healthy, version: "" },
    { ...healthy, database: { accessible: true, migrationVersion: -1 } },
    { ...healthy, database: { accessible: true, migrationVersion: 1.5 } },
    { ...healthy, database: { accessible: true } },
    { ...healthy, database: { accessible: "false", migrationVersion: 1 } },
    { ...healthy, database: { migrationVersion: 1 } },
    { version: healthy.version, database: healthy.database },
    { status: healthy.status, database: healthy.database },
    { status: "ok", version: "0.1.0" },
  ])("may not be %j", (report) => {
    expect(healthReportSchema.safeParse(report).success).toBe(false);
  });
});

describe("the health API", () => {
  it("is read with GET and answers with a health report", () => {
    expect([healthContract.path, healthContract.read.method]).toEqual(["/api/health", "GET"]);
    expect(healthContract.read.response).toBe(healthReportSchema);
  });
});
