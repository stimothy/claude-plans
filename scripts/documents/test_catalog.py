"""Tests for reading the ADRs and design documents."""

from pathlib import Path

import pytest

from scripts.documents.catalog import KINDS, read_documents

DESIGN = '---\ntitle: "System"\ndescription: "How it works."\n---\n\n## Overview\n'
ADR = '---\ntitle: "SQLite"\ndescription: "Why."\ndate: "2026-11-25"\n---\n'


def write(root: Path, name: str, content: str) -> None:
    """Write one file under the root, with the directories that it needs."""
    path = root / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def test_good_documents_are_read_in_number_order(tmp_path: Path) -> None:
    """Check that good documents are read, and assets and hidden files are passed over."""
    write(tmp_path, "docs/designs/0002-second.md", DESIGN)
    write(tmp_path, "docs/designs/0001-first-part.md", DESIGN)
    write(tmp_path, "docs/designs/assets/screen.png", "")
    write(tmp_path, "docs/designs/.DS_Store", "")
    write(tmp_path, "docs/adrs/0001-use-sqlite.md", ADR)

    documents, problems = read_documents(tmp_path)

    assert problems == []
    assert [found.path for found in documents[KINDS["design"]]] == [
        "designs/0001-first-part.md",
        "designs/0002-second.md",
    ]
    assert [(found.title, found.description) for found in documents[KINDS["adr"]]] == [("SQLite", "Why.")]


def test_missing_directories_hold_no_documents(tmp_path: Path) -> None:
    """Check that a repository without documents has no problems."""
    documents, problems = read_documents(tmp_path)

    assert (list(documents.values()), problems) == ([[], []], [])


@pytest.mark.parametrize(
    "name",
    ["notes.md", "1-short.md", "0000-zero.md", "0001-Upper.md", "0001.md", "0001-a--b.md", "0001-a.txt", "more/a.md"],
)
def test_another_name_is_a_problem(tmp_path: Path, name: str) -> None:
    """Check that only numbered, kebab-case Markdown files and assets are allowed."""
    write(tmp_path, f"docs/designs/{name}", DESIGN)

    _, problems = read_documents(tmp_path)

    assert len(problems) == 1
    assert "is not named like" in problems[0]


def test_a_number_used_twice_is_a_problem(tmp_path: Path) -> None:
    """Check that a number is used once in a directory."""
    write(tmp_path, "docs/designs/0001-first.md", DESIGN)
    write(tmp_path, "docs/designs/0001-other.md", DESIGN)

    _, problems = read_documents(tmp_path)

    assert problems == ["docs/designs/0001-other.md: the number 0001 is already used"]


@pytest.mark.parametrize(
    ("content", "expected"),
    [
        ("## Overview\n", "frontmatter"),
        ('---\ntitle: "A"\n', "frontmatter"),
        (DESIGN.replace('"System"', "System"), "frontmatter"),
        (DESIGN.replace('"System"', '"A" "B"'), "frontmatter"),
        (DESIGN.replace("title:", 'title: "A"\ntitle:'), "frontmatter"),
        (DESIGN.replace('description: "How it works."\n', ""), "exactly these fields: title, description"),
        (DESIGN.replace("title:", 'status: "new"\ntitle:'), "exactly these fields"),
        (DESIGN.replace("System", " "), "title must be"),
        (DESIGN.replace("System", "A | B"), "title must be"),
        (DESIGN.replace("System", "The __main__ module"), "title must be"),
        (DESIGN.replace("System", "A\\nB"), "title must be"),
        (DESIGN.replace("How it works.", "Done ✅"), "description must be"),
        *((DESIGN.replace("System", f"A {each} B"), "title must be") for each in "[]<>*"),
        (DESIGN.replace("System", "A \\\\ B"), "title must be"),
        # The formatter would rewrite these, or Markdown lint would reject them in the index.
        (DESIGN.replace("System", 'The \\"main\\" part'), "title must be"),
        (DESIGN.replace("How it works.", "One.  Two."), "description must be"),
        (DESIGN.replace("How it works.", "Café."), "description must be"),
        (DESIGN.replace("How it works.", "ฉัน"), "description must be"),
        (DESIGN.replace("How it works.", "See https://semver.org."), "description must be"),
        (DESIGN.replace("How it works.", "See www.semver.org."), "description must be"),
        (DESIGN.replace("How it works.", "Ask someone@example.com."), "description must be"),
    ],
)
def test_bad_metadata_is_a_problem(tmp_path: Path, content: str, expected: str) -> None:
    """Check that frontmatter holds exactly its fields, each with plain text."""
    write(tmp_path, "docs/designs/0001-system.md", content)

    documents, problems = read_documents(tmp_path)

    assert documents[KINDS["design"]] == []
    assert len(problems) == 1
    assert expected in problems[0]


@pytest.mark.parametrize("date", ["2026-13-01", "20261125", "yesterday"])
def test_an_adr_needs_a_real_date(tmp_path: Path, date: str) -> None:
    """Check that an ADR's date is a real date, written as year, month, and day."""
    write(tmp_path, "docs/adrs/0001-use-sqlite.md", ADR.replace("2026-11-25", date))

    _, problems = read_documents(tmp_path)

    assert problems == ["docs/adrs/0001-use-sqlite.md: the date must be a real one, written like 2026-11-25"]


def test_a_document_that_is_not_utf_8_is_a_problem(tmp_path: Path) -> None:
    """Check that another encoding is rejected instead of being indexed with lost letters."""
    write(tmp_path, "docs/designs/0001-system.md", "")
    (tmp_path / "docs/designs/0001-system.md").write_bytes(DESIGN.replace("System", "Café").encode("cp1252"))

    _, problems = read_documents(tmp_path)

    assert problems == ["docs/designs/0001-system.md: is not UTF-8 text"]


@pytest.mark.parametrize("name", ["0001-system.md~", "Thumbs.db", "Desktop.ini"])
def test_files_that_editors_and_systems_leave_behind_are_passed_over(tmp_path: Path, name: str) -> None:
    """Check that Git-ignored leftovers do not fail the check."""
    write(tmp_path, f"docs/designs/{name}", "")

    assert read_documents(tmp_path)[1] == []
