import { defaultColorSettings } from "@claude-plans/domain";
import { describe, expect, it } from "vitest";

import { readColors } from "./document-colors.ts";

describe("the colors that an html element names", () => {
  // As in development when the server does not give the saved colors.
  it.each([
    ["names none", {}],
    ["names only a theme", { "data-theme": "dark" }],
    ["names an unknown one", { "data-theme": "sepia", "data-color-vision": "protan" }],
  ])("are the defaults when it %s", (_, attributes: Record<string, string>) => {
    const root = document.createElement("html");
    for (const [name, value] of Object.entries(attributes)) {
      root.setAttribute(name, value);
    }

    expect(readColors(root)).toEqual(defaultColorSettings);
  });
});
