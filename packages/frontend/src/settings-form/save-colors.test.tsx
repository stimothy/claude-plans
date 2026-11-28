import { defaultColorSettings } from "@claude-plans/domain";
import { afterEach, describe, expect, it, vi } from "vitest";

import { saveColors } from "./save-colors.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

const answer = (status: number, body: unknown) =>
  vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(body, { status }));

describe("saving colors through the server", () => {
  it("sends the change, and returns all of the settings", async () => {
    const sent = answer(200, { theme: "dark", colorVision: "protan" });

    const saved = await saveColors({ theme: "dark" });

    expect(saved).toEqual({ theme: "dark", colorVision: "protan" });
    expect(sent).toHaveBeenCalledWith("/api/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: '{"theme":"dark"}',
      signal: expect.any(AbortSignal) as AbortSignal,
    });
  });

  // Later choices wait for this one, so it cannot wait for an answer without end.
  it("gives up on a server that does not answer", async () => {
    // A limit that has already run out ends the request as soon as it is made.
    const over = AbortSignal.abort(new Error("The wait is over."));
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(over);

    await expect(saveColors({ theme: "dark" })).rejects.toThrow("The wait is over.");

    expect(timeout).toHaveBeenCalledWith(10_000);
  });

  it("fails when the server refuses the change", async () => {
    answer(500, defaultColorSettings);

    await expect(saveColors({ theme: "dark" })).rejects.toThrow("500");
  });

  it("fails when the answer is not the settings", async () => {
    answer(200, { theme: "dark" });

    await expect(saveColors({ theme: "dark" })).rejects.toThrow("colorVision");
  });
});
