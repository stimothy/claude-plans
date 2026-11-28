/**
 * Runs the studio for development: a server on development data, and Vite serving the page's source in front of
 * it, so that a change to the page shows at once. Both run in this one program, so neither can outlive it.
 *
 * @packageDocumentation
 */
import type { AddressInfo } from "node:net";
import { join } from "node:path";

import { createServer } from "vite";

import { requireCurrentDatabase } from "../../packages/backend/src/database/readiness.ts";
import { runDatabaseProgram } from "../../packages/backend/src/program/database-program.ts";
import { serverSettings } from "../../packages/backend/src/server-settings.ts";
import { type RunningServer, startServer } from "../../packages/backend/src/server/server.ts";
import { readSettings } from "../../packages/backend/src/settings-file.ts";
import { createLogger } from "../../packages/logging/src/index.ts";
import { apiProxy } from "./api-proxy.ts";

const host = "127.0.0.1";

/** Which code to run, and the data that its server uses, which must not be the real data. */
export interface DevelopmentOptions {
  readonly repository: string;
  readonly dataDirectory: string;
}

/** A development server and page that are running. */
export interface Development {
  /** The address of the page. */
  readonly url: string;
  /** Settles when the server has stopped. */
  readonly ended: Promise<void>;
  /** Stops the page and the server. */
  readonly stop: () => Promise<void>;
}

async function prepareDatabase(dataDirectory: string): Promise<void> {
  const problems: string[] = [];
  const code = await runDatabaseProgram({
    arguments: ["migrate", `--data-directory=${dataDirectory}`],
    print: (line) => {
      console.log(line);
    },
    printError: (line) => {
      problems.push(line);
    },
  });
  if (code !== 0) {
    throw new Error(problems.join("\n"));
  }
}

// The built page's directory is not used, because Vite serves the page. The version only appears in the health
// report. The server takes any free port, so that it never takes the real server's.
function startBackend({ repository, dataDirectory }: DevelopmentOptions): Promise<RunningServer> {
  const { logLevel } = serverSettings(readSettings(dataDirectory), {});
  return startServer({
    dataDirectory,
    version: "development",
    pageDirectory: join(repository, "packages", "frontend", "dist"),
    port: 0,
    log: createLogger({ dataDirectory, program: "backend", level: logLevel }),
    checkDataDirectory: requireCurrentDatabase,
  });
}

async function startPage(repository: string, serverPort: number) {
  const page = await createServer({
    configFile: join(repository, "packages", "frontend", "vite.config.ts"),
    // Vite takes the next port if its usual one is in use.
    server: { host, proxy: { "/api": apiProxy(`http://${host}:${String(serverPort)}`) } },
  });
  await page.listen();
  return page;
}

/** Prepares the development database, and starts the server and then the page. */
export async function startDevelopment(options: DevelopmentOptions): Promise<Development> {
  await prepareDatabase(options.dataDirectory);
  const server = await startBackend(options);
  try {
    const page = await startPage(options.repository, server.port);
    const { port } = page.httpServer?.address() as AddressInfo;
    const stop = async (): Promise<void> => {
      await Promise.all([page.close(), server.close()]);
    };
    return { url: `http://${host}:${String(port)}`, ended: server.closed, stop };
  } catch (error) {
    await server.close();
    throw error;
  }
}
