"""Splits shell command text into the commands that it runs."""

import re
import shlex

SEPARATORS = ";&|()`\n"
REDIRECTS = "<>"
# The start of a command that Bash runs inside text, but not of arithmetic.
SUBSTITUTION = re.compile(r"(?<!\\)(?:`(?P<backtick>[^`]*)`|\$\((?!\())")

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


def _substitutions(body: str) -> list[str]:
    """Return the commands that Bash runs while it reads the body of an unquoted heredoc."""
    commands = []
    for match in SUBSTITUTION.finditer(body):
        if match["backtick"] is not None:
            commands.append(match["backtick"])
            continue
        depth, end = 1, match.end()
        while depth and end < len(body):
            depth += {"(": 1, ")": -1}.get(body[end], 0)
            end += 1
        commands.append(body[match.end() : end if depth else end - 1])
    return commands


def _code_only(command: str) -> str:
    """Remove comments, line continuations, and the heredoc text that Bash does not run."""
    kept: list[str] = []
    heredocs: list[tuple[str, bool]] = []
    line = ""
    position = 0
    while part := PARTS.match(command, position):
        position = part.end()
        if part["heredoc"]:
            heredocs.append((part["delimiter"], bool(part["mark"])))
        elif not (part["comment"] or part["continuation"]):
            kept.append(part[0])
            line += part[0]
        if part[0] == "\n":
            if not re.search(r"\b(bash|sh|zsh)\b", line):
                for delimiter, quoted in heredocs:
                    start, position = position, _after_body(command, position, delimiter)
                    if not quoted:
                        kept.extend(f"{found}\n" for found in _substitutions(command[start:position]))
            heredocs, line = [], ""
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
