/**
 * The server program's entry point, which connects it to the process that it runs in.
 *
 * @packageDocumentation
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { ServerStartReport } from "@claude-plans/domain";
import { z } from "zod";

import { runServerProgram } from "./server-program.ts";

const packages = join(import.meta.dirname, "..", "..", "..");
const manifest = join(packages, "..", "package.json");
// Building the application puts the web page here. The backend may not import the frontend, so it only reads it.
const pageDirectory = join(packages, "frontend", "dist");
const { version } = z.object({ version: z.string().min(1) }).parse(JSON.parse(readFileSync(manifest, "utf8")));

function report(started: ServerStartReport): void {
  // A program that someone runs directly has no channel to report on.
  if (process.send === undefined) {
    console.error(started.state === "failed" ? started.message : `Listening on port ${String(started.port)}`);
    return;
  }
  // The channel is closed once the report is sent, so that neither program keeps the other one running. If
  // whoever started this program has gone, the report fails, and the server carries on.
  process.send(started, undefined, undefined, () => {
    if (process.connected) {
      process.disconnect();
    }
  });
}

process.exitCode = await runServerProgram({
  arguments: process.argv.slice(2),
  version,
  pageDirectory,
  report,
  onStopRequest: (stop) => {
    // A closing terminal sends SIGHUP.
    for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
      process.on(signal, stop);
    }
  },
});
