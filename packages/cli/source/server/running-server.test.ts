import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

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
    ["points elsewhere", (_, response) => response.writeHead(302, { location: "/elsewhere" }).end()],
  ])("does not take a program that %s", async (_, handler) => {
    servers.record(await servers.listen(handler));

    await expect(findServer(servers.directory())).resolves.toBeUndefined();
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
