/**
 * The studio's first page.
 *
 * @packageDocumentation
 */
import type { ReactElement } from "react";

import styles from "./hello-page.module.css";

/** Greets the user. */
export function HelloPage(): ReactElement {
  return (
    <main className={styles["page"]}>
      <h1>Hello, world</h1>
      <p>This is claude-plans, a planning studio for plans made with Claude.</p>
    </main>
  );
}
