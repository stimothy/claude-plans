import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { execute, plan } from "./launch.ts";

const surroundings = {
  root: "/repository",
  platform: "linux" as const,
  environment: {},
  probe: (command: readonly string[]) => (command[0] === "python3.12" ? "3 12" : undefined),
  exists: () => true,
};

describe("plan", () => {
  it("creates the environment with a suitable interpreter", () => {
    const planned = plan(["setup"], surroundings);

    expect(planned).toEqual({ command: ["python3.12", "-m", "scripts.environment.create"] });
  });

  it.each([
    ["linux" as const, join("/repository", ".venv", "bin", "python")],
    ["darwin" as const, join("/repository", ".venv", "bin", "python")],
    ["win32" as const, join("/repository", ".venv", "Scripts", "python.exe")],
  ])("runs the environment's Python on %s", (platform, python) => {
    const planned = plan(["python", "-m", "ruff"], { ...surroundings, platform });

    expect(planned).toEqual({ command: [python, "-m", "ruff"] });
  });

  it("asks for setup when the environment is missing", () => {
    const planning = () => plan(["python", "-m", "ruff"], { ...surroundings, exists: () => false });

    expect(planning).toThrow("Run `npm run setup:python` first.");
  });

  it("applies a time limit to a Node.js command", () => {
    const planned = plan(["node", "--time-limit", "30", "tool.js"], surroundings);

    expect(planned).toEqual({ command: [process.execPath, "tool.js"], timeLimitSeconds: 30 });
  });

  it.each([["0"], ["-1"], ["soon"], [undefined]])("rejects the time limit %s", (limit) => {
    const argumentList = ["node", "--time-limit", ...(limit === undefined ? [] : [limit])];

    const planning = () => plan(argumentList, surroundings);

    expect(planning).toThrow("--time-limit needs a number of seconds above zero.");
  });

  it("rejects an unknown mode", () => {
    const planning = () => plan(["ruby"], surroundings);

    expect(planning).toThrow("Usage:");
  });
});

describe("execute", () => {
  const run = (script: string, timeLimitSeconds?: number) =>
    execute({ command: [process.execPath, "-e", script], ...(timeLimitSeconds && { timeLimitSeconds }) }, ".");

  it("returns the exit code of the command", () => {
    const status = run("process.exit(3)");

    expect(status).toBe(3);
  });

  it("fails a command that exceeds its time limit", () => {
    const report = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const status = run("setTimeout(() => {}, 10_000)", 0.2);

    expect(status).toBe(1);
    expect(report).toHaveBeenCalledWith("The command exceeded its time limit of 0.2 seconds.");
    report.mockRestore();
  });

  it("reports a command that cannot start", () => {
    const report = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const status = execute({ command: ["claude-plans-missing-command"] }, ".");

    expect(status).toBe(1);
    expect(report).toHaveBeenCalledWith(expect.stringContaining("claude-plans-missing-command"));
    report.mockRestore();
  });
});
