import { defaultColorSettings } from "@claude-plans/domain";
import { afterAll, expect, it, vi } from "vitest";

afterAll(() => {
  vi.restoreAllMocks();
});

it("shows the page in the document, with its palettes, and saves choices through the server", async () => {
  document.documentElement.setAttribute("data-theme", "dark");
  const asked = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(Response.json({ ...defaultColorSettings, theme: "light" }));

  await import("./main.tsx");
  await vi.waitFor(() => {
    expect(document.querySelector("h1")?.textContent).toBe("Hello, world");
  });
  const background = getComputedStyle(document.body).backgroundColor;
  document.querySelector<HTMLInputElement>('input[value="light"]')?.click();

  expect(background).toBe("rgb(18, 20, 23)");
  await vi.waitFor(() => {
    expect(asked).toHaveBeenCalledWith("/api/settings", expect.objectContaining({ method: "PATCH" }));
  });
});
