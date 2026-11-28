import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { savedColors } from "./saved-colors.ts";

const page = '<html lang="en"></html>';
const colored = (): Promise<string> => savedColors("http://127.0.0.1:1").transformIndexHtml(page);

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("the saved colors in development", () => {
  it("are asked of the server and named in the page", async () => {
    const asked = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json({ theme: "dark", colorVision: "protan" }));

    await expect(colored()).resolves.toBe('<html data-theme="dark" data-color-vision="protan" lang="en"></html>');
    expect(asked).toHaveBeenCalledWith("http://127.0.0.1:1/api/settings", expect.anything());
  });

  // The page then shows the default colors.
  it.each([
    ["cannot be reached", () => Promise.reject(new TypeError("fetch failed"))],
    ["answers with an error", () => Promise.resolve(Response.json({ message: "no" }, { status: 500 }))],
    ["answers with something else", () => Promise.resolve(new Response("no"))],
  ])("are left out, with a warning, when the server %s", async (_, answer: () => Promise<Response>) => {
    vi.spyOn(globalThis, "fetch").mockImplementation(answer);

    await expect(colored()).resolves.toBe(page);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("default colors"), expect.any(Error));
  });

  it("are left out when the server has not answered within 2 seconds", async () => {
    // A limit that has already run out ends the request as soon as it is made.
    const over = new Error("The wait is over.");
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(AbortSignal.abort(over));

    await expect(colored()).resolves.toBe(page);

    expect(timeout).toHaveBeenCalledWith(2000);
    expect(console.warn).toHaveBeenCalledWith(expect.any(String), over);
  });
});
