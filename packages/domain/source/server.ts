/**
 * How a client finds a running server, makes sure that it is the right one, and stops it.
 *
 * @packageDocumentation
 */
import { z } from "zod";

/** The name of the file in the data directory where a running server records how to reach it. */
export const serverRecordFileName = "server.json";

/** Checks what a running server records. */
export const serverRecordSchema = z.object({
  /** The port that the server listens on. */
  port: z.int().min(1).max(65_535),
  /** The secret that a request to shut down must give. It changes each time the server starts. */
  token: z.string().min(1),
});

/** How to reach a running server. */
export type ServerRecord = z.infer<typeof serverRecordSchema>;

/** The API that says which server answered, so that a client can tell it is the one it meant to reach. */
export const serverContract = {
  path: "/api/server",
  read: { method: "GET", response: z.object({ dataDirectory: z.string().min(1) }) },
} as const;

/** The API that shuts the server down. It needs the header "Authorization: Bearer" with the record's token. */
export const shutdownContract = {
  path: "/api/shutdown",
  request: { method: "POST" },
} as const;
