/**
 * Finds a free port, for tests.
 *
 * @packageDocumentation
 */
import { once } from "node:events";
import { type AddressInfo, createServer } from "node:net";

/** Returns a port that was free a moment ago, for a server that must be given one. */
export async function freePort(): Promise<number> {
  const holder = createServer().listen(0, "127.0.0.1");
  await once(holder, "listening");
  const { port } = holder.address() as AddressInfo;
  holder.close();
  await once(holder, "close");
  return port;
}
