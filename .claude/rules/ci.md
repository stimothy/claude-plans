---
paths:
  - ".github/**"
---

# Continuous integration

- The `master` ruleset requires branches to be up to date and requires eleven checks by these exact names:
  `Static checks`, `Secret scan`, `Component tests`, `End-to-end tests`, `Pull request rules` (from
  `pull-request.yml`), and
  `Tests (<os>)` and `Dependency audit (<os>)` for each of `ubuntu-latest`, `windows-latest`, and `macos-latest`.
  Renaming a job or changing its operating systems changes those names, so the ruleset must change with it.
  A newly added job is not required until the ruleset lists it. Ask the maintainer before changing the ruleset, and
  before making a new check required.
- Checks run on pull requests only, because a branch must be up to date before it merges. Do not add triggers for
  pushes to `master`. The planned release job (issue #35) is the exception and runs on merges to `master`.
