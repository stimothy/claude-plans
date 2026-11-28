import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { healthContract } from "@claude-plans/domain";
import { describe, expect, it } from "vitest";

import { useTestServers } from "../server/test-servers.ts";

const servers = useTestServers();

// Stands in for what building the page makes, beside a file that must never be served.
function buildPage(): void {
  mkdirSync(join(servers.page(), "assets"), { recursive: true });
  writeFileSync(join(servers.page(), "index.html"), "<!doctype html><title>the page</title>");
  writeFileSync(join(servers.page(), "assets", "page.js"), "// the code");
  writeFileSync(join(servers.page(), "..", "outside.txt"), "not for serving");
}

async function read(port: number, path: string): Promise<{ status: number; type: string; body: string }> {
  const answer = await fetch(`http://127.0.0.1:${String(port)}${path}`);
  return { status: answer.status, type: answer.headers.get("content-type") ?? "", body: await answer.text() };
}

describe("the built page", () => {
  it.each([
    ["/", "text/html", "the page"],
    ["/assets/page.js", "javascript", "the code"],
  ])("is served at %s", async (path, type, text) => {
    buildPage();
    const { port } = await servers.start();

    const answer = await read(port, path);

    expect(answer.status).toBe(200);
    expect(answer.type).toContain(type);
    expect(answer.body).toContain(text);
  });

  it("leaves the APIs as they are", async () => {
    buildPage();
    const { port } = await servers.start();

    const answer = await read(port, healthContract.path);

    expect(JSON.parse(answer.body)).toMatchObject({ version: "1.2.3" });
  });

  it.each(["/../outside.txt", "/%2e%2e/outside.txt", "/..%2foutside.txt", "/assets/..%2f..%2foutside.txt"])(
    "gives nothing from outside its directory for %s",
    async (path) => {
      buildPage();
      const { port } = await servers.start();

      const answer = await servers.send(port, "GET", path);

      expect(answer.status).toBeGreaterThanOrEqual(400);
      expect(JSON.stringify(answer.body)).not.toContain("not for serving");
    },
  );

  it("is refused to a request that names another website", async () => {
    buildPage();
    const { port } = await servers.start();

    const answer = await servers.send(port, "GET", "/", { origin: "https://example.com" });

    expect(answer.status).toBe(403);
  });

  it("is said to be missing, with how to make it, when it has not been built", async () => {
    const { port } = await servers.start();

    const answer = await servers.send(port, "GET", "/");

    expect(answer).toEqual({
      status: 503,
      body: { message: "The web page has not been built. Run npm run build:page, then start the server again." },
    });
  });
});
