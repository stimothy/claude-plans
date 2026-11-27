/**
 * Checks the data directory that a program is given.
 *
 * @packageDocumentation
 */
import { isAbsolute } from "node:path";

/** Returns the data directory that was given, or refuses it if it is not a full path. */
export function requireFullPath(dataDirectory = ""): string {
  // A relative path would be taken from the current directory, which could be the one with the real data.
  if (!isAbsolute(dataDirectory)) {
    throw new Error("--data-directory must give a full path.");
  }
  return dataDirectory;
}
