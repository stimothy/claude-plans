/**
 * The install command, which saves a copy of the application in a data directory and gets its database ready.
 *
 * @packageDocumentation
 */
import { join } from "node:path";

import { activateBuild, type Build, makeBuild, removeBuild, runDatabaseProgram } from "../install/build.ts";
import { isInRealData, isRealDataDirectory, requirePlainInstall, requireRealSpelling } from "../install/checkout.ts";
import { commandDirectory } from "../install/layout.ts";
import { linkCommand, requireCommandIsFree } from "../install/path-command.ts";
import { Refusal } from "../install/refusal.ts";
import { findServer } from "../server/running-server.ts";
import type { Terminal } from "../terminal.ts";
import { stopServer } from "./stop.ts";

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** What the install command was asked for. */
export interface InstallOptions {
  readonly dataDirectory: string;
  /** The repository that the application is built from. */
  readonly repository: string;
}

// Returns whether this is a plain install, which replaces the application that runs on the real data. It refuses
// one that is not allowed before anything is changed.
function checkProtections({ dataDirectory, repository }: InstallOptions): boolean {
  if (isRealDataDirectory(dataDirectory, repository)) {
    requirePlainInstall(repository);
    requireRealSpelling(dataDirectory, repository);
    requireCommandIsFree(commandDirectory(dataDirectory), repository);
    return true;
  }
  if (isInRealData(dataDirectory, repository)) {
    throw new Refusal(`${dataDirectory} is inside the real data directory. Nothing was changed.`);
  }
  return false;
}

interface Replaced {
  readonly stoppedServer: boolean;
  /** The directory of the build that is no longer current, if there was one. */
  readonly previous: string | undefined;
}

// Nothing that runs is changed until the new build has accepted the database. The new build becomes current only
// after the database is ready for it.
async function replace(build: Build, dataDirectory: string, terminal: Terminal): Promise<Replaced> {
  runDatabaseProgram(build.directory, "check", dataDirectory);
  const stoppedServer = (await findServer(dataDirectory)) !== undefined;
  if (stoppedServer) {
    await stopServer(dataDirectory, terminal);
  }
  try {
    runDatabaseProgram(build.directory, "migrate", dataDirectory, (report) => {
      terminal.print(report);
    });
    return { stoppedServer, previous: activateBuild(dataDirectory, build) };
  } catch (error) {
    if (!stoppedServer) {
      throw error;
    }
    throw new Error(`${message(error)}\nThe server was stopped. Start it again once this is solved.`, {
      cause: error,
    });
  }
}

interface Outcome extends Replaced {
  readonly version: string;
  /** Whether it was a plain install. */
  readonly plain: boolean;
}

// How to run an installed copy that is not on the path.
const launcherCommand = (dataDirectory: string): string => `node "${join(commandDirectory(dataDirectory), "main.js")}"`;

function conclude({ version, plain, stoppedServer }: Outcome, dataDirectory: string, terminal: Terminal): void {
  const command = plain ? "claude-plans" : launcherCommand(dataDirectory);
  const where = plain ? "The claude-plans command now runs this copy." : `It is in ${dataDirectory}.`;
  terminal.print(`Installed version ${version}. ${where}`);
  const next = stoppedServer ? "The server was stopped. Start it again" : "Start the server";
  terminal.print(`${next} with: ${command} start`);
}

// The new build is current by now, so a build that cannot be deleted only takes up space.
function removeEarlier(previous: string | undefined, terminal: Terminal): void {
  if (previous === undefined) {
    return;
  }
  try {
    removeBuild(previous);
  } catch (error) {
    terminal.printError(`Could not delete the earlier build in ${previous}. ${message(error)}`);
  }
}

// A failure here no longer undoes the install, so it has to say what state the user is left in.
function putOnPath(dataDirectory: string, { version, stoppedServer }: Outcome): void {
  try {
    linkCommand(commandDirectory(dataDirectory));
  } catch (error) {
    const launcher = launcherCommand(dataDirectory);
    const next = stoppedServer ? `\nThe server was stopped. Start it again with: ${launcher} start` : "";
    throw new Error(
      `${message(error)}\nVersion ${version} is installed, but npm could not put the claude-plans command on your ` +
        `path. Once this is solved, install again. Until then, run it with: ${launcher}${next}`,
      { cause: error },
    );
  }
}

/**
 * Installs the application in a data directory, and returns the exit code. A plain install, into the real data
 * directory, also puts the claude-plans command on the user's path.
 */
export async function installApplication(options: InstallOptions, terminal: Terminal): Promise<number> {
  const plain = checkProtections(options);
  const build = makeBuild({ repository: options.repository, real: plain }, options.dataDirectory);
  let replaced: Replaced;
  try {
    replaced = await replace(build, options.dataDirectory, terminal);
  } catch (error) {
    removeBuild(build.directory);
    throw error;
  }
  removeEarlier(replaced.previous, terminal);
  const outcome = { ...replaced, version: build.version, plain };
  if (plain) {
    putOnPath(options.dataDirectory, outcome);
  }
  conclude(outcome, options.dataDirectory, terminal);
  return 0;
}
