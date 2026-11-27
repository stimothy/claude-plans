/**
 * Puts the claude-plans command on the user's path, which npm does with a global install of the launcher's
 * directory. That works on every supported system.
 *
 * @packageDocumentation
 */
import { realpathSync } from "node:fs";
import { join } from "node:path";

import { Refusal } from "./refusal.ts";
import { runNpm } from "./run-program.ts";

const packageName = "claude-plans-command";

// Gives where a path really leads, or nothing if it leads nowhere.
function target(path: string): string | undefined {
  try {
    return realpathSync.native(path);
  } catch {
    return undefined;
  }
}

/**
 * Refuses if the command on the path runs another installation, such as one made from a second clone, which would
 * quietly move the command to other data. An installation that no longer exists does not count.
 */
export function requireCommandIsFree(directory: string, from: string): void {
  const linked = target(join(runNpm("npm root --global", from), packageName));
  if (linked !== undefined && linked !== target(directory)) {
    throw new Refusal(
      `The claude-plans command on your path runs the installation in ${linked}. Nothing was changed. ` +
        `To replace it, first run: npm uninstall --global ${packageName}`,
    );
  }
}

/** Installs the command in a directory on the user's path. The directory must stay where it is. */
export function linkCommand(directory: string): void {
  // The user may have set npm to copy local packages, but the command has to stay where it can find the builds.
  runNpm("npm install --global --install-links=false --ignore-scripts --no-audit --no-fund .", directory);
}
