# Contributing

Thank you for helping with claude-plans. Everyone taking part follows the [code of conduct](CODE_OF_CONDUCT.md).

The project is still being set up. This guide describes how changes are made.

## Set up and check your copy

You need Node.js 24, at version 24.15 or newer, and Python 3.12 or newer. Install the Node.js dependencies with
`npm ci`, then run `npm run setup:python`. That creates `.venv` and installs the Python tools. If setup does not
find your Python, set the `PYTHON` environment variable to its path. Run setup again when `requirements.txt` changes.

- `npm run check` runs the format check, both linters, the type checks, and the tests. Run it before you open a
  pull request.
- `npm run format` rewrites files to match the formatters.
- `npm test` runs the tests. It lists slow tests and fails a suite that runs for more than 30 seconds.

## Start with an issue

Every change starts with a GitHub issue. Search the open issues first, and open one if none covers your change.
Wait for the maintainer to agree on it before doing a large amount of work. The maintainer sets an issue's labels,
milestone, and other planning fields.

You do not need Claude or any of its review tools to contribute.

## Open a pull request

All changes to `master` go through a pull request. The maintainer reviews and merges it, using a squash merge.

- Name your branch `<issue-number>-<kebab-summary>`, such as `42-add-health-check`.
- Write the title as a [Conventional Commit](https://www.conventionalcommits.org), such as
  `feat(backend): add health check`.
- Give the description four sections: Summary, Linked issue, Changes, and Testing.
- Change at most 400 lines, counting additions and deletions. Lockfiles and generated files do not count.
  Split a larger change into several pull requests. Only the maintainer can approve an exception.
- Update the documentation in the same pull request as the code it describes.

Every pull request also raises the version in the root `package.json`, and your branch must be up to date with
`master` before it is merged.

Dependabot's pull requests are exempt from the rules about issues, branch names, titles, descriptions, size, and
version increases, until someone else adds a commit to them. Tests, builds, and other quality checks still apply.

## Write the change

- Write tests first (test-driven development). Lay each one out as Arrange, Act, Assert.
- Keep at least 80% coverage of lines, branches, functions, and statements in each package.
- Never suppress or skip a lint, type, test, or coverage requirement. Change the code so that it passes.
- Use clear names without abbreviations. Standard terms such as API and URL are fine, as are names that outside
  tools require.
- Keep files to 300 lines and directories to 10 files. Do not create catch-all directories such as `utils`,
  `helpers`, `common`, or `misc`. Lockfiles, generated files, `docs/adrs/`, and `docs/designs/` are exempt from
  these limits. The top-level directory and database migrations are exempt from the 10-file limit.
- Add TSDoc comments to everything a TypeScript file exports.
- Never commit secrets.

Tests and development must use their own data directory and port. They must never use the data of an installed copy
of the application.

## Report a security problem

Do not open a public issue for a vulnerability. Follow the [security policy](SECURITY.md) instead.

## License

By contributing, you agree that your contributions are licensed under the [MIT license](LICENSE).
