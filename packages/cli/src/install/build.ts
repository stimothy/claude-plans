/**
 * Makes a build of the application: a copy of its code with only the packages that it needs to run. Node.js runs
 * the TypeScript as it is, so there is nothing to compile.
 *
 * @packageDocumentation
 */
import { randomBytes } from "node:crypto";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

import { z } from "zod";

import { buildsDirectory, commandDirectory, currentBuild, setCurrentBuild } from "./layout.ts";
import { type InstallationRecord, recordInstallation } from "./layout.ts";
import { runNpm, runProgram } from "./run-program.ts";

const uniqueBytes = 4;

/** A build that has been made, which may not be the current one. */
export interface Build {
  readonly directory: string;
  readonly version: string;
}

function versionOf(directory: string): string {
  const manifest: unknown = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
  return z.object({ version: z.string().min(1) }).parse(manifest).version;
}

// Installed packages are left out, because the build gets its own, and so are tests.
function isShipped(path: string): boolean {
  return basename(path) !== "node_modules" && !path.endsWith(".test.ts");
}

function fill(directory: string, record: InstallationRecord): void {
  for (const name of ["package.json", "package-lock.json", "packages"]) {
    cpSync(join(record.repository, name), join(directory, name), { recursive: true, filter: isShipped });
  }
  // No package may run a script of its own, and the repository's own setup script is not part of a build.
  runNpm("npm ci --omit=dev --ignore-scripts --prefer-offline --no-audit --no-fund", directory);
  recordInstallation(directory, record);
}

/** Removes the directory of a build. */
export function removeBuild(directory: string): void {
  rmSync(directory, { recursive: true, force: true });
}

/** Makes a new build of a repository in a data directory, and leaves the current one as it is. */
export function makeBuild(record: InstallationRecord, dataDirectory: string): Build {
  const version = versionOf(record.repository);
  const name = `${version}-${randomBytes(uniqueBytes).toString("hex")}`;
  const directory = join(buildsDirectory(dataDirectory), name);
  mkdirSync(directory, { recursive: true });
  try {
    fill(directory, record);
  } catch (error) {
    removeBuild(directory);
    throw error;
  }
  return { directory, version };
}

/** Runs the database program of a build, which checks or migrates a database, and returns what it reported. */
export function runDatabaseProgram(directory: string, action: "check" | "migrate", dataDirectory: string): string {
  const program = join("packages", "backend", "src", "program", "database-main.ts");
  return runProgram(process.execPath, [program, action, `--data-directory=${dataDirectory}`], directory);
}

// It is plain JavaScript, because npm runs it from a path that it chose.
const launcher = `#!/usr/bin/env node
// Written by claude-plans install. It runs whichever build is current.
import { readFileSync } from "node:fs";

const application = new URL("../", import.meta.url);
const { build } = JSON.parse(readFileSync(new URL("current.json", application), "utf8"));
await import(new URL("builds/" + build + "/packages/cli/src/main.ts", application));
`;

function writeLauncher(dataDirectory: string, version: string): void {
  const directory = commandDirectory(dataDirectory);
  const manifest = { name: "claude-plans-command", version, type: "module", bin: { "claude-plans": "main.js" } };
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, "package.json"), JSON.stringify(manifest));
  writeFileSync(join(directory, "main.js"), launcher, { mode: 0o755 });
}

/** Makes a build the one that runs, and returns the directory of the build that it replaced, if there was one. */
export function activateBuild(dataDirectory: string, build: Build): string | undefined {
  const previous = currentBuild(dataDirectory);
  writeLauncher(dataDirectory, build.version);
  setCurrentBuild(dataDirectory, basename(build.directory));
  return previous === undefined ? undefined : join(buildsDirectory(dataDirectory), previous);
}
