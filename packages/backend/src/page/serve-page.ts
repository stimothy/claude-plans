/**
 * Serves the web page that building the application made.
 *
 * @packageDocumentation
 */
import { existsSync } from "node:fs";
import { join } from "node:path";

import fastifyStatic from "@fastify/static";
import type { FastifyInstance } from "fastify";

// The install command of an earlier version builds no page, so installing again can be what an installed copy needs.
const notBuilt =
  "The web page has not been built. For an installed copy, run claude-plans install again. In a copy of the " +
  "repository, run npm run build:page. Then start the server again.";

/**
 * Serves the files in the built page's directory, with index.html at the top address. The repository's own copy
 * may not have built the page, so that address then says how to.
 */
export function servePage(application: FastifyInstance, pageDirectory: string): void {
  if (existsSync(join(pageDirectory, "index.html"))) {
    // A failure to register stops the server from listening, so it is reported there.
    void application.register(fastifyStatic, { root: pageDirectory });
    return;
  }
  application.get("/", (_, reply) => reply.code(503).send({ message: notBuilt }));
}
