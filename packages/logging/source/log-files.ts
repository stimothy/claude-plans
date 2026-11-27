/**
 * The daily log files. Each date has its own file, so nothing is ever renamed, which several programs could not
 * do safely to one file.
 *
 * @packageDocumentation
 */
import { appendFileSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const daysKept = 14;
const millisecondsPerDay = 86_400_000;
const dateLength = "YYYY-MM-DD".length;

/** Returns the UTC date of a time, such as 2026-03-15. */
export function utcDate(time: Date): string {
  return time.toISOString().slice(0, dateLength);
}

function fileName(program: string, time: Date): string {
  return `${program}-${utcDate(time)}.log`;
}

/** Adds a line to the program's file for the line's date, creating the file and its directory if needed. */
export function appendLine(directory: string, program: string, time: Date, line: string): void {
  mkdirSync(directory, { recursive: true });
  // Each line is added with one write to the end of the file, so that lines from other programs stay separate.
  appendFileSync(join(directory, fileName(program, time)), `${line}\n`);
}

/** Deletes the program's files that are older than the 14 days up to and including today. */
export function deleteOldFiles(directory: string, program: string, today: Date): void {
  const oldest = fileName(program, new Date(today.getTime() - (daysKept - 1) * millisecondsPerDay));
  const dated = new RegExp(String.raw`^${program}-\d{4}-\d{2}-\d{2}\.log$`);
  for (const name of readdirSync(directory)) {
    if (dated.test(name) && name < oldest) {
      // Another program may have deleted the file already, which is not an error.
      rmSync(join(directory, name), { force: true });
    }
  }
}
