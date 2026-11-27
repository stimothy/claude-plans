import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { dataDirectory } from "./data-directory.ts";

const repository = resolve("a-repository");

describe("the data directory", () => {
  it("is .claude-plans in the repository by default", () => {
    expect(dataDirectory(repository)).toBe(join(repository, ".claude-plans"));
  });

  it("may be another directory, given as a full path", () => {
    const other = resolve("another-place");

    expect(dataDirectory(repository, other)).toBe(other);
  });

  it("takes a relative path from the current directory, not from the repository", () => {
    expect(dataDirectory(repository, "scratch/data")).toBe(resolve("scratch/data"));
  });

  it.each(["", "  "])("may not be named %j, which would silently mean another place", (option) => {
    expect(() => dataDirectory(repository, option)).toThrow("The data directory's path is empty.");
  });
});
