"""Tests for the Claude hook, its settings, and installing the Git hook."""

import io
import json
import subprocess
from collections.abc import Sequence
from pathlib import Path

import pytest

from scripts.guard import claude_hook, git_hooks
from scripts.guard.git_hooks import install
from scripts.guard.repository import LOCATION_VARIABLES, Git, run_git

ROOT = Path(__file__).resolve().parents[2]
OWN_HOOK = "#!/bin/sh\necho mine\n"


@pytest.mark.parametrize(
    ("tool", "command", "code"),
    [("Bash", "git push -f", 2), ("Bash", "git status", 0), ("Monitor", None, 0), ("PowerShell", "git push `\n-f", 2)],
)
def test_the_claude_hook_exits_with_2_to_block(tool: str, command: str | None, code: int, tmp_path: Path) -> None:
    """Check that the Claude hook exits with 2 to block."""
    tool_input = {} if command is None else {"command": command}
    request = {"cwd": str(tmp_path), "tool_name": tool, "tool_input": tool_input}

    result = claude_hook.main(io.StringIO(json.dumps(request)))

    assert result == code


def test_the_claude_hook_judges_the_directory_of_the_request(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Check that the Claude hook judges the directory of the request."""
    seen: list[Path] = []
    monkeypatch.setattr(claude_hook, "run_git", lambda _arguments, directory: seen.append(directory))
    request = {"cwd": str(tmp_path), "tool_input": {"command": "git push"}}

    claude_hook.main(io.StringIO(json.dumps(request)))

    assert seen == [tmp_path]


def test_the_claude_hook_reads_utf_8_whatever_the_system_uses(monkeypatch: pytest.MonkeyPatch) -> None:
    """Check that the Claude hook reads UTF-8 whatever the system uses."""
    request = json.dumps({"cwd": ".", "tool_input": {"command": "echo ”←"}}, ensure_ascii=False)
    stream = io.TextIOWrapper(io.BytesIO(request.encode()), encoding="cp1252")
    monkeypatch.setattr("sys.stdin", stream)

    result = claude_hook.main()

    assert result == 0


def test_the_settings_run_the_check_and_block_when_it_fails() -> None:
    """Check that the settings run the check and block when it fails."""
    settings = json.loads((ROOT / ".claude" / "settings.json").read_text(encoding="utf-8"))

    entry = settings["hooks"]["PreToolUse"][0]
    command = entry["hooks"][0]["command"]

    assert entry["matcher"].split("|") == ["Bash", "PowerShell", "Monitor"]
    assert "scripts.guard.claude_hook" in command
    assert command.endswith("exit 2; }")
    # Without this, a hook that times out lets the command run.
    assert entry["hooks"][0]["onFailure"] == "block"
    assert "Bash(gh pr merge:*)" in settings["permissions"]["deny"]


@pytest.mark.parametrize("rule", ["Bash(*install:studio*)", "Bash(*--studio*)"])
def test_the_settings_ask_before_an_install_into_the_real_data(rule: str) -> None:
    """Check that the settings ask before a Bash command that names the studio install."""
    settings = json.loads((ROOT / ".claude" / "settings.json").read_text(encoding="utf-8"))

    assert rule in settings["permissions"]["ask"]


def test_npm_install_installs_the_git_hook() -> None:
    """Check that npm install installs the Git hook."""
    package = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))

    assert package["scripts"]["prepare"].endswith("scripts.guard.git_hooks")


def fake_git(root: Path, hooks_path: str | None = None) -> Git:
    """Stand in for Git in a repository at a directory."""

    def run(arguments: Sequence[str], _directory: Path) -> str | None:
        if "--show-toplevel" in arguments:
            return str(root)
        return ".git" if "--git-common-dir" in arguments else hooks_path

    return run


@pytest.mark.parametrize(
    ("hooks_path", "existing", "installs"),
    [(None, None, True), (None, f"# {git_hooks.MARKER}\nold\n", True), (None, OWN_HOOK, False), ("mine", None, False)],
)
def test_install_never_replaces_your_own_hooks(
    hooks_path: str | None, existing: str | None, installs: bool, tmp_path: Path
) -> None:
    """Check that install never replaces your own hooks."""
    hook = tmp_path / ".git" / "hooks" / "pre-push"
    if existing:
        hook.parent.mkdir(parents=True)
        hook.write_text(existing, encoding="utf-8")

    result = install(tmp_path, fake_git(tmp_path, hooks_path))

    assert result == 0
    assert (hook.exists() and hook.read_bytes() == git_hooks.SOURCE.read_bytes()) is installs


def test_install_reports_a_hook_that_cannot_be_written(tmp_path: Path) -> None:
    """Check that install reports a hook that cannot be written."""
    (tmp_path / ".git").write_text("a file where the directory should be", encoding="utf-8")

    result = install(tmp_path, fake_git(tmp_path))

    assert result == 1


def test_install_does_nothing_outside_a_git_repository(tmp_path: Path) -> None:
    """Check that install does nothing outside a Git repository."""
    result = install(tmp_path, lambda _arguments, _directory: None)

    assert result == 0
    assert not (tmp_path / ".git").exists()


def test_run_git_ignores_variables_that_point_at_another_repository(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Check that run_git ignores variables that point at another repository."""
    seen: dict[str, str] = {}

    def record(*_arguments: object, **options: object) -> subprocess.CompletedProcess[str]:
        environment = options["env"]
        assert isinstance(environment, dict)
        seen.update(environment)
        return subprocess.CompletedProcess([], 0, stdout="")

    monkeypatch.setattr("subprocess.run", record)
    for variable in LOCATION_VARIABLES:
        monkeypatch.setenv(variable, "elsewhere")
    monkeypatch.setenv("GIT_CONFIG_NOSYSTEM", "1")

    run_git(["--version"], tmp_path)

    assert {"GIT_DIR", "GIT_COMMON_DIR", "GIT_OBJECT_DIRECTORY"} <= set(LOCATION_VARIABLES)
    assert not set(LOCATION_VARIABLES) & set(seen)
    assert seen["GIT_CONFIG_NOSYSTEM"] == "1"


def test_run_git_returns_output_or_nothing(tmp_path: Path) -> None:
    """Check that run_git returns output or nothing."""
    version = run_git(["--version"], tmp_path)
    missing_directory = run_git(["--version"], tmp_path / "missing")
    failure = run_git(["config", "--get", "claude-plans.missing"], tmp_path)

    assert version is not None
    assert version.startswith("git version")
    assert not version.endswith("\n")
    assert missing_directory is None
    assert failure is None
