/**
 * Asks Git where the real data is, and whether a checkout may replace the application that uses it.
 *
 * @packageDocumentation
 */
import { realpathSync } from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";

import { Refusal } from "./refusal.ts";
import { runGit } from "./run-program.ts";

// Gives a path as the disk names it, for as much of it as exists, however it was typed or linked.
function onDisk(path: string): string {
  try {
    return realpathSync.native(path);
  } catch {
    const above = dirname(path);
    return above === path ? path : join(onDisk(above), basename(path));
  }
}

// Some file systems ignore letter case. Ignoring it everywhere can only protect more.
const comparable = (path: string): string => onDisk(resolve(path)).toLowerCase();

interface Checkout {
  readonly gitDirectory: string;
  /** The directory that the main checkout and its worktrees share. */
  readonly commonDirectory: string;
}

function readCheckout(repository: string): Checkout {
  const asked = ["rev-parse", "--path-format=absolute", "--show-toplevel", "--git-dir", "--git-common-dir"];
  const [top = "", gitDirectory = "", commonDirectory = ""] = runGit(repository, asked).split("\n");
  if (comparable(top) !== comparable(repository)) {
    throw new Error(`${repository} is not the top of a checkout.`);
  }
  return { gitDirectory: comparable(gitDirectory), commonDirectory: onDisk(resolve(commonDirectory)) };
}

/** Returns the real data directory, which is .claude-plans in the main checkout, even when asked from a worktree. */
export function realDataDirectory(repository: string): string {
  try {
    const { commonDirectory } = readCheckout(repository);
    if (basename(commonDirectory) !== ".git") {
      throw new Error(`${commonDirectory} does not show where the main checkout is.`);
    }
    return join(dirname(commonDirectory), ".claude-plans");
  } catch (error) {
    // Guessing could let code under development reach the real data.
    throw new Error("Cannot tell where the real data is, so nothing was done.", { cause: error });
  }
}

/** Whether a directory is the real data directory, however its path is written. */
export function isRealDataDirectory(directory: string, repository: string): boolean {
  return comparable(directory) === comparable(realDataDirectory(repository));
}

/** Whether a directory is the real data directory or is inside it. */
export function isInRealData(directory: string, repository: string): boolean {
  return `${comparable(directory)}${sep}`.startsWith(`${comparable(realDataDirectory(repository))}${sep}`);
}

function refuse(problem: string): never {
  throw new Refusal(
    `A plain install ${problem}. Nothing was changed. ` +
      "To try this code, give a separate directory with --data-directory.",
  );
}

function commitsAhead(repository: string): number {
  try {
    return Number(runGit(repository, ["rev-list", "--count", "refs/remotes/origin/master..HEAD"]));
  } catch {
    return refuse("needs origin/master. Cannot compare master with origin/master");
  }
}

/**
 * Refuses unless the repository is the main checkout, on a master branch that has no changes, and no commits that
 * the last fetched origin/master does not have.
 */
export function requirePlainInstall(repository: string): void {
  const { gitDirectory, commonDirectory } = readCheckout(repository);
  if (gitDirectory !== comparable(commonDirectory)) {
    refuse("works only from the main checkout, and this is a worktree");
  }
  if (runGit(repository, ["branch", "--show-current"]) !== "master") {
    refuse("works only on master, and this checkout is not on the master branch");
  }
  const changes = ["status", "--porcelain", "--untracked-files=all", "--ignore-submodules=none"];
  if (runGit(repository, changes) !== "") {
    refuse("works only without local changes, and this checkout has changes that are not committed");
  }
  if (commitsAhead(repository) !== 0) {
    refuse("works only with reviewed code, and master has commits that origin/master does not");
  }
}
