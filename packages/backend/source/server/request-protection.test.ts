import { describe, expect, it } from "vitest";

import { isFromThisServer } from "./request-protection.ts";

describe("isFromThisServer", () => {
  it.each([
    { host: "127.0.0.1:4310" },
    { host: "localhost:4310" },
    { host: "LocalHost:4310" },
    { host: "localhost:4310", origin: "http://localhost:4310" },
    { host: "127.0.0.1:4310", origin: "http://127.0.0.1:4310" },
  ])("allows %j", (headers) => {
    expect(isFromThisServer(headers, 4310)).toBe(true);
  });

  it.each([
    {},
    { host: "example.com:4310" },
    { host: "localhost.example.com:4310" },
    { host: "localhost:5000" },
    { host: "localhost" },
    { host: "[::1]:4310" },
    { host: "localhost:4310", origin: "http://example.com" },
    { host: "localhost:4310", origin: "http://localhost:5000" },
    { host: "localhost:4310", origin: "https://localhost:4310" },
    { host: "localhost:4310", origin: "http://localhost:4310.example.com" },
    { host: "localhost:4310", origin: "null" },
    { host: "localhost:4310", origin: "" },
    { origin: "http://localhost:4310" },
  ])("refuses %j", (headers) => {
    expect(isFromThisServer(headers, 4310)).toBe(false);
  });

  // Browsers leave out the port when it is the usual one.
  it("allows an address without a port when the server uses port 80", () => {
    expect(isFromThisServer({ host: "localhost", origin: "http://localhost" }, 80)).toBe(true);
  });
});
