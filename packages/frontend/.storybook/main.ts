/**
 * Storybook's settings, for previewing and testing the page's components.
 *
 * @packageDocumentation
 */
import { servedFiles } from "../vite.config.ts";

interface ViteSettings {
  readonly server?: { readonly fs?: object };
}

/** Storybook allows its server more files than the page's own settings do, so the list is set again after it. */
const viteFinal = (settings: ViteSettings) => ({
  ...settings,
  server: { ...settings.server, fs: { ...settings.server?.fs, allow: [...servedFiles] } },
});

// Storybook's own React types do not pass this project's strict type check, so this does not import them.
const configuration = {
  viteFinal,
  framework: "@storybook/react-vite",
  stories: ["../src/**/*.stories.tsx"],
  addons: ["@storybook/addon-vitest"],
  // Storybook would otherwise send usage reports.
  core: { disableTelemetry: true },
};

/** Where the stories are, and what shows and tests them. */
export default configuration;
