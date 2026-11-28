"""Checks the local branch, or with a number, a pull request on GitHub."""

import json
import subprocess
import sys
from collections.abc import Callable, Sequence
from pathlib import Path
from typing import Any
from urllib.parse import quote

from scripts.guard.repository import Git, run_git
from scripts.pull_request import rules
from scripts.pull_request.versions import Read, UnreadableFileError, version_problems
from scripts.report import report

# Asks GitHub's command-line program, and returns its output, or nothing if it fails.
Gh = Callable[[Sequence[str]], str | None]


class NoAnswerError(Exception):
    """GitHub or Git did not answer, so a rule cannot be checked."""


def run_gh(arguments: Sequence[str]) -> str | None:
    """Run gh and return its output, or nothing if it fails."""
    try:
        result = subprocess.run(["gh", *arguments], capture_output=True, encoding="utf-8", timeout=60, check=False)
    except (OSError, UnicodeError, subprocess.TimeoutExpired):
        return None
    if result.returncode == 0:
        return result.stdout
    # This tells a missing issue from a missing sign-in, for example.
    sys.stderr.write(result.stderr)
    return None


def _answer(gh: Gh, path: str) -> dict[str, Any]:
    """Return GitHub's answer about one thing."""
    output = gh(["api", path])
    if output is None:
        raise NoAnswerError(f"GitHub did not answer about {path}")
    return dict(json.loads(output))


def _list(gh: Gh, path: str, query: str) -> list[dict[str, Any]]:
    """Return every item of a list on GitHub, as a query shapes each one."""
    output = gh(["api", "--paginate", path, "--jq", query])
    if output is None:
        raise NoAnswerError(f"GitHub did not answer about {path}")
    return [json.loads(line) for line in output.splitlines()]


def _file_on_github(gh: Gh, revision: str) -> Read:
    """Return how to read a file as it is at a branch or commit on GitHub."""

    def read(path: str) -> str:
        address = f"repos/{{owner}}/{{repo}}/contents/{path}?ref={quote(revision, safe='')}"
        # Without this, GitHub leaves out the text of a file over 1 MB.
        output = gh(["api", "-H", "Accept: application/vnd.github.raw+json", address])
        if output is None:
            raise NoAnswerError(f"GitHub did not answer about {address}")
        return output

    return read


def committed_file(root: Path, git: Git, commit: str) -> Read:
    """Return how to read a file as it is in a local commit."""

    def read(path: str) -> str:
        text = git(["show", f"{commit}:{path}"], root)
        if text is None:
            raise NoAnswerError(f"Git could not read {path} in {commit}")
        return text

    return read


def _version_problems(proposed: Read, current: Read) -> list[str]:
    """List what is wrong with the version, or why it cannot be checked, which hides no other problem."""
    try:
        return version_problems(proposed, current)
    except (NoAnswerError, UnreadableFileError) as error:
        return [str(error)]


def _maintainer_allows_size(gh: Gh, pull: dict[str, Any], number: int) -> bool:
    """Tell whether the pull request has the override label, added by the repository's owner."""
    if rules.OVERRIDE_LABEL not in [label["name"] for label in pull["labels"]]:
        return False
    query = ".[] | {event, label: .label.name, actor: .actor.login}"
    events = _list(gh, f"repos/{{owner}}/{{repo}}/issues/{number}/events", query)
    # The label's latest event tells who added the one that is there now.
    history = [event for event in events if event["label"] == rules.OVERRIDE_LABEL]
    added = {"event": "labeled", "label": rules.OVERRIDE_LABEL, "actor": pull["base"]["repo"]["owner"]["login"]}
    return history[-1:] == [added]


def _issue_problems(gh: Gh, issue: int) -> list[str]:
    """List what is wrong with the issue that a branch is named for."""
    try:
        found = _answer(gh, f"repos/{{owner}}/{{repo}}/issues/{issue}")
    except NoAnswerError:
        # A number with no issue gets no answer, so the other rules are still checked.
        return [f"GitHub could not read issue #{issue}, which the branch is named for"]
    return [f"#{issue} is not an issue, but a pull request"] if "pull_request" in found else []


def _pull_request_problems(gh: Gh, number: int) -> list[str] | None:
    """List a pull request's problems, or return nothing if it is exempt."""
    path = f"repos/{{owner}}/{{repo}}/pulls/{number}"
    pull = _answer(gh, path)
    # The author never changes, so commits that others add leave the exemption in place.
    if pull["user"]["login"] == "dependabot[bot]" and pull["user"]["type"] == "Bot":
        return None
    branch, body = pull["head"]["ref"], pull["body"] or ""
    problems = rules.branch_problems(branch) + rules.title_problems(pull["title"]) + rules.description_problems(body)
    unlinked = rules.link_problems(branch, body)
    problems += unlinked
    issue = rules.branch_issue(branch)
    if issue is not None and not unlinked:
        problems += _issue_problems(gh, issue)
    files = _list(gh, f"{path}/files", ".[] | {filename, additions, deletions}")
    if len(files) != pull["changed_files"]:
        raise NoAnswerError(f"GitHub listed {len(files)} of {pull['changed_files']} files, so the size is unknown")
    lines = rules.changed_lines((file["filename"], file["additions"], file["deletions"]) for file in files)
    oversize = rules.size_problems(lines)
    if oversize and not _maintainer_allows_size(gh, pull, number):
        problems += oversize
    # The base branch is read as it is now, which may be ahead of where this pull request left it.
    proposed, current = (_file_on_github(gh, revision) for revision in (pull["head"]["sha"], pull["base"]["ref"]))
    return problems + _version_problems(proposed, current)


def _local_problems(root: Path, git: Git) -> list[str]:
    """List the problems with the local branch's name, committed size, and committed version."""
    branch = git(["rev-parse", "--abbrev-ref", "HEAD"], root)
    numstat = git(["diff", "--numstat", "origin/master...HEAD"], root)
    if branch is None or numstat is None:
        raise NoAnswerError("Git could not compare the branch with origin/master")
    files = []
    for line in numstat.splitlines():
        added, deleted, path = line.split("\t", 2)
        # Git counts no lines in a binary file.
        files.append((path, int(added.replace("-", "0")), int(deleted.replace("-", "0"))))
    problems = rules.branch_problems(branch) + rules.size_problems(rules.changed_lines(files))
    proposed, current = (committed_file(root, git, commit) for commit in ("HEAD", "origin/master"))
    return problems + _version_problems(proposed, current)


def main(arguments: Sequence[str], root: Path, git: Git, gh: Gh) -> int:
    """List every problem, and return the exit code."""
    if len(arguments) > 1 or not all(argument.isdecimal() for argument in arguments):
        print("Give a pull request's number, or nothing to check the local branch.", file=sys.stderr)
        return 1
    try:
        problems = _pull_request_problems(gh, int(arguments[0])) if arguments else _local_problems(root, git)
    except NoAnswerError as error:
        print(error, file=sys.stderr)
        return 1
    if problems is None:
        print("Dependabot's pull requests are exempt from these rules.")
        return 0
    return report(problems)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:], Path.cwd(), run_git, run_gh))
