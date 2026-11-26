"""Judges the shell commands that Claude is about to run.

This reads command text, so a determined disguise can get past it. It exists to stop mistakes.
"""

import itertools
import re
from collections.abc import Sequence
from pathlib import Path

from scripts.guard.repository import Git
from scripts.guard.shell import split

# Words that can come before the program that a command runs.
PREFIXES = {
    "!",
    "{",
    "command",
    "do",
    "else",
    "env",
    "exec",
    "if",
    "nice",
    "nohup",
    "sudo",
    "then",
    "time",
    "timeout",
    "xargs",
}
# Commands that move to another directory, in lower case, including the PowerShell ones.
MOVES = {"cd", "chdir", "popd", "pushd", "pop-location", "push-location", "set-location", "sl"}
RISKY_TEXT = re.compile(r"\bgit\b[\s\S]*\b(push|clean|stash)\b|\bgh\b[\s\S]*\bmerge")
MASTER = {"master", "heads/master", "refs/heads/master"}

MERGE = "Only the maintainer merges pull requests."
FORCE = "Force pushes are not allowed. Leave a needed force push to the maintainer."
PUSH_MASTER = "Pushing to master is not allowed. Push a branch and open a pull request."
IGNORED = (
    "This removes or moves ignored files, which can destroy the real data in .claude-plans/. "
    "To remove build output or caches, delete those directories by name. In a worktree, "
    "run it without `cd`, --git-dir, or --work-tree."
)
UNKNOWN_BRANCH = "The checked-out branch cannot be told. Name the branch: git push origin <branch>."
UNREADABLE = "This command could not be read, and it may push, merge, or delete files. Write it more simply."


def _options(
    arguments: Sequence[str], valued: str, valued_long: Sequence[str] = ()
) -> tuple[list[str], set[str], list[str]]:
    """Separate long options, short option letters, and other words. The `valued` options take a value."""
    long: list[str] = []
    short: set[str] = set()
    words: list[str] = []
    remaining = iter(arguments)
    for argument in remaining:
        if argument.startswith("--"):
            long.append(argument)
            if argument in valued_long:
                next(remaining, None)
        elif argument.startswith("-"):
            for index, letter in enumerate(argument[1:], start=1):
                short.add(letter)
                if letter in valued:
                    if index == len(argument) - 1:
                        next(remaining, None)
                    break
        else:
            words.append(argument)
    return long, short, words


def _judge_push(arguments: Sequence[str], directory: Path | None, git: Git) -> str | None:
    long, short, words = _options(arguments, "o", ("--push-option", "--repo", "--receive-pack", "--exec"))
    refspecs = words[1:]
    # Git accepts a long option shortened to any unambiguous start.
    if "f" in short or any(option.startswith(("--for", "--mi")) for option in long):
        return FORCE
    if any(refspec.startswith("+") for refspec in refspecs):
        return FORCE
    destinations = [refspec.split(":")[-1] for refspec in refspecs]
    # A lone colon pushes every branch that the remote also has, which includes master.
    if (
        "--all" in long
        or "--branches" in long
        or ":" in refspecs
        or any(name in MASTER or "*" in name for name in destinations)
    ):
        return PUSH_MASTER
    pushes_current = not refspecs or any(refspec in {"HEAD", "@"} for refspec in refspecs)
    if not pushes_current:
        return None
    branch = git(["symbolic-ref", "--short", "HEAD"], directory) if directory else None
    if branch is None:
        return UNKNOWN_BRANCH
    return PUSH_MASTER if branch == "master" else None


def _is_worktree(directory: Path | None, git: Git) -> bool:
    if directory is None:
        return False
    output = git(["rev-parse", "--path-format=absolute", "--git-dir", "--git-common-dir"], directory)
    match output.splitlines() if output else []:
        case [own, shared]:
            return not own.startswith("-") and own != shared
        case _:
            # A Git older than 2.31 adds a line, repeating the option that it does not know.
            return False


def _clean_removes_ignored(arguments: Sequence[str]) -> bool:
    long, short, _ = _options(arguments, "e", ("--exclude",))
    return bool(short & {"x", "X"}) and "n" not in short and "--dry-run" not in long


def _stash_moves_ignored(arguments: Sequence[str]) -> bool:
    if arguments and not arguments[0].startswith("-") and arguments[0] not in {"push", "save"}:
        return False
    long, short, _ = _options(arguments, "m")
    return "a" in short or "--all" in long


def _judge_git(arguments: Sequence[str], directory: Path | None, git: Git) -> str | None:
    remaining = list(arguments)
    while remaining and remaining[0].startswith("-"):
        option = remaining.pop(0)
        if option in {"-C", "-c", "--config-env", "--git-dir", "--work-tree", "--namespace"} and remaining:
            value = remaining.pop(0)
            if option == "-C" and directory:
                directory = directory / Path(value).expanduser()
        if option.startswith(("--git-dir", "--work-tree")):
            directory = None
    if not remaining:
        return None
    subcommand, rest = remaining[0], remaining[1:]
    if subcommand == "push":
        return _judge_push(rest, directory, git)
    checks = {"clean": _clean_removes_ignored, "stash": _stash_moves_ignored}
    if subcommand in checks and checks[subcommand](rest):
        return None if _is_worktree(directory, git) else IGNORED
    return None


def _judge_gh(arguments: Sequence[str]) -> str | None:
    remaining = iter(arguments)
    words: list[str] = []
    for argument in remaining:
        if argument in {"-R", "--repo"}:
            next(remaining, None)
        elif not argument.startswith("-"):
            words.append(argument)
    if words[:2] == ["pr", "merge"]:
        return MERGE
    merging = re.compile(r"pulls/[^/]+/merge|mergePullRequest|enablePullRequestAutoMerge")
    if words[:1] == ["api"] and any(merging.search(argument) for argument in arguments):
        return MERGE
    return None


def _judge_program(program: str, arguments: Sequence[str], location: Path | None, git: Git) -> str | None:
    if program == "git":
        return _judge_git(arguments, location, git)
    if program == "gh":
        return _judge_gh(arguments)
    if program in {"bash", "sh", "zsh"}:
        for flag, script in itertools.pairwise(arguments):
            if re.fullmatch(r"-\w*c", flag):
                return blocked_reason(script, location, git)
    return None


def _program_and_arguments(words: Sequence[str]) -> tuple[list[str], bool]:
    """Drop what comes before the program, and report whether that changes the repository Git uses."""
    remaining = list(words)
    wrapped = moved = False
    while remaining:
        word = remaining[0]
        if word in PREFIXES:
            wrapped = True
        elif re.match(r"\w+=", word):
            moved = moved or word.startswith(("GIT_DIR=", "GIT_WORK_TREE="))
        # A wrapper such as `sudo -E` or `timeout 60` has options and values of its own.
        elif not (wrapped and (word.startswith("-") or word[:1].isdigit())):
            break
        remaining.pop(0)
    return remaining, moved


def blocked_reason(command: str, directory: Path | None, git: Git) -> str | None:
    """Return why a shell command must not run, or nothing if it may. No directory means that it is unknown."""
    try:
        segments = split(command)
    except ValueError:
        return UNREADABLE if RISKY_TEXT.search(command) else None
    location = directory
    for segment in segments:
        words, moved = _program_and_arguments(segment)
        if moved:
            location = None
        if not words:
            continue
        # Windows and macOS usually find a program whatever the case of its name.
        program = Path(words[0]).stem.lower()
        if program in MOVES:
            location = None
        elif reason := _judge_program(program, words[1:], location, git):
            return reason
    return None
