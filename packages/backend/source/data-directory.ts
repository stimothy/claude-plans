/**
 * Chooses the directory that holds the database, settings, and logs.
 *
 * @packageDocumentation
 */
import { join, resolve } from "node:path";

/**
 * Returns the full path of the data directory: the one named by the option, or else .claude-plans in the
 * repository. The caller gives the repository, so that no code guesses where the real data is.
 */
export function dataDirectory(repository: string, option?: string): string {
  if (option === undefined) {
    return join(repository, ".claude-plans");
  }
  if (option.trim() === "") {
    throw new Error("The data directory's path is empty.");
  }
  return resolve(option);
}
