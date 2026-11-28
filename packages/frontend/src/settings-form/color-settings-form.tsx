/**
 * The controls that choose the page's theme and color vision.
 *
 * @packageDocumentation
 */
import { type ColorSettings, colorVisionSchema, themeSchema } from "@claude-plans/domain";
import { type ReactElement, useState, useSyncExternalStore } from "react";

import { readColors, watchColors } from "../colors/document-colors.ts";
import { colorSaver, type SaveColors } from "./color-saver.ts";
import styles from "./color-settings-form.module.css";

const root = document.documentElement;

const labels: Readonly<Record<ColorSettings["theme"] | ColorSettings["colorVision"], string>> = {
  system: "System",
  light: "Light",
  dark: "Dark",
  default: "Default",
  protan: "Protan",
  deutan: "Deutan",
  tritan: "Tritan",
};

const groups = [
  { name: "theme", legend: "Theme", choices: themeSchema.options },
  { name: "colorVision", legend: "Color vision", choices: colorVisionSchema.options },
] as const;

// The document's attributes are the one record of what shows. A string keeps React from seeing a change every time.
function useShownColors(): ColorSettings {
  const shown = useSyncExternalStore(
    (changed) => watchColors(root, changed),
    () => JSON.stringify(readColors(root)),
  );
  return JSON.parse(shown) as ColorSettings;
}

/** Shows the color choices, and saves each change with the function it is given. */
export function ColorSettingsForm({ save }: { readonly save: SaveColors }): ReactElement {
  const [failed, setFailed] = useState(false);
  const [choose] = useState(() => colorSaver(root, save, setFailed));
  const colors = useShownColors();
  return (
    <form className={styles["settings"]}>
      {groups.map(({ name, legend, choices }) => (
        <fieldset key={name} className={styles["group"]}>
          <legend>{legend}</legend>
          {choices.map((choice) => (
            <label key={choice} className={styles["choice"]}>
              <input
                type="radio"
                name={name}
                checked={colors[name] === choice}
                onChange={() => void choose({ [name]: choice })}
              />
              {labels[choice]}
            </label>
          ))}
        </fieldset>
      ))}
      {failed && (
        <p role="alert" className={styles["failure"]}>
          Your choice could not be saved. Check that the server is running, then try again.
        </p>
      )}
    </form>
  );
}
