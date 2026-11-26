"""The repository's Git hooks, and turning them on. `npm install` runs `install`."""

import sys
from pathlib import Path
from typing import TextIO

from scripts.guard.repository import Git, run_git

ROOT = Path(__file__).resolve().parents[2]
HOOKS = ".githooks"


def pre_push(refs: TextIO = sys.stdin) -> int:
    """Reject a push to master. Git gives one line per ref: local ref and commit, then remote ref and commit."""
    if any(line.split()[2:3] == ["refs/heads/master"] for line in refs):
        print("Pushing to master is not allowed. Push a branch and open a pull request.", file=sys.stderr)
        return 1
    return 0


def install(root: Path = ROOT, git: Git = run_git) -> int:
    """Turn the hooks on, unless that would turn off hooks that are already set up."""
    shared = git(["rev-parse", "--path-format=absolute", "--git-common-dir"], root)
    if shared is None:
        return 0
    configured = git(["config", "--get", "core.hooksPath"], root)
    if configured == HOOKS:
        return 0
    hooks = Path(shared) / "hooks"
    if configured or any(hook.suffix != ".sample" for hook in hooks.glob("*")):
        print(f"Your own Git hooks were kept, so the hooks in {HOOKS}/ are off.", file=sys.stderr)
        return 0
    if git(["config", "core.hooksPath", HOOKS], root) is None:
        print(f"The hooks in {HOOKS}/ could not be turned on.", file=sys.stderr)
        return 1
    return 0


def main(hook: str) -> int:
    """Run the named hook and return its exit code."""
    return pre_push() if hook == "pre-push" else install()


if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
