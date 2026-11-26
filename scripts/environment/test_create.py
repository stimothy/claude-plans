"""Tests for creating the Python environment."""

import sys
from collections.abc import Sequence
from pathlib import Path

import pytest

from scripts.environment.create import SetupError, create, environment_python, main, run_command


class Recorder:
    """Records commands instead of running them, and fails the ones it is told to."""

    def __init__(self, failing: str | None = None) -> None:
        """Fail any command that has `failing` among its arguments."""
        self.failing = failing
        self.commands: list[list[str]] = []

    def __call__(self, command: Sequence[str], _directory: Path) -> int:
        """Record a command and return its exit code."""
        self.commands.append(list(command))
        return 1 if self.failing in command else 0


@pytest.mark.parametrize(("system", "location"), [("posix", "bin/python"), ("nt", "Scripts/python.exe")])
def test_environment_python_depends_on_the_operating_system(system: str, location: str) -> None:
    """Windows keeps the interpreter in another place."""
    python = environment_python(Path("/repository"), system)

    assert python == Path("/repository/.venv") / location


def test_create_builds_checks_and_fills_the_environment() -> None:
    """Setup runs its three steps in order."""
    recorder = Recorder()

    create(Path("/repository"), "python3.12", "posix", recorder)

    environment, version_check, install = recorder.commands
    assert environment == ["python3.12", "-m", "venv", str(Path("/repository/.venv"))]
    assert version_check[:2] == [str(Path("/repository/.venv/bin/python")), "-c"]
    assert install[-2:] == ["--requirement", str(Path("/repository/requirements.txt"))]


@pytest.mark.parametrize(
    ("failing", "message", "commands_run"),
    [
        ("venv", "could not be created", 1),
        ("-c", "Delete .venv", 2),
        ("install", "could not be installed", 3),
    ],
)
def test_create_stops_at_the_first_failure(failing: str, message: str, commands_run: int) -> None:
    """A failed step explains itself, and later steps do not run."""
    recorder = Recorder(failing)

    with pytest.raises(SetupError, match=message):
        create(Path("/repository"), "python3.12", "posix", recorder)

    assert len(recorder.commands) == commands_run


def test_main_reports_a_failure(capsys: pytest.CaptureFixture[str]) -> None:
    """A failure is printed and sets the exit code."""
    status = main(Recorder("venv"))

    assert status == 1
    assert "could not be created" in capsys.readouterr().err


def test_main_succeeds_when_every_command_does() -> None:
    """Success sets a zero exit code."""
    status = main(Recorder())

    assert status == 0


def test_run_command_returns_the_exit_code(tmp_path: Path) -> None:
    """The caller learns how the command ended."""
    expected = 3

    status = run_command([sys.executable, "-c", f"raise SystemExit({expected})"], tmp_path)

    assert status == expected
