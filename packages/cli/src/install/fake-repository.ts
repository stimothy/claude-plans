/**
 * What the install tests share: a small repository that builds quickly, with stand-ins for the two programs that
 * a build runs, and an npm that installs commands into a temporary folder.
 *
 * @packageDocumentation
 */
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, beforeEach, vi } from "vitest";

import { commandDirectory, currentBuild } from "./layout.ts";
import { runGit } from "./run-program.ts";

// The stand-in notes what it was asked to do. A file in the data directory can give it something to report, or
// tell it to fail.
const databaseProgram = `
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const [action, option] = process.argv.slice(2);
const dataDirectory = option.slice("--data-directory=".length);
mkdirSync(dataDirectory, { recursive: true });
const running = existsSync(join(dataDirectory, "server.json")) ? "running" : "stopped";
appendFileSync(join(dataDirectory, "database-actions"), action + " " + running + "\\n");
const report = join(dataDirectory, "report-" + action);
if (existsSync(report)) {
  console.log(readFileSync(report, "utf8"));
}
const failure = join(dataDirectory, "fail-" + action);
if (existsSync(failure)) {
  console.error(readFileSync(failure, "utf8"));
  process.exitCode = 1;
}
`;

// Stands in for building the page, which a real build does with Vite.
const pageBuild = `
import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync("packages/frontend/dist", { recursive: true });
copyFileSync("packages/frontend/page.html", "packages/frontend/dist/index.html");
`;

const manifest = {
  name: "fake",
  version: "1.0.0",
  private: true,
  workspaces: ["packages/*"],
  scripts: { "build:page": "node packages/frontend/build.mjs" },
};

/** Returns the text of the fake repository's root package.json at a version. */
export const fakeManifest = (version: string): string => JSON.stringify({ ...manifest, version });

const workspace = (name: string) => ({ name: `fake-${name}`, version: "1.0.0" });

// Written here, because asking npm to make it would slow every test.
const lockfile = {
  name: "fake",
  version: "1.0.0",
  lockfileVersion: 3,
  requires: true,
  packages: {
    "": { name: "fake", version: "1.0.0", workspaces: ["packages/*"] },
    "node_modules/fake-backend": { resolved: "packages/backend", link: true },
    "node_modules/fake-cli": { resolved: "packages/cli", link: true },
    "packages/backend": workspace("backend"),
    "packages/cli": workspace("cli"),
  },
};

const files = {
  "package-lock.json": JSON.stringify(lockfile),
  ".gitignore": ".claude-plans/\nnode_modules/\n",
  "package.json": JSON.stringify(manifest),
  "tsconfig.base.json": "{}",
  "packages/frontend/build.mjs": pageBuild,
  "packages/frontend/page.html": "the page",
  "packages/backend/package.json": JSON.stringify({ name: "fake-backend", version: "1.0.0", type: "module" }),
  "packages/backend/src/program/database-main.ts": databaseProgram,
  "packages/backend/src/program/database-main.test.ts": "// A build leaves tests out.\n",
  "packages/cli/package.json": JSON.stringify({ name: "fake-cli", version: "1.0.0", type: "module" }),
  "packages/cli/src/main.ts": 'console.log("the fake command", ...process.argv.slice(2));\n',
};

/** Writes a file in a directory, creating the directories above it. */
export function writeInto(directory: string, name: string, text: string): void {
  mkdirSync(dirname(join(directory, name)), { recursive: true });
  writeFileSync(join(directory, name), text);
}

/** Commits everything in a repository. */
export function commitAll(repository: string): void {
  const author = ["-c", "user.name=Test", "-c", "user.email=test@example.com", "-c", "commit.gpgsign=false"];
  runGit(repository, ["add", "--all"]);
  runGit(repository, [...author, "commit", "--no-verify", "--allow-empty", "--message=Change"]);
}

function createRepository(repository: string): void {
  for (const [name, text] of Object.entries(files)) {
    writeInto(repository, name, text);
  }
  runGit(repository, ["init", "--initial-branch=master"]);
  commitAll(repository);
  // Stands in for what was last fetched from the remote.
  runGit(repository, ["update-ref", "refs/remotes/origin/master", "HEAD"]);
}

/** A repository like the maintainer's own copy, and the places that tests use beside it. */
export interface FakeRepository {
  /** The main checkout, on an unchanged master. */
  readonly repository: () => string;
  /** A directory outside the repository, which does not exist yet. */
  readonly elsewhere: (name: string) => string;
  /** Where npm installs commands during the test. */
  readonly globalPrefix: () => string;
}

/** Gives each test a new fake repository, and keeps npm's global installs in a temporary folder. */
export function useFakeRepository(): FakeRepository {
  let root = "";
  beforeEach(() => {
    root = realpathSync.native(mkdtempSync(join(tmpdir(), "claude-plans-install-")));
    // A test must never install a command for the person who runs it.
    vi.stubEnv("npm_config_prefix", join(root, "global"));
    mkdirSync(join(root, "global", "lib"), { recursive: true });
    createRepository(join(root, "repository"));
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(root, { recursive: true, force: true });
  });
  return {
    repository: () => join(root, "repository"),
    elsewhere: (name) => join(root, name),
    globalPrefix: () => join(root, "global"),
  };
}

/** Returns what a stand-in database program was asked to do, in order. */
export function databaseActions(dataDirectory: string): string[] {
  const file = join(dataDirectory, "database-actions");
  return existsSync(file) ? readFileSync(file, "utf8").trim().split("\n") : [];
}

/** Returns the names of the builds that a data directory holds. */
export function builds(dataDirectory: string): string[] {
  const directory = join(dataDirectory, "app", "builds");
  return existsSync(directory) ? readdirSync(directory) : [];
}

/** Returns the launcher and the current build of what is installed in a data directory. */
export function installed(dataDirectory: string): { launcher: string; build: string | undefined } {
  return { launcher: join(commandDirectory(dataDirectory), "main.js"), build: currentBuild(dataDirectory) };
}
