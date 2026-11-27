/**
 * The database program's entry point, which connects it to the process that it runs in.
 *
 * @packageDocumentation
 */
import { runDatabaseProgram } from "./database-program.ts";

process.exitCode = runDatabaseProgram({
  arguments: process.argv.slice(2),
  printError: (line) => {
    console.error(line);
  },
});
