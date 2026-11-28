/**
 * Shows each choice of colors at once, and saves the choices in the order they were made.
 *
 * @packageDocumentation
 */
import type { ColorSettings, ColorSettingsUpdate } from "@claude-plans/domain";

import { readColors, showColors } from "../colors/document-colors.ts";

/** Saves a change to the color settings, and returns all of them. */
export type SaveColors = (update: ColorSettingsUpdate) => Promise<ColorSettings>;

/**
 * Returns the function that takes a choice of colors for an html element. It reports whether the latest save
 * failed, and its promise settles once the choice is saved or undone. The element shows what is saved, with the
 * choices still being saved applied to it.
 */
export function colorSaver(
  root: HTMLElement,
  save: SaveColors,
  report: (failed: boolean) => void,
): (update: ColorSettingsUpdate) => Promise<void> {
  const waiting = new Set<ColorSettingsUpdate>();
  let saved = readColors(root);
  let last = Promise.resolve();
  const show = (): void => {
    showColors(root, Object.assign({}, saved, ...waiting) as ColorSettings);
  };
  const send = async (update: ColorSettingsUpdate): Promise<void> => {
    try {
      saved = await save(update);
    } catch (error) {
      // The page's errors stay in the browser's console.
      console.error(error);
      report(true);
    }
    waiting.delete(update);
    show();
  };
  return (update) => {
    // With nothing waiting, the element shows what is saved.
    if (waiting.size === 0) {
      saved = readColors(root);
    }
    const choice = { ...update };
    waiting.add(choice);
    report(false);
    show();
    last = last.then(() => send(choice));
    return last;
  };
}
