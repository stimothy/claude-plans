import "./palettes.css";

import { type ColorSettings, colorVisionSchema } from "@claude-plans/domain";
import { afterAll, describe, expect, it } from "vitest";

import { showColors } from "./document-colors.ts";

const root = document.documentElement;
const backgrounds = ["background", "surface"] as const;
// What WCAG AA asks of text, and of the edges and marks that show where a control is and what it holds.
const needed = { text: 4.5, "muted-text": 4.5, accent: 4.5, danger: 4.5, border: 3 } as const;

const palettes: readonly ColorSettings[] = (["light", "dark"] as const).flatMap((theme) =>
  colorVisionSchema.options.map((colorVision) => ({ theme, colorVision })),
);

// The browser turns each variable into the color that it shows.
function shown(name: string): string {
  const probe = document.body.appendChild(document.createElement("div"));
  probe.style.color = `var(--color-${name})`;
  const { color } = getComputedStyle(probe);
  probe.remove();
  return color;
}

// How bright a color looks, as WCAG defines it.
function luminance(color: string): number {
  expect(color).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
  const [red = 0, green = 0, blue = 0] = [...color.matchAll(/\d+/g)].map((part) => {
    const share = Number(part[0]) / 255;
    return share <= 0.040_45 ? share / 12.92 : ((share + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(first: string, second: string): number {
  const [darker = 0, lighter = 0] = [luminance(first), luminance(second)].sort((one, other) => one - other);
  return (lighter + 0.05) / (darker + 0.05);
}

afterAll(() => {
  root.removeAttribute("data-theme");
  root.removeAttribute("data-color-vision");
});

describe("the palettes", () => {
  it.each(palettes)("meet WCAG AA contrast in the $theme theme for $colorVision color vision", (colors) => {
    showColors(root, colors);

    const tooFaint = Object.entries(needed).flatMap(([name, least]) =>
      backgrounds
        .map((background) => ({ name, background, ratio: contrast(shown(name), shown(background)) }))
        .filter(({ ratio }) => ratio < least),
    );

    expect(tooFaint).toEqual([]);
  });

  it("are eight different ones", () => {
    const seen = palettes.map((colors) => {
      showColors(root, colors);
      return [...backgrounds, ...Object.keys(needed)].map(shown).join(" ");
    });

    expect(new Set(seen).size).toBe(8);
  });

  it.each([
    ["system", "light dark"],
    ["light", "light"],
    ["dark", "dark"],
  ] as const)("let the %s theme use the color scheme %s", (theme, scheme) => {
    showColors(root, { theme, colorVision: "default" });

    expect(getComputedStyle(root).colorScheme).toBe(scheme);
  });

  // Before the server's colors reach it, and in development without a server, the page has no attributes.
  it("follow the operating system when the page names no theme", () => {
    root.removeAttribute("data-theme");

    expect(getComputedStyle(root).colorScheme).toBe("light dark");
  });

  it("color the whole page", () => {
    showColors(root, { theme: "dark", colorVision: "default" });

    expect(getComputedStyle(document.body).backgroundColor).toBe(shown("background"));
    expect(getComputedStyle(document.body).color).toBe(shown("text"));
  });
});
