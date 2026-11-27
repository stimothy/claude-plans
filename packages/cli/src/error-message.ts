/**
 * The text of a failure, for what a command prints.
 *
 * @packageDocumentation
 */

/** Returns what went wrong, whatever was thrown. */
export const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));
