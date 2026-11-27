/**
 * Keeps websites from using the server. There is no login, and any page in a browser can send requests to the
 * local computer.
 *
 * @packageDocumentation
 */
import type { IncomingHttpHeaders } from "node:http";

// The names for the local computer that a browser or a command may use.
const localNames = ["127.0.0.1", "localhost"];

/**
 * Tells whether a request is meant for this server and does not come from another website. The Host header must
 * name the local computer and the server's port, which stops a website whose name was made to point here. An
 * Origin header, which browsers add to say which website is asking, must be the server's own.
 */
export function isFromThisServer(headers: IncomingHttpHeaders, port: number): boolean {
  // A URL leaves out the usual port, as browsers do.
  const own = localNames.map((name) => new URL(`http://${name}:${String(port)}`));
  const host = headers.host?.toLowerCase();
  const { origin } = headers;
  return own.some((url) => url.host === host) && (origin === undefined || own.some((url) => url.origin === origin));
}
