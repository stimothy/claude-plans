"""Tests for releasing the version that a merge raised."""

import json
from collections.abc import Sequence
from pathlib import Path

import pytest

from scripts.release.create import main

# Each lookup has to ask for exactly the lines that the script compares.
RELEASES = ("api", "--paginate", "repos/{owner}/{repo}/releases", "--jq", ".[] | [.tag_name, .draft] | @tsv")
TAGS = ("api", "repos/{owner}/{repo}/git/matching-refs/tags/v0.2.0", "--jq", ".[].ref")
CREATE = ["release", "create", "v0.2.0", "--target", "abc123", "--title", "v0.2.0", "--generate-notes"]
ACTIONS = {"GITHUB_ACTIONS": "true"}


class GitHub:
    """Stands in for gh, with the releases and tags that GitHub has, and keeps what it is asked to create."""

    def __init__(self, releases: str = "v0.1.0\tfalse", tags: str = "", fails: str = "") -> None:
        """Start with some releases and tags, and one request that gets no answer."""
        self.answers = {RELEASES: releases, TAGS: tags}
        self.fails = fails
        self.created: list[list[str]] = []

    def __call__(self, arguments: Sequence[str]) -> str | None:
        """Answer one request."""
        asked = "create" if arguments[0] == "release" else {RELEASES: "releases", TAGS: "tags"}.get(tuple(arguments))
        if asked is None or asked == self.fails:
            return None
        if asked == "create":
            self.created.append(list(arguments))
        return self.answers.get(tuple(arguments), "")


def run(
    github: GitHub,
    version: str | None = "0.2.0",
    previous: str | None = "0.1.0",
    unanswered: str = "",
    environment: dict[str, str] = ACTIONS,
) -> int:
    """Run the release on a commit at a version, whose parent is at another. Git may leave one request unanswered."""
    answers: dict[tuple[str, ...], str] = {("rev-parse", "HEAD"): "abc123"}
    for commit, found in (("HEAD", version), ("HEAD^", previous)):
        if found is not None:
            text = found if found.startswith("<") else json.dumps({"version": found})
            answers["show", f"{commit}:package.json"] = text

    def git(arguments: Sequence[str], _directory: Path) -> str | None:
        return None if unanswered in arguments else answers.get(tuple(arguments))

    return main(Path(), git, github, environment)


@pytest.mark.parametrize("previous", ["0.1.0", "0.0.99"])
def test_a_merge_that_raises_the_version_creates_a_tagged_release(
    previous: str, capsys: pytest.CaptureFixture[str]
) -> None:
    """Check that the release tags the merged commit, and that GitHub writes notes since the release before."""
    github = GitHub()

    assert run(github, previous=previous) == 0
    assert github.created == [[*CREATE, "--latest=true", "--notes-start-tag", "v0.1.0"]]
    assert "Released v0.2.0." in capsys.readouterr().out


@pytest.mark.parametrize(
    ("releases", "expected"),
    [
        # With no release before, GitHub writes notes from the start.
        ("", ["--latest=true"]),
        # A late run must not take the place of a newer release, or start its notes there.
        ("v0.10.0\tfalse\nv0.1.9\tfalse\nv0.1.10\tfalse", ["--latest=false", "--notes-start-tag", "v0.1.10"]),
        ("v0.3.0\tfalse", ["--latest=false"]),
        # Other names are not versions, and GitHub's matches by how a name starts are other versions.
        ("nightly\tfalse\n9.0.0\tfalse\nv0.2.01\tfalse", ["--latest=true"]),
    ],
)
def test_the_release_says_whether_it_is_the_latest_and_where_its_notes_start(
    releases: str, expected: list[str]
) -> None:
    """Check that neither is left to GitHub, which would take a new release to be the latest."""
    github = GitHub(releases=releases, tags="refs/tags/v0.2.01")

    assert run(github) == 0
    assert github.created == [[*CREATE, *expected]]


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
    github = GitHub(releases="v0.2.0\tfalse\nv0.1.0\tfalse", tags="refs/tags/v0.2.0")

    assert run(github) == 0
    assert github.created == []
    assert "v0.2.0 is already released." in capsys.readouterr().out


@pytest.mark.parametrize(
    ("github", "environment", "expected"),
    [
        (GitHub(releases="v0.2.0\ttrue"), ACTIONS, "a draft release has the tag v0.2.0"),
        (GitHub(tags="refs/tags/v0.2.0"), ACTIONS, "the tag v0.2.0 exists without a release"),
        # A run on a person's computer would publish a release in their name.
        (GitHub(), {}, "only the Release workflow makes releases"),
        (GitHub(fails="releases"), ACTIONS, "GitHub did not"),
        (GitHub(fails="tags"), ACTIONS, "GitHub did not"),
        (GitHub(fails="create"), ACTIONS, "GitHub did not"),
    ],
)
def test_a_release_that_cannot_be_made_fails(
    github: GitHub, environment: dict[str, str], expected: str, capsys: pytest.CaptureFixture[str]
) -> None:
    """Check that a release that is due, but cannot be made, fails the run so that someone looks."""
    assert run(github, environment=environment) == 1
    assert github.created == []
    assert expected in capsys.readouterr().err


@pytest.mark.parametrize(
    ("version", "previous", "unanswered", "expected"),
    [
        (None, "0.1.0", "", "Git could not read package.json in HEAD"),
        ("0.2.0", None, "", "Git could not read package.json in HEAD^"),
        ("next", "0.1.0", "", "package.json in HEAD has no version like '1.2.3'"),
        ("0.2.0", "next", "", "package.json in HEAD^ has no version like '1.2.3'"),
        ("<<<<<<< HEAD", "0.1.0", "", "package.json does not hold a JSON object"),
        ("0.2.0", "0.1.0", "rev-parse", "Git could not name the commit"),
    ],
)
def test_the_release_fails_when_git_cannot_answer(
    version: str | None, previous: str | None, unanswered: str, expected: str, capsys: pytest.CaptureFixture[str]
) -> None:
    """Check that nothing is assumed about a version or a commit that cannot be read."""
    github = GitHub()

    assert run(github, version, previous, unanswered) == 1
    assert github.created == []
    assert expected in capsys.readouterr().err
