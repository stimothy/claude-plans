/**
 * How Storybook shows each story: with the page's colors, in the theme and color vision that its toolbar chooses.
 *
 * @packageDocumentation
 */
import "../src/colors/palettes.css";

import { colorSettingsSchema, colorVisionSchema, defaultColorSettings, themeSchema } from "@claude-plans/domain";

import { showColors } from "../src/colors/document-colors.ts";

const menu = (title: string, items: readonly string[]) => ({
  description: title,
  toolbar: { title, items: [...items], dynamicTitle: true },
});

// Storybook's own React types do not pass this project's strict type check, so this does not import them.
const preview = {
  globalTypes: {
    theme: menu("Theme", themeSchema.options),
    colorVision: menu("Color vision", colorVisionSchema.options),
  },
  initialGlobals: { ...defaultColorSettings },
  decorators: [
    <Result>(story: () => Result, { globals }: { readonly globals: Readonly<Record<string, unknown>> }): Result => {
      showColors(document.documentElement, colorSettingsSchema.parse(globals));
      return story();
    },
  ],
};

/** What applies to every story. */
export default preview;
