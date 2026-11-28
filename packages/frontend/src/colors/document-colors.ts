/**
 * The colors that the document shows, which the attributes on its html element name. The server adds them before
 * it sends the page, so they are right before any of the page's code runs.
 *
 * @packageDocumentation
 */
import { type ColorSettings, colorAttributes, colorSettingsSchema, defaultColorSettings } from "@claude-plans/domain";

/** Returns the colors that an html element names, or the defaults if it does not name them. */
export function readColors(root: HTMLElement): ColorSettings {
  const named = { theme: root.dataset["theme"], colorVision: root.dataset["colorVision"] };
  return colorSettingsSchema.safeParse(named).data ?? defaultColorSettings;
}

/** Makes an html element name the colors to show. */
export function showColors(root: HTMLElement, colors: ColorSettings): void {
  for (const [name, value] of Object.entries(colorAttributes(colors))) {
    root.setAttribute(name, value);
  }
}

/** Calls back after each change to an html element's colors, until the returned function is called. */
export function watchColors(root: HTMLElement, changed: () => void): () => void {
  const observer = new MutationObserver(changed);
  observer.observe(root, { attributeFilter: Object.keys(colorAttributes(defaultColorSettings)) });
  return () => {
    observer.disconnect();
  };
}
