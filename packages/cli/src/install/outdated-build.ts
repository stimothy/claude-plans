/**
 * Refuses an installed application once the repository's local master has another version, so that the user does
 * not go on using an outdated one without knowing it.
 *
 * @packageDocumentation
 */
import { manifestVersion } from "./layout.ts";
import { Refusal } from "./refusal.ts";
import { runGit } from "./run-program.ts";

/** What the check needs to know about a copy that a plain install saved. */
export interface InstalledCopy {
  readonly repository: string;
  readonly version: string;
}

// The version that master has committed, whatever branch is checked out and whatever has not been committed.
function versionOnMaster(repository: string): string {
  return manifestVersion(runGit(repository, ["show", "refs/heads/master:package.json"]));
}

/**
 * Refuses unless the copy's version is the one on master. Only versions are compared. If master's version cannot
 * be read, no difference is known, so this only warns.
 */
export function requireCurrentBuild({ repository, version }: InstalledCopy, warn: (line: string) => void): void {
  let latest: string;
  try {
    latest = versionOnMaster(repository);
  } catch (error) {
    const problem = error instanceof Error ? error.message : String(error);
    warn(`Could not check whether this copy of claude-plans is outdated. ${problem}`);
    return;
  }
  if (latest !== version) {
    throw new Refusal(
      `This copy of claude-plans is version ${version}, but master in ${repository} is at version ${latest}. ` +
        "Run claude-plans install. It works only from your own copy, on an unchanged master.",
    );
  }
}
