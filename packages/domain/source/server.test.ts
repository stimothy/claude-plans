import { describe, expect, it } from "vitest";

import { serverContract, serverRecordFileName, serverRecordSchema, shutdownContract } from "./index.ts";

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
