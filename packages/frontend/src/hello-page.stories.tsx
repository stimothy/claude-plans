/**
 * The hello world page in Storybook, whose play function is also its component test.
 *
 * @packageDocumentation
 */
import type { ColorSettingsUpdate } from "@claude-plans/domain";
import { expect, within } from "storybook/test";

import { readColors } from "./colors/document-colors.ts";
import { HelloPage } from "./hello-page.tsx";

// Storybook's own React types do not pass this project's strict type check, so the stories do not import them.
/** The component that these stories show. Nothing is saved: the stories stand in for the server. */
export default {
  component: HelloPage,
  args: {
    /** Answers as the server does, with the choices that the document shows and the new one. */
    save: (update: ColorSettingsUpdate) => Promise.resolve({ ...readColors(document.documentElement), ...update }),
  },
};

/** The page as it first appears. */
export const Hello = {
  /** Checks what the page says. */
  play: async ({ canvasElement }: { readonly canvasElement: HTMLElement }) => {
    const page = within(canvasElement);

    await expect(page.getByRole("heading", { level: 1 })).toHaveTextContent("Hello, world");
    await expect(page.getByRole("main")).toHaveTextContent("claude-plans");
    await expect(page.getByRole("group", { name: "Theme" })).toBeVisible();
    await expect(page.getByRole("group", { name: "Color vision" })).toBeVisible();
  },
};

/** The page as Storybook's toolbar shows it, here in one of the eight palettes. */
export const ChosenInTheToolbar = {
  globals: { theme: "dark", colorVision: "tritan" },
  /** Checks that the toolbar's choice reaches the document and the page. */
  play: async ({ canvasElement }: { readonly canvasElement: HTMLElement }) => {
    const page = within(canvasElement);

    await expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    await expect(document.documentElement).toHaveAttribute("data-color-vision", "tritan");
    await expect(page.getByRole("radio", { name: "Tritan" })).toBeChecked();
  },
};
