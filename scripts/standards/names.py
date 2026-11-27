"""Finds abbreviated names in file names, directory names, and Python code.

ESLint checks the names in JavaScript and TypeScript code.
"""

import ast
from collections.abc import Mapping
from pathlib import PurePosixPath

from scripts.standards.layout import DOCUMENT_DIRECTORIES, WORD_BOUNDARY

# The words that the ESLint rule rejects, each with a full word to write instead. That rule also shortens
# "application" and "configuration", which eslint.config.js turns off.
WORDS = """
    acc=accumulator arg=argument args=arguments arr=array attr=attribute attrs=attributes btn=button buf=buffer
    cb=callback cfg=configuration cmd=command conf=configuration ctx=context cur=current curr=current db=database
    decl=declaration decls=declarations def=definition dep=dependency deps=dependencies dest=destination
    dev=development dir=directory dirs=directories dist=distribution doc=document docs=documents dst=destination
    e=error el=element elem=element elems=elements env=environment envs=environments err=error ev=event evt=event
    expr=expression exprs=expressions ext=extension exts=extensions fn=function func=function i=index
    ident=identifier idents=identifiers idx=index j=index len=length lib=library mod=module msg=message num=number
    obj=object opts=options param=parameter params=parameters perf=performance pkg=package prev=previous
    prod=production prop=property props=properties proto=prototype ref=reference refs=references rel=relative
    repo=repository req=request res=result ret=return retval=return sep=separator src=source stmt=statement
    stmts=statements str=string tbl=table temp=temporary tit=title tmp=temporary util=utility utils=utilities
    val=value var=variable vars=variables ver=version
"""
ABBREVIATIONS = dict(pair.split("=") for pair in WORDS.split())
# Outside tools choose these. "tmp" holds the planning files until issue #38 removes it.
PATH_NAMES = {"docs", "tmp"}
# The maintainer chose this name for the folder that holds a package's code. A file may not have it.
DIRECTORY_NAMES = {"src"}
PYTHON_NAMES = {"tmp_path", "tmp_path_factory"}


def _abbreviation(name: str) -> str | None:
    """Return the first abbreviated word in a name, if it has one."""
    words = (word.rstrip("0123456789").lower() for word in WORD_BOUNDARY.split(name))
    return next((word for word in words if word in ABBREVIATIONS), None)


def _problem(place: str, name: str, word: str) -> str:
    """Describe one abbreviated name."""
    return f"{place}: '{name}' abbreviates '{ABBREVIATIONS[word]}' as '{word}'"


def _path_problems(files: Mapping[str, str | None]) -> list[str]:
    """List the abbreviated file and directory names, each once."""
    problems: dict[PurePosixPath, str] = {}
    for name in files:
        path = PurePosixPath(name)
        if any(path.is_relative_to(directory) for directory in DOCUMENT_DIRECTORIES):
            continue
        for part in (path, *path.parents):
            # An extension names a file type, which other tools choose.
            text = part.stem if part == path else part.name
            allowed = PATH_NAMES if part == path else PATH_NAMES | DIRECTORY_NAMES
            word = None if text in allowed else _abbreviation(text)
            if word:
                problems[part] = _problem(str(part), part.name, word)
    return list(problems.values())


def _defined_name(node: ast.AST) -> str | None:
    """Return the name that a node gives to something, if it gives one."""
    match node:
        case (
            ast.Name(ctx=ast.Store(), id=name)
            | ast.Attribute(ctx=ast.Store(), attr=name)
            | ast.arg(arg=name)
            | ast.alias(asname=name)
            | ast.MatchMapping(rest=name)
        ):
            return name
        case (
            ast.FunctionDef()
            | ast.AsyncFunctionDef()
            | ast.ClassDef()
            | ast.ExceptHandler()
            | ast.MatchAs()
            | ast.MatchStar()
            | ast.TypeVar()
            | ast.ParamSpec()
            | ast.TypeVarTuple()
        ):
            return node.name
    return None


def _is_required(name: str) -> bool:
    """Tell whether Python or a tool chose a name."""
    is_special = name.startswith("__") and name.endswith("__")
    is_visitor = name.startswith("visit_") and hasattr(ast, name.removeprefix("visit_"))
    return name in PYTHON_NAMES or is_special or is_visitor


def _python_problems(path: str, content: str) -> list[str]:
    """List the abbreviated names that Python source defines."""
    try:
        tree = ast.parse(content)
    except (SyntaxError, ValueError):
        # The suppression check reports source that cannot be read.
        return []
    problems: list[str] = []
    for node in ast.walk(tree):
        name = _defined_name(node)
        if name and not _is_required(name) and (word := _abbreviation(name)):
            problems.append(_problem(f"{path}:{getattr(node, 'lineno', 1)}", name, word))
    return problems


def name_problems(files: Mapping[str, str | None]) -> list[str]:
    """List the abbreviated names, given each path's text, or nothing for a binary file."""
    problems = _path_problems(files)
    for path, content in files.items():
        if content is not None and path.endswith((".py", ".pyi")):
            problems.extend(_python_problems(path, content))
    return problems
