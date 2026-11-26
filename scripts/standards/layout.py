"""Checks the file limits, the directory limits, and names."""

import re
from collections import Counter
from collections.abc import Mapping
from pathlib import PurePosixPath

MAXIMUM_LINES = 300
MAXIMUM_FILES = 10
LOCKFILES = ("package-lock.json", "requirements.txt")
# Neither limit applies to these, nor do the rules for directory names.
DOCUMENT_DIRECTORIES = (PurePosixPath("docs/adrs"), PurePosixPath("docs/designs"))
GRAB_BAGS = {"util", "utils", "helper", "helpers", "common", "misc"}
# A word at the start of a name can describe the rest of it, as in "common-prefix".
WORD_BOUNDARY = re.compile(r"[-_. ]+|(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])")


def _is_exempt(path: PurePosixPath) -> bool:
    """Tell whether neither limit applies to a file."""
    return str(path) in LOCKFILES or any(path.is_relative_to(directory) for directory in DOCUMENT_DIRECTORIES)


def _is_grab_bag(name: str, is_file: bool) -> bool:
    """Tell whether a file or directory name says nothing about what it holds."""
    parts = name.lstrip(".").split(".")
    if is_file and len(parts) > 1:
        parts.pop()
        # "util.test.ts" names the tests of "util".
        while len(parts) > 1 and parts[-1] in ("test", "spec", "d"):
            parts.pop()
    stem = ".".join(parts)
    return stem.lower() in GRAB_BAGS or WORD_BOUNDARY.split(stem)[-1].lower() in GRAB_BAGS - {"common"}


def _line_count(content: str) -> int:
    """Count lines, including a last line that has no line break."""
    return content.count("\n") + (not content.endswith("\n") and bool(content))


def layout_problems(files: Mapping[str, str | None]) -> list[str]:
    """List the broken limits and names, given each path's text, or nothing for a binary file."""
    problems: list[str] = []
    directories: Counter[PurePosixPath] = Counter()
    grab_bags: dict[PurePosixPath, str] = {}
    for name, content in files.items():
        path = PurePosixPath(name)
        if _is_exempt(path):
            continue
        lines = _line_count(content or "")
        if lines > MAXIMUM_LINES:
            problems.append(f"{name}: has {lines} lines, and the limit is {MAXIMUM_LINES}")
        directories[path.parent] += 1
        for part in (path, *path.parents):
            if _is_grab_bag(part.name, part == path):
                grab_bags[part] = f"{part}: '{part.name}' is a catch-all name, so name it for what it holds"
    problems.extend(
        f"{directory}: has {count} files, and the limit is {MAXIMUM_FILES}"
        for directory, count in directories.items()
        # The top-level directory is ".", which has no name. Migrations stay in one flat directory.
        if count > MAXIMUM_FILES and directory.name not in ("", "migrations")
    )
    return problems + list(grab_bags.values())
