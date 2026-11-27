import { describe, expect, it } from "vitest";

import {
  serverContract,
  serverRecordFileName,
  serverRecordSchema,
  serverStartReportSchema,
  shutdownContract,
} from "./index.ts";

const record = { port: 4310, token: "a".repeat(64) };

describe("a server record", () => {
  it("holds the port and the token that allows a shutdown", () => {
    expect(serverRecordSchema.parse(record)).toEqual(record);
    expect(serverRecordFileName).toBe("server.json");
  });

  it.each([
    { ...record, port: 0 },
    { ...record, port: 65_536 },
    { ...record, token: "" },
    { port: record.port },
    { token: record.token },
  ])("may not be %j", (invalid) => {
    expect(serverRecordSchema.safeParse(invalid).success).toBe(false);
  });
});

describe("the server APIs", () => {
  it("say which data directory the server uses", () => {
    expect([serverContract.path, serverContract.read.method]).toEqual(["/api/server", "GET"]);
    expect(serverContract.read.response.parse({ dataDirectory: "/data" })).toEqual({ dataDirectory: "/data" });
  });

  it("shut the server down with POST", () => {
    expect([shutdownContract.path, shutdownContract.shutDown.method]).toEqual(["/api/shutdown", "POST"]);
  });
});

describe("a server's start report", () => {
  it.each([
    { state: "listening", port: 4311 },
    { state: "failed", message: "Port 4311 is already in use." },
  ])("may be %j", (report) => {
    expect(serverStartReportSchema.parse(report)).toEqual(report);
  });

  it.each([{ state: "listening" }, { state: "listening", port: 0 }, { state: "failed" }, { port: 4311 }])(
    "may not be %j",
    (invalid) => {
      expect(serverStartReportSchema.safeParse(invalid).success).toBe(false);
    },
  );
});
