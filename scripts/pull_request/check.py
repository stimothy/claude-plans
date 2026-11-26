"""Checks the local branch, or with a number, a pull request on GitHub."""

import json
import subprocess
import sys
from collections.abc import Callable, Sequence
from pathlib import Path
from typing import Any

from scripts.guard.repository import Git, run_git
from scripts.pull_request import rules
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
    return result.stdout if result.returncode == 0 else None


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


def _maintainer_allows_size(gh: Gh, pull: dict[str, Any], number: int) -> bool:
    """Tell whether the pull request has the override label, added by the repository's owner."""
    if rules.OVERRIDE_LABEL not in [label["name"] for label in pull["labels"]]:
        return False
    query = f'.[] | select(.label.name == "{rules.OVERRIDE_LABEL}") | {{event, actor: .actor.login}}'
    events = _list(gh, f"repos/{{owner}}/{{repo}}/issues/{number}/events", query)
    # The latest event tells who added the label that is there now.
    owner = pull["base"]["repo"]["owner"]["login"]
    return bool(events) and events[-1] == {"event": "labeled", "actor": owner}


def _pull_request_problems(gh: Gh, number: int) -> list[str] | None:
    """List a pull request's problems, or return nothing if it is exempt."""
    path = f"repos/{{owner}}/{{repo}}/pulls/{number}"
    pull = _answer(gh, path)
    # The author never changes, so commits that others add leave the exemption in place.
    if pull["user"] == {**pull["user"], "login": "dependabot[bot]", "type": "Bot"}:
        return None
    branch, body = pull["head"]["ref"], pull["body"] or ""
    problems = rules.branch_problems(branch) + rules.title_problems(pull["title"]) + rules.description_problems(body)
    issue = rules.branch_issue(branch)
    links = rules.linked_issues(body)
    if not links:
        problems.append("the description links no issue, with words such as 'Closes #42' or 'Part of #42'")
    elif issue is not None and issue not in links:
        problems.append(f"the description must link issue #{issue}, which the branch is named for")
    elif issue is not None and "pull_request" in _answer(gh, f"repos/{{owner}}/{{repo}}/issues/{issue}"):
        problems.append(f"#{issue} is not an issue, but a pull request")
    files = _list(gh, f"{path}/files", ".[] | {filename, additions, deletions}")
    if len(files) != pull["changed_files"]:
        raise NoAnswerError(f"GitHub listed {len(files)} of {pull['changed_files']} files, so the size is unknown")
    lines = rules.changed_lines((file["filename"], file["additions"], file["deletions"]) for file in files)
    oversize = rules.size_problems(lines)
    if oversize and not _maintainer_allows_size(gh, pull, number):
        problems += oversize
    return problems


def _local_problems(root: Path, git: Git) -> list[str]:
    """List the problems with the local branch's name and committed size."""
    branch = git(["rev-parse", "--abbrev-ref", "HEAD"], root)
    numstat = git(["diff", "--numstat", "origin/master...HEAD"], root)
    if branch is None or numstat is None:
        raise NoAnswerError("Git could not compare the branch with origin/master")
    files = []
    for line in numstat.splitlines():
        added, deleted, path = line.split("\t", 2)
        # Git counts no lines in a binary file.
        files.append((path, int(added.replace("-", "0")), int(deleted.replace("-", "0"))))
    return rules.branch_problems(branch) + rules.size_problems(rules.changed_lines(files))


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
