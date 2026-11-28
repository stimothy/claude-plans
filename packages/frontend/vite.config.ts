/**
 * Vite's settings, which build the page and serve it during development.
 *
 * @packageDocumentation
 */
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/** The page's directory holds index.html, and a build goes into dist beside it. */
export default defineConfig({
  root: import.meta.dirname,
  plugins: [react()],
});
