/**
 * Saves a choice of colors through the server that sent the page.
 *
 * @packageDocumentation
 */
import { settingsContract } from "@claude-plans/domain";

import type { SaveColors } from "./color-saver.ts";

// A server on this computer answers at once, unless something is wrong with it.
const patience = 10_000;

/** Saves a change to the color settings, and returns all of them. */
export const saveColors: SaveColors = async (update) => {
  const answer = await fetch(settingsContract.path, {
    method: settingsContract.update.method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(update),
    signal: AbortSignal.timeout(patience),
  });
  if (!answer.ok) {
    throw new Error(`The server did not save the colors. It answered ${String(answer.status)}.`);
  }
  return settingsContract.update.response.parse(await answer.json());
};
