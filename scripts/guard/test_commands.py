"""Tests for judging Claude's shell commands."""

from collections.abc import Sequence
from pathlib import Path

import pytest

from scripts.guard.commands import blocked_reason
from scripts.guard.repository import Git

HERE = Path("/repository")


def fake_git(branch: str = "11-work", main_checkout: bool = False) -> Git:
    """Stand in for Git in a worktree or a main checkout."""

    def run(arguments: Sequence[str], _directory: Path) -> str | None:
        if arguments[0] == "symbolic-ref":
            return branch
        return "/main/.git\n/main/.git" if main_checkout else "/main/.git/worktrees/a\n/main/.git"

    return run


@pytest.mark.parametrize(
    "command",
    [
        "git push origin :",
        "Git push -f",
        "GH pr merge 3",
        "git --config-env user.name=NAME push -f",
        "cat <<EOF > notes.txt\n$(git push -f)\nEOF",
        "cat <<EOF\ntext `git push -f` text\nEOF",
        "cat <<-EOF\n\t$(echo $(git push -f))\n\tEOF",
        "git push --branches origin",
        "gh api graphql -f query='mutation { enablePullRequestAutoMerge }'",
        "if true; then git push origin master; fi",
        "{ git push -f; }",
        "env A=1 git push -f",
        "sudo -E git push -f",
        "xargs -r git push -f",
        "timeout 60 git push -f",
        "git push \\\n  --force",
        "git push origin \\\n  master",
        "echo ok # note\ngit push -f",
        "# Don't stop\ngit push -f\n# It's done",
        "git push origin HEAD:master>/dev/null",
        "bash <<'EOF'\ngit push -f\nEOF",
        "cat <<'EOF'\ntext\nEOF\ngit push -f",
        "git push --force",
        "git push -f origin 11-work",
        "git push -uf origin 11-work",
        "git push --force-with-lease=11-work origin 11-work",
        "git push --forc origin 11-work",
        "git push origin +11-work",
        "git push --mirror",
        "git push --all origin",
        "git push origin master",
        "git push origin HEAD:master",
        "git push origin :refs/heads/master",
        "git push --delete origin master",
        "git push origin 'refs/heads/*:refs/heads/*'",
        "git -C /elsewhere -c a.b=c push -f",
        "/usr/bin/git push -f",
        "FOO=1 git push -f",
        "git status && git push -f",
        "git status\ngit push -f",
        "git status; (git push -f)",
        "echo `git push -f`",
        "bash -lc 'git push -f'",
        "gh pr merge 3 --squash",
        "gh -R owner/name pr merge",
        "gh api -X PUT repos/owner/name/pulls/3/merge",
        "gh api graphql -f query='mutation { mergePullRequest }'",
        "git push -f 'unclosed",
    ],
)
def test_unsafe_pushes_and_merges_are_blocked(command: str) -> None:
    """Check that unsafe pushes and merges are blocked."""
    reason = blocked_reason(command, HERE, fake_git())

    assert reason is not None


@pytest.mark.parametrize(
    "command",
    [
        "cat <<EOF > notes.md\nIt's $(date) and \\$(git push -f)\nEOF",
        "git push --follow-tags origin 11-work",
        "git push origin 11-work # not master",
        "git push -u origin 11-work 2>&1 | tail -5",
        "cat <<'EOF' > notes.md\ngit push -f\nIt's `git push origin master`\nEOF",
        "echo $((1<<2))",
        "git push",
        "git push -u origin 11-fix-master",
        "git push -o ci.fast origin 11-work",
        "git push origin master:11-copy",
        "git commit -m 'never git push --force to master'",
        'git commit -m "first line\ngit push -f"',
        "grep 'git push -f' notes.md",
        "gh pr view 3",
        "gh pr create --title 'gh pr merge'",
        "git fetch origin master",
        "echo 'unclosed",
        "",
    ],
)
def test_safe_commands_are_allowed(command: str) -> None:
    """Check that safe commands are allowed."""
    reason = blocked_reason(command, HERE, fake_git())

    assert reason is None


@pytest.mark.parametrize(
    "command",
    [
        "git push",
        "git push origin",
        "git push origin HEAD",
        "git push origin 2>&1 | tail -5",
        "git push >push.log",
        "git push --push-option ci.skip origin",
        "git push -o ci.skip origin",
        "git push # publish it",
    ],
)
def test_pushing_the_checked_out_master_is_blocked(command: str) -> None:
    """Check that pushing the checked out master is blocked."""
    reason = blocked_reason(command, HERE, fake_git(branch="master"))

    assert reason is not None


@pytest.mark.parametrize(
    "command",
    [
        "git clean --exclude -n -fdx",
        "git --config-env user.name=NAME clean -fdx",
        "Git.exe clean -fdx",
        "cat <<EOF > notes.txt\n$(git clean -fdx)\nEOF",
        "git clean -fdx -enode_modules",
        "git stash save -a",
        "# Don't touch tracked files\ngit clean -fdX\n# Now it's tidy",
        "sudo -E git clean -fdx",
        "git clean -fdx",
        "git clean -f -X",
        "git stash --all",
        "git stash -a",
        "git stash push -m note -a",
    ],
)
def test_removing_ignored_files_is_blocked_only_in_a_main_checkout(command: str) -> None:
    """Check that removing ignored files is blocked only in a main checkout."""
    in_main_checkout = blocked_reason(command, HERE, fake_git(main_checkout=True))
    in_worktree = blocked_reason(command, HERE, fake_git())

    assert in_main_checkout is not None
    assert in_worktree is None


@pytest.mark.parametrize(
    "command",
    [
        "git clean -f -e -x",
        "git clean -fd",
        "git clean -ndx",
        "git clean -e x -f",
        "git stash",
        "git stash push -m -a",
        "git stash list --all",
    ],
)
def test_commands_that_keep_ignored_files_are_allowed(command: str) -> None:
    """Check that commands that keep ignored files are allowed."""
    reason = blocked_reason(command, HERE, fake_git(main_checkout=True))

    assert reason is None


@pytest.mark.parametrize(
    "command",
    [
        "pushd /main && git clean -fdx",
        "Set-Location C:/main; git clean -fdx",
        "sl /main; git clean -fdx",
        "GIT_WORK_TREE=/main git clean -fdx",
        "git --work-tree=/main clean -fdx",
        "git --git-dir=/main/.git clean -fdx",
        "cd /somewhere && git clean -fdx",
        "git --work-tree /main clean -fdx",
        "GIT_DIR=/main/.git git clean -fdx",
        "cd /somewhere && sh -c 'git clean -fdx'",
    ],
)
def test_removing_ignored_files_in_an_unknown_place_is_blocked(command: str) -> None:
    """Check that removing ignored files in an unknown place is blocked."""
    reason = blocked_reason(command, HERE, fake_git())

    assert reason is not None


def test_a_directory_that_git_cannot_read_counts_as_a_main_checkout() -> None:
    """Check that a directory that git cannot read counts as a main checkout."""
    reason = blocked_reason("git clean -fdx", HERE, lambda _arguments, _directory: None)

    assert reason is not None


def test_the_directory_option_chooses_where_git_looks() -> None:
    """Check that the directory option chooses where git looks."""
    seen: list[Path] = []

    def run(_arguments: Sequence[str], directory: Path) -> str:
        seen.append(directory)
        return "11-work"

    blocked_reason("git -C nested push", HERE, run)

    assert seen == [HERE / "nested"]


@pytest.mark.parametrize("command", ["cd /somewhere && git push", "GIT_DIR=/main/.git git push origin HEAD"])
def test_a_push_from_an_unknown_place_must_name_its_branch(command: str) -> None:
    """Check that a push from an unknown place must name its branch."""
    reason = blocked_reason(command, HERE, fake_git())

    assert reason is not None
    assert "Name the branch" in reason


@pytest.mark.parametrize("command", ["git clean 'unclosed", "git stash 'unclosed", "gh pr merge 'unclosed"])
def test_a_risky_command_that_cannot_be_read_is_blocked(command: str) -> None:
    """Check that a risky command that cannot be read is blocked."""
    reason = blocked_reason(command, HERE, fake_git())

    assert reason is not None


def test_output_from_an_old_git_counts_as_a_main_checkout() -> None:
    """Check that output from an old Git counts as a main checkout."""
    output = "--path-format=absolute\n.git\n.git"

    reason = blocked_reason("git clean -fdx", HERE, lambda _arguments, _directory: output)

    assert reason is not None
