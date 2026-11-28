"""Releases the version that a merge to master raised, from 0.1.0 on. The Release workflow runs it."""

import json
import sys
from collections.abc import Sequence
from pathlib import Path

from scripts.guard.repository import Git, run_git
from scripts.pull_request.check import Gh, run_gh
from scripts.pull_request.versions import MANIFEST, version_numbers

FIRST_RELEASE = (0, 1, 0)


class ReleaseError(Exception):
    """The release cannot be made, or whether to make it cannot be told."""


def _version(root: Path, git: Git, commit: str) -> tuple[str, tuple[int, ...]]:
    """Return the version that a commit has, as written and as numbers."""
    text = git(["show", f"{commit}:{MANIFEST}"], root)
    if text is None:
        raise ReleaseError(f"Git could not read {MANIFEST} in {commit}")
    version = json.loads(text).get("version")
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


def _release(root: Path, git: Git, gh: Gh) -> str:
    """Release the version of the commit that is checked out if its merge raised it, and say what happened."""
    version, numbers = _version(root, git, "HEAD")
    # A merge is one commit on master, so the commit before it has the version from before the merge.
    previous, previous_numbers = _version(root, git, "HEAD^")
    if numbers <= previous_numbers:
        return f"The merge did not raise the version from {previous}, so there is nothing to release."
    if numbers < FIRST_RELEASE:
        return f"Version {version} is below 0.1.0, so it is not released."
    tag = f"v{version}"
    if tag in _asked(gh, ["api", "--paginate", "repos/{owner}/{repo}/releases", "--jq", ".[].tag_name"]):
        return f"{tag} is already released."
    # GitHub lists every tag that starts with the name.
    tags = _asked(gh, ["api", f"repos/{{owner}}/{{repo}}/git/matching-refs/tags/{tag}", "--jq", ".[].ref"])
    if f"refs/tags/{tag}" in tags:
        # GitHub would release what the tag marks, whatever commit is asked for.
        raise ReleaseError(f"the tag {tag} exists without a release, so it may mark another commit")
    commit = git(["rev-parse", "HEAD"], root)
    if commit is None:
        raise ReleaseError("Git could not name the commit that is checked out")
    # GitHub makes the tag, and writes the notes from the titles of the pull requests since the last release.
    _asked(gh, ["release", "create", tag, "--target", commit, "--title", tag, "--generate-notes"])
    return f"Released {tag}."


def main(root: Path, git: Git, gh: Gh) -> int:
    """Make the release that is due, and return the exit code."""
    try:
        print(_release(root, git, gh))
    except ReleaseError as error:
        print(error, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(Path.cwd(), run_git, run_gh))
