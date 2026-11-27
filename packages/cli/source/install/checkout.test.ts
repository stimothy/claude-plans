import { mkdirSync, symlinkSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { isInRealData, isRealDataDirectory, realDataDirectory, requirePlainInstall } from "./checkout.ts";
import { commitAll, useFakeRepository, writeInto } from "./fake-repository.ts";
import { runGit } from "./run-program.ts";

const fake = useFakeRepository();

function addWorktree(): string {
  const worktree = fake.elsewhere("worktree");
  runGit(fake.repository(), ["worktree", "add", "-b", "feature", worktree]);
  return worktree;
}

describe("the real data directory", () => {
  it("is .claude-plans in the main checkout", () => {
    expect(realDataDirectory(fake.repository())).toBe(join(fake.repository(), ".claude-plans"));
  });

  it("is still the main checkout's when asked from a worktree", () => {
    expect(realDataDirectory(addWorktree())).toBe(join(fake.repository(), ".claude-plans"));
  });

  it("is found even when the environment points Git somewhere else", () => {
    vi.stubEnv("GIT_DIR", fake.elsewhere("another"));

    expect(realDataDirectory(fake.repository())).toBe(join(fake.repository(), ".claude-plans"));
  });

  // Guessing could let development reach the real data.
  it("cannot be told for a directory that is not the top of a checkout", () => {
    expect(() => realDataDirectory(join(fake.repository(), "packages"))).toThrow("Cannot tell where the real data is");
    expect(() => realDataDirectory(fake.elsewhere(".."))).toThrow("Cannot tell where the real data is");
  });

  it.each([".claude-plans", ".Claude-Plans", join(".claude-plans", "inside"), join("packages", "..", ".claude-plans")])(
    "holds %s, before and after it exists",
    (path) => {
      expect(isInRealData(join(fake.repository(), path), fake.repository())).toBe(true);
      mkdirSync(join(fake.repository(), ".claude-plans"));
      expect(isInRealData(join(fake.repository(), path), fake.repository())).toBe(true);
    },
  );

  it("holds a directory that is reached through a link", () => {
    mkdirSync(join(fake.repository(), ".claude-plans"));
    symlinkSync(fake.repository(), fake.elsewhere("link"), "junction");

    const linked = join(fake.elsewhere("link"), ".claude-plans");

    expect(isInRealData(linked, fake.repository())).toBe(true);
    expect(isRealDataDirectory(linked, fake.repository())).toBe(true);
  });

  it.each([".claude-plans-development", "packages", "."])("does not hold %s", (path) => {
    expect(isInRealData(join(fake.repository(), path), fake.repository())).toBe(false);
  });

  it("is not a directory inside it", () => {
    expect(isRealDataDirectory(join(fake.repository(), ".claude-plans", "inside"), fake.repository())).toBe(false);
  });

  it("does not hold a worktree's own .claude-plans", () => {
    const worktree = addWorktree();

    expect(isInRealData(join(worktree, ".claude-plans"), worktree)).toBe(false);
  });
});

describe("a plain install", () => {
  const attempt =
    (repository = fake.repository()) =>
    () => {
      requirePlainInstall(repository);
    };

  it("is allowed from the main checkout on an unchanged master, whatever Git ignores", () => {
    writeInto(fake.repository(), ".claude-plans/settings.yaml", "theme: dark\n");

    expect(attempt()).not.toThrow();
  });

  it("is allowed when the remote has commits that local master does not", () => {
    commitAll(fake.repository());
    runGit(fake.repository(), ["update-ref", "refs/remotes/origin/master", "HEAD"]);
    runGit(fake.repository(), ["reset", "--hard", "HEAD~1"]);

    expect(attempt()).not.toThrow();
  });

  it("is refused from a worktree, even on master", () => {
    runGit(fake.repository(), ["switch", "--create", "feature"]);
    const worktree = fake.elsewhere("worktree");
    runGit(fake.repository(), ["worktree", "add", worktree, "master"]);

    expect(attempt(worktree)).toThrow("worktree");
  });

  it.each([
    ["another branch", ["switch", "--create", "feature"]],
    ["no branch", ["switch", "--detach"]],
  ])("is refused on %s", (_, given) => {
    runGit(fake.repository(), given);

    expect(attempt()).toThrow("not on the master branch");
  });

  it.each(["package.json", "new-file.ts"])("is refused with a change to %s that is not committed", (name) => {
    // Git can be told to hide new files, which must not let one into the real application.
    runGit(fake.repository(), ["config", "status.showUntrackedFiles", "no"]);
    writeInto(fake.repository(), name, "{}");

    expect(attempt()).toThrow("changes that are not committed");
  });

  it("is refused when master has commits that origin/master does not", () => {
    commitAll(fake.repository());

    expect(attempt()).toThrow("commits that origin/master does not");
  });

  it("is refused when there is no origin/master to compare with", () => {
    runGit(fake.repository(), ["update-ref", "-d", "refs/remotes/origin/master"]);

    expect(attempt()).toThrow("Cannot compare master with origin/master");
  });

  it("says that nothing changed, and how to try the code another way", () => {
    commitAll(fake.repository());

    expect(attempt()).toThrow(
      "Nothing was changed. To try this code, give a separate directory with --data-directory.",
    );
  });
});
