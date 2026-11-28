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
    });
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
