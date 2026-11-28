"""Tests for releasing the version that a merge raised."""

import json
from collections.abc import Sequence
from pathlib import Path

import pytest

from scripts.release.create import main

RELEASES = "repos/{owner}/{repo}/releases"
TAGS = "repos/{owner}/{repo}/git/matching-refs/tags/v0.2.0"


class GitHub:
    """Stands in for gh, with the releases and tags that GitHub has, and keeps what is asked of it."""

    def __init__(self, releases: str = "v0.1.0", tags: str = "", fails: str = "") -> None:
        """Start with some releases and tags, and one request that gets no answer."""
        self.answers = {RELEASES: releases, TAGS: tags, "create": "https://example.invalid/release"}
        self.fails = fails
        self.created: list[Sequence[str]] = []

    def __call__(self, arguments: Sequence[str]) -> str | None:
        """Answer one request."""
        asked = next(key for key in self.answers if key in arguments)
        if asked == self.fails:
            return None
        if asked == "create":
            self.created.append(arguments)
        # A list that is read without every page would be cut short.
        elif asked == RELEASES and "--paginate" not in arguments:
            return None
        return self.answers[asked]


def run(github: GitHub, version: str | None = "0.2.0", previous: str | None = "0.1.0", unanswered: str = "") -> int:
    """Run the release on a commit at a version, whose parent is at another. Git may leave one request unanswered."""
    answers: dict[tuple[str, ...], str] = {("rev-parse", "HEAD"): "abc123"}
    for commit, found in (("HEAD", version), ("HEAD^", previous)):
        if found is not None:
            answers["show", f"{commit}:package.json"] = json.dumps({"version": found})

    def git(arguments: Sequence[str], _directory: Path) -> str | None:
        return None if unanswered in arguments else answers.get(tuple(arguments))

    return main(Path(), git, github)


@pytest.mark.parametrize(("version", "previous"), [("0.2.0", "0.1.0"), ("0.2.0", "0.0.99")])
def test_a_merge_that_raises_the_version_creates_a_tagged_release(
    version: str, previous: str, capsys: pytest.CaptureFixture[str]
) -> None:
    """Check that the release tags the merged commit, and that GitHub writes notes from pull request titles."""
    github = GitHub()

    assert run(github, version, previous) == 0
    assert github.created == [
        ["release", "create", "v0.2.0", "--target", "abc123", "--title", "v0.2.0", "--generate-notes"]
    ]
    assert "Released v0.2.0." in capsys.readouterr().out


def test_the_first_release_is_0_1_0() -> None:
    """Check that the lowest version that is released is 0.1.0."""
    github = GitHub(releases="")
    github.answers["repos/{owner}/{repo}/git/matching-refs/tags/v0.1.0"] = ""

    assert run(github, "0.1.0", "0.0.30") == 0
    assert [arguments[2] for arguments in github.created] == ["v0.1.0"]


@pytest.mark.parametrize(
    ("version", "previous", "reason"),
    [
        ("0.0.25", "0.0.24", "Version 0.0.25 is below 0.1.0, so it is not released."),
        ("0.2.0", "0.2.0", "The merge did not raise the version from 0.2.0"),
        ("0.2.0", "0.3.0", "The merge did not raise the version from 0.3.0"),
    ],
)
def test_other_merges_release_nothing(
    version: str, previous: str, reason: str, capsys: pytest.CaptureFixture[str]
) -> None:
    """Check that a merge releases nothing unless it raises the version to 0.1.0 or later."""
    github = GitHub()

    assert run(github, version, previous) == 0
    assert github.created == []
    assert reason in capsys.readouterr().out


def test_running_again_after_a_release_does_nothing(capsys: pytest.CaptureFixture[str]) -> None:
    """Check that a version that is already released is left alone."""
    github = GitHub(releases="v0.2.0\nv0.1.0", tags="refs/tags/v0.2.0")

    assert run(github) == 0
    assert github.created == []
    assert "v0.2.0 is already released." in capsys.readouterr().out


def test_a_tag_without_a_release_stops_the_release(capsys: pytest.CaptureFixture[str]) -> None:
    """Check that a release is not made from a tag that may mark another commit."""
    github = GitHub(tags="refs/tags/v0.2.0")

    assert run(github) == 1
    assert github.created == []
    assert "the tag v0.2.0 exists without a release" in capsys.readouterr().err


def test_a_longer_tag_is_another_tag() -> None:
    """Check that GitHub's matches by how a tag starts do not count."""
    github = GitHub(releases="v0.2.01", tags="refs/tags/v0.2.01")

    assert run(github) == 0
    assert len(github.created) == 1


@pytest.mark.parametrize("fails", [RELEASES, TAGS, "create"])
def test_the_release_fails_when_github_does_not_answer(fails: str, capsys: pytest.CaptureFixture[str]) -> None:
    """Check that no answer from GitHub fails the run, so that it can be run again."""
    github = GitHub(fails=fails)

    assert run(github) == 1
    assert github.created == []
    assert "GitHub did not" in capsys.readouterr().err


def test_the_release_fails_when_git_cannot_name_the_commit(capsys: pytest.CaptureFixture[str]) -> None:
    """Check that nothing is tagged unless the merged commit is known."""
    github = GitHub()

    assert run(github, unanswered="rev-parse") == 1
    assert github.created == []
    assert "Git could not name the commit" in capsys.readouterr().err


@pytest.mark.parametrize(
    ("version", "previous", "expected"),
    [
        (None, "0.1.0", "Git could not read package.json in HEAD"),
        ("0.2.0", None, "Git could not read package.json in HEAD^"),
        ("next", "0.1.0", "package.json in HEAD has no version like '1.2.3'"),
        ("0.2.0", "next", "package.json in HEAD^ has no version like '1.2.3'"),
    ],
)
def test_the_release_fails_when_a_version_cannot_be_read(
    version: str | None, previous: str | None, expected: str, capsys: pytest.CaptureFixture[str]
) -> None:
    """Check that nothing is assumed about a version that cannot be read."""
    github = GitHub()

    assert run(github, version, previous) == 1
    assert github.created == []
    assert expected in capsys.readouterr().err
