/**
 * Saves a choice of colors through the server that sent the page.
 *
 * @packageDocumentation
 */
import { settingsContract } from "@claude-plans/domain";

import type { SaveColors } from "./color-saver.ts";

/** Saves a change to the color settings, and returns all of them. */
export const saveColors: SaveColors = async (update) => {
  const answer = await fetch(settingsContract.path, {
    method: settingsContract.update.method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(update),
  });
  if (!answer.ok) {
    throw new Error(`The server did not save the colors. It answered ${String(answer.status)}.`);
  }
  return settingsContract.update.response.parse(await answer.json());
};
