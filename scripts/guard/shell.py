"""Splits shell command text into the commands that it runs."""

import re
import shlex

SEPARATORS = ";&|()`\n"
REDIRECTS = "<>"

# The parts of shell text that decide what is code. Any other character stands alone.
PARTS = re.compile(
    r"""(?P<continuation>\\\n)
    |(?P<escape>\\.)
    |(?P<quoted>'[^']*'|"(?:\\[\s\S]|[^"\\])*")
    |(?P<comment>(?<![^\s;&|()`])\#[^\n]*)
    |(?P<heredoc>(?<!<)<<(?!<)-?[ \t]*(?P<mark>['"]?)(?P<delimiter>[A-Za-z_][\w.-]*)(?P=mark))
    |(?P<other>[\s\S])""",
    re.VERBOSE,
)


def _after_body(command: str, start: int, delimiter: str) -> int:
    """Return where a heredoc body ends, or where it starts if it never ends."""
    end = re.compile(rf"^\t*{re.escape(delimiter)}$\n?", re.MULTILINE).search(command, start)
    return end.end() if end else start


def _code_only(command: str) -> str:
    """Remove comments, line continuations, and the heredoc bodies that no shell reads."""
    kept: list[str] = []
    delimiters: list[str] = []
    line = ""
    position = 0
    while part := PARTS.match(command, position):
        position = part.end()
        if part["heredoc"]:
            delimiters.append(part["delimiter"])
        elif not (part["comment"] or part["continuation"]):
            kept.append(part[0])
            line += part[0]
        if part[0] == "\n":
            if not re.search(r"\b(bash|sh|zsh)\b", line):
                for delimiter in delimiters:
                    position = _after_body(command, position, delimiter)
            delimiters, line = [], ""
    return "".join(kept)


def split(command: str) -> list[list[str]]:
    """Split text into the words of each command, without redirections.

    Raises:
        ValueError: A quotation does not end.
    """
    lexer = shlex.shlex(_code_only(command), posix=True, punctuation_chars=SEPARATORS + REDIRECTS)
    lexer.whitespace = " \t\r"
    lexer.whitespace_split = True
    lexer.commenters = ""
    segments: list[list[str]] = [[]]
    skip_target = False
    for token in lexer:
        punctuation = bool(token) and all(character in SEPARATORS + REDIRECTS for character in token)
        if punctuation and any(character in REDIRECTS for character in token) and "(" not in token:
            # A number just before a redirection names a file descriptor.
            if segments[-1] and segments[-1][-1].isdigit():
                segments[-1].pop()
            skip_target = True
        elif punctuation:
            segments.append([])
            skip_target = False
        elif skip_target:
            skip_target = False
        else:
            segments[-1].append(token)
    return segments
