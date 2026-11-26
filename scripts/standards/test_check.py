"""Tests for checking every file in a repository."""

from collections.abc import Sequence
from pathlib import Path

import pytest

from scripts.guard.repository import run_git
from scripts.standards.check import main


def repository(root: Path, files: dict[str, bytes]) -> Path:
    """Make a real repository that holds some untracked files."""
    run_git(["init", "--quiet"], root)
    for name, content in files.items():
        path = root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
    return root


def test_a_repository_without_problems_passes(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    """Check that a repository without problems passes."""
    root = repository(tmp_path, {".gitignore": b"ignored/\n", "ignored/utils.py": b"", "image.png": b"\x89PNG\0"})

    status = main(root, run_git)

    assert status == 0
    assert capsys.readouterr().err == ""


def test_every_problem_is_listed(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    """Check that every problem is listed."""
    root = repository(tmp_path, {"source/utils.py": b"value = 1  # noqa\n"})

    status = main(root, run_git)

    assert status == 1
    listed = capsys.readouterr().err
    assert "source/utils.py: 'utils.py' is a catch-all name" in listed
    assert "source/utils.py:1: " in listed


@pytest.mark.parametrize(
    ("name", "content"),
    [("tool.sh", b"# caf\xe9\n# shellcheck disable=SC2086\n"), ("tool.py", b"\xef\xbb\xbfvalue = 1  # noqa\n")],
)
def test_text_in_another_encoding_is_still_checked(
    tmp_path: Path, name: str, content: bytes, capsys: pytest.CaptureFixture[str]
) -> None:
    """Check that text in another encoding is still checked."""
    root = repository(tmp_path, {name: content})

    status = main(root, run_git)

    assert status == 1
    assert "turns a check off" in capsys.readouterr().err


def test_a_file_with_a_zero_byte_is_binary(tmp_path: Path) -> None:
    """Check that a file with a zero byte is binary."""
    root = repository(tmp_path, {"data.bin": b"\0" + b"line\n" * 301})

    status = main(root, run_git)

    assert status == 0


def test_a_binary_ignore_file_is_still_rejected(tmp_path: Path) -> None:
    """Check that a binary ignore file is still rejected."""
    root = repository(tmp_path, {".prettierignore": b"\0"})

    status = main(root, run_git)

    assert status == 1


def test_a_deleted_file_that_git_still_tracks_is_passed_over(tmp_path: Path) -> None:
    """Check that a deleted file that Git still tracks is passed over."""
    root = repository(tmp_path, {"utils.py": b""})
    run_git(["add", "utils.py"], root)
    (root / "utils.py").unlink()

    status = main(root, run_git)

    assert status == 0


def test_the_check_fails_when_git_cannot_list_the_files(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    """Check that the check fails when Git cannot list the files."""
    status = main(tmp_path, lambda _arguments, _directory: None)

    assert status == 1
    assert "Git could not list the files" in capsys.readouterr().err


def test_git_is_asked_for_tracked_and_new_files(tmp_path: Path) -> None:
    """Check that Git is asked for tracked and new files."""
    seen: list[Sequence[str]] = []

    def git(arguments: Sequence[str], _directory: Path) -> str:
        seen.append(arguments)
        return ""

    main(tmp_path, git)

    assert seen == [["ls-files", "-z", "--cached", "--others", "--exclude-standard"]]
