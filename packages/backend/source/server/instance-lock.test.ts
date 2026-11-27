import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, expect, it } from "vitest";

import { lockDataDirectory } from "./instance-lock.ts";

let directory = "";

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "claude-plans-instance-lock-"));
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

const refusal = "A server is already running on this data directory.";

// Starts another program that takes the lock, says so, and then runs until it is killed.
async function lockElsewhere(): Promise<{ said: string; kill: () => Promise<void> }> {
  const source = `
    import { lockDataDirectory } from ${JSON.stringify(new URL("instance-lock.ts", import.meta.url).href)};
    try {
      lockDataDirectory(process.argv[1]);
      console.log("locked");
      setInterval(() => {}, 1000);
    } catch (error) {
      console.log(error.message);
    }
  `;
  const program = spawn(process.execPath, ["--input-type=module", "--eval", source, directory]);
  const ended = new Promise<void>((resolve) =>
    program.once("exit", () => {
      resolve();
    }),
  );
  const said = await new Promise<string>((resolve) =>
    program.stdout.once("data", (data) => {
      resolve(String(data).trim());
    }),
  );
  const kill = async (): Promise<void> => {
    program.kill("SIGKILL");
    await ended;
  };
  return { said, kill };
}

it("refuses a second lock until the first is released", () => {
  const release = lockDataDirectory(directory);

  expect(() => lockDataDirectory(directory)).toThrow(refusal);
  release();
  lockDataDirectory(directory)();
});

it("lets only one of several programs that start together have the lock", async () => {
  const programs = await Promise.all([lockElsewhere(), lockElsewhere(), lockElsewhere()]);

  const said = programs.map((program) => program.said).sort();
  await Promise.all(programs.map((program) => program.kill()));

  expect(said).toEqual([refusal, refusal, "locked"]);
});

it("is free again after the program that held it is killed", async () => {
  const holder = await lockElsewhere();
  expect(() => lockDataDirectory(directory)).toThrow(refusal);

  await holder.kill();

  lockDataDirectory(directory)();
});

it("reports other failures as they are", () => {
  expect(() => lockDataDirectory(join(directory, "missing"))).toThrow("unable to open database file");
});
