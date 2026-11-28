"""Releases the version that a merge to master raised, from 0.1.0 on. The Release workflow runs it."""

import os
import sys
from collections.abc import Mapping, Sequence
from pathlib import Path

from scripts.guard.repository import Git, run_git
from scripts.pull_request.check import Gh, NoAnswerError, committed_file, run_gh
from scripts.pull_request.versions import MANIFEST, UnreadableFileError, manifest_version, version_numbers

FIRST_RELEASE = (0, 1, 0)


class ReleaseError(Exception):
    """The release cannot be made, or whether to make it cannot be told."""


def _version(root: Path, git: Git, commit: str) -> tuple[str, tuple[int, ...]]:
    """Return the version that a commit has, as written and as numbers."""
    try:
        version = manifest_version(committed_file(root, git, commit))
    except (NoAnswerError, UnreadableFileError) as error:
        raise ReleaseError(str(error)) from error
    numbers = version_numbers(version)
    if numbers is None:
        raise ReleaseError(f"{MANIFEST} in {commit} has no version like '1.2.3'")
    return str(version), numbers


def _asked(gh: Gh, arguments: Sequence[str]) -> list[str]:
    """Return the lines that gh answers with."""
    output = gh(arguments)
    if output is None:
        raise ReleaseError(f"GitHub did not do as asked: gh {' '.join(arguments)}")
    return output.splitlines()


def _published_releases(gh: Gh, tag: str) -> set[str]:
    """Return the tags of the published releases, refusing if only a draft has the tag that is due."""
    query = ".[] | [.tag_name, .draft] | @tsv"
    listed = [
        line.split("\t") for line in _asked(gh, ["api", "--paginate", "repos/{owner}/{repo}/releases", "--jq", query])
    ]
    published = {name for name, draft in listed if draft == "false"}
    if tag not in published and tag in (name for name, _draft in listed):
        # A draft marks no commit, and a release made beside it would be a second one for the tag.
        raise ReleaseError(f"a draft release has the tag {tag}, so publish or delete it, and run this again")
    return published


def _placing(published: set[str], numbers: tuple[int, ...]) -> list[str]:
    """Say whether a release is the latest, and which release its notes start after."""
    # GitHub takes a new release to be the latest unless told, even one that is made late.
    others = [
        (found, name)
        for name in published
        if name.startswith("v") and (found := version_numbers(name.removeprefix("v"))) is not None
    ]
    latest = [f"--latest={'false' if any(found > numbers for found, _name in others) else 'true'}"]
    earlier = [pair for pair in others if pair[0] < numbers]
    return latest + (["--notes-start-tag", max(earlier)[1]] if earlier else [])


def _release(root: Path, git: Git, gh: Gh, environment: Mapping[str, str]) -> str:
    """Release the version of the commit that is checked out if its merge raised it, and say what happened."""
    version, numbers = _version(root, git, "HEAD")
    # A merge is one commit on master, because only squash merges are allowed.
    previous, previous_numbers = _version(root, git, "HEAD^")
    if numbers <= previous_numbers:
        return f"The merge did not raise the version from {previous}, so there is nothing to release."
    if numbers < FIRST_RELEASE:
        return f"Version {version} is below 0.1.0, so it is not released."
    tag = f"v{version}"
    published = _published_releases(gh, tag)
    if tag in published:
        return f"{tag} is already released."
    # GitHub lists every tag that starts with the name.
    tags = _asked(gh, ["api", f"repos/{{owner}}/{{repo}}/git/matching-refs/tags/{tag}", "--jq", ".[].ref"])
    if f"refs/tags/{tag}" in tags:
        # GitHub would release what the tag marks, whatever commit is asked for.
        raise ReleaseError(f"the tag {tag} exists without a release, so it may mark another commit")
    commit = git(["rev-parse", "HEAD"], root)
    if commit is None:
        raise ReleaseError("Git could not name the commit that is checked out")
    if environment.get("GITHUB_ACTIONS") != "true":
        raise ReleaseError("only the Release workflow makes releases, so nothing was released")
    # GitHub makes the tag, and writes the notes from the titles of pull requests.
    create = ["release", "create", tag, "--target", commit, "--title", tag, "--generate-notes"]
    _asked(gh, create + _placing(published, numbers))
    return f"Released {tag}."


def main(root: Path, git: Git, gh: Gh, environment: Mapping[str, str]) -> int:
    """Make the release that is due, and return the exit code."""
    try:
        print(_release(root, git, gh, environment))
    except ReleaseError as error:
        print(error, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(Path.cwd(), run_git, run_gh, os.environ))
