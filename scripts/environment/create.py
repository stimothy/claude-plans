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
    """Run a command in a directory and return its exit code, which is 1 if it cannot start."""
    try:
        return subprocess.run(command, cwd=directory, check=False).returncode
    except OSError as error:
        print(f"{command[0]}: {error}", file=sys.stderr)
        return 1


def environment_python(root: Path, system: str) -> Path:
    """Return the environment's Python for an operating system, named as in `os.name`."""
    location = ("Scripts", "python.exe") if system == "nt" else ("bin", "python")
    return root.joinpath(".venv", *location)


def create(root: Path, interpreter: str, system: str, run: Run) -> None:
    """Install the tools into the environment, first creating it with an interpreter if it has no Python.

    An environment that has a Python is kept, because creating it again would not replace the interpreter.
    One whose Python is missing or a broken link is cleared, because creating over it fails.

    Raises:
        SetupError: A step failed, or an existing environment is broken or uses a Python that is too old.
    """
    existing = environment_python(root, system)
    python = str(existing)
    options = ["--disable-pip-version-check", "--require-hashes"]
    install = [python, "-m", "pip", "install", *options, "--requirement"]
    unusable = "The Python in .venv does not run or is older than 3.12. Delete .venv and run setup again."
    steps = [
        ([python, "-c", VERSION_CHECK], unusable),
        ([*install, str(root / "requirements.txt")], "The Python tools could not be installed."),
    ]
    if not existing.exists():
        venv = [interpreter, "-m", "venv", "--clear", str(root / ".venv")]
        steps.insert(0, (venv, "The environment could not be created."))
    for command, message in steps:
        if run(command, root) != 0:
            raise SetupError(message)


def main(run: Run = run_command, root: Path = ROOT) -> int:
    """Set up the repository's environment and return the exit code."""
    try:
        create(root, sys.executable, os.name, run)
    except SetupError as error:
        print(error, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
