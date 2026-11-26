import { z } from "zod";

/** Checks a theme. With "system", the web page follows the operating system. */
export const themeSchema = z.enum(["system", "light", "dark"]);

/** Checks a color vision choice. */
export const colorVisionSchema = z.enum(["default", "protan", "deutan", "tritan"]);

/** Checks the settings that choose the web page's colors. */
export const colorSettingsSchema = z.object({ theme: themeSchema, colorVision: colorVisionSchema });

/** The settings that choose the web page's colors. */
export type ColorSettings = z.infer<typeof colorSettingsSchema>;

/** The colors that apply until the user chooses others. */
export const defaultColorSettings: Readonly<ColorSettings> = { theme: "system", colorVision: "default" };

// A misspelled or unknown setting is an error, so that it is not silently dropped.
const colorSettingsUpdateSchema = z
  .strictObject({ theme: themeSchema.exactOptional(), colorVision: colorVisionSchema.exactOptional() })
  .refine((update) => Object.keys(update).length > 0, "Give at least one setting to change.");

/** A change to one or more of the color settings. */
export type ColorSettingsUpdate = z.infer<typeof colorSettingsUpdateSchema>;

/** The API that reads and changes the color settings. An update answers with all of them. */
export const settingsContract = {
  path: "/api/settings",
  read: { method: "GET", response: colorSettingsSchema },
  update: { method: "PATCH", request: colorSettingsUpdateSchema, response: colorSettingsSchema },
} as const;
