"""Tests for the Claude and Git hooks."""

import io
import json
from collections.abc import Sequence
from pathlib import Path

import pytest

from scripts.guard.claude_hook import main as claude_hook
from scripts.guard.git_hooks import install, pre_push
from scripts.guard.repository import run_git


@pytest.mark.parametrize(("command", "code"), [("git push -f", 2), ("git status", 0), (None, 0)])
def test_the_claude_hook_exits_with_2_to_block(command: str | None, code: int, tmp_path: Path) -> None:
    """Check that the claude hook exits with 2 to block."""
    request = {"cwd": str(tmp_path), "tool_input": {} if command is None else {"command": command}}

    result = claude_hook(io.StringIO(json.dumps(request)))

    assert result == code


@pytest.mark.parametrize(("remote", "code"), [("refs/heads/master", 1), ("refs/heads/11-master", 0)])
def test_the_pre_push_hook_rejects_only_master(remote: str, code: int) -> None:
    """Check that the pre push hook rejects only master."""
    lines = io.StringIO(f"refs/heads/11-work abc refs/heads/11-work def\nrefs/heads/x abc {remote} def\n")

    result = pre_push(lines)

    assert result == code


@pytest.mark.parametrize(
    ("configured", "existing_hook", "sets"),
    [(None, False, True), (".githooks", False, False), ("elsewhere", False, False), (None, True, False)],
)
def test_install_sets_the_hooks_path_only_when_nothing_would_be_replaced(
    configured: str | None, existing_hook: bool, sets: bool, tmp_path: Path
) -> None:
    """Check that install sets the hooks path only when nothing would be replaced."""
    (tmp_path / "hooks").mkdir()
    (tmp_path / "hooks" / ("pre-commit" if existing_hook else "pre-commit.sample")).touch()
    calls: list[Sequence[str]] = []

    def run(arguments: Sequence[str], _directory: Path) -> str | None:
        calls.append(arguments)
        if arguments[0] == "rev-parse":
            return str(tmp_path)
        return configured if "--get" in arguments else ""

    result = install(tmp_path, run)

    assert result == 0
    assert (["config", "core.hooksPath", ".githooks"] in calls) is sets


def test_install_reports_a_setting_that_cannot_be_saved(tmp_path: Path) -> None:
    """Check that install reports a setting that cannot be saved."""
    result = install(tmp_path, lambda arguments, _directory: str(tmp_path) if arguments[0] == "rev-parse" else None)

    assert result == 1


def test_install_does_nothing_outside_a_git_repository(tmp_path: Path) -> None:
    """Check that install does nothing outside a git repository."""
    calls: list[Sequence[str]] = []

    result = install(tmp_path, lambda arguments, _directory: calls.append(arguments))

    assert result == 0
    assert len(calls) == 1


def test_run_git_returns_output_or_nothing(tmp_path: Path) -> None:
    """Check that run git returns output or nothing."""
    version = run_git(["--version"], tmp_path)
    missing_directory = run_git(["--version"], tmp_path / "missing")
    failure = run_git(["config", "--get", "claude-plans.missing"], tmp_path)

    assert version is not None
    assert version.startswith("git version")
    assert missing_directory is None
    assert failure is None
