/**
 * Describes what was thrown, for a log entry.
 *
 * @packageDocumentation
 */

// An error may have a cause, and one that gathers several errors holds them in a list.
function related(error: Error): unknown[] {
  const gathered: unknown[] = error instanceof AggregateError ? error.errors : [];
  return error.cause === undefined ? gathered : [...gathered, error.cause];
}

/**
 * Returns the stack traces of an error and of the errors behind it. An error's other properties are left out,
 * because they can hold secrets or the body of a request. For the same reason, a thrown object that is not an
 * error is not shown.
 */
export function stackTrace(thrown: unknown, seen = new Set<unknown>()): string {
  if (!(thrown instanceof Error)) {
    return typeof thrown === "string" ? thrown : `A value of type ${typeof thrown} was thrown.`;
  }
  seen.add(thrown);
  const causes = related(thrown)
    .filter((cause) => !seen.has(cause))
    .map((cause) => `\nCaused by: ${stackTrace(cause, seen)}`);
  return `${thrown.stack ?? String(thrown)}${causes.join("")}`;
}
