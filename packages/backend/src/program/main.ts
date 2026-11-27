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

const manifest = join(import.meta.dirname, "..", "..", "..", "..", "package.json");
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
  report,
  onStopRequest: (stop) => {
    // A closing terminal sends SIGHUP.
    for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
      process.on(signal, stop);
    }
  },
});
