/**
 * Puts the saved colors into the page that Vite serves, as the studio's server does with the built page, so that
 * no other colors show first during development either.
 *
 * @packageDocumentation
 */
import { settingsContract, withColors } from "../../packages/domain/src/index.ts";

// The page should not hang on a server that does not answer.
const patience = 2000;

/** A plugin for Vite that asks the server for the saved colors each time it serves the page. */
export function savedColors(serverUrl: string) {
  return {
    name: "claude-plans-saved-colors",
    async transformIndexHtml(html: string): Promise<string> {
      try {
        const signal = AbortSignal.timeout(patience);
        const answer = await fetch(`${serverUrl}${settingsContract.path}`, { signal });
        // An answer with an error is not the settings, so reading it as them fails.
        return withColors(html, settingsContract.read.response.parse(await answer.json()));
      } catch (error) {
        console.warn("The page shows its default colors, because the server did not give the saved ones.", error);
        return html;
      }
    },
  };
}
