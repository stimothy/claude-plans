---
paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.py"
---

# Code and tests

- Write each test before the code it covers, laid out as Arrange, Act, Assert. No check can prove the order.
- Write only tests that earn their cost. Unit tests mock everything outside the unit and run very fast, and
  integration tests use a real database. Keep many unit tests, fewer integration tests, and the fewest end-to-end
  tests.
- Outside `end-to-end/`, name a TypeScript test file `*.integration.test.ts` if it uses a real database, runs a
  server, or starts another program, and `*.test.ts` otherwise. The name decides its Node.js suite and so its time
  limits: each unit test gets Vitest's default 5 seconds and each integration test 30 seconds, and a whole run of
  the unit suite is stopped after 30 seconds and of the integration suite after 2 minutes. Running one suite alone
  does not check coverage; `npm run test:node` runs both and then checks it.
- End-to-end tests are `*.spec.ts` files in the top-level `end-to-end/` directory, run by Playwright with
  `npm run test:end-to-end`, outside the Node.js suites and coverage. Add one only for what no unit, integration,
  or component test can show. Import `test` from `end-to-end/installed-studio.ts`, not from `@playwright/test`;
  it installs this copy of the application into a temporary data directory and runs the installed command. All
  tests in a run share that studio and its saved settings, in order, so a test must neither depend on nor leave
  behind settings that break another. Each test has Playwright's per-test timeout, and the install and each
  studio command a limit in `installed-studio.ts` shorter than the `studio` fixture's, because Playwright skips
  cleanup when setup uses all of the fixture's time. `globalTimeout` in `end-to-end/playwright.config.ts`
  limits the whole run. Do not move it to the launcher's `--time-limit`, which kills only the command it started
  and would leave the server and browser running.
- A test that uses data or runs a server creates its own temporary data directory and picks a free port, on
  every branch. It never uses `.claude-plans/` or the default port 4310.
- Development scripts never use the real data by default.
- Use full names without abbreviations. Standard terms such as API, CLI, URL, ID, and HTML are allowed, as are
  names that outside tools require. Keep `src` as the name of each package's code directory, which the
  maintainer chose; the name check allows it only as a directory name, not as a file name or a name in code.
- Keep files to 300 lines and directories to 10 files, and split by responsibility instead of creating
  catch-all directories such as `utils`, `helpers`, `common`, or `misc`. CONTRIBUTING.md lists the exemptions.
- `backend`, `cli`, and `frontend` may import `domain` but never one another. Only `backend` and `cli` may
  import `logging`. Neither `domain` nor `logging` imports `backend`, `cli`, or `frontend`.
- Update the documentation that describes the code in the same PR.
