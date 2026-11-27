import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
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
  ])("refuses %j with exit code 2", async (given, problem) => {
    const result = await run(...given);

    expect(result.code).toBe(2);
    expect(result.errors).toContain(problem);
  });

  // Each has a data directory, so that only the named problem can refuse it. The usage names every option, so only
  // the first line is checked.
  it.each([
    [["stop", "--port", "4311"], "Unknown option '--port'"],
    [["health", "--detached"], "Unknown option '--detached'"],
    [["health", "extra"], "Unexpected argument 'extra'"],
    [["start", "--port"], "--port <value>' argument missing"],
  ])("refuses %j even with a data directory", async (given, problem) => {
    const [name = "", ...rest] = given;

    const result = await run(name, "--data-directory", servers.directory(), ...rest);

    expect(result.code).toBe(2);
    expect(result.errors.split("\n")[0]).toContain(problem);
  });

  it("gives the server the typed port and log level, and leaves out what was not typed", async () => {
    const directory = `--data-directory=${servers.directory()}`;
    const [typed, saved] = [await freePort(), await freePort()];

    const first = await run("start", directory, "--detached", "--port", String(typed), "--log-level", "error");
    await run("stop", directory);
    const logs = join(servers.directory(), "logs");
    const logged = existsSync(logs);
    writeFileSync(join(servers.directory(), "settings.yaml"), `port: ${String(saved)}\n`);
    const second = await run("start", directory, "--detached");
    await run("stop", directory);

    expect(first.output).toContain(`:${String(typed)}`);
    // At the error level, a server that starts and stops writes nothing.
    expect(logged).toBe(false);
    expect(second.output).toContain(`:${String(saved)}`);
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

    // No file system takes a name this long, so the command fails. Logging would create the directory above it.
    const result = await run("health", "--data-directory", join(missing, "a".repeat(300)));

    expect(result.code).toBe(1);
    expect(existsSync(missing)).toBe(false);
  });
});
