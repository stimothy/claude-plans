/**
 * Reads the settings file in the data directory, and saves the color settings in it.
 *
 * @packageDocumentation
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  type ColorSettings,
  type ColorSettingsUpdate,
  colorVisionSchema,
  defaultColorSettings,
  portSchema,
  settingsContract,
  themeSchema,
} from "@claude-plans/domain";
import { type Document, isScalar, parseDocument } from "yaml";
import { z } from "zod";

import { logLevelSchema, type ServerOverrides } from "./server-settings.ts";

// A misspelled setting is an error, so that it is not silently ignored.
const fileSchema = z.strictObject({
  port: portSchema.optional(),
  logLevel: logLevelSchema.optional(),
  theme: themeSchema.default(defaultColorSettings.theme),
  colorVision: colorVisionSchema.default(defaultColorSettings.colorVision),
});

/** What the settings file says, with the default for each color setting that it leaves out. */
export interface Settings extends ServerOverrides {
  readonly colors: ColorSettings;
}

interface SettingsDocument {
  readonly document: Document;
  readonly settings: Settings;
}

function location(directory: string): string {
  return join(directory, "settings.yaml");
}

function readText(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return "";
    }
    throw error;
  }
}

function parse(text: string): Document {
  const document: Document = parseDocument(text);
  const [broken] = document.errors;
  if (broken !== undefined) {
    throw broken;
  }
  // After a "---" line with no value, the parser gives an empty value, which no setting could be added to.
  // An empty string has no source text either, so the value must also be null, not a string.
  if (isScalar(document.contents) && document.contents.value === null && document.contents.source === "") {
    document.comment = document.contents.comment ?? null;
    document.contents = null;
  }
  return document;
}

// Turns the text of a settings file into the settings, or explains what is wrong with it.
function understand(text: string): SettingsDocument {
  const document = parse(text);
  const content: unknown = document.contents === null ? {} : document.toJS();
  const { theme, colorVision, ...overrides } = fileSchema.parse(content);
  return { document, settings: { ...overrides, colors: { theme, colorVision } } };
}

function load(path: string): SettingsDocument {
  const text = readText(path);
  try {
    return understand(text);
  } catch (error) {
    const problem = error instanceof z.ZodError ? z.prettifyError(error) : String(error);
    throw new Error(`The settings file ${path} is not valid:\n${problem}`, { cause: error });
  }
}

/** Reads the settings in a data directory. A directory without a settings file has the default settings. */
export function readSettings(directory: string): Settings {
  return load(location(directory)).settings;
}

/**
 * Saves a change to the color settings, keeping everything else in the file, and returns all of them. It creates
 * the data directory and the file if needed. A file that is not valid is left as it is.
 */
export function saveColorSettings(directory: string, update: ColorSettingsUpdate): ColorSettings {
  const changes = settingsContract.update.request.parse(update);
  const path = location(directory);
  const { document, settings } = load(path);
  for (const [name, value] of Object.entries(changes)) {
    document.set(name, value);
  }
  mkdirSync(directory, { recursive: true });
  // Writing a new file and then renaming it means that a failure never leaves half of a file.
  writeFileSync(`${path}.new`, document.toString());
  renameSync(`${path}.new`, path);
  return { ...settings.colors, ...changes };
}
