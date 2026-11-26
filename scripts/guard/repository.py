"""Asks Git about a repository."""

import os
import subprocess
from collections.abc import Callable, Sequence
from pathlib import Path

Git = Callable[[Sequence[str], Path], str | None]

# These make Git work on a repository other than the one in its directory.
LOCATION_VARIABLES = (
    "GIT_COMMON_DIR",
    "GIT_DIR",
    "GIT_INDEX_FILE",
    "GIT_NAMESPACE",
    "GIT_OBJECT_DIRECTORY",
    "GIT_WORK_TREE",
)


def run_git(arguments: Sequence[str], directory: Path) -> str | None:
    """Run Git in a directory and return its output, or nothing if it fails."""
    environment = {name: value for name, value in os.environ.items() if name not in LOCATION_VARIABLES}
    try:
        result = subprocess.run(
            ["git", *arguments],
            cwd=directory,
            env=environment,
            capture_output=True,
            encoding="utf-8",
            timeout=10,
            check=False,
        )
    except (OSError, UnicodeError, subprocess.TimeoutExpired):
        return None
    return result.stdout.strip() if result.returncode == 0 else None
