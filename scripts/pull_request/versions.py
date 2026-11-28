"""The rules about the application's version, which the root package.json and every package share."""

import json
import re
from collections.abc import Callable
from typing import Any

# Returns a file's text as it is in one commit.
Read = Callable[[str], str]

MANIFEST = "package.json"
LOCKFILE = "package-lock.json"
VERSION = re.compile(r"(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)")
# The lockfile also lists dependencies, some of them under a package's own directory.
PACKAGE = re.compile(r"packages/[^/]+")


def _parsed(read: Read, path: str) -> dict[str, Any]:
    """Return what a JSON file holds."""
    return dict(json.loads(read(path)))


def _numbers(version: object) -> tuple[int, ...] | None:
    """Return a version's three numbers, if it is written as three numbers."""
    match = VERSION.fullmatch(version) if isinstance(version, str) else None
    return tuple(map(int, match.groups())) if match else None


def _other_versions(read: Read) -> dict[str, object]:
    """Return the version in each place that must match the root package.json, or nothing where there is none."""
    lockfile = _parsed(read, LOCKFILE)
    entries = lockfile["packages"]
    found = {LOCKFILE: lockfile.get("version"), f"{LOCKFILE}, for the root package,": entries[""].get("version")}
    for directory in filter(PACKAGE.fullmatch, entries):
        path = f"{directory}/{MANIFEST}"
        found[path] = _parsed(read, path).get("version")
        found[f"{LOCKFILE}, for {directory},"] = entries[directory].get("version")
    return found


def version_problems(read_proposed: Read, read_current: Read) -> list[str]:
    """List what is wrong with a change's version, given how to read its files and master's."""
    version = _parsed(read_proposed, MANIFEST).get("version")
    numbers = _numbers(version)
    if numbers is None:
        return [f"{MANIFEST} needs a version like '1.2.3', but has {version!r}"]
    problems = [
        f"{place} has {'no version' if other is None else f'the version {other!r}'}, but {MANIFEST} has {version!r}"
        for place, other in _other_versions(read_proposed).items()
        if other != version
    ]
    current = _parsed(read_current, MANIFEST).get("version")
    current_numbers = _numbers(current)
    if current_numbers is None:
        problems.append(f"master's version {current!r} cannot be compared with {version}")
    elif numbers <= current_numbers:
        problems.append(f"the version must be higher than {current}, which master has, but it is {version}")
    return problems
