/**
 * Makes a build of the application: a copy of its code with only the packages that it needs to run. Node.js runs
 * the TypeScript as it is, so only the web page, which runs in a browser, has to be built.
 *
 * @packageDocumentation
 */
import { randomBytes } from "node:crypto";
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

import { buildsDirectory, commandDirectory, currentBuild, setCurrentBuild } from "./layout.ts";
import { type InstallationRecord, recordInstallation, versionOf } from "./layout.ts";
import { Refusal } from "./refusal.ts";
import { runNpm, runProgram } from "./run-program.ts";

const uniqueBytes = 4;

/** A build that has been made, which may not be the current one. */
export interface Build {
  readonly directory: string;
  readonly version: string;
}

// The build installs its own packages and builds its own page, so the repository's are left out. So are tests.
const madeByTheBuild = new Set(["node_modules", "dist"]);

function isShipped(path: string): boolean {
  return !madeByTheBuild.has(basename(path)) && !/\.test\.tsx?$/.test(path);
}

function fill(directory: string, record: InstallationRecord): void {
  // The page's TypeScript settings extend the base ones, which building the page reads.
  for (const name of ["package.json", "package-lock.json", "tsconfig.base.json", "packages"]) {
    cpSync(join(record.repository, name), join(directory, name), { recursive: true, filter: isShipped });
  }
  // No package may run a script of its own, and the repository's own setup script is not part of a build.
  runNpm("npm ci --omit=dev --ignore-scripts --prefer-offline --no-audit --no-fund", directory);
  runNpm("npm run build:page", directory);
  recordInstallation(directory, record);
}

/** Removes the directory of a build. */
export function removeBuild(directory: string): void {
  rmSync(directory, { recursive: true, force: true });
}

/** Makes a new build of a repository in a data directory, and leaves the current one as it is. */
export function makeBuild(record: InstallationRecord, dataDirectory: string): Build {
  // Vite reads these as parts of an address, not of a path.
  if (/[#?*]/.test(dataDirectory)) {
    throw new Refusal(`The web page cannot be built in ${dataDirectory}, because its path has #, ?, or *.`);
  }
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

/**
 * Runs the database program of a build, which checks or migrates the data directory's database. What it reports is
 * passed on, even if it then fails.
 */
export function runDatabaseProgram(
  directory: string,
  action: "check" | "migrate",
  dataDirectory: string,
  report?: (printed: string) => void,
): void {
  const program = join("packages", "backend", "src", "program", "database-main.ts");
  runProgram(process.execPath, [program, action, `--data-directory=${dataDirectory}`], directory, report);
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
