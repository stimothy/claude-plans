/**
 * Where an installed application is kept in its data directory. Each build has a directory of its own, which never
 * moves, because npm may link packages by their full paths. One small file says which build is current, and a
 * launcher that stays in one place runs it.
 *
 * @packageDocumentation
 */
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { z } from "zod";

/** Returns the directory that holds a data directory's builds. */
export function buildsDirectory(dataDirectory: string): string {
  return join(dataDirectory, "app", "builds");
}

/** Returns the directory of the launcher, which is also the package that npm installs as the command. */
export function commandDirectory(dataDirectory: string): string {
  return join(dataDirectory, "app", "command");
}

const currentSchema = z.object({ build: z.string().min(1) });
const currentFile = (dataDirectory: string): string => join(dataDirectory, "app", "current.json");

// Reads a JSON file, or gives nothing if there is none.
function readJson(file: string): unknown {
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : undefined;
}

/** Returns the name of the current build, or nothing if nothing is installed. */
export function currentBuild(dataDirectory: string): string | undefined {
  return currentSchema.optional().parse(readJson(currentFile(dataDirectory)))?.build;
}

/** Makes a build the current one. The change happens all at once, so there is always a whole build to run. */
export function setCurrentBuild(dataDirectory: string, build: string): void {
  const unfinished = `${currentFile(dataDirectory)}.new`;
  writeFileSync(unfinished, JSON.stringify({ build }));
  renameSync(unfinished, currentFile(dataDirectory));
}

const installationSchema = z.object({ repository: z.string().min(1), real: z.boolean() });
const installationFile = (build: string): string => join(build, "installation.json");

/** What a build records when it is made. */
export type InstallationRecord = z.infer<typeof installationSchema>;

/** Records in a build where it was made from, and whether it is for the real data. */
export function recordInstallation(build: string, record: InstallationRecord): void {
  writeFileSync(installationFile(build), JSON.stringify(record));
}

/** What an installed copy of the command knows about itself. */
export interface Installation {
  /** The repository that the build was made from, which installing again builds from. */
  readonly repository: string;
  /** Whether a plain install made it. Only such a copy may use the real data. */
  readonly real: boolean;
  /** The data directory that holds the build, which the command uses unless told otherwise. */
  readonly dataDirectory: string;
}

/** Returns what is known about the installed build in this directory, or nothing if it is not one. */
export function readInstallation(directory: string): Installation | undefined {
  const record = installationSchema.optional().parse(readJson(installationFile(directory)));
  // A build is in app/builds/<name> in its data directory, wherever that directory is now.
  return record === undefined ? undefined : { ...record, dataDirectory: resolve(directory, "..", "..", "..") };
}
