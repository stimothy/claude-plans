import { join } from "node:path";

import eslint from "@eslint/js";
import prettier from "eslint-config-prettier";
import jsdoc from "eslint-plugin-jsdoc";
import tsdoc from "eslint-plugin-tsdoc";
import { defineConfig, includeIgnoreFile } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  // Skip what Git ignores, as Prettier and markdownlint do.
  includeIgnoreFile(join(import.meta.dirname, ".gitignore")),
  {
    linterOptions: {
      // Inline comments cannot turn rules off.
      noInlineConfig: true,
    },
  },
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
      "no-restricted-syntax": [
        "error",
        {
          selector: "ExportNamedDeclaration[source=null] > ExportSpecifier",
          message: "Put export on the declaration itself, so that its TSDoc comment can be checked.",
        },
      ],
      "tsdoc/syntax": "error",
    },
  },
  prettier,
);
