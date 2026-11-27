import { existsSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { removeBuild } from "../install/build.ts";
import { builds, commitAll, databaseActions, installed, useFakeRepository } from "../install/fake-repository.ts";
import { writeInto } from "../install/fake-repository.ts";
import { commandDirectory } from "../install/layout.ts";
import { Refusal } from "../install/refusal.ts";
import { runNpm, runProgram } from "../install/run-program.ts";
import { recordingTerminal } from "../recording-terminal.ts";
import { answer, useStandInServers } from "../server/stand-in-server.ts";
import { installApplication } from "./install.ts";

// Removing a build works as it always does, except where a test makes it fail.
vi.mock("../install/build.ts", async (importOriginal) => {
  const original = await importOriginal<{ removeBuild: (directory: string) => void }>();
  return { ...original, removeBuild: vi.fn(original.removeBuild) };
});

const fake = useFakeRepository();
const servers = useStandInServers();
const real = (): string => join(fake.repository(), ".claude-plans");

async function install(dataDirectory: string, repository = fake.repository()) {
  const terminal = recordingTerminal();
  const code = await installApplication({ dataDirectory, repository }, terminal);
  return { code, output: terminal.output.join("\n"), errors: terminal.errors.join("\n") };
}

// What the command in a build prints, run as the launcher runs it.
const launch = (dataDirectory: string): string =>
  runProgram(process.execPath, [installed(dataDirectory).launcher, "start"], fake.elsewhere(".."));

const linkedCommand = (): string => join(runNpm("npm root --global", fake.repository()), "claude-plans-command");

// A stand-in server for a data directory, which stops when asked, by removing its record.
async function runningServer(data = servers.directory()): Promise<string> {
  const record = join(data, "server.json");
  const port = await servers.listen((request, response) => {
    if (request.method === "POST") {
      rmSync(record);
      answer(response, {}, 202);
    } else {
      answer(response, { dataDirectory: data });
    }
  });
  writeInto(data, "server.json", JSON.stringify({ port, token: "token" }));
  return data;
}

describe("installing into another data directory", () => {
  it("builds there, migrates, and leaves the command on the path alone", async () => {
    const data = fake.elsewhere("development");

    const result = await install(data);

    expect(result.code).toBe(0);
    expect(result.output).toContain("Installed version 1.0.0");
    expect(result.output).toContain(`node "${installed(data).launcher}" start`);
    expect(databaseActions(data)).toEqual(["check stopped", "migrate stopped"]);
    expect(launch(data)).toBe("the fake command start");
    expect(existsSync(linkedCommand())).toBe(false);
    expect(existsSync(real())).toBe(false);
  });

  it("builds from the code as it is, committed or not, without its tests", async () => {
    const data = fake.elsewhere("development");
    writeInto(fake.repository(), "packages/cli/src/main.ts", 'console.log("changed");\n');

    await install(data);

    expect(launch(data)).toBe("changed");
    const build = join(data, "app", "builds", installed(data).build ?? "");
    expect(existsSync(join(build, "packages/backend/src/program/database-main.ts"))).toBe(true);
    expect(existsSync(join(build, "packages/backend/src/program/database-main.test.ts"))).toBe(false);
  });

  it("keeps what was installed while the repository changes, until installed again", async () => {
    const data = fake.elsewhere("development");
    await install(data);
    const first = installed(data).build;
    writeInto(fake.repository(), "packages/cli/src/main.ts", 'console.log("changed");\n');

    const before = launch(data);
    await install(data);

    expect([before, launch(data)]).toEqual(["the fake command start", "changed"]);
    expect(builds(data)).toEqual([installed(data).build]);
    expect(installed(data).build).not.toBe(first);
  });
});

// The earlier application is still the current one, and no other build was left behind.
function expectOnlyBuild(dataDirectory: string, build: string | undefined): void {
  expect([installed(dataDirectory).build, ...builds(dataDirectory)]).toEqual([build, build]);
}

describe("installing while a server runs", () => {
  it("stops the server before migrating, and says to start it again", async () => {
    const data = await runningServer();

    const result = await install(data);

    expect(databaseActions(data)).toEqual(["check running", "migrate stopped"]);
    expect(result.output).toContain("The server was stopped. Start it again");
  });

  it("changes nothing for a newer database, and leaves the server running", async () => {
    const data = await runningServer();
    await install(data);
    const before = installed(data).build;
    await runningServer();
    writeInto(data, "fail-check", "The database is newer.");

    await expect(install(data)).rejects.toThrow("The database is newer.");

    expect(existsSync(join(data, "server.json"))).toBe(true);
    expectOnlyBuild(data, before);
  });

  it("fails without migrating when the server cannot be stopped", async () => {
    await servers.serve((_, response) => response.writeHead(401).end());

    await expect(install(servers.directory())).rejects.toThrow("refused to stop");

    expect(databaseActions(servers.directory())).toEqual(["check running"]);
    expect(builds(servers.directory())).toEqual([]);
  });

  // A program that is stopped during a migration may have said nothing else about the backup that it reported.
  it.each([false, true])("passes on what migrating reports, when it fails is %s", async (fails) => {
    const data = fake.elsewhere("development");
    writeInto(data, "report-migrate", "Backed up the database.");
    if (fails) {
      writeInto(data, "fail-migrate", "Stopped.");
    }
    const terminal = recordingTerminal();

    const attempt = installApplication({ dataDirectory: data, repository: fake.repository() }, terminal);

    await (fails ? expect(attempt).rejects.toThrow("Stopped.") : expect(attempt).resolves.toBe(0));
    expect(terminal.output[0]).toBe("Backed up the database.");
  });

  it("keeps the earlier application when a migration fails", async () => {
    const data = fake.elsewhere("development");
    await install(data);
    const before = installed(data).build;
    writeInto(data, "fail-migrate", "Migration 1 failed.");

    await expect(install(data)).rejects.toThrow(/^Migration 1 failed\.$/);

    expectOnlyBuild(data, before);
  });

  it("says that the server was stopped when a migration fails after that", async () => {
    const data = await runningServer();
    writeInto(data, "fail-migrate", "Migration 1 failed.");

    await expect(install(data)).rejects.toThrow("Migration 1 failed.\nThe server was stopped. Start it again");
  });
});

describe("a plain install", () => {
  it("saves the application in .claude-plans, and puts the command on the path", async () => {
    const result = await install(real());

    expect(result.output).toContain("The claude-plans command now runs this copy.");
    expect(result.output).toContain("Start the server with: claude-plans start");
    expect(databaseActions(real())).toEqual(["check stopped", "migrate stopped"]);
    expect(readFileSync(join(linkedCommand(), "main.js"), "utf8")).toBe(
      readFileSync(join(commandDirectory(real()), "main.js"), "utf8"),
    );
    const bin = process.platform === "win32" ? "claude-plans.cmd" : join("bin", "claude-plans");
    expect(existsSync(join(fake.globalPrefix(), bin))).toBe(true);
  });

  it("may be repeated", async () => {
    await install(real());

    await expect(install(real())).resolves.toMatchObject({ code: 0 });
  });

  it("changes nothing from a checkout that may not replace the real application", async () => {
    commitAll(fake.repository());

    await expect(install(real())).rejects.toThrow("Nothing was changed.");

    expect(existsSync(real())).toBe(false);
    expect(existsSync(linkedCommand())).toBe(false);
  });

  it("keeps its protections when the real directory is named another way", async () => {
    commitAll(fake.repository());

    await expect(install(join(fake.repository(), "packages", "..", ".Claude-Plans"))).rejects.toThrow("A plain");
  });

  // A refusal is not logged, which would write into the real data.
  async function expectRefusal(attempt: Promise<unknown>, problem: string): Promise<void> {
    await expect(attempt).rejects.toThrow(problem);
    await expect(attempt).rejects.toBeInstanceOf(Refusal);
  }

  it("refuses a directory inside the real data", async () => {
    await expectRefusal(install(join(real(), "development")), "inside the real data directory");

    expect(existsSync(real())).toBe(false);
  });

  // Where letter case matters, this is another directory, which must not become the real application's.
  it("refuses the real directory written in other letters before it exists", async () => {
    await expect(install(join(fake.repository(), ".Claude-Plans"))).rejects.toThrow("letter case");

    expect(existsSync(linkedCommand())).toBe(false);
  });

  // Puts the command of an installation elsewhere on the path, and returns that installation's directory.
  function linkAnotherInstallation(): string {
    const other = fake.elsewhere("other");
    writeInto(other, "package.json", JSON.stringify({ name: "claude-plans-command", version: "1.0.0" }));
    runNpm("npm install --global --ignore-scripts --offline .", other);
    return other;
  }

  it("changes nothing when the command on the path runs another installation", async () => {
    linkAnotherInstallation();

    await expectRefusal(install(real()), "runs the installation in");

    expect(existsSync(real())).toBe(false);
  });

  it("replaces a command whose installation no longer exists", async () => {
    rmSync(linkAnotherInstallation(), { recursive: true });

    await expect(install(real())).resolves.toMatchObject({ code: 0 });
  });

  // A linked command runs the current build. A copy would look for one beside itself.
  it("links the command even when npm is set to copy local packages", async () => {
    vi.stubEnv("npm_config_install_links", "true");

    await install(real());

    expect(realpathSync(linkedCommand())).toBe(realpathSync(commandDirectory(real())));
  });

  it("works from an npm script that names a workspace", async () => {
    vi.stubEnv("npm_config_workspace", "missing");

    await expect(install(real())).resolves.toMatchObject({ code: 0 });
  });
});

describe("a step that fails", () => {
  it("leaves no part of a build behind when npm cannot make it", async () => {
    const data = fake.elsewhere("development");
    await install(data);
    const before = installed(data).build;
    const manifest = { name: "fake", version: "1.0.0", dependencies: { "not-in-the-lockfile": "1.0.0" } };
    writeInto(fake.repository(), "package.json", JSON.stringify(manifest));

    await expect(install(data)).rejects.toThrow("npm");

    expectOnlyBuild(data, before);
  });

  // The new build is current by then, so the user has to be told what state they are in.
  it("says what is installed when the command cannot be put on the path", async () => {
    await install(real());
    await runningServer(real());
    writeInto(fake.elsewhere("."), "file", "");
    vi.stubEnv("npm_config_prefix", fake.elsewhere(join("file", "global")));

    const attempt = install(real());

    await expect(attempt).rejects.toThrow("Version 1.0.0 is installed, but");
    await expect(attempt).rejects.toThrow(`The server was stopped. Start it again with: node "`);
    expect(builds(real())).toEqual([installed(real()).build]);
  });

  it("still finishes when the earlier build cannot be deleted", async () => {
    const data = fake.elsewhere("development");
    await install(data);
    vi.mocked(removeBuild).mockImplementationOnce(() => {
      throw new Error("The file is in use.");
    });

    const result = await install(data);

    expect(result.code).toBe(0);
    expect(result.errors).toContain("The file is in use.");
  });
});
