/**
 * How the page's html element names the colors to show. Whoever sends the page adds the saved choices to it, so
 * that the right colors show from the first paint.
 *
 * @packageDocumentation
 */
import { type ColorSettings, colorSettingsSchema } from "./settings.ts";

// Where the attributes go.
const htmlTag = /<html(?=[\s>])/;

/** The attributes of the page's html element for a choice of colors. The page's styles select on them. */
export function colorAttributes({ theme, colorVision }: ColorSettings): Readonly<Record<string, string>> {
  return { "data-theme": theme, "data-color-vision": colorVision };
}

/** Returns the page's HTML with the colors that it should show. */
export function withColors(html: string, colors: ColorSettings): string {
  if (!htmlTag.test(html)) {
    throw new Error("The page has no <html> element to name its colors in.");
  }
  // Checking the choices keeps anything else out of the page.
  const attributes = Object.entries(colorAttributes(colorSettingsSchema.parse(colors)))
    .map(([name, value]) => ` ${name}="${value}"`)
    .join("");
  return html.replace(htmlTag, `<html${attributes}`);
}
