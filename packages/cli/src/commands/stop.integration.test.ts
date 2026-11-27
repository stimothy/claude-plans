import { rmSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { recordingTerminal } from "../recording-terminal.ts";
import { standInToken, useStandInServers } from "../server/stand-in-server.ts";
import { stopServer } from "./stop.ts";

const servers = useStandInServers();
const removeRecord = (): void => {
  rmSync(join(servers.directory(), "server.json"));
};

// Runs the command, and gives its exit code and what it printed.
async function stop(timeout?: number) {
  const terminal = recordingTerminal();
  const code = await stopServer(servers.directory(), terminal, timeout);
  return { code, output: terminal.output };
}

describe("the stop command", () => {
  it("asks with the token, and waits until the server has removed its record", async () => {
    const asked = vi.fn();
    await servers.serve((request, response) => {
      asked(request.method, request.url, request.headers.authorization);
      response.writeHead(202).end();
      setTimeout(removeRecord, 100);
    });

    const stopped = await stop();

    expect(stopped).toEqual({ code: 0, output: ["The server stopped."] });
    expect(asked).toHaveBeenCalledWith("POST", "/api/shutdown", `Bearer ${standInToken}`);
    expect(() => {
      removeRecord();
    }).toThrow("ENOENT");
  });

  it("is also done when another server has already taken its place", async () => {
    await servers.serve((_, response) => {
      response.writeHead(202).end();
      servers.record(1, "the-next-server's-token");
    });

    await expect(stop(500)).resolves.toMatchObject({ code: 0 });
  });

  it("succeeds when no server is running", async () => {
    const output = [`No server is running on ${servers.directory()}.`];

    await expect(stop()).resolves.toEqual({ code: 0, output });
  });

  it("does not send the token to a server for another data directory", async () => {
    const asked = vi.fn();
    await servers.serve(asked, join(servers.directory(), "other"));

    await stop();

    expect(asked).not.toHaveBeenCalled();
  });

  it("fails when the server refuses", async () => {
    await servers.serve((_, response) => response.writeHead(401).end());

    await expect(stop()).rejects.toThrow("status 401");
  });

  it("fails when the server does not finish stopping", async () => {
    await servers.serve((_, response) => response.writeHead(202).end());

    await expect(stop(100)).rejects.toThrow("did not finish stopping");
  });
});
