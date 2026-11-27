import { beforeEach, describe, expect, it, vi } from "vitest";

import { readSchemaVersion } from "../database/schema-version.ts";
import { healthReport } from "./health-report.ts";

vi.mock("../database/schema-version.ts", () => ({ readSchemaVersion: vi.fn() }));
vi.mock("../database/migrations/index.ts", () => ({ migrations: [{}, {}] }));

const read = vi.mocked(readSchemaVersion);
const log = vi.fn();

const report = (): unknown => healthReport("/data", "1.2.3", log);

beforeEach(() => {
  vi.resetAllMocks();
});

describe("healthReport", () => {
  it("is ok when the database is at the application's schema version", () => {
    read.mockReturnValue(2);

    expect(report()).toEqual({ status: "ok", version: "1.2.3", database: { accessible: true, migrationVersion: 2 } });
    expect(read).toHaveBeenCalledWith("/data");
  });

  it.each([1, 3])("is an error when the database is at another version, such as %i", (version) => {
    read.mockReturnValue(version);

    expect(report()).toMatchObject({ status: "error", database: { accessible: true, migrationVersion: version } });
  });

  it("says that a database which was never set up cannot be read", () => {
    read.mockReturnValue(undefined);

    expect(report()).toMatchObject({ status: "error", database: { accessible: false, migrationVersion: null } });
    expect(log).not.toHaveBeenCalled();
  });

  it("logs why a database cannot be read", () => {
    const failure = new Error("file is not a database");
    read.mockImplementation(() => {
      throw failure;
    });

    expect(report()).toMatchObject({ status: "error", database: { accessible: false, migrationVersion: null } });
    expect(log).toHaveBeenCalledWith("Cannot read the database", failure);
  });
});
