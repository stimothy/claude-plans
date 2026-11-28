import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { defaultColorSettings, settingsContract } from "@claude-plans/domain";
import { describe, expect, it } from "vitest";

import { useTestServers } from "../server/test-servers.ts";

const servers = useTestServers();

const file = (): string => join(servers.directory(), "settings.yaml");

function saveFile(text: string): void {
  mkdirSync(servers.directory(), { recursive: true });
  writeFileSync(file(), text);
}

const address = (port: number): string => `http://127.0.0.1:${String(port)}${settingsContract.path}`;

async function change(port: number, body: string, type = "application/json"): Promise<Response> {
  const method = settingsContract.update.method;
  return fetch(address(port), { method, headers: { "content-type": type }, body });
}

describe("the color settings API", () => {
  it("gives the defaults when none are saved", async () => {
    const { port } = await servers.start();

    const answer = await fetch(address(port));

    expect(await answer.json()).toEqual(defaultColorSettings);
  });

  it("gives the saved choices, as the file says them at the time", async () => {
    const { port } = await servers.start();
    saveFile("theme: dark\ncolorVision: deutan\n");

    const answer = await fetch(address(port));

    expect(await answer.json()).toEqual({ theme: "dark", colorVision: "deutan" });
  });

  it("saves a change, keeps the rest of the file, and answers with all of the choices", async () => {
    saveFile("# my settings\nlogLevel: debug\ncolorVision: protan\n");
    const { port } = await servers.start();

    const answer = await change(port, '{"theme":"light"}');

    expect(answer.status).toBe(200);
    expect(await answer.json()).toEqual({ theme: "light", colorVision: "protan" });
    expect(readFileSync(file(), "utf8")).toBe("# my settings\nlogLevel: debug\ncolorVision: protan\ntheme: light\n");
  });

  it.each([
    ["an unknown choice", '{"theme":"sepia"}', "application/json"],
    ["another setting", '{"port":80}', "application/json"],
    ["no change", "{}", "application/json"],
    ["text that is not JSON", "theme: dark", "application/json"],
    ["a body sent as text", '{"theme":"dark"}', "text/plain"],
  ])("refuses %s, and saves nothing", async (_, body, type) => {
    saveFile("theme: system\n");
    const { port } = await servers.start();

    const answer = await change(port, body, type);

    expect(answer.status).toBe(400);
    expect(readFileSync(file(), "utf8")).toBe("theme: system\n");
  });

  it("refuses a change that another website asks for", async () => {
    const { port } = await servers.start();

    const answer = await servers.send(port, settingsContract.update.method, settingsContract.path, {
      origin: "https://example.com",
    });

    expect(answer.status).toBe(403);
  });

  it("reports a file that is not valid, and leaves it as it is", async () => {
    const { port } = await servers.start();
    saveFile("theme: sepia\n");

    const answers = [await fetch(address(port)), await change(port, '{"theme":"dark"}')];

    expect(answers.map((answer) => answer.status)).toEqual([500, 500]);
    expect(readFileSync(file(), "utf8")).toBe("theme: sepia\n");
    expect(servers.log.error).toHaveBeenCalled();
  });
});
