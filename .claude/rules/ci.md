---
paths:
  - ".github/**"
  - "scripts/release/**"
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
  pushes to `master`. The Release workflow, `release.yml`, is the only exception. It runs after the merge, so it
  is not a required check.
- The Release job is the only job with write access. Give no other workflow or job write access, and ask the
  maintainer before widening any workflow's permissions or triggers.
- Do not add a concurrency group to `release.yml`; its comment says why.
- Never run `scripts/release/create.py` locally on a commit that raises the version to 0.1.0 or later. Locally
  `gh` is signed in as the maintainer, so it would create a real tag and release. Test it through
  `scripts/release/test_create.py` instead.
