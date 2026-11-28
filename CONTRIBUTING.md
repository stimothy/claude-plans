# Contributing

Thank you for helping with claude-plans. Everyone taking part follows the [code of conduct](CODE_OF_CONDUCT.md).

The project is still being set up. This guide describes how changes are made.

## Set up and check your copy

You need Node.js 24, at version 24.15 or newer, Python 3.12 or newer, and
[gitleaks](https://github.com/gitleaks/gitleaks) 8.19 or newer. Install the Node.js dependencies with
`npm ci`, then run `npm run setup:python`. That creates `.venv` and installs the Python tools. If setup does not
find your Python, set the `PYTHON` environment variable to its path. Run setup again when `requirements.txt` changes.
Setup keeps the Python that `.venv` already has, so delete `.venv` to change versions. The component and
end-to-end tests need a browser, which `npx playwright install chromium` downloads. Run it again after Playwright
is updated.

- `npm run check` runs the format check, both linters, the type checks, the tests, the component and end-to-end
  tests, a secret scan, and a dependency audit. Run it before you open a pull request. GitHub runs the same checks,
  with tests on Linux, Windows, and macOS, and component and end-to-end tests on Linux.
- `npm run dev` runs the server, with the web page in front of it, which shows your changes to the page as you save
  them. It prints the page's address. It keeps its data in `.claude-plans-development/` in your copy and takes free
  ports. Start it again after changing the server's code.
- `npm run storybook` shows the page's components one at a time, at `http://localhost:6006`. Its toolbar switches
  the theme and color vision, to check a component in all eight palettes.
- `npm run test:components` runs the stories and the page's other tests in Chromium, and requires at least 80%
  coverage of the page's code. The whole run is stopped after 2 minutes.
- `npm run test:end-to-end` installs your copy into a temporary data directory, runs the installed studio on a
  free port, and uses its page in Chromium. It lists each test's time, names the test files that took more than
  5 seconds, and stops after 5 minutes.
- `npm run build:page` builds the web page, which the server serves. `install` builds its own, so you need this
  only before starting your copy's server with `npm run claude-plans`.
- `npm run lock:python` updates `requirements.txt`, which locks every Python package with hashes. Run it after you
  change `requirements.in`, and do not edit `requirements.txt` by hand.
- `npm run format` rewrites files to match the formatters.
- `npm test` runs the tests and lists slow ones. Each suite has a time limit: 30 seconds for the Node.js unit tests
  and for the Python tests, and 2 minutes for the Node.js integration tests. `npm run test:unit` and
  `npm run test:integration` run one Node.js suite. Only `npm run test:node`, which runs both, checks their
  coverage.
- `npm run claude-plans -- <command>` runs the `claude-plans` command from your copy. `install`, `start`, `stop`,
  and `health` each need `--data-directory` with a full path. Use a directory made for development, and pick
  another port with `start --port`. Run `install` before the first `start`, and again when `start` says that the
  database is not ready. `npm run claude-plans -- help` lists the options.
- `npm run install:studio` is only for installing the studio for your own use. It writes to `.claude-plans/` in
  your main copy and puts the `claude-plans` command on your path, so never run it to try out a change.

## Start with an issue

Every change starts with a GitHub issue. Search the open issues first, and open one if none covers your change.
Wait for the maintainer to agree on it before doing a large amount of work. The maintainer sets an issue's labels,
milestone, and other planning fields.

You do not need Claude or any of its review tools to contribute.

## Open a pull request

All changes to `master` go through a pull request. The maintainer reviews and merges it, using a squash merge.
`npm ci` and `npm install` copy a Git hook that rejects pushes to `master` into your clone's hooks directory,
unless you have your own `pre-push` hook or a `core.hooksPath` setting. If you use Claude Code, use version 2.1.295
or newer, because older versions let a command run when the repository's check times out. Its settings stop Claude
from pushing to `master`, force pushing, and merging a pull request. In your main checkout, they also stop
`git clean` with `-x` or `-X`, and `git stash` with `-a` or `--all`, but not direct deletion such as `rm`. These
catch mistakes and are not a security barrier.

- Name your branch `<issue-number>-<kebab-summary>`, such as `42-add-health-check`.
- Write the title as a [Conventional Commit](https://www.conventionalcommits.org), such as
  `feat(backend): add health check`.
- Give the description four sections, each a `##` heading with text under it: Summary, Linked issue, Changes, and
  Testing. Under Linked issue, link the issue your branch is named for, with words such as `Closes #42`, or
  `Part of #42` if the issue stays open.
- Change at most 400 lines, counting additions and deletions. Lockfiles and generated files do not count.
  Split a larger change into several pull requests. Only the maintainer can approve an exception, by adding the
  `size:override` label.
- Update the documentation in the same pull request as the code it describes.

Every pull request also raises the version in the root `package.json`, and your branch must be up to date with
`master` before it is merged.

`npm run check:pull-request` checks your branch's name, and the size of its committed changes against your copy of
`origin/master`. GitHub also checks the title, the description, and the linked issue. To run all of these on an open
pull request, use `npm run check:pull-request -- <number>`, which needs the [GitHub CLI](https://cli.github.com).
Neither checks the version yet.

Dependabot's pull requests are exempt from the rules about issues, branch names, titles, descriptions, size, and
version increases, even after someone else adds commits to them. Tests, builds, and other quality checks still apply.

## Write the change

- Write tests first (test-driven development). Lay each one out as Arrange, Act, Assert.
- Name a TypeScript test file `*.integration.test.ts` if it uses a real database, runs a server, or starts another
  program, and `*.test.ts` otherwise. End-to-end tests are the `*.spec.ts` files in `end-to-end/`. Add one only
  for what no other test can show.
- Keep at least 80% coverage of lines, branches, functions, and statements in each package.
- Never suppress or skip a lint, type, test, or coverage requirement. Change the code so that it passes.
- Use clear names without abbreviations. Standard terms such as API and URL are fine, as are names that outside
  tools require, and `src` as a directory name.
- Keep files to 300 lines and directories to 10 files. Do not create catch-all directories such as `utils`,
  `helpers`, `common`, or `misc`. Lockfiles, generated files, `docs/adrs/`, and `docs/designs/` are exempt from
  these limits. The top-level directory and database migrations are exempt from the 10-file limit.
- `npm run lint` enforces these limits and names. It also rejects comments that turn a check off, tool ignore files
  such as `.prettierignore`, and tests that are skipped or run alone. It checks new files too, but not ignored ones.
  It catches common forms, so reviewers still watch for others, such as a rule turned off in a configuration file.
  If you commit a new generated file, add it to the list in `scripts/standards/layout.py`.
- `npm run lint` also rejects common abbreviations in names, and copied code: a block of at least 30 tokens and
  5 lines in JavaScript, TypeScript, or Python, tests included. Move shared code to one place instead. If the name
  check rejects a name that an outside tool requires, allow just that name, in `scripts/standards/names.py` for
  Python and file names or in `eslint.config.js` for JavaScript and TypeScript. The latter skips names written
  only in capitals, such as `MAXIMUM_LEN`, so reviewers watch for those.
- Add TSDoc comments to everything a TypeScript file exports.
- Each package lives in `packages/`, with its code in `src/`. `backend`, `cli`, and `frontend` may import
  `domain` but never one another. Only `backend` and `cli` may import `logging`. `domain` and `logging` import no
  other package. Import another package by its name, such as `@claude-plans/domain`, never by a path.
  `npm run lint` enforces this.
- When you add a package, add its type check to the `typecheck` script in `package.json`.
- Never commit secrets.

Tests and development must use their own data directory and port. They must never use the data of an installed copy
of the application.

## Write documentation

`docs/adrs/` holds architecture decision records, and `docs/designs/` holds design documents. `docs/README.md` is a
generated index of both.

- `npm run document:new -- adr "<title>" "<description>"` creates the next numbered record and rebuilds the index.
  Use `design` in place of `adr` for a design document.
- After you change a title or description, run `npm run document:index`. `npm run lint` rejects an outdated index,
  a bad file name, a number used twice, and bad frontmatter.
- Write each frontmatter value in double quotes. Titles and descriptions are plain text, without quotation marks,
  double spaces, links, or Markdown formatting, because the index shows them in a table. The check lists the rest
  of what it rejects.

## Report a security problem

Do not open a public issue for a vulnerability. Follow the [security policy](SECURITY.md) instead.

## License

By contributing, you agree that your contributions are licensed under the [MIT license](LICENSE).
