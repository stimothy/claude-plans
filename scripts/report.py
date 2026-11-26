"""Reports the problems that a check found."""

import sys
from collections.abc import Iterable


def report(problems: Iterable[str]) -> int:
    """Print each problem, and return the check's exit code."""
    status = 0
    for problem in problems:
        print(problem, file=sys.stderr)
        status = 1
    return status
