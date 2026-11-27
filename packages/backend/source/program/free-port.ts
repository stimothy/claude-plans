/**
 * Finds a port for a test's server.
 *
 * @packageDocumentation
 */
import { createServer } from "node:net";

/** Returns a port that was free a moment ago, for a server that must be given one. */
export async function freePort(): Promise<number> {
  const holder = createServer();
  const address = await new Promise<ReturnType<typeof holder.address>>((resolve, reject) => {
    holder.once("error", reject);
    holder.listen(0, "127.0.0.1", () => {
      resolve(holder.address());
    });
  });
  await new Promise((resolve) => holder.close(resolve));
  if (address === null || typeof address === "string") {
    throw new Error("No port was given.");
  }
  return address.port;
}
