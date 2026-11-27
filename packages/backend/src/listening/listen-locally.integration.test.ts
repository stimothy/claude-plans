import { type AddressInfo, createServer, type ListenOptions, type Server } from "node:net";

import fastify, { type FastifyInstance } from "fastify";
import { afterEach, expect, it } from "vitest";

import { listenLocally } from "./listen-locally.ts";

let open: Server[] = [];
let applications: FastifyInstance[] = [];

afterEach(async () => {
  open.forEach((server) => server.close());
  await Promise.all(applications.map((application) => application.close()));
  open = [];
  applications = [];
});

// Takes a free port the way another program would, and returns it.
async function hold(options: ListenOptions): Promise<number> {
  const holder = createServer();
  open.push(holder);
  await new Promise<void>((resolve) => holder.listen({ ...options, port: 0 }, resolve));
  return (holder.address() as AddressInfo).port;
}

function listen(port: number): Promise<AddressInfo> {
  const application = fastify();
  applications.push(application);
  return listenLocally(application, port);
}

it("listens on the local computer's own address, on a free port for 0", async () => {
  const bound = await listen(0);

  expect(bound.address).toBe("127.0.0.1");
  expect(bound.port).toBeGreaterThan(0);
});

// Some systems let 127.0.0.1 be taken beside each of these, and "localhost" could then reach the other program.
it.each([
  { where: "the same address", options: { host: "127.0.0.1" } },
  { where: "the other local address", options: { host: "::1" } },
  { where: "every address", options: {} },
  { where: "every address of the older kind", options: { host: "0.0.0.0" } },
])("reports a port that another program holds on $where", async ({ options }) => {
  const port = await hold(options);

  await expect(listen(port)).rejects.toThrow(`Port ${String(port)} is already in use.`);
});

it("passes on any other failure as it is", async () => {
  await expect(listen(70_000)).rejects.toThrow("Port should be >= 0 and < 65536");
});
