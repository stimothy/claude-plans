/**
 * Listens on a port that only this computer can reach, and that no other program answers.
 *
 * @packageDocumentation
 */
import { type AddressInfo, connect, type Server } from "node:net";

// Only programs on this computer can reach this address.
const localAddress = "127.0.0.1";

// The addresses that the name "localhost" can mean.
const localhostAddresses = [localAddress, "::1"];

function answers(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const client = connect({ host, port });
    client.once("connect", () => {
      client.destroy();
      resolve(true);
    });
    client.once("error", () => {
      resolve(false);
    });
  });
}

function taken(port: number, cause?: unknown): Error {
  return new Error(`Port ${String(port)} is already in use.`, { cause });
}

// Some systems allow listening here while another program answers on the same port at another local address,
// so that "localhost" could reach either one. Trying to connect finds such a program.
async function checkUnanswered(port: number): Promise<void> {
  const answered = await Promise.all(localhostAddresses.map((host) => answers(host, port)));
  if (answered.includes(true)) {
    throw taken(port);
  }
}

/** What can be made to listen, such as a Fastify application. */
export interface Listener {
  readonly listen: (options: { host: string; port: number }) => Promise<unknown>;
  readonly server: Server;
}

/** Makes a server listen on 127.0.0.1, on any free port for 0, and returns where it listens. */
export async function listenLocally(listener: Listener, port: number): Promise<AddressInfo> {
  if (port !== 0) {
    await checkUnanswered(port);
  }
  try {
    await listener.listen({ host: localAddress, port });
  } catch (error) {
    // Another program may have taken the port since the check.
    throw error instanceof Error && "code" in error && error.code === "EADDRINUSE" ? taken(port, error) : error;
  }
  // A server that listens on a port, not a pipe, always has such an address.
  return listener.server.address() as AddressInfo;
}
