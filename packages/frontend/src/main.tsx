/**
 * The page's entry point, which shows it in the browser's document.
 *
 * @packageDocumentation
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { HelloPage } from "./hello-page.tsx";

createRoot(document.body.appendChild(document.createElement("div"))).render(
  <StrictMode>
    <HelloPage />
  </StrictMode>,
);
