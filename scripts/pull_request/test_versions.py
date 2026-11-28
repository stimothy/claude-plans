"""Tests for the rules about the application's version."""

import json
from collections.abc import Mapping

import pytest

from scripts.pull_request.versions import version_problems

APPLICATION = "package.json"
PACKAGE = "packages/cli/package.json"
LATER_PACKAGE = "packages/logging/package.json"
LOCKFILE = "package-lock.json"


def package_files(version: object = "0.2.0", **others: object) -> dict[str, str]:
    """Make the files that give versions, all at one version except for the places named with another."""
    names = ("root", "package", "later", "lock", "lock_root", "lock_package", "lock_later")
    places = {name: others.get(name, version) for name in names}

    def manifest(place: str) -> dict[str, object]:
        return {} if places[place] is None else {"version": places[place]}

    entries = {
        "": manifest("lock_root"),
        "packages/cli": manifest("lock_package"),
        "packages/logging": manifest("lock_later"),
        # Neither is a package of this repository.
        "node_modules/zod": {"version": "4.6.7"},
        "packages/cli/node_modules/zod": {"version": "4.0.0"},
    }
    return {
        APPLICATION: json.dumps(manifest("root")),
        PACKAGE: json.dumps(manifest("package")),
        LATER_PACKAGE: json.dumps(manifest("later")),
        LOCKFILE: json.dumps(manifest("lock") | {"packages": entries}),
    }


def problems(proposed: Mapping[str, str], current: str = "0.1.9") -> list[str]:
    """List the problems with some files, when master is at a version."""
    return version_problems(proposed.__getitem__, package_files(current).__getitem__)


@pytest.mark.parametrize(
    ("version", "current"), [("0.2.0", "0.1.9"), ("0.0.10", "0.0.9"), ("1.0.0", "0.99.99"), ("0.10.0", "0.9.0")]
)
def test_a_higher_version_that_every_place_shares_passes(version: str, current: str) -> None:
    """Check that versions are compared as numbers, part by part."""
    assert problems(package_files(version), current) == []


@pytest.mark.parametrize("current", ["0.2.0", "0.2.1", "1.0.0"])
def test_a_version_that_is_not_higher_than_master_s_is_a_problem(current: str) -> None:
    """Check that the same version, or a lower one, is not an increase."""
    assert problems(package_files(), current) == [
        f"the version must be higher than {current}, which master has, but it is 0.2.0"
    ]


@pytest.mark.parametrize(
    ("place", "name"),
    [
        ("package", PACKAGE),
        ("later", LATER_PACKAGE),
        ("lock", LOCKFILE),
        ("lock_root", f"{LOCKFILE}, for the root package,"),
        ("lock_package", f"{LOCKFILE}, for packages/cli,"),
        ("lock_later", f"{LOCKFILE}, for packages/logging,"),
    ],
)
@pytest.mark.parametrize(("other", "has"), [("0.1.9", "the version '0.1.9'"), (None, "no version")])
def test_a_place_that_disagrees_is_a_problem(place: str, name: str, other: str | None, has: str) -> None:
    """Check that every package, and the lockfile, must have the root's version."""
    assert problems(package_files(**{place: other})) == [f"{name} has {has}, but {APPLICATION} has '0.2.0'"]


@pytest.mark.parametrize("version", [None, 2, "0.2", "v0.2.0", "0.2.0-beta.1", "0.2.0+build", "0.02.0", "0.2.0\n"])
def test_a_version_that_is_not_three_numbers_is_a_problem(version: object) -> None:
    """Check that the root's version is three numbers, as release tags are."""
    assert problems(package_files(version)) == [f"{APPLICATION} needs a version like '1.2.3', but has {version!r}"]


def test_a_version_on_master_that_cannot_be_compared_is_a_problem() -> None:
    """Check that an increase is not assumed when master's version cannot be compared."""
    assert problems(package_files(), "next") == ["master's version 'next' cannot be compared with 0.2.0"]
