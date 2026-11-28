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
  `npm run test:end-to-end`, outside the Node.js suites and coverage. They install this copy of the application
  into a temporary data directory and run the installed command. Their time limit is `globalTimeout` in
  `end-to-end/playwright.config.ts`. Do not move it to the launcher's `--time-limit`, which kills only the command
  it started and would leave the server and browser running.
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
