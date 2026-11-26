"""Installs the Git hook that rejects pushes to master. `npm install` runs this."""

import sys
from pathlib import Path

from scripts.guard.repository import Git, run_git

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(__file__).resolve().parent / "pre-push"
# A hook that holds this line is a copy of ours, so it may be replaced.
MARKER = "claude-plans pre-push hook"


def install(root: Path = ROOT, git: Git = run_git) -> int:
    """Copy the hook into Git's hooks directory, unless that would replace or sit beside your own hooks."""
    top = git(["rev-parse", "--show-toplevel"], root)
    common = git(["rev-parse", "--git-common-dir"], root)
    # A copy of the source inside some other repository must not change that repository.
    if top is None or common is None or Path(top).resolve() != root.resolve():
        return 0
    hook = (root / common).resolve() / "hooks" / "pre-push"
    try:
        custom = git(["config", "--get", "core.hooksPath"], root)
        if custom or (hook.exists() and MARKER not in hook.read_text(encoding="utf-8", errors="replace")):
            print("Your own Git hooks were kept, so pushes to master are not blocked here.", file=sys.stderr)
            return 0
        hook.parent.mkdir(parents=True, exist_ok=True)
        hook.write_bytes(SOURCE.read_bytes())
        hook.chmod(0o755)
    except OSError as error:
        print(f"The Git hook could not be installed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(install())
