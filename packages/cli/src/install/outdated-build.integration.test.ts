// These tests cover which commands an installed copy refuses once master has another version than it.
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { runRecorded } from "../recording-terminal.ts";
import type { Surroundings } from "../surroundings.ts";
import { commitAll, databaseActions, useFakeRepository, writeInto } from "./fake-repository.ts";
import { runGit } from "./run-program.ts";

const fake = useFakeRepository();
const data = (): string => fake.elsewhere("data");

// A copy of version 1.0.0, which is what the fake repository's master has at first.
const installedCopy = (real = true): Surroundings => ({
  repository: fake.repository(),
  version: "1.0.0",
  installation: { dataDirectory: data(), real },
});

const run = (surroundings: Surroundings, ...given: string[]) => runRecorded(surroundings, given);

function writeVersion(manifest: string): void {
  writeInto(fake.repository(), "package.json", manifest);
}

function commitVersion(version: string): void {
  writeVersion(JSON.stringify({ name: "fake", version, private: true, workspaces: ["packages/*"] }));
  commitAll(fake.repository());
}

// The health command with no server says only that none is running, so this shows that it was not refused.
const notRunning = (): object => ({ code: 1, errors: `No server is running on ${data()}.` });

describe("an installed copy whose version is not the one on master", () => {
  it.each(["start", "health"])("refuses to %s, and says to install", async (name) => {
    commitVersion("1.0.1");

    const result = await run(installedCopy(), name);

    expect(result.code).toBe(1);
    expect(result.errors).toContain("This copy of claude-plans is version 1.0.0, but master in");
    expect(result.errors).toContain("is at version 1.0.1. Run claude-plans install.");
    expect(result.errors).toContain("your own copy, on an unchanged master");
  });

  it("counts an older version on master too", async () => {
    commitVersion("0.9.0");

    await expect(run(installedCopy(), "health")).resolves.toMatchObject({
      errors: expect.stringContaining("is at version 0.9.0") as unknown,
    });
  });

  // A refusal changes nothing, so the data directory gets no log of it.
  it("does not log the refusal", async () => {
    mkdirSync(data());
    commitVersion("1.0.1");

    await run(installedCopy(), "start");

    expect(existsSync(join(data(), "logs"))).toBe(false);
  });

  it("still stops a server", async () => {
    commitVersion("1.0.1");

    await expect(run(installedCopy(), "stop")).resolves.toMatchObject({ code: 0, errors: "" });
  });

  it("still installs", async () => {
    commitVersion("1.0.1");

    const result = await run(installedCopy(false), "install");

    expect(result.code).toBe(0);
    expect(databaseActions(data())).toEqual(["check stopped", "migrate stopped"]);
  });
});

describe("what does not make a build outdated", () => {
  it("is work on another branch", async () => {
    runGit(fake.repository(), ["switch", "--create", "work"]);
    commitVersion("1.0.1");

    await expect(run(installedCopy(), "health")).resolves.toMatchObject(notRunning());
  });

  it("is a version that master does not have a commit of yet", async () => {
    writeVersion(JSON.stringify({ name: "fake", version: "1.0.1" }));

    await expect(run(installedCopy(), "health")).resolves.toMatchObject(notRunning());
  });

  // Such a copy is made from a branch, which usually has another version than master.
  it("is anything, to a copy that was installed into another directory", async () => {
    commitVersion("1.0.1");

    await expect(run(installedCopy(false), "health")).resolves.toMatchObject(notRunning());
  });
});

describe("when the version on master cannot be read", () => {
  it.each([
    [
      "the repository is gone",
      () => {
        rmSync(fake.repository(), { recursive: true });
      },
    ],
    [
      "there is no master branch",
      () => {
        runGit(fake.repository(), ["branch", "--move", "main"]);
      },
    ],
    [
      "its package.json has no version",
      () => {
        writeVersion("{}");
        commitAll(fake.repository());
      },
    ],
  ])("warns and carries on, as when %s", async (_, spoil) => {
    spoil();

    const result = await run(installedCopy(), "health");

    expect(result.errors).toContain("Could not check whether this copy of claude-plans is outdated");
    expect(result.errors).toContain(`No server is running on ${data()}.`);
  });
});
