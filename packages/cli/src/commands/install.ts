/**
 * The install command, which saves a copy of the application in a data directory and gets its database ready.
 *
 * @packageDocumentation
 */
import { activateBuild, type Build, makeBuild, removeBuild, runDatabaseProgram } from "../install/build.ts";
import { isInRealData, isRealDataDirectory, requirePlainInstall } from "../install/checkout.ts";
import { commandDirectory } from "../install/layout.ts";
import { linkCommand, requireCommandIsFree } from "../install/path-command.ts";
import { Refusal } from "../install/refusal.ts";
import { findServer } from "../server/running-server.ts";
import type { Terminal } from "../terminal.ts";
import { stopServer } from "./stop.ts";

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
    runDatabaseProgram(build.directory, "migrate", dataDirectory);
    return { stoppedServer, previous: activateBuild(dataDirectory, build) };
  } catch (error) {
    if (!stoppedServer) {
      throw error;
    }
    const problem = error instanceof Error ? error.message : String(error);
    throw new Error(`${problem}\nThe server was stopped. Start it again once this is solved.`, { cause: error });
  }
}

interface Outcome extends Replaced {
  readonly version: string;
  /** Whether it was a plain install. */
  readonly plain: boolean;
}

function conclude({ version, plain, stoppedServer }: Outcome, dataDirectory: string, terminal: Terminal): void {
  const launcher = `node "${commandDirectory(dataDirectory)}/main.js"`;
  const command = plain ? "claude-plans" : launcher;
  const where = plain ? "The claude-plans command now runs this copy." : `It is in ${dataDirectory}.`;
  terminal.print(`Installed version ${version}. ${where}`);
  const next = stoppedServer ? "The server was stopped. Start it again" : "Start the server";
  terminal.print(`${next} with: ${command} start`);
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
  if (plain) {
    linkCommand(commandDirectory(options.dataDirectory));
  }
  if (replaced.previous !== undefined) {
    removeBuild(replaced.previous);
  }
  conclude({ ...replaced, version: build.version, plain }, options.dataDirectory, terminal);
  return 0;
}
