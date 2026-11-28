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
 * Returns the function that takes a choice of colors for an html element. Its promise settles once the choice is
 * saved or undone. The element shows what is saved, with the choices still being saved applied to it. The report
 * is whether a choice has been undone that no later one has replaced: it ends with the next choice, or when a
 * choice already waiting saves the same setting.
 */
export function colorSaver(
  root: HTMLElement,
  save: SaveColors,
  report: (failed: boolean) => void,
): (update: ColorSettingsUpdate) => Promise<void> {
  const waiting = new Set<ColorSettingsUpdate>();
  // The settings whose latest save failed.
  const undone = new Set<string>();
  let saved: ColorSettings;
  let last = Promise.resolve();
  const show = (): void => {
    showColors(root, Object.assign({}, saved, ...waiting) as ColorSettings);
  };
  const send = async (update: ColorSettingsUpdate): Promise<void> => {
    const names = Object.keys(update);
    try {
      saved = await save(update);
      names.forEach((name) => undone.delete(name));
    } catch (error) {
      // The page's errors stay in the browser's console.
      console.error(error);
      names.forEach((name) => undone.add(name));
    }
    report(undone.size > 0);
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
    undone.clear();
    report(false);
    show();
    last = last.then(() => send(choice));
    return last;
  };
}
