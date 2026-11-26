"""Tests for finding suppression comments and skipped tests."""

import pytest

from scripts.standards.suppressions import suppression_problems


@pytest.mark.parametrize(
    "comment",
    [
        "# noqa",
        "# NOQA: E501",
        "# type: ignore[arg-type]",
        "# ruff: noqa",
        "# ruff: disable[E501]",
        "# fmt: off",
        "# fmt: skip",
        "# isort: skip",
        "# yapf: disable",
        "# pragma: no cover",
        "# pragma: no branch",
        "# pragma no cover",
        "# PRAGMA:NO COVER",
        "# isort: off",
        "# prettier-ignore",
        "# mypy: ignore-errors",
        "# pyright: basic",
        "# pylint: disable=invalid-name",
        "# nosec",
        "# gitleaks:allow",
        "# jscpd:ignore-start",
    ],
)
def test_a_python_suppression_comment_is_a_problem(comment: str) -> None:
    """Check that a Python suppression comment is a problem."""
    problems = suppression_problems("tool.py", f"value = 1\nother = 2  {comment}\n")

    assert len(problems) == 1
    assert problems[0].startswith("tool.py:2: ")


@pytest.mark.parametrize(
    "source",
    [
        "@pytest.mark.skip\ndef test_it() -> None: ...\n",
        "@pytest.mark.skipif(True, reason='x')\ndef test_it() -> None: ...\n",
        "@mark.xfail\ndef test_it() -> None: ...\n",
        "pytestmark = pytest.mark.skip\n",
        "pytest.skip('later')\n",
        "pytest.xfail('later')\n",
        "module = pytest.importorskip('module')\n",
        "from pytest import skip\n",
        "from unittest import skipIf\n",
        "@unittest.expectedFailure\ndef test_it() -> None: ...\n",
        "@unittest.skip('later')\ndef test_it() -> None: ...\n",
        "@unittest.skipUnless(False, 'x')\ndef test_it() -> None: ...\n",
        "raise unittest.SkipTest\n",
        "self.skipTest('later')\n",
    ],
)
def test_a_skipped_python_test_is_a_problem(source: str) -> None:
    """Check that a skipped Python test is a problem."""
    problems = suppression_problems("test_tool.py", source)

    assert len(problems) == 1
    assert "skips a test" in problems[0]


@pytest.mark.parametrize(
    "source",
    [
        "text = '# noqa and # type: ignore'\n",
        "# The type of each value is checked.\n",
        "queue.skip()\n",
        "from pytest import mark\n",
        "@pytest.mark.parametrize('a', [1])\ndef test_it(a: int) -> None: ...\n",
    ],
)
def test_other_python_text_is_allowed(source: str) -> None:
    """Check that other Python text is allowed."""
    problems = suppression_problems("tool.py", source)

    assert problems == []


def test_a_python_stub_is_read_as_python() -> None:
    """Check that a Python stub is read as Python."""
    problems = suppression_problems("tool.pyi", "value: int  # type: ignore\n")

    assert len(problems) == 1


@pytest.mark.parametrize("source", ["def broken(:\n", "text = '''\n", "  indented\n value\n"])
def test_python_that_cannot_be_read_is_a_problem(source: str) -> None:
    """Check that Python that cannot be read is a problem."""
    problems = suppression_problems("tool.py", source)

    assert problems == ["tool.py: cannot be read as Python"]


@pytest.mark.parametrize(
    ("path", "line"),
    [
        ("notes.md", "<!-- markdownlint-disable MD013 -->"),
        ("notes.md", "<!--markdownlint-configure-file {} -->"),
        ("notes.md", "<!-- prettier-ignore -->"),
        ("ci.yml", "  # prettier-ignore"),
        ("ci.yml", "  # yamllint disable-line"),
        ("ci.yml", "  uses: a/b@c # zizmor: ignore[rule]"),
        ("hooks/pre-push", "# shellcheck disable=SC2086"),
        ("page.css", "/* stylelint-disable */"),
        ("page.html", "<!-- prettier-ignore-start -->"),
        ("settings.toml", 'key = "value" # gitleaks:allow'),
        ("query.sql", "value -- gitleaks:allow"),
        ("settings.jsonc", "  // prettier-ignore"),
        ("page.css", "/* jscpd:ignore-start */"),
        ("notes.md", "<!-- markdownlint-enable -->"),
        ("notes.md", "<!-- markdownlint-capture -->"),
        ("notes.md", "<!-- markdownlint-restore -->"),
    ],
)
def test_a_suppression_comment_in_another_file_is_a_problem(path: str, line: str) -> None:
    """Check that a suppression comment in another file is a problem."""
    problems = suppression_problems(path, f"first\n{line}\n")

    assert len(problems) == 1
    assert problems[0].startswith(f"{path}:2: ")


def test_prose_about_suppressions_is_allowed() -> None:
    """Check that prose about suppressions is allowed."""
    problems = suppression_problems("notes.md", "Never add `prettier-ignore` or `# noqa` to a file.\n")

    assert problems == []


@pytest.mark.parametrize(
    "path", [".eslintignore", ".gitleaksignore", "a/.jscpdignore", ".markdownlintignore", ".prettierignore"]
)
def test_a_tool_ignore_file_is_a_problem(path: str) -> None:
    """Check that a tool ignore file is a problem."""
    problems = suppression_problems(path, "")

    assert len(problems) == 1


@pytest.mark.parametrize("path", ["tool.ts", "tool.test.tsx", "tool.mjs"])
def test_javascript_and_typescript_are_left_to_eslint(path: str) -> None:
    """Check that JavaScript and TypeScript are left to ESLint."""
    problems = suppression_problems(path, "// prettier-ignore\n")

    assert problems == []
