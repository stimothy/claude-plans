/**
 * What a migration is.
 *
 * @packageDocumentation
 */
import type { DatabaseSync } from "node:sqlite";

/** One step that moves the database forward. There is no step back. */
export interface Migration {
  /** The schema version that the database has after this step. */
  readonly version: number;
  /** A few words about what the step does. */
  readonly name: string;
  /**
   * Changes the schema, the data, or both. It runs inside a transaction, so it must not begin or end one, and it
   * must finish before it returns.
   */
  readonly apply: (database: DatabaseSync) => void;
}
