/**
 * How Vite passes the page's API requests to the development server.
 *
 * @packageDocumentation
 */
import type { ProxyOptions } from "vite";

/**
 * Returns the settings that pass requests on to the server. The server refuses a request that another website
 * makes, which a browser names in the Origin header. Vite's own page has another port than the server, so its
 * Origin is replaced by the server's. Every other Origin is passed on as it is, for the server to refuse. Vite
 * itself refuses a Host that is not this computer's, before it passes anything on.
 */
export function apiProxy(server: string): ProxyOptions {
  return {
    target: server,
    // The server also checks the Host header, which has to name its own port.
    changeOrigin: true,
    configure: (proxy) => {
      proxy.on("proxyReq", (outgoing, incoming) => {
        const { origin, host = "" } = incoming.headers;
        if (origin === `http://${host}`) {
          outgoing.setHeader("origin", server);
        }
      });
    },
  };
}
