"""Tests for creating the Python environment."""

import sys
from collections.abc import Sequence
from pathlib import Path

import pytest

from scripts.environment.create import (
    ROOT,
    VERSION_CHECK,
    SetupError,
    create,
    environment_python,
    main,
    run_command,
)


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
    assert environment == ["python3.12", "-m", "venv", "--clear", str(Path("/repository/.venv"))]
    python = str(Path("/repository/.venv/bin/python"))
    assert version_check == [python, "-c", VERSION_CHECK]
    requirements = str(Path("/repository/requirements.txt"))
    options = ["--disable-pip-version-check", "--require-hashes"]
    assert install == [python, "-m", "pip", "install", *options, "--requirement", requirements]


def test_create_keeps_an_environment_that_has_a_python(tmp_path: Path) -> None:
    """Running the venv module again would not change the interpreter, and can leave the two mixed."""
    python = environment_python(tmp_path, "posix")
    python.parent.mkdir(parents=True)
    python.touch()
    recorder = Recorder()

    create(tmp_path, "python3.14", "posix", recorder)

    assert [command[0] for command in recorder.commands] == [str(python), str(python)]


@pytest.mark.parametrize(("version", "status"), [((3, 11, 9), 1), ((3, 12, 0), 0)])
def test_version_check_accepts_only_python_3_12_or_newer(
    tmp_path: Path, version: tuple[int, int, int], status: int
) -> None:
    """The real check runs against a pretended version."""
    pretend = f"import sys; sys.version_info = {version}; "

    assert run_command([sys.executable, "-c", pretend + VERSION_CHECK], tmp_path) == status


@pytest.mark.parametrize(
    ("failing", "message", "commands_run"),
    [
        ("venv", "could not be created", 1),
        ("-c", "Delete .venv and run", 2),
        ("install", "could not be installed", 3),
    ],
)
def test_create_stops_at_the_first_failure(failing: str, message: str, commands_run: int) -> None:
    """A failed step explains itself, and later steps do not run."""
    recorder = Recorder(failing)

    with pytest.raises(SetupError, match=message):
        create(Path("/repository"), "python3.12", "posix", recorder)

    assert len(recorder.commands) == commands_run


def test_main_reports_a_failure(capsys: pytest.CaptureFixture[str], tmp_path: Path) -> None:
    """A failure is printed and sets the exit code."""
    status = main(Recorder("venv"), tmp_path)

    assert status == 1
    assert "could not be created" in capsys.readouterr().err


def test_main_succeeds_when_every_command_does(tmp_path: Path) -> None:
    """Success sets a zero exit code, using this interpreter and operating system."""
    recorder = Recorder()

    status = main(recorder, tmp_path)

    assert status == 0
    environment, version_check, _install = recorder.commands
    assert environment == [sys.executable, "-m", "venv", "--clear", str(tmp_path / ".venv")]
    location = "Scripts/python.exe" if sys.platform == "win32" else "bin/python"
    assert version_check[0] == str(tmp_path / ".venv" / location)


def test_the_root_is_the_repository() -> None:
    """Setup works on the directory that holds the project."""
    assert (ROOT / "package.json").is_file()


def test_run_command_returns_the_exit_code(tmp_path: Path) -> None:
    """The caller learns how the command ended."""
    expected = 3

    status = run_command([sys.executable, "-c", f"raise SystemExit({expected})"], tmp_path)

    assert status == expected


def test_run_command_fails_when_the_program_cannot_start(capsys: pytest.CaptureFixture[str], tmp_path: Path) -> None:
    """A missing interpreter is a failed step, not a crash."""
    status = run_command([str(tmp_path / "missing-python")], tmp_path)

    assert status == 1
    assert "missing-python" in capsys.readouterr().err
