/**
 * What npm run dev runs. It uses development data of its own in this copy of the repository, never the real data.
 *
 * @packageDocumentation
 */
import { join, resolve } from "node:path";

import { startDevelopment } from "./development.ts";

const repository = resolve(import.meta.dirname, "..", "..");
const dataDirectory = join(repository, ".claude-plans-development");

try {
  const development = await startDevelopment({ repository, dataDirectory });
  // A closing terminal sends SIGHUP.
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
    process.on(signal, () => {
      void development.stop();
    });
  }
  console.log(`The page is at ${development.url}, with data in ${dataDirectory}. Press Ctrl+C to stop.`);
  // The server also stops when asked to through its API, which stops the page too.
  await development.ended;
  await development.stop();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
