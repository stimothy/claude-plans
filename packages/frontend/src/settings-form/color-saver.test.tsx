import { type ColorSettings, type ColorSettingsUpdate, defaultColorSettings } from "@claude-plans/domain";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { readColors, showColors } from "../colors/document-colors.ts";
import { colorSaver } from "./color-saver.ts";

let root = document.createElement("html");

beforeEach(() => {
  root = document.createElement("html");
  showColors(root, defaultColorSettings);
});

// Saves that finish only when a test says how.
function heldSaves() {
  const held: { update: ColorSettingsUpdate; answer: PromiseWithResolvers<ColorSettings> }[] = [];
  const save = vi.fn((update: ColorSettingsUpdate) => {
    const answer = Promise.withResolvers<ColorSettings>();
    held.push({ update, answer });
    return answer.promise;
  });
  // A save is sent only once the one before it has finished.
  const sent = (index: number) => vi.waitUntil(() => held[index]);
  const failed = vi.fn();
  return { save, sent, failed, choose: colorSaver(root, save, failed) };
}

const dark = { theme: "dark", colorVision: "default" } as const;

describe("saving a choice of colors", () => {
  it("shows the choice at once, and then what was saved", async () => {
    const { choose, save, sent, failed } = heldSaves();

    const finished = choose({ theme: "dark" });
    const atOnce = readColors(root);
    (await sent(0)).answer.resolve({ theme: "dark", colorVision: "tritan" });
    await finished;

    expect(atOnce).toEqual(dark);
    expect(readColors(root)).toEqual({ theme: "dark", colorVision: "tritan" });
    expect(save).toHaveBeenCalledWith({ theme: "dark" });
    expect(failed).toHaveBeenLastCalledWith(false);
  });

  it("goes back to the saved colors, and says so, when saving fails", async () => {
    const { choose, sent, failed } = heldSaves();

    const finished = choose({ theme: "dark" });
    (await sent(0)).answer.reject(new Error("The server is not running."));
    await finished;

    expect(readColors(root)).toEqual(defaultColorSettings);
    expect(failed).toHaveBeenLastCalledWith(true);
  });

  // Saves that overtook each other could leave an earlier choice saved.
  it("sends one save at a time, and keeps showing the choices not yet saved", async () => {
    const { choose, save, sent } = heldSaves();

    const first = choose({ theme: "dark" });
    const second = choose({ theme: "light" });
    const early = await sent(0);
    const sentBeforeTheFirstFinished = save.mock.calls.length;
    early.answer.resolve(dark);
    await first;
    const between = readColors(root);
    (await sent(1)).answer.resolve({ theme: "light", colorVision: "default" });
    await second;

    expect(sentBeforeTheFirstFinished).toBe(1);
    expect(between.theme).toBe("light");
    expect(readColors(root).theme).toBe("light");
  });

  it("undoes only the choice that could not be saved", async () => {
    const { choose, sent } = heldSaves();

    const first = choose({ theme: "dark" });
    const second = choose({ colorVision: "protan" });
    (await sent(0)).answer.reject(new Error("The server is not running."));
    await first;
    const between = readColors(root);
    (await sent(1)).answer.resolve({ theme: "system", colorVision: "protan" });
    await second;

    expect(between).toEqual({ theme: "system", colorVision: "protan" });
    expect(readColors(root)).toEqual({ theme: "system", colorVision: "protan" });
  });
});
