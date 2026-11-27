import { join } from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import { lintCode, loadLinter, root } from "../linting/lint-code.ts";

beforeAll(loadLinter, 30_000);

// Returns what the boundary rule says about code in a file. A parse error counts, so that none passes unnoticed.
async function complaints(code: string, file: string): Promise<string[]> {
  const messages = await lintCode(code, file);
  return messages
    .filter((message) => message.fatal === true || message.ruleId === "boundaries/imports")
    .map((message) => message.message);
}

function importing(name: string): string {
  return `import "${name}";\n`;
}

describe("the import boundaries", () => {
  it.each([
    ["backend", "domain"],
    ["backend", "logging"],
    ["cli", "domain"],
    ["cli", "logging"],
    ["frontend", "domain"],
    ["domain", "domain"],
  ])("let %s import %s", async (from, to) => {
    await expect(complaints(importing(`@claude-plans/${to}`), `packages/${from}/source/a.ts`)).resolves.toEqual([]);
  });

  it.each([
    ["backend", "cli"],
    ["backend", "frontend"],
    ["cli", "backend"],
    ["cli", "frontend"],
    ["frontend", "backend"],
    ["frontend", "cli"],
    ["frontend", "logging"],
    ["domain", "backend"],
    ["domain", "cli"],
    ["domain", "frontend"],
    ["domain", "logging"],
    ["logging", "backend"],
    ["logging", "domain"],
    ["logging", "cli"],
    ["logging", "frontend"],
    // A package that the rule does not know may import nothing, and nothing may import it.
    ["other", "domain"],
    ["backend", "other"],
  ])("do not let %s import %s", async (from, to) => {
    await expect(complaints(importing(`@claude-plans/${to}/part`), `packages/${from}/source/a.ts`)).resolves.toEqual([
      `The ${from} package may not import the ${to} package.`,
    ]);
  });

  it.each([
    'export * from "@claude-plans/cli";',
    'export { start } from "@claude-plans/cli";',
    'import type { Start } from "@claude-plans/cli";',
    'await import("@claude-plans/cli");',
    "await import(`@claude-plans/cli`);",
    'export type Start = import("@claude-plans/cli").Start;',
    'import cli = require("@claude-plans/cli");',
    'require("@claude-plans/cli");',
  ])("cover %s", async (code) => {
    await expect(complaints(`${code}\n`, "packages/backend/source/a.ts")).resolves.toEqual([
      "The backend package may not import the cli package.",
    ]);
  });

  it.each(["await import(name);", "require(`@claude-plans/${name}`);"])(
    "reject %s, which cannot be checked",
    async (code) => {
      await expect(complaints(`${code}\n`, "packages/backend/source/a.ts")).resolves.toEqual([
        "Write the module's name as plain text, so that package boundaries can be checked.",
      ]);
    },
  );

  it.each([
    "../../cli/source/start.ts",
    "./../../cli/source/start.ts",
    "../../domain/source/index.ts",
    "../../../scripts/report.ts",
    "../node_modules/@claude-plans/cli",
    "..",
    join(root, "packages/cli/source/start.ts"),
    `file://${root}/packages/cli/source/start.ts`,
  ])("do not let a path reach %s", async (path) => {
    const found = await complaints(importing(path.replaceAll("\\", "/")), "packages/backend/a.ts");

    expect(found).toEqual(["A path may not leave its own package. Import another package by its name."]);
  });

  it.each(["./start.ts", "../package.json", "zod", "node:fs", "@types/node", "@claude-plans-other/cli"])(
    "leave %s alone",
    async (name) => {
      await expect(complaints(importing(name), "packages/backend/source/a.ts")).resolves.toEqual([]);
    },
  );

  it("cover JavaScript files", async () => {
    await expect(complaints(importing("@claude-plans/cli"), "packages/frontend/vite.config.js")).resolves.toEqual([
      "The frontend package may not import the cli package.",
    ]);
  });

  it("do not apply outside the packages", async () => {
    await expect(complaints(importing("../packages/cli/source/a.ts"), "scripts/a.ts")).resolves.toEqual([]);
  });
});
