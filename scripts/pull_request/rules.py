"""The rules about how a pull request is proposed, as CONTRIBUTING.md describes them."""

import re
from collections.abc import Iterable

from scripts.standards.layout import LOCKFILES

MAXIMUM_CHANGED_LINES = 400
OVERRIDE_LABEL = "size:override"
SECTIONS = ("Summary", "Linked issue", "Changes", "Testing")
TYPES = "feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert"
TITLE = re.compile(rf"({TYPES})(\([a-z0-9][a-z0-9-]*\))?!?: \S.*")
BRANCH = re.compile(r"([1-9][0-9]*)(-[a-z0-9]+)+")
LINK = re.compile(r"\b(?:close[sd]?|fix(?:es|ed)?|resolve[sd]?|part of):? +#([0-9]+)", re.IGNORECASE)


def branch_issue(branch: str) -> int | None:
    """Return the number of the issue that a branch is named for, if it is named for one."""
    match = BRANCH.fullmatch(branch)
    return int(match[1]) if match else None


def branch_problems(branch: str) -> list[str]:
    """List what is wrong with a branch's name."""
    if branch_issue(branch) is not None:
        return []
    return [f"the branch '{branch}' is not named like '42-add-health-check', with the issue's number first"]


def title_problems(title: str) -> list[str]:
    """List what is wrong with a title."""
    if TITLE.fullmatch(title):
        return []
    return [f"the title '{title}' is not a Conventional Commit, such as 'feat(backend): add health check'"]


def _sections(body: str) -> dict[str, str]:
    """Return the text under each second-level heading, without comments."""
    shown = re.sub(r"<!--.*?-->", "", body.replace("\r\n", "\n"), flags=re.DOTALL)
    parts = re.split(r"^## +(.*?) *$", shown, flags=re.MULTILINE)
    return {heading.strip(): text for heading, text in zip(parts[1::2], parts[2::2], strict=True)}


def description_problems(body: str) -> list[str]:
    """List the sections that a description lacks."""
    sections = _sections(body)
    return [
        f"the description has no '## {name}' section with text in it"
        for name in SECTIONS
        # Headings inside a section are not text, but a line such as "#13 did this" is.
        if not re.sub(r"^#{1,6}(\s.*)?$", "", sections.get(name, ""), flags=re.MULTILINE).strip()
    ]


def linked_issues(body: str) -> set[int]:
    """Return the issues that the "Linked issue" section links."""
    text = _sections(body).get("Linked issue", "")
    return {int(number) for number in LINK.findall(text)}


def link_problems(branch: str, body: str) -> list[str]:
    """List what is wrong with the issues that a description links."""
    links = linked_issues(body)
    if not links:
        return ["the description links no issue, with words such as 'Closes #42' or 'Part of #42'"]
    issue = branch_issue(branch)
    if issue is None or issue in links:
        return []
    return [f"the description must link issue #{issue}, which the branch is named for"]


def changed_lines(files: Iterable[tuple[str, int, int]]) -> int:
    """Count the added and deleted lines, given each file's path, additions, and deletions."""
    # No generated file is committed yet. The first one must be left out here too.
    return sum(added + deleted for path, added, deleted in files if path not in LOCKFILES)


def size_problems(lines: int) -> list[str]:
    """List what is wrong with a change's size."""
    if lines <= MAXIMUM_CHANGED_LINES:
        return []
    return [f"the change has {lines} lines, and the limit is {MAXIMUM_CHANGED_LINES} without the maintainer's label"]
