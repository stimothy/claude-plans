"""Tests for creating, indexing, and checking documents."""

from datetime import UTC, datetime
from pathlib import Path

import pytest

from scripts.documents.command import main

NOW = datetime(2026, 11, 25, 5, 37, tzinfo=UTC)


def run(root: Path, *arguments: str) -> int:
    """Run the command in a directory at a fixed time."""
    return main(arguments, root, NOW)


def read(root: Path, name: str) -> str:
    """Return a file's text."""
    return (root / name).read_text(encoding="utf-8")


def test_a_new_adr_is_dated_logged_and_indexed(tmp_path: Path) -> None:
    """Check that a new ADR has its metadata and first changelog line, and joins the index."""
    assert run(tmp_path, "new", "adr", "Use SQLite: why", "One file holds the data.") == 0

    assert read(tmp_path, "docs/adrs/0001-use-sqlite-why.md") == (
        '---\ntitle: "Use SQLite: why"\ndescription: "One file holds the data."\ndate: "2026-11-25"\n---\n\n'
        "## Context\n\n## Decision\n\n## Consequences\n\n## Changelog\n\n- 2026-11-25 05:37 UTC - Created\n"
    )
    assert "[Use SQLite: why](adrs/0001-use-sqlite-why.md)" in read(tmp_path, "docs/README.md")
    assert run(tmp_path, "check") == 0


def test_a_new_design_document_takes_the_next_number(tmp_path: Path) -> None:
    """Check that numbers go on from the highest one, even after a gap."""
    run(tmp_path, "new", "design", "First", "One.")
    (tmp_path / "docs/designs/0001-first.md").rename(tmp_path / "docs/designs/0007-first.md")
    run(tmp_path, "index")

    assert run(tmp_path, "new", "design", "Second", "Two.") == 0

    assert (
        read(tmp_path, "docs/designs/0008-second.md")
        == '---\ntitle: "Second"\ndescription: "Two."\n---\n\n## Overview\n'
    )


def test_the_index_lists_each_kind_in_an_aligned_table(tmp_path: Path) -> None:
    """Check the index's exact text, which the formatter must leave alone."""
    run(tmp_path, "new", "design", "A", "How it works.")

    assert read(tmp_path, "docs/README.md") == (
        "# Documentation\n\n"
        "<!-- Built by `npm run document:index`. Do not edit it by hand. -->\n\n"
        "When sources disagree, ADRs outrank code, and code outranks design documents.\n\n"
        "## Architecture decision records\n\nNone yet.\n\n"
        "## Design documents\n\n"
        "| Document               | Description   |\n"
        "| ---------------------- | ------------- |\n"
        "| [A](designs/0001-a.md) | How it works. |\n"
    )


def test_a_file_name_keeps_accented_letters_without_their_accents(tmp_path: Path) -> None:
    """Check that an accent does not split a word in a file name."""
    run(tmp_path, "new", "design", "Café naïve — plans", "One.")

    assert (tmp_path / "docs/designs/0001-cafe-naive-plans.md").is_file()


@pytest.mark.parametrize("index", [None, "# Documentation\n"])
def test_the_check_rejects_a_missing_or_outdated_index(
    tmp_path: Path, index: str | None, capsys: pytest.CaptureFixture[str]
) -> None:
    """Check that the index must match the documents."""
    (tmp_path / "docs").mkdir()
    if index is not None:
        (tmp_path / "docs/README.md").write_text(index, encoding="utf-8")

    assert run(tmp_path, "check") == 1
    assert "docs/README.md: is out of date" in capsys.readouterr().err


@pytest.mark.parametrize("arguments", [("check",), ("index",), ("new", "design", "Next", "Two.")])
def test_nothing_is_written_while_a_document_is_bad(tmp_path: Path, arguments: tuple[str, ...]) -> None:
    """Check that each command lists a bad document's problem and writes nothing."""
    (tmp_path / "docs/designs").mkdir(parents=True)
    (tmp_path / "docs/designs/notes.md").write_text("", encoding="utf-8")

    assert run(tmp_path, *arguments) == 1
    assert sorted(path.name for path in tmp_path.rglob("*.md")) == ["notes.md"]


@pytest.mark.parametrize(("title", "description"), [("???", "Fine."), ("A | B", "Fine."), ("Fine", "")])
def test_a_document_that_would_fail_the_check_is_not_created(tmp_path: Path, title: str, description: str) -> None:
    """Check that a title without a file name, or bad metadata, creates nothing."""
    assert run(tmp_path, "new", "design", title, description) == 1
    assert list(tmp_path.iterdir()) == []


def test_the_check_rejects_a_bad_document_even_when_the_index_is_current(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """Check that a bad document fails the check although the index lists every good one."""
    run(tmp_path, "new", "design", "Good", "One.")
    (tmp_path / "docs/designs/notes.md").write_text("", encoding="utf-8")

    assert run(tmp_path, "check") == 1
    listed = capsys.readouterr().err
    assert "is not named like" in listed
    assert "out of date" not in listed


def test_index_rewrites_the_index_after_a_change_by_hand(tmp_path: Path) -> None:
    """Check that rebuilding the index picks up a changed description."""
    run(tmp_path, "new", "design", "System", "Before.")
    changed = read(tmp_path, "docs/designs/0001-system.md").replace("Before.", "After.")
    (tmp_path / "docs/designs/0001-system.md").write_text(changed, encoding="utf-8")

    assert run(tmp_path, "index") == 0

    assert "After." in read(tmp_path, "docs/README.md")
    assert run(tmp_path, "check") == 0


def test_the_next_number_follows_the_highest_of_the_same_kind(tmp_path: Path) -> None:
    """Check that another kind's numbers and lower numbers do not matter."""
    run(tmp_path, "new", "design", "First", "One.")
    run(tmp_path, "new", "design", "Last", "Two.")
    (tmp_path / "docs/designs/0002-last.md").rename(tmp_path / "docs/designs/0007-last.md")
    run(tmp_path, "new", "adr", "Other", "Why.")
    (tmp_path / "docs/adrs/0001-other.md").rename(tmp_path / "docs/adrs/0009-other.md")

    assert run(tmp_path, "new", "design", "Next", "Three.") == 0

    assert (tmp_path / "docs/designs/0008-next.md").is_file()


def test_every_row_is_listed_and_columns_are_as_wide_as_their_headings(tmp_path: Path) -> None:
    """Check a table with two rows whose descriptions are shorter than the heading."""
    run(tmp_path, "new", "design", "A", "One.")
    run(tmp_path, "new", "design", "Longer", "Two.")

    assert read(tmp_path, "docs/README.md").endswith(
        "| Document                         | Description |\n"
        "| -------------------------------- | ----------- |\n"
        "| [A](designs/0001-a.md)           | One.        |\n"
        "| [Longer](designs/0002-longer.md) | Two.        |\n"
    )


def test_written_files_have_the_same_line_breaks_on_every_system(tmp_path: Path) -> None:
    """Check that no file gets Windows line breaks, which the formatter rejects."""
    run(tmp_path, "new", "design", "A", "One.")

    for name in ("docs/designs/0001-a.md", "docs/README.md"):
        assert b"\r" not in (tmp_path / name).read_bytes()
