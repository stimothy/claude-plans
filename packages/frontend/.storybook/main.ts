/**
 * Storybook's settings, for previewing and testing the page's components.
 *
 * @packageDocumentation
 */
// Storybook's own React types do not pass this project's strict type check, so this does not import them.
const configuration = {
  framework: "@storybook/react-vite",
  stories: ["../src/**/*.stories.tsx"],
  addons: ["@storybook/addon-vitest"],
  // Storybook would otherwise send usage reports.
  core: { disableTelemetry: true },
};

/** Where the stories are, and what shows and tests them. */
export default configuration;
