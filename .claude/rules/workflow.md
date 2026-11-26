# Workflow

These are the maintainer's working agreements with Claude. CONTRIBUTING.md has the parts that apply to everyone.

When working for an outside contributor, follow CONTRIBUTING.md and skip the maintainer-only steps, such as
setting issue fields and milestones and running the maintainer's review tools. The ban on pushing to `master`,
merging, and force pushing, and the Quality section, still apply.

## Issues

- Start every change with a GitHub issue. Give it a type (Task, Bug, Feature, Documentation, or Spike), one
  `area:` label, a milestone (Bootstrap during the bootstrap), and the Priority and Effort issue fields.
- Split High Effort work into sub-issues with the same fields, one pull request (PR) per sub-issue.
- Close a parent issue after the PR for its last sub-issue merges, when told of the merge or on noticing it later.

## Pull requests

- Follow "Open a pull request" in CONTRIBUTING.md for the branch name, Conventional Commit title, four
  description sections, and the limit of 400 changed lines. Add `size:override` only when the maintainer
  approves it.
- Give the PR the issue's area label and milestone.
- Every PR except Dependabot's raises the version in the root `package.json`, with the matching versions in
  `package-lock.json`. Stay below 0.1.0 until issue #38 releases v0.1.0. The version must be higher than the one
  on `master` when the PR merges. Until issue #34 adds a check for this, compare by hand, and raise the version
  again if `master` has caught up.
- The maintainer merges, with a squash merge. Never merge a PR, never force push, and never push to `master`.
- Bring a branch up to date by merging `master` into it. A rebase needs a force push, so rebase only when the
  maintainer asks, and leave the force push to them.

## Reviews

- Run the `/code-review-swarm` skill before creating a PR and before every later push, except a push of only
  fixes for earlier findings.
- Claude instruction files, meaning `CLAUDE.md` and files under `.claude/`, are written by the
  `claude-wordsmith` agent and reviewed by the `claude-whisperer` agent, which takes the swarm's place under the
  same rules. A change with both kinds of file gets both reviews.
- Start a new subagent for every agent run instead of resuming one, so the prompt cache is not rewritten.
- After acting on findings, tell the maintainer one line per finding: fixed, or dismissed with the reason.
  Then ask whether to review the fixes again, and push them only after the answer. Never start this re-review
  unasked. A push that also holds any other change gets a fresh review.
- The maintainer may waive the review for one push. The waiver does not carry over to later pushes.

## Quality

- Never suppress, skip, or ignore a lint, type, test, or coverage requirement, whether by comment,
  configuration, or a lower threshold. Change the code to meet it.
- Never commit secrets. The repository is public.
- Script each process that will repeat, in `scripts/`, so it can be run instead of reasoned through.
