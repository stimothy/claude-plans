/**
 * The page's entry point, which shows it in the browser's document.
 *
 * @packageDocumentation
 */
import "./colors/palettes.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { HelloPage } from "./hello-page.tsx";
import { saveColors } from "./settings-form/save-colors.ts";

createRoot(document.body.appendChild(document.createElement("div"))).render(
  <StrictMode>
    <HelloPage save={saveColors} />
  </StrictMode>,
);
