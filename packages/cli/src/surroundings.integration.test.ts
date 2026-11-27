// These tests cover what a copy of the command may reach, which depends on how it came to be there.
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { commitAll, databaseActions, installed, useFakeRepository, writeInto } from "./install/fake-repository.ts";
import { recordInstallation } from "./install/layout.ts";
import { runRecorded } from "./recording-terminal.ts";
import { type Surroundings, surroundingsOf } from "./surroundings.ts";

const fake = useFakeRepository();
const real = (): string => join(fake.repository(), ".claude-plans");
const copy = (): Surroundings => ({ repository: fake.repository(), version: "1.0.0" });
const installedCopy = (dataDirectory: string, isReal: boolean): Surroundings => ({
  repository: fake.repository(),
  version: "1.0.0",
  installation: { dataDirectory, real: isReal },
});

const run = (surroundings: Surroundings, ...given: string[]) => runRecorded(surroundings, given);

describe("the surroundings of a copy", () => {
  it("are the repository that it is in", () => {
    expect(surroundingsOf(fake.repository())).toEqual({ repository: fake.repository(), version: "1.0.0" });
  });

  it("are what an installed build recorded, and the data directory that holds it", () => {
    const build = fake.elsewhere(join("data", "app", "builds", "one"));
    mkdirSync(build, { recursive: true });
    recordInstallation(build, { repository: fake.repository(), real: false });
    writeInto(build, "package.json", JSON.stringify({ version: "0.9.0" }));

    expect(surroundingsOf(build)).toEqual({
      repository: fake.repository(),
      version: "0.9.0",
      installation: { dataDirectory: fake.elsewhere("data"), real: false },
    });
  });
});

describe("the repository's own copy", () => {
  describe.each(["", "inside"])("given the real data and %j", (below) => {
    it.each(["start", "stop", "health", "install"])("refuses to %s, changing nothing", async (name) => {
      const result = await run(copy(), name, "--data-directory", join(real(), below));

      expect(result.code).toBe(2);
      expect(result.errors).toContain("never uses the real data");
      expect(existsSync(real())).toBe(false);
    });
  });

  it("installs into another data directory", async () => {
    const data = fake.elsewhere("development");

    const result = await run(copy(), "install", "--data-directory", data);

    expect(result.code).toBe(0);
    expect(databaseActions(data)).toEqual(["check stopped", "migrate stopped"]);
    // A copy of code that nobody has reviewed must not be able to reach the real data.
    expect(surroundingsOf(join(data, "app", "builds", installed(data).build ?? ""))).toMatchObject({
      installation: { real: false },
    });
  });

  it("makes the first plain install only when asked for it by name", async () => {
    const result = await run(copy(), "install", "--studio");

    expect(result.code).toBe(0);
    expect(installed(real()).build).toBeDefined();
    expect(result.output).toContain("claude-plans command now runs");
    expect(surroundingsOf(join(real(), "app", "builds", installed(real()).build ?? ""))).toMatchObject({
      installation: { real: true },
    });
  });

  it("does not log a refused plain install in the real data", async () => {
    mkdirSync(real());
    commitAll(fake.repository());

    const result = await run(copy(), "install", "--studio");

    expect(result.code).toBe(1);
    expect(result.errors).toContain("Nothing was changed.");
    expect(existsSync(join(real(), "logs"))).toBe(false);
  });

  it("does not take a data directory with --studio", async () => {
    const result = await run(copy(), "install", "--studio", "--data-directory", fake.elsewhere("data"));

    expect(result.code).toBe(2);
    expect(result.errors).toContain("--studio takes no --data-directory");
  });

  it.each(["start", "stop", "health"])("does not take --studio to %s", async (name) => {
    const result = await run(copy(), name, "--studio");

    expect(result.errors).toContain("Unknown option '--studio'");
  });
});

describe("an installed copy", () => {
  it("uses the data directory that holds it, unless told otherwise", async () => {
    const data = fake.elsewhere("development");

    const own = await run(installedCopy(data, false), "stop");
    const named = await run(installedCopy(data, false), "stop", "--data-directory", fake.elsewhere("other"));

    expect(own.output).toBe(`No server is running on ${data}.`);
    expect(named.output).toBe(`No server is running on ${fake.elsewhere("other")}.`);
  });

  it("uses the real data when a plain install made it", async () => {
    const result = await run(installedCopy(real(), true), "stop");

    expect(result).toMatchObject({ code: 0, output: `No server is running on ${real()}.` });
  });

  // It may hold code that nobody has reviewed.
  it("does not use the real data when it was installed into another directory", async () => {
    const development = installedCopy(fake.elsewhere("development"), false);

    const result = await run(development, "stop", "--data-directory", real());

    expect(result.code).toBe(2);
    expect(result.errors).toContain("never uses the real data");
  });

  // A worktree is often removed while a copy that was installed from it is still in use.
  it("still uses its own data directory after the checkout that it came from is gone", async () => {
    const data = fake.elsewhere("development");
    const orphan: Surroundings = {
      repository: fake.elsewhere("removed"),
      version: "1.0.0",
      installation: { dataDirectory: data, real: false },
    };

    const own = await run(orphan, "stop");
    const named = await run(orphan, "stop", "--data-directory", fake.elsewhere("other"));

    expect(own).toMatchObject({ code: 0, output: `No server is running on ${data}.` });
    expect(named.errors).toContain("Cannot tell where the real data is");
  });

  it("does not take --studio", async () => {
    const result = await run(installedCopy(real(), true), "install", "--studio");

    expect(result.code).toBe(2);
    expect(result.errors).toContain("--studio is for the first install");
  });
});
