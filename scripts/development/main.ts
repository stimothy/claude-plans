/**
 * What npm run dev runs. It uses development data of its own in this copy of the repository, never the real data.
 *
 * @packageDocumentation
 */
import { resolve } from "node:path";

import { developmentData, runUntilStopped, startDevelopment } from "./development.ts";

const repository = resolve(import.meta.dirname, "..", "..");
const dataDirectory = developmentData(repository);

try {
  const development = await startDevelopment({ repository, dataDirectory });
  const stopped = runUntilStopped(development, process);
  console.log(`The page is at ${development.url}, with data in ${dataDirectory}. Press Ctrl+C to stop.`);
  await stopped;
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
