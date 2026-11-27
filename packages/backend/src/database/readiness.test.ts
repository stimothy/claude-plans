import { writeFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { migrate } from "./migrate.ts";
import { requireCurrentDatabase, requireSupportedDatabase } from "./readiness.ts";
import { databaseFile } from "./schema-version.ts";
import { statements, useTestDirectory } from "./test-database.ts";

const directory = useTestDirectory();
const twoSteps = [statements(1, "CREATE TABLE a (id INTEGER)"), statements(2, "CREATE TABLE b (id INTEGER)")];

describe("requireCurrentDatabase", () => {
  it("accepts a database at the newest version", () => {
    migrate(directory(), twoSteps);

    expect(() => {
      requireCurrentDatabase(directory(), 2);
    }).not.toThrow();
  });

  it.each([
    { name: "no database", prepare: () => undefined },
    { name: "an older database", prepare: () => migrate(directory(), twoSteps.slice(0, 1)) },
  ])("refuses $name, and says to install", ({ prepare }) => {
    prepare();

    expect(() => {
      requireCurrentDatabase(directory(), 2);
    }).toThrow("not ready for this version of the application. Run claude-plans install");
  });

  it("refuses a newer database, and says why", () => {
    migrate(directory(), twoSteps);

    expect(() => {
      requireCurrentDatabase(directory(), 1);
    }).toThrow("The database is at version 2, which is newer than version 1");
  });

  it("explains a database that it cannot read", () => {
    writeFileSync(databaseFile(directory()), "not a database".repeat(100));

    expect(() => {
      requireCurrentDatabase(directory(), 0);
    }).toThrow("Cannot read the database. Running claude-plans install may repair it.");
  });
});

describe("requireSupportedDatabase", () => {
  it.each([undefined, 0, 1])("accepts version %j when the newest known is 1", (version) => {
    expect(() => {
      requireSupportedDatabase(version, 1);
    }).not.toThrow();
  });

  it("refuses a version after the newest known", () => {
    expect(() => {
      requireSupportedDatabase(2, 1);
    }).toThrow("newer than version 1, the newest that this application supports");
  });
});
