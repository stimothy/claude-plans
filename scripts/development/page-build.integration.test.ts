import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { build } from "vite";
import { expect, it, onTestFinished } from "vitest";

const page = resolve(import.meta.dirname, "..", "..", "packages", "frontend");

// The tests of the palettes read the page's CSS as it is written, so what ships must be the same.
it("builds the page with its palettes as they are written", async () => {
  const built = mkdtempSync(join(tmpdir(), "claude-plans-page-"));
  onTestFinished(() => {
    rmSync(built, { recursive: true, force: true });
  });

  await build({ configFile: join(page, "vite.config.ts"), logLevel: "silent", build: { outDir: built } });

  const styles = readdirSync(join(built, "assets"))
    .filter((name) => name.endsWith(".css"))
    .map((name) => readFileSync(join(built, "assets", name), "utf8"))
    .join("");
  expect(styles).toContain("light-dark(");
  expect(styles).not.toContain("lightningcss");
});
