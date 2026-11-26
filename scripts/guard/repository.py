"""Asks Git about a repository."""

import subprocess
from collections.abc import Callable, Sequence
from pathlib import Path

Git = Callable[[Sequence[str], Path], str | None]


def run_git(arguments: Sequence[str], directory: Path) -> str | None:
    """Run Git in a directory and return its output, or nothing if it fails."""
    try:
        result = subprocess.run(["git", *arguments], cwd=directory, capture_output=True, text=True, check=False)
    except OSError:
        return None
    return result.stdout.strip() if result.returncode == 0 else None
