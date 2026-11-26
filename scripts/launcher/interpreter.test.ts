import { describe, expect, it } from "vitest";

import { findPython, probeVersion } from "./interpreter.ts";

function probeKnowing(versions: Record<string, string>) {
  return (command: readonly string[]) => versions[command.join(" ")];
}

describe("findPython", () => {
  it("skips interpreters that are older than 3.12", () => {
    const probe = probeKnowing({ python3: "3 11", python: "3 12" });

    const command = findPython({}, probe);

    expect(command).toEqual(["python"]);
  });

  it.each(["python3.14", "python3.13", "python3.12"])("prefers %s over python3", (versioned) => {
    const probe = probeKnowing({ [versioned]: "3 12", python3: "3 13" });

    const command = findPython({}, probe);

    expect(command).toEqual([versioned]);
  });

  it("falls back to the Windows launcher", () => {
    const probe = probeKnowing({ "py -3": "3 13" });

    const command = findPython({}, probe);

    expect(command).toEqual(["py", "-3"]);
  });

  it("uses only the PYTHON variable when it is set", () => {
    const probe = probeKnowing({ "/chosen/python": "3 9", "python3.12": "3 12" });

    const find = () => findPython({ PYTHON: "/chosen/python" }, probe);

    expect(find).toThrow("Python 3.12 or newer was not found. Tried: /chosen/python.");
  });

  it("explains how to choose an interpreter when none is suitable", () => {
    const find = () => findPython({}, probeKnowing({}));

    expect(find).toThrow("set the PYTHON environment variable");
  });
});

describe("probeVersion", () => {
  it("returns nothing for a command that does not exist", () => {
    const version = probeVersion(["claude-plans-missing-interpreter"]);

    expect(version).toBeUndefined();
  });

  it("returns nothing for a command that fails", () => {
    const version = probeVersion([process.execPath, "--no-such-option"]);

    expect(version).toBeUndefined();
  });

  it("asks a real Python for its major and minor version", () => {
    const python = findPython(process.env, probeVersion);

    const version = probeVersion(python);

    expect(version).toMatch(/^3 \d+$/);
  });
});
