/**
 * The database program's entry point, which connects it to the process that it runs in.
 *
 * @packageDocumentation
 */
import { runDatabaseProgram } from "./database-program.ts";

process.exitCode = await runDatabaseProgram({
  arguments: process.argv.slice(2),
  print: console.log.bind(console),
  printError: console.error.bind(console),
});
