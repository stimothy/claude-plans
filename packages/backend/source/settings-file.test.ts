import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ColorSettingsUpdate } from "@claude-plans/domain";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readSettings, saveColorSettings } from "./settings-file.ts";

let directory = "";

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "claude-plans-settings-"));
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

function write(text: string): void {
  writeFileSync(join(directory, "settings.yaml"), text);
}

function saved(): string {
  return readFileSync(join(directory, "settings.yaml"), "utf8");
}

const defaults = { colors: { theme: "system", colorVision: "default" } };

describe("reading the settings", () => {
  it.each(["", "# Nothing is set yet.\n", "---\n", "---\n# Nothing is set yet.\n"])(
    "gives the defaults for a file holding %j, which can then be saved to",
    (text) => {
      write(text);

      expect(readSettings(directory)).toEqual(defaults);
      saveColorSettings(directory, { theme: "light" });
      expect(readSettings(directory).colors.theme).toBe("light");
      expect(saved().includes("# Nothing")).toBe(text.includes("# Nothing"));
    },
  );

  it("gives the defaults, and creates nothing, when there is no file", () => {
    expect(readSettings(join(directory, "absent"))).toEqual(defaults);
    expect(readdirSync(directory)).toEqual([]);
  });

  it("gives what the file sets", () => {
    write("port: 5000\nlogLevel: debug\ntheme: dark\ncolorVision: protan\n");

    expect(readSettings(directory)).toEqual({
      port: 5000,
      logLevel: "debug",
      colors: { theme: "dark", colorVision: "protan" },
    });
  });

  it("fills in the color setting that the file leaves out", () => {
    write("colorVision: tritan\n");

    expect(readSettings(directory).colors).toEqual({ theme: "system", colorVision: "tritan" });
  });

  it.each([
    ["theme: sepia\n", "theme"],
    ["colorVision: mono\n", "colorVision"],
    ["logLevel: loud\n", "logLevel"],
    ["port: 0\n", "port"],
    ["port: 65536\n", "port"],
    ["port: 80.5\n", "port"],
    ['port: "5000"\n', "port"],
    ["logLevl: debug\n", "logLevl"],
    ["- dark\n", "expected object"],
    ["null\n", "expected object"],
    ["theme: [dark\n", "end with a ]"],
    ["theme: dark\ntheme: light\n", "unique"],
  ])("rejects %j, naming the file and the problem", (text, problem) => {
    write(text);

    expect(() => readSettings(directory)).toThrow(join(directory, "settings.yaml"));
    expect(() => readSettings(directory)).toThrow(problem);
  });

  it("does not take a file that cannot be read for a missing one", () => {
    // A directory where the file belongs cannot be read as a file on any system.
    mkdirSync(join(directory, "settings.yaml"));

    expect(() => readSettings(directory)).toThrow(/EISDIR/);
  });
});

describe("saving the color settings", () => {
  it("creates the data directory and the file", () => {
    const nested = join(directory, "not", "yet");

    saveColorSettings(nested, { theme: "light" });

    expect(readSettings(nested).colors).toEqual({ theme: "light", colorVision: "default" });
    expect(readdirSync(nested)).toEqual(["settings.yaml"]);
  });

  it.each<[ColorSettingsUpdate, object]>([
    [{ colorVision: "deutan" }, { theme: "dark", colorVision: "deutan" }],
    [
      { theme: "light", colorVision: "protan" },
      { theme: "light", colorVision: "protan" },
    ],
  ])("saves %j and answers with all of the color settings", (update, colors) => {
    write("theme: dark\n");

    expect(saveColorSettings(directory, update)).toEqual(colors);
    expect(readSettings(directory).colors).toEqual(colors);
  });

  it("leaves the file whole when the new one cannot be written", () => {
    write("theme: dark\n");
    // A directory where the new file belongs cannot be written to as a file on any system.
    mkdirSync(join(directory, "settings.yaml.new"));

    expect(() => saveColorSettings(directory, { theme: "light" })).toThrow(/EISDIR/);
    expect(saved()).toBe("theme: dark\n");
  });

  it("keeps the overrides and comments that are in the file", () => {
    write("# My settings\nport: 5000 # not the usual one\ntheme: dark\nlogLevel: warn\n");

    saveColorSettings(directory, { theme: "light" });

    expect(saved()).toBe("# My settings\nport: 5000 # not the usual one\ntheme: light\nlogLevel: warn\n");
  });

  it("keeps the comment in a file that sets nothing", () => {
    write("# My settings\n");

    saveColorSettings(directory, { theme: "light" });

    expect(saved()).toContain("# My settings");
    expect(readSettings(directory).colors.theme).toBe("light");
  });

  it.each([{}, { theme: "sepia" }, { port: 80 }])("refuses %j and leaves the file as it was", (update) => {
    write("theme: dark\n");

    expect(() => saveColorSettings(directory, update as ColorSettingsUpdate)).toThrow();
    expect(saved()).toBe("theme: dark\n");
  });

  it("does not overwrite a file that it cannot understand", () => {
    write("theme: sepia\n");

    expect(() => saveColorSettings(directory, { theme: "light" })).toThrow("theme");
    expect(saved()).toBe("theme: sepia\n");
  });
});
