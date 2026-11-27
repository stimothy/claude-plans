// What the server must still get right after a crash, or when something fails while it starts or stops.
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { connect } from "node:net";
import { join } from "node:path";

import { expect, it } from "vitest";

import { useTestServers } from "./test-servers.ts";

const servers = useTestServers();
const path = (name: string): string => join(servers.directory(), name);

it("stops even while a client holds a connection open", async () => {
  const server = await servers.start();
  const client = connect({ host: "127.0.0.1", port: server.port });
  const ended = new Promise((resolve) => client.once("close", resolve));
  // Being cut off may reach the client as an error.
  client.on("error", () => undefined);
  await new Promise((resolve) => client.once("connect", resolve));
  // The blank line that would end the request is never sent.
  client.write("GET /api/health HTTP/1.1\r\nHost: localhost\r\n");

  await server.close();

  await expect(ended).resolves.toBeDefined();
});

it("removes a crashed server's record even when it cannot start", async () => {
  mkdirSync(servers.directory(), { recursive: true });
  writeFileSync(path("server.json"), "left over");

  await expect(servers.start(70_000)).rejects.toThrow();

  expect(existsSync(path("server.json"))).toBe(false);
});

it("replaces an unfinished record, without keeping its permissions", async () => {
  mkdirSync(servers.directory(), { recursive: true });
  writeFileSync(path("server.json.new"), "unfinished");
  chmodSync(path("server.json.new"), 0o644);

  const { port } = await servers.start();

  expect(readFileSync(path("server.json"), "utf8")).toContain(`"port":${String(port)},`);
  // Windows does not have these permissions.
  expect(statSync(path("server.json")).mode & 0o777).toBe(process.platform === "win32" ? 0o666 : 0o600);
});

it("stops listening when it cannot write its record", async () => {
  const earlier = await servers.start();
  await earlier.close();
  // A directory in the record's place cannot be removed as a file.
  mkdirSync(path("server.json.new"));

  await expect(servers.start(earlier.port)).rejects.toThrow("server.json.new");

  rmSync(path("server.json.new"), { recursive: true });
  // This would fail if the port were still held.
  await expect(servers.start(earlier.port)).resolves.toBeDefined();
});

it("frees the data directory when it cannot stop cleanly, and says so", async () => {
  const server = await servers.start();
  const { token } = JSON.parse(readFileSync(path("server.json"), "utf8")) as { token: string };
  rmSync(path("server.json"));
  mkdirSync(path("server.json"));

  await servers.shutDown(server.port, { authorization: `Bearer ${token}` });
  await expect(server.closed).rejects.toThrow("server.json");

  expect(servers.log.error).toHaveBeenCalledWith("The server did not stop cleanly", expect.any(Error));
  servers.forget(server);
  rmSync(path("server.json"), { recursive: true });
  await expect(servers.start()).resolves.toBeDefined();
});

it("logs why its database cannot be read", async () => {
  mkdirSync(servers.directory(), { recursive: true });
  writeFileSync(path("database.sqlite"), "not a database".repeat(100));
  const { port } = await servers.start();

  await servers.send(port, "GET", "/api/health");

  expect(servers.log.error).toHaveBeenCalledWith("Cannot read the database", expect.any(Error));
});
