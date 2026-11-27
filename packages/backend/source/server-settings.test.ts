import { describe, expect, it } from "vitest";

import { serverSettings } from "./server-settings.ts";

describe("the server settings", () => {
  it("default to port 4310 and the info log level", () => {
    expect(serverSettings({}, {})).toEqual({ port: 4310, logLevel: "info" });
  });

  it("take the settings file over the defaults", () => {
    expect(serverSettings({ port: 5000, logLevel: "warn" }, {})).toEqual({ port: 5000, logLevel: "warn" });
  });

  it("take command options over the settings file", () => {
    const file = { port: 5000, logLevel: "warn" } as const;

    expect(serverSettings(file, { port: 6000, logLevel: "debug" })).toEqual({ port: 6000, logLevel: "debug" });
  });

  it("choose each setting by itself", () => {
    expect(serverSettings({ port: 5000 }, { logLevel: "error" })).toEqual({ port: 5000, logLevel: "error" });
  });

  it("treat an option that was not given as absent", () => {
    expect(serverSettings({ port: 5000 }, { port: undefined, logLevel: undefined })).toEqual({
      port: 5000,
      logLevel: "info",
    });
  });

  it.each([{ port: 0 }, { port: 65_536 }, { port: Number.NaN }])("reject the option %j", (options) => {
    expect(() => serverSettings({}, options)).toThrow("port");
  });
});
