/**
 * Lints code with the repository's own settings, for the tests of the lint rules.
 *
 * @packageDocumentation
 */
import { join } from "node:path";

import { ESLint, type Linter } from "eslint";
import tseslint from "typescript-eslint";

/** The repository's top-level directory. */
export const root = join(import.meta.dirname, "..", "..");

// Type information is not needed for the rules under test, and loading it is slow.
const eslint = new ESLint({ cwd: root, overrideConfig: tseslint.configs.disableTypeChecked });

/**
 * Loads the linter, which takes seconds on a busy machine. A test file does this once in its setup, so that no one
 * test is timed for it.
 */
export async function loadLinter(): Promise<void> {
  await eslint.lintText("", { filePath: join(root, "scripts", "a.ts") });
}

/** Returns what the linters say about code as if it were in a file, which need not exist. */
export async function lintCode(code: string, file: string): Promise<Linter.LintMessage[]> {
  const results = await eslint.lintText(code, { filePath: join(root, file) });
  return results.flatMap((result) => result.messages);
}
