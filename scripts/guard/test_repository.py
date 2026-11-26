"""Integration tests of the guard with real Git repositories in temporary directories."""

import os
import subprocess
from pathlib import Path

import pytest

from scripts.guard.commands import blocked_reason
from scripts.guard.git_hooks import install
from scripts.guard.repository import LOCATION_VARIABLES, run_git


def git(directory: Path, *arguments: str) -> int:
    """Run Git and return its exit code."""
    return subprocess.run(["git", *arguments], cwd=directory, capture_output=True, check=False).returncode


@pytest.fixture
def checkout(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Create a main checkout on master with a subdirectory, a linked worktree, and a bare remote."""
    # The user's own Git settings, such as commit signing or hooks, must not reach these repositories.
    monkeypatch.setenv("GIT_CONFIG_GLOBAL", os.devnull)
    monkeypatch.setenv("GIT_CONFIG_NOSYSTEM", "1")
    for variable in LOCATION_VARIABLES:
        monkeypatch.delenv(variable, raising=False)
    main = tmp_path / "main"
    (main / "sub").mkdir(parents=True)
    author = ["-c", "user.name=Test", "-c", "user.email=test@example.invalid"]
    assert git(main, "init", "--initial-branch=master") == 0
    assert git(main, *author, "commit", "--allow-empty", "--message=start") == 0
    assert git(main, "worktree", "add", "-b", "work", str(tmp_path / "worktree")) == 0
    assert git(tmp_path, "init", "--bare", "remote.git") == 0
    return main


@pytest.mark.parametrize(("place", "blocked"), [("main", True), ("main/sub", True), ("worktree", False)])
def test_real_git_tells_a_main_checkout_from_a_worktree(checkout: Path, place: str, blocked: bool) -> None:
    """Check that real Git tells a main checkout from a worktree."""
    directory = checkout.parent / place

    clean = blocked_reason("git clean -fdx", directory, run_git)
    push = blocked_reason("git push", directory, run_git)

    assert (clean is not None) is blocked
    assert (push is not None) is blocked


def test_the_installed_hook_rejects_only_pushes_to_master(checkout: Path) -> None:
    """Check that the installed hook rejects only pushes to master."""
    worktree = checkout.parent / "worktree"
    remote = str(checkout.parent / "remote.git")

    installed = install(checkout, run_git)
    to_master = git(worktree, "push", remote, "HEAD:refs/heads/master")
    spaced = git(worktree, "push", remote, "HEAD@{1 second ago}:refs/heads/master")
    to_branch = git(worktree, "push", remote, "HEAD:refs/heads/work")

    assert installed == 0
    assert to_master != 0
    assert spaced != 0
    assert to_branch == 0


def test_install_leaves_an_enclosing_repository_alone(checkout: Path) -> None:
    """Check that install leaves an enclosing repository alone."""
    result = install(checkout / "sub", run_git)

    assert result == 0
    assert not (checkout / ".git" / "hooks" / "pre-push").exists()
