/**
 * The API that reads and changes the saved color settings.
 *
 * @packageDocumentation
 */
import { settingsContract } from "@claude-plans/domain";
import type { FastifyInstance } from "fastify";

import { readSettings, saveColorSettings } from "../settings-file.ts";

/** Adds the API for the color settings in a data directory. */
export function serveColorSettings(application: FastifyInstance, dataDirectory: string): void {
  // The file is read for each request, so that a change made to it by hand shows at once.
  application.get(settingsContract.path, () => readSettings(dataDirectory).colors);
  application.patch(settingsContract.path, async (request, reply) => {
    const update = settingsContract.update.request.safeParse(request.body);
    if (!update.success) {
      return reply.code(400).send({ message: "A change must name a theme, a color vision, or both, as they are." });
    }
    return saveColorSettings(dataDirectory, update.data);
  });
}
