import { execFile } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { afterAll, expect, it } from "vitest";

const directory = mkdtempSync(join(tmpdir(), "claude-plans-shared-log-"));
const writers = 4;
const entriesEach = 2000;

afterAll(() => {
  rmSync(directory, { recursive: true, force: true });
});

// Several commands may run at once, and they all append to the same file.
it("keeps every entry whole when several programs write at the same time", async () => {
  // Each program waits for all of them to be ready, so that they write at the same time.
  const program = `
    import { readdirSync, writeFileSync } from "node:fs";
    import { createLogger } from ${JSON.stringify(new URL("index.ts", import.meta.url).href)};
    const [dataDirectory, writer] = process.argv.slice(1);
    const now = () => new Date("2026-03-15T12:00:00.000Z");
    const log = createLogger({ dataDirectory, program: "cli", level: "info", now });
    writeFileSync(dataDirectory + "/ready-" + writer, "");
    while (readdirSync(dataDirectory).filter((name) => name.startsWith("ready-")).length < ${String(writers)});
    for (let entry = 0; entry < ${String(entriesEach)}; entry += 1) {
      log.info(writer.repeat(500));
    }
  `;

  await Promise.all(
    Array.from({ length: writers }, (_, writer) =>
      promisify(execFile)(process.execPath, ["--input-type=module", "--eval", program, directory, String(writer)]),
    ),
  );

  expect(readdirSync(join(directory, "logs"))).toEqual(["cli-2026-03-15.log"]);
  const lines = readFileSync(join(directory, "logs", "cli-2026-03-15.log"), "utf8")
    .trimEnd()
    .split("\n");
  const messages = lines.map((line) => (JSON.parse(line) as { message: string }).message);
  expect(messages).toHaveLength(writers * entriesEach);
  expect(messages.every((message) => /^(0+|1+|2+|3+)$/.test(message))).toBe(true);
  // Had the programs run one after another, the writer would have changed only once between each two.
  const changes = messages.filter((message, line) => line > 0 && message !== messages[line - 1]);
  expect(changes.length).toBeGreaterThanOrEqual(writers);
});
