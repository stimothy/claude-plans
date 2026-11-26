"""Reads the ADRs and design documents, and lists what is wrong with them."""

import json
import re
import unicodedata
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import date
from pathlib import Path


@dataclass(frozen=True)
class Kind:
    """One kind of document: where it lives, what it is called, and how it starts."""

    directory: str
    heading: str
    fields: tuple[str, ...]
    sections: tuple[str, ...]


KINDS = {
    "adr": Kind(
        "adrs",
        "Architecture decision records",
        ("title", "description", "date"),
        ("Context", "Decision", "Consequences", "Changelog"),
    ),
    "design": Kind("designs", "Design documents", ("title", "description"), ("Overview",)),
}
NAME = re.compile(r"(?!0000)([0-9]{4})(-[a-z0-9]+)+\.md")
FIELD = re.compile(r'([a-z]+): (".*")')
# Markdown or the index's table would treat these as formatting. The formatter rewrites frontmatter with a quote.
FORMATTING = re.compile(r'[|\[\]<>*\\"]|__')
# Markdown turns these into links, and Markdown lint rejects them when they are bare.
LINK = re.compile(r"://|\bwww\.|\S@\S+\.\S", re.IGNORECASE)


@dataclass(frozen=True)
class Document:
    """A document as the index lists it, with its path inside docs/."""

    path: str
    title: str
    description: str


def _frontmatter(text: str) -> dict[str, str] | None:
    """Return the fields at the top of a document, or nothing if they are not written as expected."""
    lines = text.split("\n")
    if lines[0] != "---" or "---" not in lines[1:]:
        return None
    fields: dict[str, str] = {}
    for line in lines[1 : lines.index("---", 1)]:
        match = FIELD.fullmatch(line)
        if match is None or match[1] in fields:
            return None
        try:
            # A double-quoted JSON string means the same in YAML.
            fields[match[1]] = json.loads(match[2])
        except json.JSONDecodeError:
            return None
    return fields


def _is_plain_text(value: str) -> bool:
    """Tell whether a value is one line that the index can show as written."""
    # The formatter counts wide characters and marks drawn over others differently, which would misalign the table.
    uneven = any(
        unicodedata.east_asian_width(each) in "WF" or unicodedata.category(each) in ("Mn", "Me") for each in value
    )
    # The formatter also joins repeated spaces.
    changed = value != " ".join(value.split()) or FORMATTING.search(value) or LINK.search(value)
    return bool(value) and value.isprintable() and not changed and not uneven


def _is_date(value: str) -> bool:
    """Tell whether a value is a real date, written as year, month, and day."""
    try:
        return date.fromisoformat(value).isoformat() == value
    except ValueError:
        return False


def metadata_problems(kind: Kind, fields: Mapping[str, str]) -> list[str]:
    """List what is wrong with a document's fields."""
    if set(fields) != set(kind.fields):
        return [f"the frontmatter needs exactly these fields: {', '.join(kind.fields)}"]
    problems = [
        f'the {name} must be one line of plain text, without | [ ] < > * \\ " __, double spaces, links, or emoji'
        for name in ("title", "description")
        if not _is_plain_text(fields[name])
    ]
    if "date" in fields and not _is_date(fields["date"]):
        problems.append("the date must be a real one, written like 2026-11-25")
    return problems


def _is_leftover(name: str) -> bool:
    """Tell whether an editor or operating system left a file behind. Git ignores these."""
    return name.startswith(".") or name.endswith("~") or name in ("Thumbs.db", "Desktop.ini")


def read_documents(root: Path) -> tuple[dict[Kind, list[Document]], list[str]]:
    """Return the good documents of each kind in number order, and every problem."""
    documents: dict[Kind, list[Document]] = {kind: [] for kind in KINDS.values()}
    problems: list[str] = []
    for kind in KINDS.values():
        numbers: set[str] = set()
        directory = root / "docs" / kind.directory
        for path in sorted(directory.glob("*")):
            if _is_leftover(path.name) or (path.name == "assets" and path.is_dir()):
                continue
            name = f"docs/{kind.directory}/{path.name}"
            match = NAME.fullmatch(path.name)
            if match is None or not path.is_file():
                problems.append(f"{name}: is not named like '0001-use-sqlite.md', and is not 'assets/'")
                continue
            if match[1] in numbers:
                problems.append(f"{name}: the number {match[1]} is already used")
            numbers.add(match[1])
            try:
                fields = _frontmatter(path.read_text(encoding="utf-8"))
            except UnicodeDecodeError:
                problems.append(f"{name}: is not UTF-8 text")
                continue
            if fields is None:
                problems.append(f'{name}: needs frontmatter between --- lines, with each field written as name: "text"')
                continue
            wrong = metadata_problems(kind, fields)
            problems.extend(f"{name}: {problem}" for problem in wrong)
            if not wrong:
                location = f"{kind.directory}/{path.name}"
                documents[kind].append(Document(location, fields["title"], fields["description"]))
    return documents, problems
