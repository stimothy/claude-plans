"""Tests for checking a branch, or a pull request on GitHub."""

import json
import subprocess
from collections.abc import Sequence
from pathlib import Path

import pytest

from scripts.pull_request.check import main, run_gh
from scripts.pull_request.test_rules import DESCRIPTION

PULL = "repos/{owner}/{repo}/pulls/51"
ISSUE = "repos/{owner}/{repo}/issues/14"
EVENTS = "repos/{owner}/{repo}/issues/51/events"


def github(
    changed: int = 10,
    labels: Sequence[str] = (),
    events: Sequence[tuple[str, str]] = (),
    issue: dict[str, object] | None = None,
    **fields: object,
) -> dict[str, str]:
    """Make GitHub's answers about a pull request that follows the rules, with some facts changed."""
    pull = {
        "user": {"login": "someone", "type": "User"},
        "head": {"ref": "14-check-rules"},
        "base": {"repo": {"owner": {"login": "maintainer"}}},
        "title": "ci: check rules",
        "body": DESCRIPTION,
        "labels": [{"name": name} for name in labels],
        "changed_files": 1,
    }
    return {
        PULL: json.dumps(pull | fields),
        f"{PULL}/files": json.dumps({"filename": "a.py", "additions": changed, "deletions": 0}),
        ISSUE: json.dumps({"number": 14} if issue is None else issue),
        EVENTS: "\n".join(json.dumps({"event": event, "actor": actor}) for event, actor in events),
    }


def check(answers: dict[str, str]) -> int:
    """Check pull request 51, with GitHub answering from the given text."""

    def gh(arguments: Sequence[str]) -> str | None:
        return next((answers[argument] for argument in arguments if argument in answers), None)

    return main(["51"], Path(), lambda _arguments, _directory: None, gh)


def test_a_pull_request_that_follows_the_rules_passes(capsys: pytest.CaptureFixture[str]) -> None:
    """Check that a pull request that follows the rules passes."""
    assert check(github()) == 0
    assert capsys.readouterr().err == ""


def test_every_broken_rule_is_listed(capsys: pytest.CaptureFixture[str]) -> None:
    """Check that every broken rule is listed."""
    answers = github(changed=401, title="Checks", head={"ref": "checks"}, body=None)

    assert check(answers) == 1
    listed = capsys.readouterr().err
    for expected in ("branch 'checks'", "title 'Checks'", "'## Summary'", "links no issue", "401 lines"):
        assert expected in listed


@pytest.mark.parametrize(
    ("answers", "expected"),
    [
        (github(body=DESCRIPTION.replace("#14", "#15")), "must link issue #14"),
        (github(issue={"number": 14, "pull_request": {}}), "#14 is not an issue"),
    ],
)
def test_the_linked_issue_must_be_the_branch_s_real_issue(
    answers: dict[str, str], expected: str, capsys: pytest.CaptureFixture[str]
) -> None:
    """Check that the linked issue must be the real issue that the branch names."""
    assert check(answers) == 1
    assert expected in capsys.readouterr().err


@pytest.mark.parametrize(
    ("labels", "events", "status"),
    [
        (["size:override"], [("labeled", "maintainer")], 0),
        (["size:override"], [("labeled", "maintainer"), ("unlabeled", "x"), ("labeled", "someone")], 1),
        (["size:override"], [], 1),
        ([], [("labeled", "maintainer")], 1),
    ],
)
def test_only_the_maintainer_s_label_allows_a_larger_change(
    labels: list[str], events: list[tuple[str, str]], status: int
) -> None:
    """Check that only the label that the maintainer added allows a larger change."""
    assert check(github(changed=401, labels=labels, events=events)) == status


def test_the_limit_itself_is_allowed() -> None:
    """Check that a change of exactly 400 lines passes."""
    assert check(github(changed=400)) == 0


def test_a_pull_request_from_dependabot_is_exempt(capsys: pytest.CaptureFixture[str]) -> None:
    """Check that Dependabot's pull requests are exempt, whoever adds commits to them."""
    answers = {PULL: github(user={"login": "dependabot[bot]", "type": "Bot"}, title="Bump", body=None)[PULL]}

    assert check(answers) == 0
    assert "exempt" in capsys.readouterr().out


@pytest.mark.parametrize("missing", [PULL, f"{PULL}/files", EVENTS])
def test_the_check_fails_when_github_does_not_answer(missing: str, capsys: pytest.CaptureFixture[str]) -> None:
    """Check that the check fails when GitHub does not answer."""
    answers = github(changed=401, labels=["size:override"], events=[("labeled", "maintainer")])
    del answers[missing]

    assert check(answers) == 1
    assert "GitHub did not answer" in capsys.readouterr().err


def test_the_check_fails_when_github_lists_only_some_files(capsys: pytest.CaptureFixture[str]) -> None:
    """Check that a size from a partial file list is not trusted."""
    assert check(github(changed_files=2)) == 1
    assert "listed 1 of 2 files" in capsys.readouterr().err


@pytest.mark.parametrize(
    ("branch", "numstat", "status"),
    [
        ("14-check-rules", "10\t2\ta.py\n-\t-\timage.png\n900\t0\tpackage-lock.json", 0),
        ("14-check-rules", "401\t0\ta.py", 1),
        ("checks", "", 1),
        ("14-check-rules", None, 1),
        (None, "", 1),
    ],
)
def test_without_a_number_the_local_branch_is_checked(branch: str | None, numstat: str | None, status: int) -> None:
    """Check that the branch's name and committed size are checked without asking GitHub."""
    answers = {"rev-parse": branch, "diff": numstat}

    def git(arguments: Sequence[str], _directory: Path) -> str | None:
        return answers[arguments[0]]

    assert main([], Path(), git, lambda _arguments: None) == status


@pytest.mark.parametrize("arguments", [["x"], ["1", "2"]])
def test_other_arguments_are_rejected(arguments: list[str]) -> None:
    """Check that anything but one number is rejected."""
    assert main(arguments, Path(), lambda _arguments, _directory: None, lambda _arguments: None) == 1


@pytest.mark.parametrize(("code", "output"), [(0, "{}"), (1, None)])
def test_gh_returns_output_or_nothing(monkeypatch: pytest.MonkeyPatch, code: int, output: str | None) -> None:
    """Check that gh returns its output, or nothing if it fails."""
    monkeypatch.setattr("subprocess.run", lambda *_given, **_options: subprocess.CompletedProcess([], code, "{}"))

    assert run_gh(["api"]) == output


def test_gh_returns_nothing_when_it_cannot_start(monkeypatch: pytest.MonkeyPatch) -> None:
    """Check that gh returns nothing when it cannot start."""

    def fail(*_given: object, **_options: object) -> None:
        raise OSError

    monkeypatch.setattr("subprocess.run", fail)

    assert run_gh(["api"]) is None
