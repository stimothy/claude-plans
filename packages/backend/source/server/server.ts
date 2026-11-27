/**
 * Starts and stops the server for one data directory.
 *
 * @packageDocumentation
 */
import { randomBytes } from "node:crypto";
import { mkdirSync, realpathSync } from "node:fs";

import type { Logger } from "@claude-plans/logging";
import type { FastifyInstance } from "fastify";

import { createApplication } from "./application.ts";
import { lockDataDirectory } from "./instance-lock.ts";
import { removeServerRecord, writeServerRecord } from "./server-record.ts";

// Only programs on this computer can reach this address.
const localAddress = "127.0.0.1";
const tokenBytes = 32;

/** What to serve, and where. */
export interface ServerStartOptions {
  readonly dataDirectory: string;
  /** The application's version, which the health report gives. */
  readonly version: string;
  /** The port to listen on, or 0 for any free port. */
  readonly port: number;
  readonly log: Logger;
}

/** A server that is listening. */
export interface RunningServer {
  readonly address: string;
  readonly port: number;
  /** Settles when the server has stopped, whether by close or by a request to shut down. */
  readonly closed: Promise<void>;
  /** Stops the server. Calling it again changes nothing. */
  readonly close: () => Promise<void>;
}

async function listen(application: FastifyInstance, port: number): Promise<{ address: string; port: number }> {
  try {
    await application.listen({ host: localAddress, port });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EADDRINUSE") {
      throw new Error(`Port ${String(port)} is already in use.`, { cause: error });
    }
    throw error;
  }
  const bound = application.server.address();
  // A string would be the path of a pipe, which the server never listens on.
  if (bound === null || typeof bound === "string") {
    throw new Error("The server is not listening.");
  }
  return bound;
}

// Makes the function that stops the server, and the promise that settles when it has.
function stopping(stop: () => Promise<void>): Pick<RunningServer, "close" | "closed"> {
  let finish: (result: Promise<void>) => void = () => undefined;
  const closed = new Promise<void>((resolve) => {
    finish = resolve;
  });
  let started = false;
  const close = (): Promise<void> => {
    if (!started) {
      started = true;
      finish(stop());
    }
    return closed;
  };
  return { close, closed };
}

// Runs while this program holds the lock on the data directory.
async function serve(options: ServerStartOptions, release: () => void): Promise<RunningServer> {
  const { dataDirectory, version, log } = options;
  // A server that crashed may have left its record, which no longer leads to a server.
  removeServerRecord(dataDirectory);
  const token = randomBytes(tokenBytes).toString("hex");
  let shutDown = (): void => undefined;
  const application = createApplication({
    dataDirectory,
    version,
    token,
    log,
    shutDown: () => {
      shutDown();
    },
  });
  const lifecycle = stopping(async () => {
    try {
      await application.close();
      removeServerRecord(dataDirectory);
      log.info("The server stopped");
    } finally {
      release();
    }
  });
  shutDown = () => {
    lifecycle.close().catch((error: unknown) => {
      log.error("The server did not stop cleanly", error);
    });
  };
  try {
    const bound = await listen(application, options.port);
    writeServerRecord(dataDirectory, { port: bound.port, token });
    log.info(`The server is listening on port ${String(bound.port)}`);
    return { ...bound, ...lifecycle };
  } catch (error) {
    await application.close();
    throw error;
  }
}

/**
 * Starts the server, which only this computer can reach. It fails if a server is already running on the data
 * directory, or if the port is taken. It creates the data directory, but never the database. A failure to start
 * is logged.
 */
export async function startServer(options: ServerStartOptions): Promise<RunningServer> {
  try {
    mkdirSync(options.dataDirectory, { recursive: true });
    // Following links gives a directory one name, however it was reached.
    const dataDirectory = realpathSync(options.dataDirectory);
    const release = lockDataDirectory(dataDirectory);
    try {
      return await serve({ ...options, dataDirectory }, release);
    } catch (error) {
      release();
      throw error;
    }
  } catch (error) {
    options.log.error("The server did not start", error);
    throw error;
  }
}
