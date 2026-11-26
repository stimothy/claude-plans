"""Create `.venv` and install the Python tools into it. Run through `npm run setup:python`."""

import os
import subprocess
import sys
from collections.abc import Callable, Sequence
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
VERSION_CHECK = "import sys; sys.exit(sys.version_info < (3, 12))"

Run = Callable[[Sequence[str], Path], int]


class SetupError(Exception):
    """The environment could not be set up."""


def run_command(command: Sequence[str], directory: Path) -> int:
    """Run a command in a directory and return its exit code."""
    return subprocess.run(command, cwd=directory, check=False).returncode


def environment_python(root: Path, system: str) -> Path:
    """Return the environment's Python for an operating system, named as in `os.name`."""
    location = ("Scripts", "python.exe") if system == "nt" else ("bin", "python")
    return root.joinpath(".venv", *location)


def create(root: Path, interpreter: str, system: str, run: Run) -> None:
    """Create the environment with an interpreter, or update the existing one.

    Raises:
        SetupError: A step failed, or an existing environment uses a Python that is too old.
    """
    python = str(environment_python(root, system))
    install = [python, "-m", "pip", "install", "--disable-pip-version-check", "--requirement"]
    steps = [
        ([interpreter, "-m", "venv", str(root / ".venv")], "The environment could not be created."),
        ([python, "-c", VERSION_CHECK], "Delete .venv, which uses a Python older than 3.12, and run setup again."),
        ([*install, str(root / "requirements.txt")], "The Python tools could not be installed."),
    ]
    for command, message in steps:
        if run(command, root) != 0:
            raise SetupError(message)


def main(run: Run = run_command) -> int:
    """Set up this repository's environment and return the exit code."""
    try:
        create(ROOT, sys.executable, os.name, run)
    except SetupError as error:
        print(error, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
