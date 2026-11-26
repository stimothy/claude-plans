"""Asks Git about a repository."""

import subprocess
from collections.abc import Callable, Sequence
from pathlib import Path

Git = Callable[[Sequence[str], Path], str | None]


def run_git(arguments: Sequence[str], directory: Path) -> str | None:
    """Run Git in a directory and return its output, or nothing if it fails."""
    try:
        result = subprocess.run(
            ["git", *arguments], cwd=directory, capture_output=True, encoding="utf-8", timeout=10, check=False
        )
    except (OSError, UnicodeError, subprocess.TimeoutExpired):
        return None
    return result.stdout.strip() if result.returncode == 0 else None
