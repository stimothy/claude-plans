/**
 * Serves the web page that building the application made, in the saved colors.
 *
 * @packageDocumentation
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { type ColorSettings, defaultColorSettings, withColors } from "@claude-plans/domain";
import type { Logger } from "@claude-plans/logging";
import fastifyStatic from "@fastify/static";
import type { FastifyInstance } from "fastify";

import { readSettings } from "../settings-file.ts";

// The install command of an earlier version builds no page, so installing again can be what an installed copy needs.
const notBuilt =
  "The web page has not been built. For an installed copy, run claude-plans install again. In a copy of the " +
  "repository, run npm run build:page. Then start the server again.";

/** What serving the page needs. */
export interface PageOptions {
  /** The directory that holds the built web page. */
  readonly pageDirectory: string;
  /** The data directory, whose settings choose the page's colors. */
  readonly dataDirectory: string;
  readonly log: Logger;
}

// The page still shows when the settings cannot be read.
function savedColors({ dataDirectory, log }: PageOptions): ColorSettings {
  try {
    return readSettings(dataDirectory).colors;
  } catch (error) {
    log.error("The page shows its default colors, because the saved colors could not be read", error);
    return defaultColorSettings;
  }
}

/**
 * Serves the files in the built page's directory, with index.html at the top address. The repository's own copy
 * may not have built the page, so that address then says how to.
 */
export function servePage(application: FastifyInstance, options: PageOptions): void {
  const index = join(options.pageDirectory, "index.html");
  if (!existsSync(index)) {
    application.get("/", (_, reply) => reply.code(503).send({ message: notBuilt }));
    return;
  }
  // A failure to register stops the server from listening, so it is reported there.
  void application.register(fastifyStatic, { root: options.pageDirectory, index: false });
  for (const path of ["/", "/index.html"]) {
    application.get(path, (_, reply) => {
      // The colors go into the page itself, so that no others can show first. A kept copy could hold old ones.
      const page = withColors(readFileSync(index, "utf8"), savedColors(options));
      return reply.header("cache-control", "no-store").type("text/html; charset=utf-8").send(page);
    });
  }
}
