"""Creates a numbered document, builds the index in docs/README.md, or checks both."""

import argparse
import json
import re
import sys
import unicodedata
from collections.abc import Sequence
from datetime import UTC, datetime
from pathlib import Path

from scripts.documents.catalog import KINDS, NAME, Document, Kind, metadata_problems, read_documents
from scripts.report import report

INDEX = "docs/README.md"
INTRODUCTION = """# Documentation

<!-- Built by `npm run document:index`. Do not edit it by hand. -->

When sources disagree, ADRs outrank code, and code outranks design documents.
"""


def _table(documents: Sequence[Document]) -> str:
    """Lay out documents as a table, aligned as the formatter would align it."""
    rows = [("Document", "Description")]
    rows += [(f"[{found.title}]({found.path})", found.description) for found in documents]
    widths = [max(len(cell) for cell in column) for column in zip(*rows, strict=True)]
    rows.insert(1, ("-" * widths[0], "-" * widths[1]))
    return "".join(f"| {name:<{widths[0]}} | {text:<{widths[1]}} |\n" for name, text in rows)


def _index(documents: dict[Kind, list[Document]]) -> str:
    """Return the whole text of the index."""
    sections = (
        f"\n## {kind.heading}\n\n{_table(found) if found else 'None yet.\n'}" for kind, found in documents.items()
    )
    return INTRODUCTION + "".join(sections)


def _write(path: Path, text: str, mode: str = "w") -> None:
    """Write a file with the line breaks that the formatter expects."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open(mode, encoding="utf-8", newline="\n") as file:
        file.write(text)


def _create(root: Path, kind: Kind, title: str, description: str, now: datetime) -> list[str]:
    """Create the next document of a kind, or list why it cannot be created."""
    fields = {"title": title, "description": description}
    if "date" in kind.fields:
        fields["date"] = now.date().isoformat()
    # Splitting letters from their accents lets the accents be dropped without splitting words.
    unaccented = "".join(each for each in unicodedata.normalize("NFKD", title) if not unicodedata.combining(each))
    slug = re.sub(r"[^a-z0-9]+", "-", unaccented.lower()).strip("-")
    problems = metadata_problems(kind, fields)
    if not slug:
        problems.append("the title needs a letter or digit to name the file")
    if problems:
        return problems
    directory = root / "docs" / kind.directory
    used = [int(match[1]) for path in directory.glob("*") if (match := NAME.fullmatch(path.name))]
    path = directory / f"{max(used, default=0) + 1:04}-{slug}.md"
    frontmatter = "".join(f"{name}: {json.dumps(value, ensure_ascii=False)}\n" for name, value in fields.items())
    body = "".join(f"\n## {section}\n" for section in kind.sections)
    if "Changelog" in kind.sections:
        body += f"\n- {now:%Y-%m-%d %H:%M} UTC - Created\n"
    # This mode never replaces a file.
    _write(path, f"---\n{frontmatter}---\n{body}", "x")
    print(f"Created {path.relative_to(root).as_posix()}")
    return []


def _arguments(arguments: Sequence[str]) -> argparse.Namespace:
    """Read the command line."""
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    new = commands.add_parser("new", help="create the next document and rebuild the index")
    new.add_argument("kind", choices=KINDS)
    new.add_argument("title")
    new.add_argument("description")
    commands.add_parser("index", help="rebuild the index")
    commands.add_parser("check", help="check the documents and the index")
    return parser.parse_args(arguments)


def main(arguments: Sequence[str], root: Path, now: datetime) -> int:
    """Run one command, and return the exit code."""
    options = _arguments(arguments)
    documents, problems = read_documents(root)
    if not problems and options.command == "new":
        problems = _create(root, KINDS[options.kind], options.title, options.description, now)
        documents, _ = read_documents(root)
    if problems:
        return report(problems)
    index, expected = root / INDEX, _index(documents)
    if options.command != "check":
        _write(index, expected)
    elif not index.is_file() or index.read_text(encoding="utf-8", errors="replace") != expected:
        problems = [f"{INDEX}: is out of date, so run `npm run document:index`"]
    return report(problems)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:], Path.cwd(), datetime.now(UTC)))
