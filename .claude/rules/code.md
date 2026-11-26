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
- A test that uses data or runs a server creates its own temporary data directory and picks a free port, on
  every branch. It never uses `.claude-plans/` or the default port 4310.
- Development scripts never use the real data by default.
- Use full names without abbreviations. Standard terms such as API, CLI, URL, ID, and HTML are allowed, as are
  names that outside tools require.
- Keep files to 300 lines and directories to 10 files, and split by responsibility instead of creating
  catch-all directories such as `utils`, `helpers`, `common`, or `misc`. CONTRIBUTING.md lists the exemptions.
- `backend`, `cli`, and `frontend` may import `domain` but never one another. Only `backend` and `cli` may
  import `logging`. Neither `domain` nor `logging` imports `backend`, `cli`, or `frontend`.
- Update the documentation that describes the code in the same PR.
