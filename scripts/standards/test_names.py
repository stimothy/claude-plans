"""Tests for rejecting abbreviated names."""

import pytest

from scripts.standards.names import name_problems


@pytest.mark.parametrize(
    "code",
    [
        "def parse_args():\n    pass\n",
        "async def send_msg():\n    pass\n",
        "class RepoReader:\n    pass\n",
        "class HTTPReq:\n    pass\n",
        "def read(*args):\n    pass\n",
        "def read(source, /, *, cfg=None):\n    pass\n",
        "read = lambda ctx: 1\n",
        "env = {}\n",
        "MAXIMUM_LEN = 3\n",
        "pathDir = 1\n",
        "error2, msg2 = 1, 2\n",
        "for i in range(3):\n    pass\n",
        "with open('a') as tmp:\n    pass\n",
        "[1 for num in range(3)]\n",
        "if (res := 1):\n    pass\n",
        "self.db = 1\n",
        "import subprocess as proc_lib\n",
        "from os import path as dir_path\n",
        "try:\n    pass\nexcept ValueError as err:\n    pass\n",
        "match value:\n    case [first, *prev]:\n        pass\n",
        "match value:\n    case {**opts}:\n        pass\n",
        "match value:\n    case 1 as val:\n        pass\n",
        "def first[Elem](values: list[Elem]) -> Elem:\n    pass\n",
        "def call[**Args]() -> None:\n    pass\n",
        "def pack[*Args]() -> None:\n    pass\n",
        "def visit_msg():\n    pass\n",
        "def __str_value():\n    pass\n",
    ],
)
def test_an_abbreviated_python_name_is_rejected(code: str) -> None:
    """Check that an abbreviated Python name is rejected."""
    problems = name_problems({"source/tool.py": code})

    assert len(problems) >= 1
    assert all(problem.startswith("source/tool.py:") for problem in problems)


@pytest.mark.parametrize(
    "code",
    [
        "from os import environ\nvalue = environ\n",
        "import pathlib.os as operating_system\n",
        "print(sys.argv, os.env)\n",
        "run(cmd=1)\n",
        "def test_reads(tmp_path, tmp_path_factory):\n    pass\n",
        "def read_url_by_id(api, cli, html):\n    pass\n",
        "application_configuration = 1\n",
        "determine = 1\n",
        "class Tool:\n    def __str__(self):\n        pass\n\n    def __len__(self):\n        pass\n",
        "wrapper.__doc__ = 'text'\n",
        "class Reader(ast.NodeVisitor):\n    def visit_ClassDef(self, node):\n        pass\n",
        '"""A docstring may say args."""  # And so may a comment: cfg.\nvalue = "tmp dir"\n',
    ],
)
def test_other_python_names_are_allowed(code: str) -> None:
    """Check that full names, and names the code only uses, are allowed."""
    problems = name_problems({"source/tool.py": code})

    assert problems == []


def test_a_problem_says_which_word_to_write_out() -> None:
    """Check that a problem gives the line, the name, and the full word."""
    problems = name_problems({"source/tool.pyi": "\nmax_retry_msg: str\n"})

    assert problems == ["source/tool.pyi:2: 'max_retry_msg' abbreviates 'message' as 'msg'"]


def test_python_that_cannot_be_read_is_left_to_the_other_checks() -> None:
    """Check that unreadable Python raises nothing."""
    problems = name_problems({"tool.py": "def (:\n", "null.py": "\0", "image.py": None})

    assert problems == []


def test_only_python_content_is_read() -> None:
    """Check that the content of other files is left alone."""
    problems = name_problems({"notes.md": "env = 1\n"})

    assert problems == []


@pytest.mark.parametrize(
    ("path", "named"),
    [
        ("source/cfg.json", "source/cfg.json"),
        ("source/readEnv.ts", "source/readEnv.ts"),
        ("source/msg-queue.test.ts", "source/msg-queue.test.ts"),
        ("source/server.env.ts", "source/server.env.ts"),
        (".github/db/schema.sql", ".github/db"),
        ("lib/index.ts", "lib"),
        ("scripts/.cfg", "scripts/.cfg"),
        ("tmp_files/notes.md", "tmp_files"),
    ],
)
def test_an_abbreviated_file_or_directory_name_is_rejected(path: str, named: str) -> None:
    """Check that an abbreviated file or directory name is rejected."""
    problems = name_problems({path: None})

    assert len(problems) == 1
    assert problems[0].startswith(f"{named}: ")


@pytest.mark.parametrize(
    "path",
    [
        "docs/guide.md",
        ".claude/rules/docs.md",
        "tmp/SPEC.md",
        "docs/adrs/0001-use-db.md",
        "docs/designs/env/layout.png",
        "package-lock.json",
        "tsconfig.base.json",
        "eslint.config.js",
        "source/archive.lib",
    ],
)
def test_other_file_names_are_allowed(path: str) -> None:
    """Check that full names, extensions, and agreed names are allowed."""
    problems = name_problems({path: None})

    assert problems == []


def test_a_directory_is_listed_once() -> None:
    """Check that a directory with several files is listed once."""
    problems = name_problems({"lib/first.ts": None, "lib/second.ts": None})

    assert len(problems) == 1
