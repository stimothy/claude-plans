/**
 * The studio's first page.
 *
 * @packageDocumentation
 */
import type { ReactElement } from "react";

import styles from "./hello-page.module.css";
import type { SaveColors } from "./settings-form/color-saver.ts";
import { ColorSettingsForm } from "./settings-form/color-settings-form.tsx";

/** Greets the user, and lets them choose the page's colors, which are saved with the given function. */
export function HelloPage({ save }: { readonly save: SaveColors }): ReactElement {
  return (
    <main className={styles["page"]}>
      <h1>Hello, world</h1>
      <p className={styles["introduction"]}>This is claude-plans, a planning studio for plans made with Claude.</p>
      <ColorSettingsForm save={save} />
    </main>
  );
}
