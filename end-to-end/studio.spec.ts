// The few journeys that only the whole application can show: installed, running, and used in a browser.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect } from "@playwright/test";

import { test } from "./installed-studio.ts";

const manifest = readFileSync(join(import.meta.dirname, "..", "package.json"), "utf8");
const { version } = JSON.parse(manifest) as { version: string };
const darkBackground = "rgb(18, 20, 23)";

test("the installed studio shows its page without errors, and reports that it is healthy", async ({ page, studio }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });

  await page.goto(studio.url);

  await expect(page.getByRole("heading", { name: "Hello, world" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "System" })).toBeChecked();
  expect(errors).toEqual([]);
  const health = JSON.parse(await studio.command("health", "--json")) as unknown;
  expect(health).toMatchObject({ status: "ok", version, database: { accessible: true } });
});

test("a choice of colors outlives the server, and shows from the page's first paint", async ({
  page,
  browser,
  studio,
}) => {
  await page.goto(studio.url);

  for (const name of ["Dark", "Protan"]) {
    const saved = page.waitForResponse((response) => response.request().method() === "PATCH" && response.ok());
    await page.getByRole("radio", { name }).check();
    await saved;
  }
  await studio.restart();

  // With scripts off, only what the server sent can have set the colors. The browser itself prefers light.
  const withoutScripts = await browser.newContext({ javaScriptEnabled: false, colorScheme: "light" });
  const first = await withoutScripts.newPage();
  await first.goto(studio.url);
  await expect(first.locator("html")).toHaveAttribute("data-color-vision", "protan");
  await expect(first.locator("body")).toHaveCSS("background-color", darkBackground);
  await withoutScripts.close();
  await page.reload();
  await expect(page.getByRole("radio", { name: "Dark" })).toBeChecked();
  await expect(page.getByRole("radio", { name: "Protan" })).toBeChecked();
});
