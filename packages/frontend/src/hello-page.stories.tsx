/**
 * The hello world page in Storybook, whose play function is also its component test.
 *
 * @packageDocumentation
 */
import { expect, within } from "storybook/test";

import { HelloPage } from "./hello-page.tsx";

// Storybook's own React types do not pass this project's strict type check, so the stories do not import them.
/** The component that these stories show. */
export default { component: HelloPage };

/** The page as it first appears. */
export const Hello = {
  /** Checks what the page says. */
  play: async ({ canvasElement }: { readonly canvasElement: HTMLElement }) => {
    const page = within(canvasElement);

    await expect(page.getByRole("heading", { level: 1 })).toHaveTextContent("Hello, world");
    await expect(page.getByRole("main")).toHaveTextContent("claude-plans");
  },
};
