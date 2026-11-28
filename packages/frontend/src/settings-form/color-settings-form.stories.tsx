/**
 * The color settings in Storybook, whose play functions are also their component tests.
 *
 * @packageDocumentation
 */
import type { ColorSettings, ColorSettingsUpdate } from "@claude-plans/domain";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { readColors, showColors } from "../colors/document-colors.ts";
import { ColorSettingsForm } from "./color-settings-form.tsx";

interface Story {
  readonly canvasElement: HTMLElement;
  readonly args: { readonly save: (update: ColorSettingsUpdate) => Promise<ColorSettings> };
}

const root = document.documentElement;
const chosen = (canvas: HTMLElement, name: string) => within(canvas).getByRole("radio", { name });

/** The component that these stories show. Nothing is saved: each story stands in for the server. */
export default {
  component: ColorSettingsForm,
  // Like the server, the stand-in answers with the earlier choices too, which the document shows.
  args: { save: fn((update: ColorSettingsUpdate) => Promise.resolve({ ...readColors(root), ...update })) },
};

/** Choosing a theme and a color vision. */
export const Choosing = {
  /** Checks that each choice shows at once and is saved. */
  play: async ({ canvasElement, args }: Story) => {
    const form = within(canvasElement);

    await userEvent.click(chosen(canvasElement, "Dark"));
    await userEvent.click(chosen(canvasElement, "Tritan"));

    await expect(chosen(canvasElement, "Dark")).toBeChecked();
    await expect(chosen(canvasElement, "Tritan")).toBeChecked();
    await expect(root).toHaveAttribute("data-theme", "dark");
    await expect(root).toHaveAttribute("data-color-vision", "tritan");
    await waitFor(() => expect(args.save).toHaveBeenLastCalledWith({ colorVision: "tritan" }));
    await expect(form.queryByRole("alert")).toBeNull();
    // In some browsers, pressing Enter on a choice inside a form would send the form and reload the page.
    await expect(chosen(canvasElement, "Dark")).toHaveProperty("form", null);
  },
};

/** What shows when a choice cannot be saved. */
export const NotSaved = {
  args: { save: fn(() => Promise.reject(new Error("The server is not running."))) },
  /** Checks that the choice is undone, and that the page says so. */
  play: async ({ canvasElement }: Story) => {
    const form = within(canvasElement);
    const before = root.getAttribute("data-theme");

    await userEvent.click(chosen(canvasElement, "Light"));

    await expect(await form.findByRole("alert")).toHaveTextContent("could not be saved");
    await expect(chosen(canvasElement, "Light")).not.toBeChecked();
    await expect(root).toHaveAttribute("data-theme", before);
  },
};

/** The choices follow the colors that the document names, such as those that Storybook's toolbar chooses. */
export const NamedByTheDocument = {
  /** Checks that a change made outside the form shows in it. */
  play: async ({ canvasElement }: Story) => {
    showColors(root, { theme: "light", colorVision: "deutan" });

    await waitFor(() => expect(chosen(canvasElement, "Deutan")).toBeChecked());
    await expect(chosen(canvasElement, "Light")).toBeChecked();
  },
};
