import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { runCommandLine } from "./command-line.ts";
import { recordingTerminal } from "./recording-terminal.ts";
import { freePort, useStandInServers } from "./server/stand-in-server.ts";

const servers = useStandInServers();

async function run(...given: string[]) {
  const terminal = recordingTerminal();
  const code = await runCommandLine(given, terminal);
  return { code, output: terminal.output.join("\n"), errors: terminal.errors.join("\n") };
}

describe("the command line", () => {
  it("starts a server, reports its health, and stops it", async () => {
    const directory = `--data-directory=${servers.directory()}`;
    const port = await freePort();

    const started = await run("start", directory, "--detached", "--port", String(port), "--log-level", "debug");
    const health = await run("health", directory, "--json");
    const stopped = await run("stop", directory);

    expect(started).toMatchObject({ code: 0, errors: "" });
    // Nothing has created the database yet.
    expect(health.code).toBe(1);
    expect(JSON.parse(health.output)).toMatchObject({ status: "error", database: { accessible: false } });
    expect(stopped).toMatchObject({ code: 0, output: "The server stopped." });
  });

  it.each([[["--help"]], [["help"]], [["stop", "--help"]]])("explains itself when given %j", async (given) => {
    const result = await run(...given);

    expect(result).toMatchObject({ code: 0, errors: "" });
    expect(result.output).toContain("claude-plans health --data-directory <path> [--json]");
  });

  it.each([
    [[], "Usage:"],
    [["restart"], "Usage:"],
    [["toString"], "Usage:"],
    [["stop"], "--data-directory must give a full path"],
    [["stop", "--data-directory", ".claude-plans"], "--data-directory must give a full path"],
    [["stop", "--port", "4311"], "--port"],
    [["health", "--detached"], "--detached"],
    [["health", "extra"], "extra"],
    [["start", "--data-directory"], "--data-directory"],
  ])("refuses %j with exit code 2", async (given, problem) => {
    const result = await run(...given);

    expect(result.code).toBe(2);
    expect(result.errors).toContain(problem);
  });

  it("reports a command that fails, and logs it without the record's token", async () => {
    await servers.serve((_, response) => response.writeHead(401).end());

    const result = await run("stop", "--data-directory", servers.directory());

    expect(result).toMatchObject({ code: 1, errors: "The server refused to stop, with status 401." });
    const logs = join(servers.directory(), "logs");
    const [name = ""] = readdirSync(logs);
    expect(name).toMatch(/^cli-/);
    expect(readFileSync(join(logs, name), "utf8")).toContain("The stop command failed");
    expect(readFileSync(join(logs, name), "utf8")).not.toContain("stand-in-token");
  });

  it("does not create a data directory only to log in it", async () => {
    const missing = join(servers.directory(), "missing");

    const result = await run("start", "--data-directory", join(missing, "\0"));

    expect(result.code).toBe(1);
    expect(existsSync(missing)).toBe(false);
  });
});
