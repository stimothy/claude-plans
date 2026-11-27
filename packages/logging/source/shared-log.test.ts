import { execFile } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { afterAll, expect, it } from "vitest";

const directory = mkdtempSync(join(tmpdir(), "claude-plans-shared-log-"));
const writers = 4;
const entriesEach = 100;

afterAll(() => {
  rmSync(directory, { recursive: true, force: true });
});

// Several commands may run at once, and they all append to the same file.
it("keeps every entry whole when several programs write at the same time", async () => {
  const program = `
    import { createLogger } from ${JSON.stringify(new URL("index.ts", import.meta.url).href)};
    const now = () => new Date("2026-03-15T12:00:00.000Z");
    const log = createLogger({ dataDirectory: process.argv[1], program: "cli", level: "info", now });
    for (let entry = 0; entry < ${String(entriesEach)}; entry += 1) {
      log.info(process.argv[2].repeat(2000));
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
});
