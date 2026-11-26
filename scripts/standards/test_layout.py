"""Tests for the file limits, directory limits, and names."""

import pytest

from scripts.standards.layout import layout_problems


def files(directory: str, count: int) -> dict[str, str]:
    """Make a number of empty files in a directory."""
    return {f"{directory}file{number}.txt": "" for number in range(count)}


@pytest.mark.parametrize("content", ["line\n" * 301, "line\n" * 300 + "line"])
def test_a_file_over_300_lines_is_a_problem(content: str) -> None:
    """Check that a file over 300 lines is a problem."""
    problems = layout_problems({"source/long.py": content})

    assert problems == ["source/long.py: has 301 lines, and the limit is 300"]


@pytest.mark.parametrize(
    "path",
    ["package-lock.json", "requirements.txt", "docs/adrs/0001-storage.md", "docs/designs/assets/diagram.svg"],
)
def test_lockfiles_and_documents_may_be_long(path: str) -> None:
    """Check that lockfiles and documents may be long."""
    problems = layout_problems({path: "line\n" * 301})

    assert problems == []


def test_300_lines_and_binary_files_are_allowed() -> None:
    """Check that 300 lines and binary files are allowed."""
    problems = layout_problems({"source/full.py": "line\n" * 300, "source/image.png": None})

    assert problems == []


@pytest.mark.parametrize("directory", ["source/", "docs/", "packages/backend/migrations/older/"])
def test_a_directory_over_10_files_is_a_problem(directory: str) -> None:
    """Check that a directory over 10 files is a problem."""
    problems = layout_problems(files(directory, 11))

    assert problems == [f"{directory.rstrip('/')}: has 11 files, and the limit is 10"]


@pytest.mark.parametrize(
    "directory", ["", "docs/adrs/", "docs/designs/", "docs/adrs/assets/", "packages/backend/migrations/"]
)
def test_some_directories_may_hold_more_files(directory: str) -> None:
    """Check that some directories may hold more files."""
    problems = layout_problems(files(directory, 11))

    assert problems == []


def test_files_in_subdirectories_do_not_count() -> None:
    """Check that files in subdirectories do not count."""
    contents = {**files("source/", 10), **files("source/nested/", 10)}

    problems = layout_problems(contents)

    assert problems == []


def test_only_the_top_level_lockfiles_are_exempt() -> None:
    """Check that only the top level lockfiles are exempt."""
    problems = layout_problems({"source/requirements.txt": "line\n" * 301})

    assert len(problems) == 1


def test_binary_files_count_toward_the_directory_limit() -> None:
    """Check that binary files count toward the directory limit."""
    problems = layout_problems(dict.fromkeys(files("images/", 11)))

    assert len(problems) == 1


def test_a_migration_keeps_the_line_limit() -> None:
    """Check that a migration keeps the line limit."""
    problems = layout_problems({"migrations/0001-start.sql": "line\n" * 301})

    assert len(problems) == 1


@pytest.mark.parametrize(
    ("path", "name"),
    [
        ("source/utils/format.ts", "utils"),
        ("source/Helpers/format.ts", "Helpers"),
        ("source/common/format.ts", "common"),
        ("source/misc.py", "misc.py"),
        ("source/util.test.ts", "util.test.ts"),
        ("source/string-utils.ts", "string-utils.ts"),
        ("source/test_helpers.py", "test_helpers.py"),
        ("source/dateUtils.ts", "dateUtils.ts"),
        ("source/URLUtils.ts", "URLUtils.ts"),
        ("source/string.utils.ts", "string.utils.ts"),
        ("source/date.helpers.test.ts", "date.helpers.test.ts"),
        ("source/date.utils/format.ts", "date.utils"),
        ("source/date-helper.ts", "date-helper.ts"),
        ("source/Common/format.ts", "Common"),
        ("source/.utils/format.ts", ".utils"),
    ],
)
def test_a_grab_bag_name_is_a_problem(path: str, name: str) -> None:
    """Check that a grab bag name is a problem."""
    problems = layout_problems({path: ""})

    assert len(problems) == 1
    assert f"'{name}' is a catch-all name" in problems[0]


@pytest.mark.parametrize(
    "path",
    [
        "source/common-prefix.ts",
        "source/lowest-common.ts",
        "source/helper-text.ts",
        "source/util-types.test.ts",
        "source/utilization.py",
        "docs/adrs/0002-misc.md",
    ],
)
def test_other_names_are_allowed(path: str) -> None:
    """Check that other names are allowed."""
    problems = layout_problems({path: ""})

    assert problems == []


def test_a_grab_bag_directory_is_reported_once() -> None:
    """Check that a grab bag directory is reported once."""
    problems = layout_problems({"utils/first.ts": "", "utils/second.ts": ""})

    assert len(problems) == 1
