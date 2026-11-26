import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
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
    .filter((rule) => checked.includes(rule));
}

const checked = ["no-warning-comments", "no-restricted-syntax", "unicorn/name-replacements"];

const repeated = `export function total(values) {
  let sum = 0;
  for (const value of values) {
    sum += value > 0 ? value * 2 : -value;
  }
  return sum;
}
`;

// Returns the exit code of the duplicate check, run on the given files with the repository's settings.
function duplicateCheck(files: Record<string, string>): number | null {
  const directory = mkdtempSync(join(tmpdir(), "duplicates-"));
  try {
    for (const [name, content] of Object.entries(files)) {
      writeFileSync(join(directory, name), content);
    }
    const program = join(root, "node_modules", "jscpd", "run-jscpd.js");
    return spawnSync(process.execPath, [program, "--config", join(root, ".jscpd.json"), directory]).status;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

describe("the duplicate check", () => {
  it.each([
    ["first.ts", "second.ts"],
    ["first.test.ts", "second.test.ts"],
    ["first.mjs", "second.cjs"],
    ["first.ts", "second.tsx"],
    ["first.jsx", "second.mjs"],
  ])("rejects a copy in %s and %s", (first, second) => {
    const files = { [first]: repeated, [second]: repeated };

    const status = duplicateCheck(files);

    expect(status).toBe(1);
  });

  it("rejects a copy in Python files", () => {
    const code =
      "def total(values):\n    result = 0\n    for value in values:\n        if value > 0:\n            result += value * 2\n    print(result, values, len(values))\n    return result\n";

    const status = duplicateCheck({ "first.py": code, "second.py": code });

    expect(status).toBe(1);
  });

  it("allows files that share no block", () => {
    const files = { "first.ts": repeated, "second.ts": "export const answer = 42;\n" };

    const status = duplicateCheck(files);

    expect(status).toBe(0);
  });
});

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

  it.each([
    "const cfg = 1;",
    "function read(args) {\n  return args;\n}",
    "class MsgReader {}",
    "const maximumLen = 1;",
  ])("reject the abbreviated name in %s", async (code) => {
    const rules = await brokenRules(`${code}\n`, "tool.ts");

    expect(rules).toContain("unicorn/name-replacements");
  });

  it("allow full words and names that outside code chose", async () => {
    const code =
      "const applications = 1;\nconst configuration = { env: applications, url: 2 };\nread(configuration.env);\n";

    const rules = await brokenRules(code, "tool.ts");

    expect(rules).toEqual([]);
  });

  it("reject the same words in JavaScript and TypeScript as in other names", () => {
    const source = readFileSync(join(import.meta.dirname, "names.py"), "utf8");
    const words = [...(/WORDS = """([^"]*)"""/.exec(source)?.[1] ?? "").matchAll(/(\w+)=/g)].map((match) => match[1]);
    const rule = readFileSync(
      join(root, "node_modules/eslint-plugin-unicorn/rules/shared/name-replacements.js"),
      "utf8",
    );
    const list = rule.slice(0, rule.indexOf("defaultAllowList"));
    const defaults = [...list.matchAll(/^\t(\w+): \{/gm)].map((match) => match[1]);
    // Both full words are allowed, and splitting "stdDev" finds "dev".
    const left = ["application", "applications", "configuration", "stdDev"];

    expect(words.toSorted()).toEqual(defaults.filter((word) => !left.includes(word ?? "")).toSorted());
  });

  it("leave file names to the structure check", async () => {
    const rules = await brokenRules("const value = 1;\n", "msg-cfg.ts");

    expect(rules).toEqual([]);
  });

  it("still reject separate export lists in test files", async () => {
    const rules = await brokenRules("const value = 1;\nexport { value };\n", "tool.test.ts");

    expect(rules).toContain("no-restricted-syntax");
  });
});
