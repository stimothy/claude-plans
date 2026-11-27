/**
 * Gives each database test a directory of its own.
 *
 * @packageDocumentation
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach } from "vitest";

/** Makes a new temporary directory for each test, removes it afterward, and returns how to get its path. */
export function useTestDirectory(): () => string {
  let directory = "";
  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "claude-plans-database-"));
  });
  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });
  return () => directory;
}
