import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { type Development, startDevelopment } from "./development.ts";

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
    writeFileSync(data(), "a file where the directory should be");

    await expect(start()).rejects.toThrow("data");
  });
});
