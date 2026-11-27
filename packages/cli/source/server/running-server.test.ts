import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { inspect } from "node:util";

import { describe, expect, it, vi } from "vitest";

import { findServer } from "./running-server.ts";
import { answer, type Handler, standInToken, useStandInServers } from "./stand-in-server.ts";

const servers = useStandInServers();

describe("finding the server for a data directory", () => {
  it("gives the port, the token, and the directory's name on disk", async () => {
    const port = await servers.serve();

    const found = await findServer(servers.directory());

    expect(found).toEqual({ port, token: standInToken, dataDirectory: servers.directory() });
  });

  it("knows a directory that is reached through a link", async () => {
    const link = join(servers.directory(), "..", "link");
    // Windows allows a junction without special rights, and other systems ignore the type.
    symlinkSync(servers.directory(), link, "junction");
    await servers.serve();

    await expect(findServer(link)).resolves.toBeDefined();
  });

  it.each(["", "missing"])("finds none without a record, in the directory %j", async (inside) => {
    await expect(findServer(join(servers.directory(), inside))).resolves.toBeUndefined();
  });

  it("finds none when nothing listens on the recorded port", async () => {
    const port = await servers.listen(() => undefined);
    servers.record(port === 1 ? 2 : 1);

    await expect(findServer(servers.directory())).resolves.toBeUndefined();
  });

  it("does not take a server for another data directory", async () => {
    await servers.serve(undefined, join(servers.directory(), "other"));

    await expect(findServer(servers.directory())).resolves.toBeUndefined();
  });

  it.each<[string, Handler]>([
    [
      "answers with an error",
      (_, response) => {
        answer(response, {}, 404);
      },
    ],
    ["does not answer with JSON", (_, response) => response.end("hello")],
    [
      "answers with something else",
      (_, response) => {
        answer(response, { name: "other" });
      },
    ],
  ])("does not take a program that %s", async (_, handler) => {
    servers.record(await servers.listen(handler));

    await expect(findServer(servers.directory())).resolves.toBeUndefined();
  });

  it("does not follow a program that points elsewhere, even to the right server", async () => {
    const asked = vi.fn();
    const right = await servers.listen((_, response) => {
      asked();
      answer(response, { dataDirectory: servers.directory() });
    });
    const location = `http://127.0.0.1:${String(right)}/api/server`;
    servers.record(await servers.listen((_, response) => response.writeHead(302, { location }).end()));

    await expect(findServer(servers.directory())).resolves.toBeUndefined();
    expect(asked).not.toHaveBeenCalled();
  });

  it("reaches a server on a port that browsers refuse", async () => {
    // Node.js's fetch will not connect to these ports, although a server can listen on them.
    const port = await servers.listen(
      (_, response) => {
        answer(response, { dataDirectory: servers.directory() });
      },
      [6000, 6666, 6667, 6668, 6669, 10_080],
    );
    servers.record(port);

    await expect(findServer(servers.directory())).resolves.toMatchObject({ port });
  });

  it("keeps a damaged record's token out of the whole error", async () => {
    // Without its quotes, the token is where the parser fails, and the parser's message quotes the text there.
    writeFileSync(join(servers.directory(), "server.json"), `{"token": sekret}`);

    const error = await findServer(servers.directory()).catch((thrown: unknown) => thrown);

    expect(inspect(error)).toContain("is not valid");
    expect(inspect(error)).not.toContain("sekret");
  });

  it("says so when the program on the port does not answer in time", async () => {
    servers.record(await servers.listen(() => undefined));

    await expect(findServer(servers.directory(), 50)).rejects.toThrow("did not answer in time");
  });

  it.each(["not JSON", '{"port": 4311}'])("explains a record that holds %j", async (text) => {
    writeFileSync(join(servers.directory(), "server.json"), text);

    await expect(findServer(servers.directory())).rejects.toThrow("server.json is not valid");
  });

  it("passes on any other failure to read the record", async () => {
    // A directory in the record's place cannot be read as a file.
    mkdirSync(join(servers.directory(), "server.json"));

    await expect(findServer(servers.directory())).rejects.toThrow("EISDIR");
  });
});
