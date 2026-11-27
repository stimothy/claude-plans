/**
 * How a client starts a server, finds a running one, makes sure that it is the right one, and stops it.
 *
 * @packageDocumentation
 */
import { z } from "zod";

/** Checks a port number that a server can listen on. */
export const portSchema = z.int().min(1).max(65_535);

/**
 * Checks what a server program tells whoever started it, once it is listening or has failed to start. It is sent
 * on the channel that Node.js gives a child process.
 */
export const serverStartReportSchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("listening"), port: portSchema }),
  z.object({ state: z.literal("failed"), message: z.string() }),
]);

/** Whether a server program started. */
export type ServerStartReport = z.infer<typeof serverStartReportSchema>;

/** The name of the file in the data directory where a running server records how to reach it. */
export const serverRecordFileName = "server.json";

/** Checks what a running server records. */
export const serverRecordSchema = z.object({
  /** The port that the server listens on. */
  port: portSchema,
  /** The secret that a request to shut down must give. It changes each time the server starts. */
  token: z.string().min(1),
});

/** How to reach a running server. */
export type ServerRecord = z.infer<typeof serverRecordSchema>;

/**
 * The API that says which server answered, so that a client can tell it is the one it meant to reach. It names the
 * data directory as Node.js's realpathSync.native does, which a client must also use before comparing.
 */
export const serverContract = {
  path: "/api/server",
  read: { method: "GET", response: z.object({ dataDirectory: z.string().min(1) }) },
} as const;

/** The API that shuts the server down. It needs the header "Authorization: Bearer" with the record's token. */
export const shutdownContract = {
  path: "/api/shutdown",
  shutDown: { method: "POST" },
} as const;
