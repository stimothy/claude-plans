"""Checks every file in the repository against the structural code standards."""

import sys
from pathlib import Path

from scripts.guard.repository import Git, run_git
from scripts.standards.layout import layout_problems
from scripts.standards.suppressions import suppression_problems


def _text(path: Path) -> str | None:
    """Return a file's text, or nothing if it is binary."""
    data = path.read_bytes()
    # Text in another encoding is still checked, and a byte order mark is not part of it.
    return None if b"\0" in data else data.decode("utf-8-sig", errors="replace")


def main(root: Path, git: Git) -> int:
    """List every problem, and return the exit code."""
    # New files count before they are committed, but ignored files never do.
    listed = git(["ls-files", "-z", "--cached", "--others", "--exclude-standard"], root)
    if listed is None:
        print(f"Git could not list the files in {root}.", file=sys.stderr)
        return 1
    names = sorted({name for name in listed.split("\0") if name})
    files = {name: _text(root / name) for name in names if (root / name).is_file()}
    problems = layout_problems(files)
    for name, content in files.items():
        problems.extend(suppression_problems(name, content or ""))
    for problem in problems:
        print(problem, file=sys.stderr)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main(Path.cwd(), run_git))
