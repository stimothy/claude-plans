import { describe, expect, it } from "vitest";

import { colorSettingsSchema, defaultColorSettings, settingsContract } from "./index.ts";

describe("color settings", () => {
  it("default to the system theme and the default color vision", () => {
    expect(colorSettingsSchema.parse(defaultColorSettings)).toEqual({ theme: "system", colorVision: "default" });
  });

  it.each(["system", "light", "dark"])("allow the theme %s", (theme) => {
    expect(colorSettingsSchema.safeParse({ theme, colorVision: "default" }).success).toBe(true);
  });

  it.each(["default", "protan", "deutan", "tritan"])("allow the color vision %s", (colorVision) => {
    expect(colorSettingsSchema.safeParse({ theme: "dark", colorVision }).success).toBe(true);
  });

  it.each([
    { theme: "sepia", colorVision: "default" },
    { theme: "dark", colorVision: "mono" },
    { theme: "dark" },
    { colorVision: "protan" },
  ])("reject %j", (settings) => {
    expect(colorSettingsSchema.safeParse(settings).success).toBe(false);
  });
});

describe("a settings update", () => {
  it.each([{ theme: "light" }, { colorVision: "tritan" }, { theme: "dark", colorVision: "protan" }])(
    "may change %j",
    (update) => {
      expect(settingsContract.update.request.parse(update)).toEqual(update);
    },
  );

  it.each([{}, { theme: "sepia" }, { theme: "dark", port: 80 }, { theme: undefined }])("rejects %j", (update) => {
    expect(settingsContract.update.request.safeParse(update).success).toBe(false);
  });
});
