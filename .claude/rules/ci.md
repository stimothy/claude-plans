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
- Checks run on pull requests only, because a branch must be up to date before it merges, so do not add triggers
  for pushes to `master` to them. Today only the Release workflow, `release.yml`, runs on pushes to `master`, and
  only its job has write access. It runs after the merge, so it is not a required check. Ask the maintainer before
  giving any other job write access, adding another push-to-`master` trigger, or widening any workflow's
  permissions or triggers.
- Do not add a concurrency group to `release.yml`, because GitHub would cancel a waiting run and lose its release.
- Never run `scripts/release/create.py` locally, and never create releases or release tags by hand; the maintainer
  does that if it is ever needed. A release is public and made in the maintainer's name. Never set
  `GITHUB_ACTIONS` to get past the script's check. Test it with `npm run test:python`, which runs
  `scripts/release/test_create.py`.
- Keep `scripts/release` and the modules it imports to Python's standard library. `release.yml` installs nothing
  and runs only after the merge, where no pull request check would catch a failed import.
