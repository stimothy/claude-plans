"""Tests for checking a branch, or a pull request on GitHub."""

import json
import subprocess
from collections.abc import Sequence
from pathlib import Path

import pytest

from scripts.pull_request.check import main, run_gh
from scripts.pull_request.test_rules import DESCRIPTION
from scripts.pull_request.test_versions import package_files

PULL = "repos/{owner}/{repo}/pulls/51"
ISSUE = "repos/{owner}/{repo}/issues/14"
EVENTS = "repos/{owner}/{repo}/issues/51/events"
CONTENTS = "repos/{owner}/{repo}/contents"
PROPOSED = f"{CONTENTS}/package.json?ref=abc123"
CURRENT = f"{CONTENTS}/package.json?ref=master"


def proposed(version: str) -> dict[str, str]:
    """Make GitHub's answers about the files that give a pull request's version."""
    return {f"{CONTENTS}/{path}?ref=abc123": text for path, text in package_files(version).items()}


def github(
    changed: int = 10,
    labels: Sequence[str] = (),
    events: Sequence[tuple[str, str, str]] = (),
    issue: dict[str, object] | None = None,
    deleted: int = 0,
    **fields: object,
) -> dict[str, str]:
    """Make GitHub's answers about a pull request that follows the rules, with some facts changed."""
    pull = {
        "user": {"login": "someone", "type": "User"},
        "head": {"ref": "14-check-rules", "sha": "abc123"},
        "base": {"ref": "master", "repo": {"owner": {"login": "maintainer"}}},
        "title": "ci: check rules",
        "body": DESCRIPTION,
        "labels": [{"name": name} for name in labels],
        "changed_files": 1,
    }
    return proposed("0.2.0") | {
        CURRENT: package_files("0.1.9")["package.json"],
        PULL: json.dumps(pull | fields),
        f"{PULL}/files": json.dumps({"filename": "a.py", "additions": changed, "deletions": deleted}),
        ISSUE: json.dumps({"number": 14} if issue is None else issue),
        EVENTS: "\n".join(
            json.dumps({"event": event, "label": label, "actor": actor}) for event, label, actor in events
        ),
    }


def check(answers: dict[str, str]) -> int:
    """Check pull request 51, with GitHub answering from the given text."""

    def gh(arguments: Sequence[str]) -> str | None:
        # A list that is read without every page would be cut short.
        if {f"{PULL}/files", EVENTS} & set(arguments) and "--paginate" not in arguments:
            return None
        # Without this header, GitHub answers about a file with facts about it instead of its text.
        asks_for_text = "Accept: application/vnd.github.raw+json" in arguments
        if any(argument.startswith(CONTENTS) for argument in arguments) and not asks_for_text:
            return None
        return next((answers[argument] for argument in arguments if argument in answers), None)

    return main(["51"], Path(), lambda _arguments, _directory: None, gh)


def test_a_pull_request_that_follows_the_rules_passes(capsys: pytest.CaptureFixture[str]) -> None:
    """Check that a pull request that follows the rules passes."""
    assert check(github()) == 0
    assert capsys.readouterr().err == ""


def test_every_broken_rule_is_listed(capsys: pytest.CaptureFixture[str]) -> None:
    """Check that every broken rule is listed."""
    answers = github(changed=401, title="Checks", head={"ref": "checks", "sha": "abc123"}, body=None)

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


ADDED = ("labeled", "size:override", "maintainer")
ADDED_BY_ANOTHER = ("labeled", "size:override", "someone")


@pytest.mark.parametrize(
    ("labels", "events", "status"),
    [
        (["size:override"], [ADDED], 0),
        (["size:override"], [ADDED, ("unlabeled", "size:override", "x"), ADDED_BY_ANOTHER], 1),
        (["size:override"], [ADDED_BY_ANOTHER, ("labeled", "area:ci", "maintainer")], 1),
        (["size:override"], [ADDED, ("labeled", "area:ci", "someone")], 0),
        (["size:override"], [], 1),
        ([], [ADDED], 1),
    ],
)
def test_only_the_maintainer_s_label_allows_a_larger_change(
    labels: list[str], events: list[tuple[str, str, str]], status: int
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


@pytest.mark.parametrize(
    "user", [{"login": "github-actions[bot]", "type": "Bot"}, {"login": "dependabot[bot]", "type": "User"}]
)
def test_no_other_author_is_exempt(user: dict[str, str]) -> None:
    """Check that another bot, or a user with Dependabot's name, keeps the rules."""
    assert check(github(user=user, title="Bump")) == 1


def test_deleted_lines_count_toward_the_limit() -> None:
    """Check that deleted lines count toward the limit."""
    assert check(github(changed=200, deleted=201)) == 1


def test_a_missing_issue_is_listed_with_the_other_problems(capsys: pytest.CaptureFixture[str]) -> None:
    """Check that an issue that cannot be read does not hide the other problems."""
    answers = github(title="Checks", changed=401)
    del answers[ISSUE]

    assert check(answers) == 1
    listed = capsys.readouterr().err
    for expected in ("title 'Checks'", "could not read issue #14", "401 lines"):
        assert expected in listed


@pytest.mark.parametrize("missing", [PULL, f"{PULL}/files", EVENTS, PROPOSED, CURRENT])
def test_the_check_fails_when_github_does_not_answer(missing: str, capsys: pytest.CaptureFixture[str]) -> None:
    """Check that the check fails when GitHub does not answer."""
    answers = github(changed=401, labels=["size:override"], events=[ADDED])
    del answers[missing]

    assert check(answers) == 1
    assert "GitHub did not answer" in capsys.readouterr().err


def test_a_pull_request_must_raise_the_version(capsys: pytest.CaptureFixture[str]) -> None:
    """Check that a pull request whose version master already has fails."""
    assert check(github() | proposed("0.1.9")) == 1
    assert "must be higher than 0.1.9" in capsys.readouterr().err


def test_a_base_branch_s_name_is_encoded_in_the_address() -> None:
    """Check that a branch name cannot be cut short or change what an address asks for."""
    answers = github(base={"ref": "release#1", "repo": {"owner": {"login": "maintainer"}}})
    answers[f"{CONTENTS}/package.json?ref=release%231"] = answers.pop(CURRENT)

    assert check(answers) == 0


@pytest.mark.parametrize(
    ("path", "text", "expected"),
    [
        ("package.json", "<<<<<<< HEAD", "package.json does not hold a JSON object"),
        ("package-lock.json", "[]", "package-lock.json does not hold a JSON object"),
        ("package-lock.json", '{"version": "0.2.0"}', "for the root package, has no version"),
        ("packages/cli/package.json", None, "GitHub did not answer about"),
    ],
)
def test_a_version_file_that_cannot_be_read_hides_no_other_problem(
    path: str, text: str | None, expected: str, capsys: pytest.CaptureFixture[str]
) -> None:
    """Check that a broken or missing version file is listed with the other problems."""
    answers = github(title="Checks")
    address = f"{CONTENTS}/{path}?ref=abc123"
    if text is None:
        del answers[address]
    else:
        answers[address] = text

    assert check(answers) == 1
    listed = capsys.readouterr().err
    assert "title 'Checks'" in listed
    assert expected in listed


def test_the_check_fails_when_github_lists_only_some_files(capsys: pytest.CaptureFixture[str]) -> None:
    """Check that a size from a partial file list is not trusted."""
    assert check(github(changed_files=2)) == 1
    assert "listed 1 of 2 files" in capsys.readouterr().err


def check_branch(branch: str | None, numstat: str | None, version: str | None = "0.2.0") -> int:
    """Check a local branch, with Git answering about it and master."""
    answers: dict[tuple[str, ...], str | None] = {
        ("rev-parse", "--abbrev-ref", "HEAD"): branch,
        # Three dots count only what the branch committed since it left master.
        ("diff", "--numstat", "origin/master...HEAD"): numstat,
        ("show", "origin/master:package.json"): package_files("0.1.9")["package.json"],
    }
    if version is not None:
        answers |= {("show", f"HEAD:{path}"): text for path, text in package_files(version).items()}

    def git(arguments: Sequence[str], _directory: Path) -> str | None:
        return answers.get(tuple(arguments))

    return main([], Path(), git, lambda _arguments: None)


@pytest.mark.parametrize(
    ("branch", "numstat", "status"),
    [
        ("14-check-rules", "10\t2\ta.py\n-\t-\timage.png\n900\t0\tpackage-lock.json", 0),
        ("14-check-rules", "200\t201\ta.py", 1),
        ("checks", "", 1),
        ("14-check-rules", None, 1),
        (None, "", 1),
    ],
)
def test_without_a_number_the_local_branch_is_checked(branch: str | None, numstat: str | None, status: int) -> None:
    """Check that the branch's name and committed size are checked without asking GitHub."""
    assert check_branch(branch, numstat) == status


@pytest.mark.parametrize(
    ("version", "expected"),
    [("0.1.9", "must be higher than 0.1.9"), (None, "Git could not read package.json in HEAD")],
)
def test_the_local_branch_s_committed_version_is_checked(
    version: str | None, expected: str, capsys: pytest.CaptureFixture[str]
) -> None:
    """Check that the branch must have committed a higher version than origin/master has."""
    assert check_branch("14-check-rules", "", version) == 1
    assert expected in capsys.readouterr().err


@pytest.mark.parametrize("arguments", [["x"], ["1", "2"]])
def test_other_arguments_are_rejected(arguments: list[str], capsys: pytest.CaptureFixture[str]) -> None:
    """Check that anything but one number is rejected."""
    assert main(arguments, Path(), lambda _arguments, _directory: None, lambda _arguments: None) == 1
    assert "Give a pull request's number" in capsys.readouterr().err


@pytest.mark.parametrize(("code", "output"), [(0, "{}"), (1, None)])
def test_gh_returns_output_or_nothing(monkeypatch: pytest.MonkeyPatch, code: int, output: str | None) -> None:
    """Check that gh returns its output, or nothing if it fails."""
    result = subprocess.CompletedProcess([], code, "{}", "")
    monkeypatch.setattr("subprocess.run", lambda *_given, **_options: result)

    assert run_gh(["api"]) == output


def test_gh_says_why_it_failed(monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]) -> None:
    """Check that gh's own message is shown when it fails."""
    failure = subprocess.CompletedProcess([], 1, "", "gh: Not Found\n")
    monkeypatch.setattr("subprocess.run", lambda *_given, **_options: failure)

    run_gh(["api"])

    assert capsys.readouterr().err == "gh: Not Found\n"


def test_gh_returns_nothing_when_it_cannot_start(monkeypatch: pytest.MonkeyPatch) -> None:
    """Check that gh returns nothing when it cannot start."""

    def fail(*_given: object, **_options: object) -> None:
        raise OSError

    monkeypatch.setattr("subprocess.run", fail)

    assert run_gh(["api"]) is None
