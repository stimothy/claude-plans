"""Tests for the rules about how a pull request is proposed."""

import pytest

from scripts.pull_request.rules import (
    branch_issue,
    changed_lines,
    description_problems,
    link_problems,
    linked_issues,
    title_problems,
)

DESCRIPTION = "## Summary\n\nWhat.\n\n## Linked issue\n\nCloses #14.\n\n## Changes\n\n- One.\n\n## Testing\n\nRan it.\n"


@pytest.mark.parametrize(("branch", "issue"), [("14-check-pull-request-rules", 14), ("3-x", 3), ("7-use-node-24", 7)])
def test_a_branch_named_for_an_issue_gives_its_number(branch: str, issue: int) -> None:
    """Check that a branch named for an issue gives its number."""
    assert branch_issue(branch) == issue


@pytest.mark.parametrize(
    "branch",
    ["master", "check-rules", "14", "14-", "014-rules", "14-Rules", "14-two--hyphens", "14_rules", "fix/14-rules"],
)
def test_another_branch_name_gives_no_number(branch: str) -> None:
    """Check that another branch name gives no number."""
    assert branch_issue(branch) is None


@pytest.mark.parametrize(
    "title",
    ["feat(backend): add health check", "ci: add checks", "fix!: drop a command", "refactor(command-line)!: split it"]
    + [f"{kind}: change it" for kind in ("docs", "style", "perf", "test", "build", "chore", "revert")],
)
def test_a_conventional_commit_title_passes(title: str) -> None:
    """Check that a Conventional Commit title passes."""
    assert title_problems(title) == []


@pytest.mark.parametrize(
    "title",
    ["Add checks", "feature: add checks", "ci:add checks", "ci: ", "CI: add checks", "ci(): add", " ci: add checks"],
)
def test_another_title_is_a_problem(title: str) -> None:
    """Check that another title is a problem."""
    assert len(title_problems(title)) == 1


def test_a_description_with_the_four_sections_passes() -> None:
    """Check that a full description passes, with other sections and Windows line breaks."""
    body = f"{DESCRIPTION}\n## Review\n\nDone.\n".replace("\n", "\r\n")

    assert description_problems(body) == []


@pytest.mark.parametrize("section", ["Summary", "Linked issue", "Changes", "Testing"])
def test_each_section_is_required(section: str) -> None:
    """Check that each section is required."""
    body = DESCRIPTION.replace(f"## {section}\n", "## Other\n")

    assert description_problems(body) == [f"the description has no '## {section}' section with text in it"]


@pytest.mark.parametrize("filling", ["", "<!-- Say how\nyou tested. -->", "### Detail"])
def test_a_section_without_text_is_a_problem(filling: str) -> None:
    """Check that a section holding only comments or headings is a problem."""
    body = DESCRIPTION.replace("Ran it.", filling)

    assert len(description_problems(body)) == 1


@pytest.mark.parametrize(
    ("text", "issues"),
    [
        ("Closes #14.", {14}),
        ("closed #1, Fixes #2 and resolved #3", {1, 2, 3}),
        ("Part of #13. It stays open.", {13}),
        ("See #14.", set()),
        ("<!-- Closes #14 -->", set()),
        ("<!-- one -->\nFixes: #14\n<!-- two -->", {14}),
        ("Discloses #14", set()),
    ],
)
def test_only_linking_words_in_the_linked_issue_section_link_an_issue(text: str, issues: set[int]) -> None:
    """Check which issues a description links."""
    body = f"## Summary\n\nCloses #99.\n\n## Linked issue\n\n{text}\n"

    assert linked_issues(body) == issues


def test_a_line_that_starts_with_an_issue_number_is_text() -> None:
    """Check that only a real heading is left out of a section's text."""
    body = DESCRIPTION.replace("What.", "#13 added the other checks.")

    assert description_problems(body) == []


@pytest.mark.parametrize(
    ("branch", "text", "problem"),
    [
        ("14-rules", "Closes #14.", None),
        ("14-rules", "None.", "links no issue"),
        ("14-rules", "Closes #15.", "must link issue #14"),
        ("rules", "Closes #15.", None),
    ],
)
def test_the_linked_issue_must_match_the_branch(branch: str, text: str, problem: str | None) -> None:
    """Check that the description links the issue that the branch is named for."""
    problems = link_problems(branch, f"## Linked issue\n\n{text}\n")

    assert (problems == []) if problem is None else (problem in problems[0])


def test_lines_in_lockfiles_do_not_count() -> None:
    """Check that additions and deletions count, except in the top-level lockfiles."""
    files = [("a.py", 3, 2), ("package-lock.json", 500, 1), ("requirements.txt", 9, 9), ("web/requirements.txt", 4, 0)]

    counted = 3 + 2 + 4
    assert changed_lines(files) == counted
