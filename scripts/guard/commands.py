"""Judges the shell commands that Claude is about to run.

This reads command text, so a determined disguise can get past it. It exists to stop mistakes.
"""

import itertools
import re
import shlex
from collections.abc import Sequence
from pathlib import Path

from scripts.guard.repository import Git

SEPARATORS = ";&|()`\n"
# Words that can come before the program that a command runs.
PREFIXES = {"!", "{", "command", "do", "else", "env", "exec", "if", "nohup", "sudo", "then", "time", "xargs"}
RISKY_TEXT = re.compile(r"\bgit\b[\s\S]*\b(push|clean|stash)\b|\bgh\b[\s\S]*\bmerge")
MASTER = {"master", "heads/master", "refs/heads/master"}

MERGE = "Only the maintainer merges pull requests."
FORCE = "Force pushes are not allowed."
PUSH_MASTER = "Pushing to master is not allowed. Push a branch and open a pull request."
IGNORED = (
    "This removes or moves ignored files, which can destroy the real data in .claude-plans/. "
    "It is allowed only in a worktree, run from there without `cd`, --git-dir, or --work-tree."
)
UNREADABLE = "This command could not be read, and it may push, merge, or delete files. Write it more simply."


def _split(command: str) -> list[list[str]]:
    lexer = shlex.shlex(command.replace("\\\n", ""), posix=True, punctuation_chars=SEPARATORS)
    lexer.whitespace = " \t\r"
    lexer.whitespace_split = True
    lexer.commenters = ""
    segments: list[list[str]] = [[]]
    for token in lexer:
        if token and all(character in SEPARATORS for character in token):
            segments.append([])
        else:
            segments[-1].append(token)
    return segments


def _options(arguments: Sequence[str], valued: str) -> tuple[list[str], set[str], list[str]]:
    """Separate long options, short option letters, and other words. `valued` letters take a value."""
    long: list[str] = []
    short: set[str] = set()
    words: list[str] = []
    remaining = iter(arguments)
    for argument in remaining:
        if argument.startswith("--"):
            long.append(argument)
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
    long, short, words = _options(arguments, "o")
    refspecs = words[1:]
    # Git accepts a long option shortened to any unambiguous start.
    if "f" in short or any(option.startswith(("--fo", "--mi")) for option in long):
        return FORCE
    if any(refspec.startswith("+") for refspec in refspecs):
        return FORCE
    destinations = [refspec.split(":")[-1] for refspec in refspecs]
    if "--all" in long or "--branches" in long or any(name in MASTER or "*" in name for name in destinations):
        return PUSH_MASTER
    pushes_current = not refspecs or any(refspec in {"HEAD", "@"} for refspec in refspecs)
    if pushes_current and directory and git(["symbolic-ref", "--short", "HEAD"], directory) == "master":
        return PUSH_MASTER
    return None


def _is_worktree(directory: Path | None, git: Git) -> bool:
    if directory is None:
        return False
    output = git(["rev-parse", "--path-format=absolute", "--git-dir", "--git-common-dir"], directory)
    return output is not None and len(set(output.splitlines())) > 1


def _removes_ignored(subcommand: str, arguments: Sequence[str]) -> bool:
    if subcommand == "clean":
        long, short, _ = _options(arguments, "e")
        return bool(short & {"x", "X"}) and "n" not in short and "--dry-run" not in long
    if arguments and not arguments[0].startswith("-") and arguments[0] not in {"push", "save"}:
        return False
    long, short, _ = _options(arguments, "m")
    return "a" in short or "--all" in long


def _judge_git(arguments: Sequence[str], directory: Path | None, git: Git) -> str | None:
    remaining = list(arguments)
    while remaining and remaining[0].startswith("-"):
        option = remaining.pop(0)
        if option in {"-C", "-c", "--git-dir", "--work-tree", "--namespace"} and remaining:
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
    if subcommand in {"clean", "stash"} and _removes_ignored(subcommand, rest):
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


def blocked_reason(command: str, directory: Path | None, git: Git) -> str | None:
    """Return why a shell command must not run, or nothing if it may. No directory means that it is unknown."""
    try:
        segments = _split(command)
    except ValueError:
        return UNREADABLE if RISKY_TEXT.search(command) else None
    location = directory
    for segment in segments:
        words = list(segment)
        while words and (words[0] in PREFIXES or re.match(r"\w+=", words[0])):
            if words.pop(0).startswith(("GIT_DIR=", "GIT_WORK_TREE=")):
                location = None
        if not words:
            continue
        program = Path(words[0]).stem
        if program in {"cd", "pushd"}:
            location = None
        elif reason := _judge_program(program, words[1:], location, git):
            return reason
    return None
