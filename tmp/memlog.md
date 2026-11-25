| Date and time | Entry | Summary |
|---|---|---|
| 2026-11-25 05:37 UTC | [D]000001 | Entries are append-only, use UTC, and share one number sequence; a new decision resolves a question by citing it. Earlier decisions are stamped when recorded. |
| 2026-11-25 05:37 UTC | [D]000002 | Every change starts with an issue; milestones are epics, and issues are stories with a type, area label, Priority, and Effort. |
| 2026-11-25 05:37 UTC | [D]000003 | High Effort must be split; each PR of a split change gets its own sub-issue, and Claude closes the parent after the last one merges. |
| 2026-11-25 05:37 UTC | [D]000004 | The maintainer merges PRs; nobody pushes or force pushes to master. |
| 2026-11-25 05:37 UTC | [D]000005 | Keep the current ruleset, which the maintainer tested with their own PRs, and revisit it later. |
| 2026-11-25 05:37 UTC | [D]000006 | PRs use issue-numbered branches, Conventional Commit titles, a four-section description, and a 400-line limit with a maintainer override. |
| 2026-11-25 05:37 UTC | [D]000007 | Run code-review-swarm before creating or pushing to a PR; Claude instruction files get claude-whisperer instead. |
| 2026-11-25 05:37 UTC | [D]000008 | claude-wordsmith writes Claude instruction files, and every agent run uses a new subagent to avoid prompt cache rewrites. |
| 2026-11-25 05:37 UTC | [D]000009 | Every PR raises one shared semantic version; each merge releases it, starting at v0.1.0, and branches must be up to date. |
| 2026-11-25 05:37 UTC | [D]000010 | The project is public, MIT licensed, and includes contributing, security, and conduct documents; outside contributors start with an issue. |
| 2026-11-25 05:37 UTC | [D]000011 | The bootstrap is limited to health checks, a hello world page with color settings, a migration-only database, and repository standards. |
| 2026-11-25 05:37 UTC | [D]000012 | Use npm workspaces with domain, backend, CLI, and frontend packages; only domain may be imported across packages. |
| 2026-11-25 05:37 UTC | [D]000013 | The backend uses Fastify with a REST API, chosen over Express, Hono, NestJS, and Koa. |
| 2026-11-25 05:37 UTC | [D]000014 | Use node:sqlite, plain SQL, and forward-only transactional migrations, with no backups for now. |
| 2026-11-25 05:37 UTC | [D]000015 | Only the install command runs migrations. |
| 2026-11-25 05:37 UTC | [D]000016 | The database and YAML settings file live in the Git-ignored .claude-plans directory in the repository. |
| 2026-11-25 05:37 UTC | [D]000017 | The backend stores theme and color vision settings; the system theme is the default, and pages load without a color flash. |
| 2026-11-25 05:37 UTC | [D]000018 | Style with CSS Modules and shared color variables, without a component library, and meet WCAG AA contrast. |
| 2026-11-25 05:37 UTC | [D]000019 | The CLI starts and stops the server, with a --detached option; the server is local only, has no login, and checks request origins. |
| 2026-11-25 05:37 UTC | [D]000020 | Enforce standards with automated checks; never suppress or skip lint, type, test, or coverage requirements. |
| 2026-11-25 05:37 UTC | [D]000021 | Use Vitest, Storybook, and Playwright, with 80% coverage per package excluding E2E and a time limit per suite. |
| 2026-11-25 05:37 UTC | [D]000022 | CI runs static checks on Linux, unit and integration tests on three systems, and browser tests on Linux with Chromium. |
| 2026-11-25 05:37 UTC | [D]000023 | Scripts use Python 3.12 or newer in .venv and meet the same quality standards as other code. |
| 2026-11-25 05:37 UTC | [D]000024 | ADRs hold one costly decision, are never superseded, and end with a UTC changelog; design documents have none. |
| 2026-11-25 05:37 UTC | [D]000025 | ADR frontmatter has title, description, and date; design frontmatter has title and description; neither has status. |
| 2026-11-25 05:37 UTC | [D]000026 | Ignore .claude-plans, .serena, local Claude settings, Claude worktrees, and common generated, environment, and IDE files. |
| 2026-11-25 05:37 UTC | [D]000027 | The tmp directory is temporary; the last bootstrap PR removes it after preserving anything worth keeping. |
| 2026-11-25 05:37 UTC | [A]000028 | The start command refuses outdated or newer databases; the reply approving the other items did not name this one. |
| 2026-11-25 05:37 UTC | [A]000029 | The CLI runs the backend as a separate program, and stop uses a protected local API; the reply did not name this item. |
| 2026-11-25 05:37 UTC | [A]000030 | Each worktree has its own .claude-plans directory; the reply did not name this item. |
| 2026-11-25 05:37 UTC | [A]000031 | Claude closes a parent issue when told of the last merge or on finding it during later work in the repository. |
| 2026-11-25 05:37 UTC | [A]000032 | Node.js 24 is the required major version because it is installed locally and node:sqlite worked on 24.18.0. |
| 2026-11-25 05:37 UTC | [A]000033 | The 400-line limit counts additions plus deletions. |
| 2026-11-25 05:37 UTC | [A]000034 | Document numbering is separate for ADRs and designs, and an ADR date is its UTC creation date. |
| 2026-11-25 05:37 UTC | [O]000035 | Confirm the official stability status of node:sqlite before writing its ADR. |
| 2026-11-25 05:37 UTC | [O]000036 | Which bootstrap decisions need ADRs? Candidates are SQLite access, migrations, package boundaries, and Fastify. |
| 2026-11-25 05:37 UTC | [O]000037 | What time limit should each test suite have? |
| 2026-11-25 05:37 UTC | [O]000038 | How is the claude-plans command put on the user's path during local setup? |
| 2026-11-25 05:37 UTC | [O]000039 | How is the default port overridden, and how do clients find a changed port? |
| 2026-11-25 05:37 UTC | [O]000040 | How do tests isolate local data from the .claude-plans directory? |
| 2026-11-25 05:37 UTC | [O]000041 | How is bootstrap implementation split into issues and sub-issues, and what order do the CI checks arrive in? |
| 2026-11-25 05:37 UTC | [O]000042 | What should plans contain, how should they be stored, and are YAML files their source? This is future work. |
| 2026-11-25 05:37 UTC | [O]000043 | How should comments, events, and Claude's thread monitoring work? This is future work. |
| 2026-11-25 05:39 UTC | [D]000044 | Keep the memlog as a Markdown table with one row per entry, so it renders well. |
| 2026-11-25 05:41 UTC | [D]000045 | Claude creates the labels and milestones. |
| 2026-11-25 05:41 UTC | [D]000046 | The maintainer is the code owner; the bootstrap adds a CODEOWNERS file naming them. |
| 2026-11-25 05:41 UTC | [A]000047 | The origin check also validates the Host header, which blocks DNS rebinding from other websites. |
| 2026-11-25 05:41 UTC | [O]000048 | Worktrees share default port 4310; how do clients reach only their own server, and what if the port is taken? |
| 2026-11-25 05:41 UTC | [O]000049 | How do the 10-file and 300-line limits treat lockfiles, generated files, the repository root, and migrations? |
| 2026-11-25 05:41 UTC | [O]000050 | What does install do when a server is running or the database is newer than the application supports? |
