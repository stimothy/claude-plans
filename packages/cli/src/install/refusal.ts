/**
 * A command's refusal to do what would be unsafe.
 *
 * @packageDocumentation
 */

/** Says why a command would not act. A refusal changes nothing, so it is not even logged in the data directory. */
export class Refusal extends Error {}
