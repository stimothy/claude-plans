"""Finds comments that turn checks off, and tests that are skipped.

ESLint checks JavaScript and TypeScript files.
"""

import ast
import io
import re
import tokenize
from pathlib import PurePosixPath

ESLINT_SUFFIXES = (".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts")
IGNORE_FILES = (".eslintignore", ".gitleaksignore", ".jscpdignore", ".markdownlintignore", ".prettierignore")
PYTHON_COMMENT = re.compile(
    r"\b(noqa|nosec|type:\s*ignore|ruff:|mypy:|pyright:|pylint:\s*disable|fmt:\s*(off|skip)|yapf:\s*disable"
    r"|isort:\s*(off|skip)|pragma[:\s]?\s*no\s*(cover|branch)|gitleaks:allow|jscpd:ignore|prettier-ignore)",
    re.IGNORECASE,
)
# A comment marker comes first, so that prose can name these. Gitleaks accepts its comment anywhere on a line.
OTHER_COMMENT = re.compile(
    r"(#|//|/\*|<!--)\s*(markdownlint-(disable|enable|configure|capture|restore)|prettier-ignore|yamllint disable"
    r"|shellcheck disable|zizmor:\s*ignore|stylelint-disable|jscpd:ignore)|gitleaks:allow"
)
SKIP = re.compile(
    r"(pytest\.(mark\.)?|mark\.)(skip|skipif|xfail)|pytest\.importorskip"
    r"|unittest\.(skip|skipIf|skipUnless|expectedFailure|SkipTest)|.+\.skipTest"
)


def _dotted_name(node: ast.expr) -> str:
    """Return a name such as "pytest.mark.skip", or nothing for another expression."""
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute) and (owner := _dotted_name(node.value)):
        return f"{owner}.{node.attr}"
    return ""


def _skipped_names(node: ast.AST) -> list[str]:
    """Return the names that a node uses to skip a test."""
    if isinstance(node, ast.ImportFrom):
        names = [f"{node.module}.{alias.name}" for alias in node.names]
    else:
        names = [_dotted_name(node)] if isinstance(node, ast.Attribute) else []
    return [name for name in names if SKIP.fullmatch(name)]


def _python_problems(path: str, content: str) -> list[str]:
    """List the suppression comments and skipped tests in Python source."""
    try:
        tree = ast.parse(content)
        tokens = list(tokenize.generate_tokens(io.StringIO(content).readline))
    except (SyntaxError, ValueError, tokenize.TokenError):
        return [f"{path}: cannot be read as Python"]
    comments = [
        f"{path}:{token.start[0]}: has a comment that turns a check off"
        for token in tokens
        if token.type == tokenize.COMMENT and PYTHON_COMMENT.search(token.string)
    ]
    skips = [
        f"{path}:{getattr(node, 'lineno', 1)}: '{name}' skips a test"
        for node in ast.walk(tree)
        for name in _skipped_names(node)
    ]
    return comments + skips


def suppression_problems(path: str, content: str) -> list[str]:
    """List the ways that one file turns checks off."""
    if PurePosixPath(path).name in IGNORE_FILES:
        return [f"{path}: hides files from a check"]
    if path.endswith(ESLINT_SUFFIXES):
        return []
    if path.endswith((".py", ".pyi")):
        return _python_problems(path, content)
    return [
        f"{path}:{number}: has a comment that turns a check off"
        for number, line in enumerate(content.split("\n"), start=1)
        if OTHER_COMMENT.search(line)
    ]
