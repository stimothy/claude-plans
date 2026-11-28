import { describe, expect, it } from "vitest";

import { colorAttributes, withColors } from "./index.ts";

describe("the attributes that choose the page's colors", () => {
  it("name the theme and the color vision", () => {
    expect(colorAttributes({ theme: "dark", colorVision: "protan" })).toEqual({
      "data-theme": "dark",
      "data-color-vision": "protan",
    });
  });
});

describe("a page given its colors", () => {
  it.each(['<html lang="en">', "<html>"])("names them in %s, and keeps the rest", (tag) => {
    const page = `<!doctype html>\n${tag}\n<body>Hello</body>\n</html>`;

    const colored = withColors(page, { theme: "light", colorVision: "tritan" });

    const named = tag.replace("<html", '<html data-theme="light" data-color-vision="tritan"');
    expect(colored).toBe(`<!doctype html>\n${named}\n<body>Hello</body>\n</html>`);
  });

  // A page served without its colors would flash the wrong ones, so the mistake must show.
  it("cannot be one without an html element", () => {
    expect(() => withColors("<body></body>", { theme: "dark", colorVision: "default" })).toThrow("<html>");
  });

  // The names go into the page as they are, so only the known choices may.
  it("takes no choice that is not one of the settings", () => {
    const forged = { theme: '"><script>', colorVision: "default" } as unknown as Parameters<typeof withColors>[1];

    expect(() => withColors("<html></html>", forged)).toThrow("theme");
  });
});
