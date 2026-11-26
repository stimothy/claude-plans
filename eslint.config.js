import { join } from "node:path";

import eslint from "@eslint/js";
import prettier from "eslint-config-prettier";
import jsdoc from "eslint-plugin-jsdoc";
import tsdoc from "eslint-plugin-tsdoc";
import { defineConfig, includeIgnoreFile } from "eslint/config";
import tseslint from "typescript-eslint";

const exportRestriction = {
  selector: "ExportNamedDeclaration[source=null] > ExportSpecifier",
  message: "Put export on the declaration itself, so that its TSDoc comment can be checked.",
};

const skipMessage = "Tests may not be skipped or run alone.";
// A test function may be reached through others, as in "it.concurrent" or "test.concurrent.each(cases)".
const testCall = [
  "callee",
  "callee.object",
  "callee.object.object",
  "callee.callee.object",
  "callee.callee.object.object",
]
  .map((path) => `[${path}.name=/^(it|test|describe|suite)$/]`)
  .join(", ");
const skipRestrictions = [
  "MemberExpression[property.name=/^(skip|skipIf|runIf|only|todo|fails|fixme)$/]",
  "MemberExpression[property.value=/^(skip|skipIf|runIf|only|todo|fails|fixme)$/]",
  "ObjectPattern > Property[key.name=/^(skip|only|todo)$/]",
  `CallExpression:matches(${testCall}) > ObjectExpression > Property[key.name=/^(skip|only|todo|fails)$/]`,
  "CallExpression[callee.name=/^(xit|xtest|xdescribe|fit|fdescribe)$/]",
].map((selector) => ({ selector, message: skipMessage }));

export default defineConfig(
  // Skip what Git ignores, as Prettier and markdownlint do.
  includeIgnoreFile(join(import.meta.dirname, ".gitignore")),
  {
    linterOptions: {
      // Inline comments cannot turn rules off.
      noInlineConfig: true,
    },
  },
  // ESLint lints these only when a configuration names them.
  { files: ["**/*.jsx"], languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } } },
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      complexity: ["error", 10],
      "max-depth": ["error", 3],
      "max-params": ["error", 4],
      "no-warning-comments": [
        "error",
        {
          location: "anywhere",
          terms: [
            "eslint-disable",
            "eslint-enable",
            "@ts-ignore",
            "@ts-expect-error",
            "@ts-nocheck",
            "prettier-ignore",
            "v8 ignore",
            "c8 ignore",
            "istanbul ignore",
            "node:coverage ignore",
            "jscpd:ignore",
            "gitleaks:allow",
          ],
        },
      ],
    },
  },
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { jsdoc, tsdoc },
    rules: {
      "jsdoc/require-jsdoc": [
        "error",
        {
          publicOnly: true,
          require: {
            ArrowFunctionExpression: true,
            ClassDeclaration: true,
            FunctionDeclaration: true,
            FunctionExpression: true,
            MethodDefinition: true,
          },
          contexts: [
            "ExportDefaultDeclaration > Identifier",
            "ExportDefaultDeclaration > ObjectExpression",
            "ExportNamedDeclaration > VariableDeclaration",
            "TSDeclareFunction",
            "TSEnumDeclaration",
            "TSInterfaceDeclaration",
            "TSTypeAliasDeclaration",
          ],
          enableFixer: false,
        },
      ],
      "no-restricted-syntax": ["error", exportRestriction],
      "tsdoc/syntax": "error",
    },
  },
  {
    files: ["**/*.{test,spec}.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"],
    // This replaces the earlier list, so it repeats the export restriction.
    rules: { "no-restricted-syntax": ["error", exportRestriction, ...skipRestrictions] },
  },
  prettier,
);
