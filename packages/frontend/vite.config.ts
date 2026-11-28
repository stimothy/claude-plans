/**
 * Vite's settings, which build the page and serve it during development.
 *
 * @packageDocumentation
 */
import { join } from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * The only files that a development server gives to whoever can reach it. By default, Vite gives the whole
 * repository, which in the maintainer's own copy holds the real data.
 */
export const servedFiles: readonly string[] = [
  import.meta.dirname,
  // The one other package that the page imports, which Vite reads at its own path rather than in node_modules.
  join(import.meta.dirname, "..", "..", "node_modules"),
];

/** The page's directory holds index.html, and a build goes into dist beside it. */
export default defineConfig({
  root: import.meta.dirname,
  plugins: [react()],
  // The first versions with CSS light-dark(). For older ones, the build would replace it with other CSS, which the
  // tests of the palettes never see.
  build: { cssTarget: ["chrome123", "edge123", "firefox120", "safari17.5"] },
  server: { fs: { allow: [...servedFiles] } },
});
