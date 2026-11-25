# Bootstrap specification

This temporary file says what the bootstrap must deliver and how work happens in this repository.
[PRODUCT.md](PRODUCT.md) covers the user experience, [ARCHITECT.md](ARCHITECT.md) covers architecture,
and [memlog.md](memlog.md) records decisions, assumptions, and open questions.

## Purpose and scope

The planning studio will hold plans made with Claude and help specify future changes.
Plan structure, plan storage, and comment workflows are future work.

The bootstrap delivers only this:

- A backend health check, which the command-line interface (CLI) can also show.
- A hello world web page with theme and color vision settings.
- A database with no tables except the one that tracks migrations.
- Logging to rotating files, so problems are easier to debug.
- The repository rules, tooling, documentation, scripts, and checks described below.

The repository is public and may accept outside contributions, so it is written as an open source project.
It uses the MIT license and includes a contributing guide, a security policy, and a code of conduct.

## Issues and milestones

- Every change starts with a GitHub issue. Milestones are epics, and issues are stories.
- Claude creates the labels and milestones.
- Every issue and sub-issue has a type, an area label, a milestone, Priority, and Effort.
- Types are Task, Bug, Feature, Documentation, and Spike.
- Area labels are `area:` plus `backend`, `frontend`, `cli`, `shared`, `docs`, `tooling`, `ci`, or `claude`.
- Other labels are `accessibility`, `good first issue`, `help wanted`, and `size:override`.
- Priority and Effort are GitHub issue fields. Priority is Urgent, High, Medium, or Low.
- Low Effort is a small pull request (PR). Medium is larger but reviewable. High must be split into sub-issues.
- A change that needs several PRs gets one sub-issue per PR. A small change stays on its main issue.
- After the last sub-issue's PR merges, Claude closes the parent issue.
- Outside contributors also start with an issue. They do not need the Claude review tools.

## Pull requests

- All changes to `master` go through a PR. Nobody pushes or force pushes to `master`.
- The maintainer merges PRs. The repository allows only squash merges and deletes merged branches.
- Branches are named `<issue-number>-<kebab-summary>`.
- Titles follow Conventional Commits, such as `feat(backend): add health check`.
- Descriptions have Summary, Linked issue, Changes, and Testing sections.
- A PR may change at most 400 lines, excluding lockfiles and generated files.
  Only the maintainer can approve an exception, using `size:override`.
- `/code-review-swarm` runs before a PR is created and before each later push.
- Claude instruction files are reviewed by `claude-whisperer` instead. A PR with both kinds of change gets both.
- Claude instruction files include `CLAUDE.md` and files under `.claude/` such as agents, rules, and skills.
  The `claude-wordsmith` agent writes them.
- Each agent run uses a new subagent, because the five-minute prompt cache makes reuse costly.

## Dependabot

Dependabot's PRs are exempt from this file's rules for how a change is proposed and described, because the repository
cannot control all of what it creates. This covers issues, branch names, titles, descriptions, size, and version
increases. Tests, builds, and the other quality checks must still pass, to show that the new versions work.
The maintainer still merges these PRs.

## Releases

- The root `package.json` holds one semantic version, and every package matches it.
- Every PR raises the version, except Dependabot's. When a PR must raise it, CI fails if the version
  is not higher than the one on `master`.
- Branches must be up to date with `master` before merging.
- Each merge that raises the version creates a release tagged like `v1.2.3`, with notes from PR titles.
- The first release is `v0.1.0`. Versions stay below `1.0.0` until the maintainer calls the project stable.

## Code standards

- Follow DRY (do not repeat yourself) and the SOLID design principles.
- Use clear names without abbreviations. Standard terms such as API, CLI, URL, ID, and HTML are allowed,
  as are names that outside tools require.
- Add TSDoc comments to every exported function, variable, and other declaration.
- Split directories logically as they grow. Grab-bag names such as `utils`, `helpers`, `common`, and `misc`
  are banned. A directory holds at most 10 files, and a file holds at most 300 lines.
- The directory rules do not apply to `docs/adrs/`, `docs/designs/`, or their `assets/` directories.
- Database migrations may stay in one flat directory, exempt from the 10-file limit.
- Never suppress or skip a lint, type, test, or coverage requirement. Change the code so it passes.
- Never commit secrets.

## Real data

The maintainer's local copy of `master` holds their real data. Development work must never lose or alter it.
This includes work in worktrees and on branches created directly in that copy.
Claude must respect the real database at all times.

Claude may use the real data to work with the maintainer's plans. Testing development changes, such as code on
a branch other than `master`, must not. For that, Claude installs and starts the studio with its own data directory,
such as its job's temporary directory, and its own port. The Claude rules give instructions for both cases.

## Testing

- Use test-driven development (TDD). Write tests that earn their cost, in Arrange, Act, Assert form.
- Unit tests mock everything outside the unit and run very fast. Integration tests use a real database.
- Include component and end-to-end (E2E) tests. Keep many unit tests, fewer integration tests,
  and the fewest E2E tests.
- Consider CPU time, memory, and CI minutes. Efficiency must not reduce quality.
- Each package needs 80% coverage of lines, branches, functions, and statements, combined across all tests
  except E2E. Only generated files, stories, configuration, and type-only files are excluded.
- Tests that use data or run a server use their own temporary data directory and port, on every branch.
  They never use the real data.
- Each test suite has a time limit.

## Documentation

`docs/` holds `adrs/` for architecture decision records (ADRs) and `designs/` for design documents.
Each may have an `assets/` directory for images and screenshots.

- Files are named `####-<kebab>.md`, numbered in sequence without duplicates in each directory.
- Every document has frontmatter without a status field. It is current as soon as it is written.
- ADR fields are `title`, `description`, and `date`. Design document fields are `title` and `description`.
- Diagrams use raw Mermaid.
- Write well organized prose for people, without run-on sentences or paragraphs.
  Revise the surrounding sentences when updating; do not tack on new ones.
- Documentation changes ship with the code they describe.
- When sources disagree, ADRs outrank code, and code outranks design documents.

**ADRs** record one decision each, only when it would be hard or costly to reverse.
They are living documents and are never superseded, so searches do not surface outdated decisions.
Each ends with a changelog, newest last, using entries like `2026-11-25 05:37 UTC - Summary`.

**Design documents** explain how the system works and why, rather than repeating ADRs.
They change with the code and have no changelog. Split them by subject or subtopic as they grow:
one part keeps the number, and the others get new numbers. The first is `0001-architecture.md`.

`docs/README.md` indexes both directories by name and description.
A script builds it from document metadata, and CI fails if it is out of date.

## Orientation files

- `README.md` is for people. It explains local setup, repository workflow, and system use,
  and links to the rules and documents.
- `CLAUDE.md` tells Claude how to work here and to find orientation in `docs/`. It links instead of restating.
  It uses `@` imports only for content needed in every session.
- `.claude/rules/` holds the rules Claude must follow, scoped by path so they load where relevant.

## Scripts and checks

- Script every repeatable process so Claude can run it instead of reasoning through it.
  This includes creating documents and updating the documentation index.
- Scripts live in `scripts/`, use Python 3.12 or newer in a virtual environment, and follow the directory rules.
  One npm command creates `.venv` on every operating system.
- Scripts meet the same standards as other code, including tests, 80% coverage, type checks, and linting.
- Checks run both locally and in CI. They cover PR issue links, names and descriptions, size, version,
  code quality, repository structure, documentation, secrets, and dependency audits.
- Git hooks and Claude settings block pushes to `master`. Claude settings also block force pushes and
  `gh pr merge`.

## Ignored files

Git ignores `.claude-plans/`, `.serena/`, `.idea/`, `.claude/settings.local.json`, `.claude/worktrees/`,
and common IDE, operating system, dependency, build, cache, environment, and log files.
The shared `.claude/settings.json` is committed.

## Done when

- The health check works through the backend API and the CLI, and the web page meets [PRODUCT.md](PRODUCT.md).
- The architecture and standards in these files are in place, and every automated check passes locally and in CI.
- `README.md`, `CLAUDE.md`, the rules, the documentation, and the `v0.1.0` release exist.
- The last bootstrap PR removes `tmp/` after moving anything worth keeping into the docs, rules, or README.
