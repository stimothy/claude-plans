/**
 * A lint rule that keeps each package's imports pointing in the allowed direction.
 *
 * @packageDocumentation
 */
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

import type { Rule } from "eslint";

const packages = join(import.meta.dirname, "..", "..", "packages");

// The other packages that each one may import. A package that is not listed here may import none.
const allowed = new Map([
  ["backend", new Set(["domain", "logging"])],
  ["cli", new Set(["domain", "logging"])],
  ["domain", new Set<string>()],
  ["frontend", new Set(["domain"])],
  ["logging", new Set<string>()],
]);

// Where each kind of import keeps the module's name.
interface Importing {
  readonly source?: Part | null;
  readonly argument?: Part & { readonly literal?: Part };
  readonly expression?: Part;
  readonly arguments?: readonly Part[];
}

interface Part {
  readonly type: string;
  readonly value?: unknown;
  readonly expressions?: readonly unknown[];
  readonly quasis?: readonly { readonly value: { readonly cooked?: string | null } }[];
}

// Returns a module name that is written as plain text, or nothing if it is worked out while the code runs.
function plainText(part: Part): string | undefined {
  if (part.type === "TemplateLiteral") {
    return part.expressions?.length === 0 ? (part.quasis?.[0]?.value.cooked ?? undefined) : undefined;
  }
  return typeof part.value === "string" ? part.value : undefined;
}

// Returns the part of an import that names its module. An export without "from" has none.
function modulePart(node: Importing): Part | undefined {
  // An import in a type holds its name in a literal type, and older parsers call that "argument".
  const named = node.source ?? node.argument?.literal ?? node.expression ?? node.arguments?.[0];
  return named ?? undefined;
}

interface Problem {
  readonly messageId: "direction" | "outside" | "unreadable";
  readonly data?: Record<string, string>;
}

// A path may reach only the files of its own package.
function pathProblem(path: string, file: string, from: string): Problem | undefined {
  const target = relative(join(packages, from), resolve(dirname(file), path));
  const leaves = path.startsWith("file:") || isAbsolute(target) || target === ".." || target.startsWith(`..${sep}`);
  return leaves ? { messageId: "outside" } : undefined;
}

// Another of this repository's packages may be imported only in an allowed direction.
function nameProblem(name: string, from: string): Problem | undefined {
  const to = /^@claude-plans\/([^/]+)/.exec(name)?.[1];
  const permitted = to === undefined || (allowed.has(from) && (to === from || allowed.get(from)?.has(to)));
  return permitted ? undefined : { messageId: "direction", data: { from, to } };
}

// Reports what is wrong with one import in a file of a package, if anything.
function check(context: Rule.RuleContext, from: string, node: Rule.Node): void {
  const part = modulePart(node as unknown as Importing);
  if (part === undefined) {
    return;
  }
  const name = plainText(part);
  let found: Problem | undefined = { messageId: "unreadable" };
  if (name !== undefined) {
    const isPath = /^(\.{1,2}($|\/)|\/|[a-z]:|file:)/i.test(name);
    found = isPath ? pathProblem(name, context.filename, from) : nameProblem(name, from);
  }
  if (found !== undefined) {
    context.report({ node, ...found });
  }
}

// Checks every kind of syntax that can name another module.
function listeners(context: Rule.RuleContext, from: string): Rule.RuleListener {
  const listener = (node: Rule.Node): void => {
    check(context, from, node);
  };
  return {
    ImportDeclaration: listener,
    ExportNamedDeclaration: listener,
    ExportAllDeclaration: listener,
    ImportExpression: listener,
    TSImportType: listener,
    TSExternalModuleReference: listener,
    "CallExpression[callee.name='require']": listener,
  };
}

/** The lint rule that reports imports across a boundary between packages. */
export const importBoundaries: Rule.RuleModule = {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      direction: "The {{from}} package may not import the {{to}} package.",
      outside: "A path may not leave its own package. Import another package by its name.",
      unreadable: "Write the module's name as plain text, so that package boundaries can be checked.",
    },
  },
  /** Starts the rule on a file, and does nothing for a file outside the packages. */
  create(context) {
    const inside = relative(packages, context.filename).split(sep);
    const [from = ""] = inside;
    if (from === ".." || inside.length < 2) {
      return {};
    }
    return listeners(context, from);
  },
};
