/**
 * Starts and stops the server for one data directory.
 *
 * @packageDocumentation
 */
import { randomBytes } from "node:crypto";
import { mkdirSync, realpathSync } from "node:fs";

import type { Logger } from "@claude-plans/logging";

import { lockDataDirectory } from "../instance-lock/instance-lock.ts";
import { listenLocally } from "../listening/listen-locally.ts";
import { createApplication } from "./application.ts";
import { removeServerRecord, writeServerRecord } from "./server-record.ts";

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

// Makes the function that stops the server, and the promise that settles when it has.
function stopping(stop: () => Promise<void>): Pick<RunningServer, "close" | "closed"> {
  const { promise: closed, resolve } = Promise.withResolvers<undefined>();
  let started = false;
  const close = async (): Promise<void> => {
    if (!started) {
      started = true;
      resolve(stop().then(() => undefined));
    }
    await closed;
  };
  return { close, closed };
}

// Runs while this program holds the lock on the data directory.
async function serve(options: ServerStartOptions, release: () => void): Promise<RunningServer> {
  const { dataDirectory, version, log } = options;
  // A server that crashed may have left its record, which no longer leads to a server.
  removeServerRecord(dataDirectory);
  const token = randomBytes(tokenBytes).toString("hex");
  // The application below exists by the time that anything can ask to stop it.
  const lifecycle = stopping(async () => {
    try {
      await application.close();
      removeServerRecord(dataDirectory);
      log.info("The server stopped");
    } finally {
      release();
    }
  });
  const shutDown = (): void => {
    lifecycle.close().catch((error: unknown) => {
      log.error("The server did not stop cleanly", error);
    });
  };
  const application = createApplication({ dataDirectory, version, token, log, shutDown });
  try {
    const { address, port } = await listenLocally(application, options.port);
    writeServerRecord(dataDirectory, { port, token });
    log.info(`The server is listening on port ${String(port)}`);
    return { address, port, ...lifecycle };
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
    // The name on disk is the same however the directory was reached, through a link or in another letter case.
    const dataDirectory = realpathSync.native(options.dataDirectory);
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
