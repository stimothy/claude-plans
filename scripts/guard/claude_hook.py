"""Claude Code runs this before a shell command. Exit code 2 blocks the command and shows Claude the reason."""

import json
import sys
from pathlib import Path
from typing import TextIO

from scripts.guard.commands import blocked_reason
from scripts.guard.repository import run_git


def main(request: TextIO = sys.stdin) -> int:
    """Judge the command in a hook request and return the exit code."""
    details = json.load(request)
    command = details.get("tool_input", {}).get("command", "")
    reason = blocked_reason(command, Path(details["cwd"]), run_git)
    if reason:
        print(f"Blocked: {reason}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
