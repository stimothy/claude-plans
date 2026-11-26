---
paths:
  - ".github/**"
---

# Continuous integration

- The `master` ruleset requires branches to be up to date and requires eight checks by job name: Static checks,
  Secret scan, and Tests and Dependency audit on each of three operating systems. Renaming a job or changing its
  operating systems changes those names, so the ruleset must change with it. Ask the maintainer before changing
  the ruleset, and before making a new check required.
- Checks run on pull requests only, because a branch must be up to date before it merges. Do not add triggers for
  pushes to `master`. The planned release job (issue #35) is the exception and runs on merges to `master`.
