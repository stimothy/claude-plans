# claude-plans

claude-plans is a planning studio for plans made with Claude. It runs on the user's own computer as a backend,
a `claude-plans` command, and a web page. The repository is public and MIT licensed.

## Current state

The bootstrap is in progress, and the application is mostly not built. The sources below describe planned
commands and behaviour, not working ones. Check that a package, script, or command exists before you run it
or describe it as working.

## Commands

CONTRIBUTING.md covers setup and every npm script. Run `npm run check` before creating a pull request (PR)
and before pushing to one. It runs the checks that continuous integration (CI) runs, which also tests on
Windows and macOS. Run Python tools through their npm scripts, which use `.venv` through
`scripts/launcher/launch.ts`, instead of calling `python` directly.

## Sources

Until issue #38 removes them, the design lives in these temporary files, even after `docs/` (issue #15) starts to
appear:

- [tmp/SPEC.md](tmp/SPEC.md): scope, issues, PRs, releases, and standards.
- [tmp/ARCHITECT.md](tmp/ARCHITECT.md): packages, server, local data, install, database, logging, and CI.
- [tmp/PRODUCT.md](tmp/PRODUCT.md): the web page and the `claude-plans` commands.
- [tmp/memlog.md](tmp/memlog.md): the decision log. A struck-through entry number was replaced or answered.

If `docs/` and `tmp/` cover the same subject, use whichever the decision log shows as newest, and ask if that is
unclear. [CONTRIBUTING.md](CONTRIBUTING.md) describes how anyone makes a change.

## Decision log

While `tmp/memlog.md` exists, record there each decision, assumption, and open question that changes the `tmp/`
specifications or fills a gap in them, but not every implementation choice. Add each as a new table row, marked
`[D]`, `[A]`, or `[O]`. Take the time from `date -u` and the next number from the one six-digit
sequence that all entries share. Cite the entry that a new row resolves or replaces. Never edit an earlier
row, except to strike through the number of an entry that is replaced or answered.

## Rules

The rules in `.claude/rules/` load on their own. These two load in every session:

- [real-data.md](.claude/rules/real-data.md): when to use the real data, and how to keep development off it.
- [workflow.md](.claude/rules/workflow.md): issues, PRs, versions, reviews, and quality.

These load when you work with matching files:

- [code.md](.claude/rules/code.md): TypeScript and Python code and tests.
- [ci.md](.claude/rules/ci.md): files under `.github/`.
- [docs.md](.claude/rules/docs.md): files under `docs/`.

Before creating the first file that a path-scoped rule covers, or a script that writes such files, read that
rule, because it may not have loaded yet.
