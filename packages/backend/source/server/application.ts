/**
 * The server's APIs, and what applies to every request.
 *
 * @packageDocumentation
 */
import { timingSafeEqual } from "node:crypto";

import { healthContract, serverContract, shutdownContract } from "@claude-plans/domain";
import type { Logger } from "@claude-plans/logging";
import fastify, { type FastifyInstance } from "fastify";

import { healthReport } from "../health/health-report.ts";
import { isFromThisServer } from "./request-protection.ts";

/** What the server's APIs need. */
export interface ApplicationOptions {
  /** The full path of the data directory, with any links followed. */
  readonly dataDirectory: string;
  readonly version: string;
  /** The secret that a request to shut down must give. */
  readonly token: string;
  readonly log: Logger;
  /** Called after the answer to an allowed request to shut down has been sent. */
  readonly shutDown: () => void;
}

function matches(given: string | undefined, token: string): boolean {
  const expected = Buffer.from(`Bearer ${token}`);
  const received = Buffer.from(given ?? "");
  // The comparison takes the same time wherever the two differ, so it tells nothing about the token.
  return received.length === expected.length && timingSafeEqual(received, expected);
}

// A mistake in a request keeps its status. Anything else is the server's fault.
function statusOf(error: unknown): number {
  const given = error instanceof Error && "statusCode" in error ? Number(error.statusCode) : 500;
  return given >= 400 && given < 500 ? given : 500;
}

function handleErrors(application: FastifyInstance, log: Logger): void {
  application.setErrorHandler((error, request, reply) => {
    const status = statusOf(error);
    // An error about a request can quote its body, which must not be logged.
    if (status === 500) {
      log.error(`The server could not handle ${request.method} ${request.routeOptions.url ?? "a request"}`, error);
    }
    return reply.code(status).send({ message: "The server could not handle the request." });
  });
}

/** Makes the server's application, which does not listen yet. */
export function createApplication(options: ApplicationOptions): FastifyInstance {
  const { dataDirectory, version, token, log, shutDown } = options;
  // Fastify's own logger stays off, because only the studio's logger may write. Stopping closes every connection,
  // so that one a browser leaves open cannot keep the server from stopping.
  const application = fastify({ logger: false, forceCloseConnections: true });
  handleErrors(application, log);

  application.addHook("onRequest", async (request, reply) => {
    if (!isFromThisServer(request.headers, request.socket.localPort ?? 0)) {
      return reply.code(403).send({ message: "Only this computer's own pages and commands may use the server." });
    }
    return undefined;
  });
  application.get(healthContract.path, () => healthReport(dataDirectory, version, log.error));
  application.get(serverContract.path, () => ({ dataDirectory }));
  application.post(shutdownContract.path, async (request, reply) => {
    if (!matches(request.headers.authorization, token)) {
      return reply.code(401).send({ message: "Shutting down needs the token in the server's record." });
    }
    reply.raw.once("finish", shutDown);
    return reply.code(202).send({ message: "The server is shutting down." });
  });
  return application;
}
