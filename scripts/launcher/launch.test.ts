import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

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

  it.each([["0"], ["-1"], ["soon"], ["Infinity"], [undefined]])("rejects the time limit %s", (limit) => {
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

  it("stops a command that ignores termination when its time limit passes", () => {
    const report = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const started = Date.now();

    const status = run("process.on('SIGTERM', () => {}); setTimeout(() => {}, 10_000)", 1.001);

    expect(status).toBe(1);
    expect(Date.now() - started).toBeLessThan(5000);
    expect(report).toHaveBeenCalledWith("The command exceeded its time limit of 1.001 seconds.");
    report.mockRestore();
  });

  it("fails when a signal ends the command, and names it where the system reports it", () => {
    const report = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const status = run("process.kill(process.pid, 'SIGKILL')", 30);

    expect(status).toBe(1);
    // Windows ends the command with an exit code and reports no signal.
    const messages = process.platform === "win32" ? [] : [["The command was ended by SIGKILL."]];
    expect(report.mock.calls).toEqual(messages);
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

describe("the launcher program", () => {
  const launch = (...argumentList: string[]) =>
    spawnSync(process.execPath, [resolve(import.meta.dirname, "launch.ts"), ...argumentList], {
      cwd: tmpdir(),
      encoding: "utf8",
    });

  it("runs commands at the repository root and passes on their exit code", () => {
    const result = launch("node", "-e", "console.log(process.cwd()); process.exit(3)");

    expect(result.stdout.trim()).toBe(resolve(import.meta.dirname, "../.."));
    expect(result.status).toBe(3);
  });

  it("fails and explains a usage error", () => {
    const result = launch("ruby");

    expect(result.stderr).toContain("Usage:");
    expect(result.status).toBe(1);
  });
});
