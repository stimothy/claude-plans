import { EventEmitter, once } from "node:events";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { request } from "node:http";
import { type AddressInfo, createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";

import { migrate } from "../../packages/backend/src/database/migrate.ts";
import { type Development, developmentData, runUntilStopped, startDevelopment } from "./development.ts";

const repository = resolve(import.meta.dirname, "..", "..");
let temporary = "";
let running: Development | undefined;

beforeEach(() => {
  temporary = mkdtempSync(join(tmpdir(), "claude-plans-development-"));
});
afterEach(async () => {
  await running?.stop();
  running = undefined;
  rmSync(temporary, { recursive: true, force: true });
});

// The repository's own development data is left alone.
const data = (): string => join(temporary, "data");

async function start(): Promise<Development> {
  running = await startDevelopment({ repository, dataDirectory: data() });
  return running;
}

// Unlike fetch, this can send any Host header.
function statusOf(url: string, headers: Record<string, string>): Promise<number | undefined> {
  return new Promise((resolvePromise, reject) => {
    const sent = request(url, { headers, agent: false }, (response) => {
      response.resume();
      resolvePromise(response.statusCode);
    });
    sent.on("error", reject);
    sent.end();
  });
}

describe("development", () => {
  it("serves the page's source, and passes its API requests to a server on the development data", async () => {
    const development = await start();

    const page = await fetch(development.url);
    const health = await fetch(`${development.url}/api/health`);

    // Only this computer may reach the page, whose requests reach the server's APIs.
    expect(new URL(development.url).hostname).toBe("127.0.0.1");
    expect(await page.text()).toContain("/src/main.tsx");
    expect(await health.json()).toMatchObject({ status: "ok" });
    expect(existsSync(join(data(), "server.json"))).toBe(true);
  });

  // A browser names the page that is asking, which here is Vite's and not the server's own.
  it("accepts a request that its own page makes", async () => {
    const { url } = await start();

    await expect(statusOf(`${url}/api/health`, { origin: url })).resolves.toBe(200);
  });

  it.each([
    ["another website", { origin: "https://example.com" }],
    ["another program on this computer", { origin: "http://127.0.0.1:1" }],
    ["a page without an origin of its own", { origin: "null" }],
    ["a website whose name was made to point here", { host: "example.com", origin: "http://example.com" }],
  ])("refuses a request from %s", async (_, headers: Record<string, string>) => {
    const { url } = await start();

    await expect(statusOf(`${url}/api/health`, headers)).resolves.toBe(403);
  });

  it("stops both servers", async () => {
    const development = await start();

    await development.stop();

    await expect(fetch(development.url)).rejects.toThrow();
    expect(existsSync(join(data(), "server.json"))).toBe(false);
    await expect(development.ended).resolves.toBeUndefined();
  });

  it("says why the server did not start", async () => {
    mkdirSync(data());
    writeFileSync(join(data(), "settings.yaml"), "logLevel: loud\n");

    await expect(start()).rejects.toThrow("logLevel");
  });

  it("says why the database could not be prepared", async () => {
    migrate(data(), [{ version: 1, name: "from a later version", apply: () => undefined }]);

    await expect(start()).rejects.toThrow("newer than version 0");
  });

  it("stops the server when the page cannot start", async () => {
    // A directory without the page has no settings for Vite.
    const starting = startDevelopment({ repository: temporary, dataDirectory: data() });

    await expect(starting).rejects.toThrow("vite.config.ts");
    expect(existsSync(join(data(), "server.json"))).toBe(false);
  });

  // The real server's port comes from its settings, so a port from the development settings must not be used either.
  it("gives its server a free port, whatever the settings say", async () => {
    // The port stays taken, so that the system cannot give it out as a free one.
    const holder = createServer().listen(0, "127.0.0.1");
    await once(holder, "listening");
    onTestFinished(() => {
      holder.close();
    });
    const { port: chosen } = holder.address() as AddressInfo;
    mkdirSync(data());
    writeFileSync(join(data(), "settings.yaml"), `port: ${String(chosen)}\n`);

    await start();

    const record = JSON.parse(readFileSync(join(data(), "server.json"), "utf8")) as { port: number };
    expect(record.port).not.toBe(chosen);
  });

  // The page's server could otherwise read out the real data in the maintainer's own copy.
  it.each(["package.json", "packages/backend/src/server/server.ts"])(
    "gives out no file of the repository that the page does not use, such as %s",
    async (file) => {
      const { url } = await start();

      const answer = await fetch(`${url}/@fs${pathToFileURL(join(repository, file)).pathname}`);

      expect(answer.status).toBe(403);
    },
  );

  it("gives out the packages that the page uses", async () => {
    const { url } = await start();

    const source = await (await fetch(`${url}/src/main.tsx`)).text();
    const used = [...source.matchAll(/from "(\/[^"]+)"/g)].map((match) => match[1] ?? "");
    const answers = await Promise.all(used.map(async (path) => (await fetch(`${url}${path}`)).status));

    expect(used.length).toBeGreaterThan(1);
    expect(answers).toEqual(used.map(() => 200));
  });
});

describe("running development until it is stopped", () => {
  it("keeps its data apart from the real data", () => {
    expect(developmentData(repository)).toBe(join(repository, ".claude-plans-development"));
  });

  // Vite adds a listener of its own, which ends the program without waiting for the server to stop.
  it.each(["SIGINT", "SIGTERM", "SIGHUP"])("stops both servers on %s, and nothing else answers it", async (signal) => {
    const development = await start();
    const signals = new EventEmitter();
    const other = vi.fn();
    signals.on(signal, other);
    const finished = runUntilStopped(development, signals);

    signals.emit(signal);

    await finished;
    await expect(fetch(development.url)).rejects.toThrow();
    expect(other).not.toHaveBeenCalled();
  });

  it("stops the page when the server is asked to stop through its API", async () => {
    const development = await start();
    const finished = runUntilStopped(development, new EventEmitter());
    const record = JSON.parse(readFileSync(join(data(), "server.json"), "utf8")) as { port: number; token: string };

    await fetch(`http://127.0.0.1:${String(record.port)}/api/shutdown`, {
      method: "POST",
      headers: { authorization: `Bearer ${record.token}` },
    });

    await finished;
    await expect(fetch(development.url)).rejects.toThrow();
  });

  it("stops the page when the server cannot stop cleanly", async () => {
    const stop = vi.fn(() => Promise.resolve());
    const failed = Promise.reject(new Error("The record could not be removed."));
    const broken = { url: "", ended: failed, stop };

    await expect(runUntilStopped(broken, new EventEmitter())).rejects.toThrow("record");

    expect(stop).toHaveBeenCalled();
  });
});
