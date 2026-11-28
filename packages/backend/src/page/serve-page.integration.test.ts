import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { healthContract } from "@claude-plans/domain";
import { describe, expect, it } from "vitest";

import { useTestServers } from "../server/test-servers.ts";

const servers = useTestServers();

// Stands in for what building the page makes, beside a file that must never be served.
function buildPage(): void {
  mkdirSync(join(servers.page(), "assets"), { recursive: true });
  writeFileSync(join(servers.page(), "index.html"), '<!doctype html><html lang="en"><title>the page</title></html>');
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

  // The colors are in the page as it arrives, so no other colors can show first.
  it.each(["/", "/index.html"])("names the saved colors at %s, as they are at the time", async (path) => {
    buildPage();
    const { port } = await servers.start();
    const first = await read(port, path);
    mkdirSync(servers.directory(), { recursive: true });
    writeFileSync(join(servers.directory(), "settings.yaml"), "theme: dark\ncolorVision: protan\n");

    const second = await read(port, path);

    expect(first.body).toContain('<html data-theme="system" data-color-vision="default" lang="en">');
    expect(second.body).toContain('<html data-theme="dark" data-color-vision="protan" lang="en">');
    expect(second.type).toContain("text/html");
  });

  // A browser that kept the page would show the colors of an earlier choice first.
  it("is not to be kept by the browser", async () => {
    buildPage();
    const { port } = await servers.start();

    const answer = await fetch(`http://127.0.0.1:${String(port)}/`);

    expect(answer.headers.get("cache-control")).toBe("no-store");
  });

  it("shows in the default colors when the settings file is not valid, and says why in the log", async () => {
    buildPage();
    const { port } = await servers.start();
    mkdirSync(servers.directory(), { recursive: true });
    writeFileSync(join(servers.directory(), "settings.yaml"), "theme: sepia\n");

    const answer = await read(port, "/");

    expect(answer.status).toBe(200);
    expect(answer.body).toContain('data-theme="system" data-color-vision="default"');
    expect(servers.log.error).toHaveBeenCalledWith(expect.stringContaining("colors"), expect.any(Error));
  });

  // A browser names the page that asks for a built script or style, under whichever name it opened it.
  it.each(["127.0.0.1", "localhost"])("serves its files to its own page opened at %s", async (name) => {
    buildPage();
    const { port } = await servers.start();
    const headers = { host: `${name}:${String(port)}`, origin: `http://${name}:${String(port)}` };

    // A request that is not refused reaches the files, which have no such script.
    const answer = await servers.send(port, "GET", "/assets/missing.js", headers);

    expect(answer.status).toBe(404);
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

    expect(answer.status).toBe(503);
    // An installed copy, which an earlier version may have installed, cannot be built from the repository.
    expect(JSON.stringify(answer.body)).toMatch(/claude-plans install again.*npm run build:page.*start the server/);
  });
});
