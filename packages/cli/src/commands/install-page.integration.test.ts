// These tests cover how installing builds the web page.
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { builds, installed, useFakeRepository, writeInto } from "../install/fake-repository.ts";
import { recordingTerminal } from "../recording-terminal.ts";
import { installApplication } from "./install.ts";

const fake = useFakeRepository();
const data = (): string => fake.elsewhere("development");

const install = (): Promise<number> =>
  installApplication({ dataDirectory: data(), repository: fake.repository() }, recordingTerminal());

describe("installing the web page", () => {
  it("builds it from the build's own copy, not one that the repository had built", async () => {
    writeInto(fake.repository(), "packages/frontend/dist/earlier.html", "built before");
    writeInto(fake.repository(), "packages/frontend/src/main.test.tsx", "// A build leaves tests out.\n");

    await install();

    const built = join(data(), "app", "builds", installed(data()).build ?? "", "packages", "frontend");
    expect(readFileSync(join(built, "dist", "index.html"), "utf8")).toBe("the page");
    expect(existsSync(join(built, "dist", "earlier.html"))).toBe(false);
    expect(existsSync(join(built, "src", "main.test.tsx"))).toBe(false);
  });

  it("keeps the earlier application when the page cannot be built", async () => {
    await install();
    const before = installed(data()).build;
    rmSync(join(fake.repository(), "packages", "frontend", "page.html"));

    await expect(install()).rejects.toThrow("page.html");

    expect([installed(data()).build, ...builds(data())]).toEqual([before, before]);
  });
});
