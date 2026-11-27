/**
 * What a copy of the command is, which decides which data it may reach. It is either the repository's own copy,
 * which runs code under development, or one that install saved.
 *
 * @packageDocumentation
 */
import { isAbsolute } from "node:path";

import { isInRealData, realDataDirectory } from "./install/checkout.ts";
import { readInstallation } from "./install/layout.ts";

/** Where a copy of the command is. */
export interface Surroundings {
  /** The repository that install builds from. */
  readonly repository: string;
  /** What an installed copy knows about itself. The repository's own copy has nothing here. */
  readonly installation?: { readonly dataDirectory: string; readonly real: boolean };
}

/** Returns the surroundings of the copy whose top directory this is. */
export function surroundingsOf(directory: string): Surroundings {
  const installation = readInstallation(directory);
  if (installation === undefined) {
    return { repository: directory };
  }
  const { repository, dataDirectory, real } = installation;
  return { repository, installation: { dataDirectory, real } };
}

/** The options that say which data directory a command is for. */
export interface Target {
  /** The directory that was typed, if one was. */
  readonly typed: string | undefined;
  /** Whether install was asked to install the real application for the first time. */
  readonly studio: boolean;
}

// The one way for the repository's own copy to reach the real data. Install then applies a plain install's
// protections.
function studioDirectory({ repository, installation }: Surroundings, typed: string | undefined): string {
  if (installation !== undefined) {
    throw new Error("--studio is for the first install, from the repository. Run claude-plans install instead.");
  }
  if (typed !== undefined) {
    throw new Error("--studio takes no --data-directory, because it installs the real application.");
  }
  return realDataDirectory(repository);
}

/**
 * Returns the data directory for a command. It refuses one that holds real data unless the copy was saved by a
 * plain install, so that code under development cannot reach it.
 */
export function targetDirectory(surroundings: Surroundings, { typed, studio }: Target): string {
  if (studio) {
    return studioDirectory(surroundings, typed);
  }
  const { repository, installation } = surroundings;
  const dataDirectory = typed ?? installation?.dataDirectory ?? "";
  if (!isAbsolute(dataDirectory)) {
    throw new Error("--data-directory must give a full path. Only an installed command has a default.");
  }
  if (installation?.real !== true && isInRealData(dataDirectory, repository)) {
    throw new Error(
      "This copy of claude-plans never uses the real data. Use the claude-plans command that a plain install saved, " +
        "or give a separate data directory.",
    );
  }
  return dataDirectory;
}
