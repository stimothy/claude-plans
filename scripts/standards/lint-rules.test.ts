import { join } from "node:path";

import { ESLint } from "eslint";
import tseslint from "typescript-eslint";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..", "..");

// Type information is not needed for these rules, and loading it is slow.
const eslint = new ESLint({ cwd: root, overrideConfig: tseslint.configs.disableTypeChecked });

async function brokenRules(code: string, file: string): Promise<string[]> {
  const results = await eslint.lintText(code, { filePath: join(root, "scripts", file) });
  return results
    .flatMap((result) => result.messages)
    .map((message) => message.ruleId ?? message.message)
    .filter((rule) => rule === "no-warning-comments" || rule === "no-restricted-syntax");
}

describe("the lint rules", () => {
  it.each([
    "// eslint-disable-next-line no-console",
    "/* eslint-disable */",
    "// @ts-ignore",
    "// @ts-expect-error: a reason does not make it allowed",
    "// @ts-nocheck",
    "// prettier-ignore",
    "/* v8 ignore next */",
    "/* c8 ignore next */",
    "/* istanbul ignore next */",
    "/* jscpd:ignore-start */",
    "// gitleaks:allow",
    "/* eslint-enable */",
    "/* node:coverage ignore next */",
  ])("reject the comment %s", async (comment) => {
    const code = `${comment}\nconst value = 1;\n`;

    const rules = await brokenRules(code, "tool.ts");

    expect(rules).toContain("no-warning-comments");
  });

  it.each([
    "it.skip('a', run);",
    "it.only('a', run);",
    "it.todo('a');",
    "test.fails('a', run);",
    "describe.skipIf(true)('a', run);",
    "test.runIf(false)('a', run);",
    "test.describe.only('a', run);",
    "test.fixme('a', run);",
    "it['only']('a', run);",
    "it('a', (context) => context.skip());",
    "it('a', ({ skip }) => skip());",
    "it('a', { skip: true }, run);",
    "describe('a', { only: true }, run);",
    "xit('a', run);",
    "fdescribe('a', run);",
    "fit('a', run);",
    "xtest('a', run);",
    "xdescribe('a', run);",
    "test('a', { todo: true }, run);",
    "suite('a', { fails: true }, run);",
    "it.concurrent('a', { only: true }, run);",
    "it.each([1])('a %s', { skip: true }, run);",
    "test.concurrent.each([1])('a %s', { skip: true }, run);",
    "describe.concurrent.sequential('a', { skip: true }, run);",
  ])("reject the skipped or focused test %s", async (code) => {
    const rules = await brokenRules(code, "tool.test.ts");

    expect(rules).toContain("no-restricted-syntax");
  });

  it.each(["tool.js", "tool.mjs", "tool.cjs", "tool.jsx", "tool.tsx"])("reject comments in %s", async (file) => {
    const rules = await brokenRules("// prettier-ignore\n", file);

    expect(rules).toContain("no-warning-comments");
  });

  it.each(["tool.spec.ts", "tool.test.tsx", "tool.test.js", "tool.spec.mjs"])(
    "reject a focused test in %s",
    async (file) => {
      const rules = await brokenRules("it.only('a', run);\n", file);

      expect(rules).toContain("no-restricted-syntax");
    },
  );

  it("allow other tests and comments", async () => {
    const code = "// Runs each case.\nit.each([1])('a %s', run);\nit('b', { timeout: 5 }, run);\n";

    const rules = await brokenRules(code, "tool.test.ts");

    expect(rules).toEqual([]);
  });

  it("allow a member named only outside tests", async () => {
    const rules = await brokenRules("export const value = options.only;\n", "tool.ts");

    expect(rules).toEqual([]);
  });

  it("still reject separate export lists in test files", async () => {
    const rules = await brokenRules("const value = 1;\nexport { value };\n", "tool.test.ts");

    expect(rules).toContain("no-restricted-syntax");
  });
});
