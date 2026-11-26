# Decision log

| Date and time | Entry | Summary |
| --- | --- | --- |
| 2026-11-25 05:37 UTC | [D]000001 | Entries are append-only, use UTC, and share one number sequence; a new decision resolves a question by citing it. Earlier decisions are stamped when recorded. |
| 2026-11-25 05:37 UTC | [D]000002 | Every change starts with an issue; milestones are epics, and issues are stories with a type, area label, Priority, and Effort. |
| 2026-11-25 05:37 UTC | [D]000003 | High Effort must be split; each PR of a split change gets its own sub-issue, and Claude closes the parent after the last one merges. |
| 2026-11-25 05:37 UTC | [D]000004 | The maintainer merges PRs; nobody pushes or force pushes to master. |
| 2026-11-25 05:37 UTC | [D]000005 | Keep the current ruleset, which the maintainer tested with their own PRs, and revisit it later. |
| 2026-11-25 05:37 UTC | [D]000006 | PRs use issue-numbered branches, Conventional Commit titles, a four-section description, and a 400-line limit with a maintainer override. |
| 2026-11-25 05:37 UTC | [D]000007 | Run code-review-swarm before creating or pushing to a PR; Claude instruction files get claude-whisperer instead. |
| 2026-11-25 05:37 UTC | [D]000008 | claude-wordsmith writes Claude instruction files, and every agent run uses a new subagent to avoid prompt cache rewrites. |
| 2026-11-25 05:37 UTC | ~~[D]000009~~ | Every PR raises one shared semantic version; each merge releases it, starting at v0.1.0, and branches must be up to date. |
| 2026-11-25 05:37 UTC | [D]000010 | The project is public, MIT licensed, and includes contributing, security, and conduct documents; outside contributors start with an issue. |
| 2026-11-25 05:37 UTC | [D]000011 | The bootstrap is limited to health checks, a hello world page with color settings, a migration-only database, and repository standards. |
| 2026-11-25 05:37 UTC | ~~[D]000012~~ | Use npm workspaces with domain, backend, CLI, and frontend packages; only domain may be imported across packages. |
| 2026-11-25 05:37 UTC | [D]000013 | The backend uses Fastify with a REST API, chosen over Express, Hono, NestJS, and Koa. |
| 2026-11-25 05:37 UTC | ~~[D]000014~~ | Use node:sqlite, plain SQL, and forward-only transactional migrations, with no backups for now. |
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
| 2026-11-25 05:37 UTC | ~~[A]000030~~ | Each worktree has its own .claude-plans directory; the reply did not name this item. |
| 2026-11-25 05:37 UTC | [A]000031 | Claude closes a parent issue when told of the last merge or on finding it during later work in the repository. |
| 2026-11-25 05:37 UTC | [A]000032 | Node.js 24 is the required major version because it is installed locally and node:sqlite worked on 24.18.0. |
| 2026-11-25 05:37 UTC | [A]000033 | The 400-line limit counts additions plus deletions. |
| 2026-11-25 05:37 UTC | [A]000034 | Document numbering is separate for ADRs and designs, and an ADR date is its UTC creation date. |
| 2026-11-25 05:37 UTC | [O]000035 | Confirm the official stability status of node:sqlite before writing its ADR. |
| 2026-11-25 05:37 UTC | ~~[O]000036~~ | Which bootstrap decisions need ADRs? Candidates are SQLite access, migrations, package boundaries, and Fastify. |
| 2026-11-25 05:37 UTC | ~~[O]000037~~ | What time limit should each test suite have? |
| 2026-11-25 05:37 UTC | ~~[O]000038~~ | How is the claude-plans command put on the user's path during local setup? |
| 2026-11-25 05:37 UTC | ~~[O]000039~~ | How is the default port overridden, and how do clients find a changed port? |
| 2026-11-25 05:37 UTC | ~~[O]000040~~ | How do tests isolate local data from the .claude-plans directory? |
| 2026-11-25 05:37 UTC | ~~[O]000041~~ | How is bootstrap implementation split into issues and sub-issues, and what order do the CI checks arrive in? |
| 2026-11-25 05:37 UTC | [O]000042 | What should plans contain, how should they be stored, and are YAML files their source? This is future work. |
| 2026-11-25 05:37 UTC | [O]000043 | How should comments, events, and Claude's thread monitoring work? This is future work. |
| 2026-11-25 05:39 UTC | [D]000044 | Keep the memlog as a Markdown table with one row per entry, so it renders well. |
| 2026-11-25 05:41 UTC | [D]000045 | Claude creates the labels and milestones. |
| 2026-11-25 05:41 UTC | [D]000046 | The maintainer is the code owner; the bootstrap adds a CODEOWNERS file naming them. |
| 2026-11-25 05:41 UTC | [A]000047 | The origin check also validates the Host header, which blocks DNS rebinding from other websites. |
| 2026-11-25 05:41 UTC | ~~[O]000048~~ | Worktrees share default port 4310; how do clients reach only their own server, and what if the port is taken? |
| 2026-11-25 05:41 UTC | ~~[O]000049~~ | How do the 10-file and 300-line limits treat lockfiles, generated files, the repository root, and migrations? |
| 2026-11-25 05:41 UTC | ~~[O]000050~~ | What does install do when a server is running or the database is newer than the application supports? |
| 2026-11-25 22:24 UTC | [D]000051 | Add logging to ease debugging, using rotating files in .claude-plans/logs/. |
| 2026-11-25 22:24 UTC | [A]000052 | The backend and CLI write separate log files, so two programs never rotate the same file. |
| 2026-11-25 22:24 UTC | [A]000053 | Log entries are JSON lines with a UTC time, level, and message; errors include stack traces. |
| 2026-11-25 22:24 UTC | [A]000054 | Log levels are error, warn, info, and debug, with info as the default. |
| 2026-11-25 22:24 UTC | ~~[A]000055~~ | Each program rotates its log at 10 MB and keeps five rotated files. |
| 2026-11-25 22:24 UTC | [A]000056 | A detached server logs like a foreground server, including startup failures. |
| 2026-11-25 22:24 UTC | [A]000057 | Logs never contain secrets or request and response bodies. |
| 2026-11-25 22:24 UTC | ~~[O]000058~~ | How is the log level changed? |
| 2026-11-25 22:24 UTC | ~~[O]000059~~ | Where does logging code shared by the backend and CLI live, given that only domain may be imported? |
| 2026-11-25 22:24 UTC | ~~[O]000060~~ | Are web page errors recorded in the log files? |
| 2026-11-25 22:24 UTC | [O]000061 | What rotates log files reliably on every supported system, including with several CLI commands at once? |
| 2026-11-25 22:40 UTC | [D]000062 | Resolves O000038: install puts claude-plans on the user's path; the first run uses a script inside the repository. |
| 2026-11-25 22:43 UTC | [D]000063 | Development, including branches in the maintainer's own copy, must never lose or alter real data; Claude respects it. |
| 2026-11-25 22:43 UTC | ~~[O]000064~~ | How is real data kept apart from development, given that A000030 does not cover branches in the same directory? |
| 2026-11-25 22:43 UTC | ~~[O]000065~~ | Which copy of the code does the claude-plans command on the path run? Depends on O000064. |
| 2026-11-25 22:43 UTC | ~~[O]000066~~ | Should install back up the database before migrating, revisiting the no-backups part of D000014? |
| 2026-11-25 22:45 UTC | [D]000067 | Resolves O000064: data stays in the repository by default; install and start accept another data directory. |
| 2026-11-25 22:45 UTC | [D]000068 | Resolves the override part of O000039: the port can be overridden by an option. |
| 2026-11-25 22:45 UTC | [D]000069 | Claude develops with its own data directory, such as its job's temporary directory, following written instructions. |
| 2026-11-25 22:45 UTC | [A]000070 | The options are --data-directory and --port; the data directory holds the database, settings, and logs. |
| 2026-11-25 22:45 UTC | [A]000071 | stop and health take --data-directory, find the recorded port, and confirm the server's directory before acting. |
| 2026-11-25 22:45 UTC | [A]000072 | install with another data directory leaves the claude-plans command on the user's path unchanged. |
| 2026-11-25 22:45 UTC | ~~[O]000073~~ | What protects real data if Claude omits the data directory option? |
| 2026-11-25 22:48 UTC | [D]000074 | Resolves O000073: do not block Claude's commands, as it will use real data for plans; testing development changes must not. |
| 2026-11-25 22:50 UTC | [D]000075 | Resolves O000039: the default port is overridden by the YAML settings file, which a command option overrides. |
| 2026-11-25 22:51 UTC | [D]000076 | The port option belongs to start only, not install; install still accepts another data directory. |
| 2026-11-25 22:51 UTC | [D]000077 | Resolves O000040: tests use their own temporary data directory and port on every branch, never the real data. |
| 2026-11-25 22:53 UTC | ~~[D]000078~~ | install builds the application; if the build and package.json versions differ, commands block and say to run it. |
| 2026-11-25 22:53 UTC | [A]000079 | The build records its version, and any difference counts, whether the source is newer or older. |
| 2026-11-25 22:53 UTC | [A]000080 | install and stop are never blocked by an outdated build. |
| 2026-11-25 22:53 UTC | [A]000081 | The CLI also blocks when the running server's version differs, and says to stop, install, and start. |
| 2026-11-25 22:53 UTC | ~~[O]000082~~ | Should the build check also catch source changes that do not change the version? |
| 2026-11-25 22:54 UTC | [D]000083 | Resolves the migrations part of the 10-file question in O000049: migrations may stay in one flat directory. |
| 2026-11-25 22:55 UTC | [D]000084 | Resolves the running-server part of O000050: install stops the server, installs, and says to start it again. |
| 2026-11-25 22:55 UTC | [A]000085 | install stops only the server using the same data directory, so a development install leaves the real one running. |
| 2026-11-25 22:55 UTC | [A]000086 | If the server cannot be stopped, install fails without changing anything. |
| 2026-11-25 22:55 UTC | [D]000087 | Rotate logs by date instead of by size, replacing A000055. |
| 2026-11-25 22:55 UTC | [A]000088 | A new log file starts each UTC day, and its name includes the date. |
| 2026-11-25 22:55 UTC | [A]000089 | Each program keeps 14 days of log files and deletes older ones. |
| 2026-11-25 22:56 UTC | [D]000090 | Strike through the ID of a replaced or fully answered entry; this is the only edit allowed to an earlier row, as an exception to D000001. |
| 2026-11-25 23:12 UTC | [D]000091 | Resolves O000082: the build check compares only versions; outdated builds from unversioned changes are accepted. |
| 2026-11-25 23:12 UTC | [D]000092 | Dependabot changes carry no version change, so their PRs are exempt from the version rise in D000009. |
| 2026-11-25 23:12 UTC | [A]000093 | A merge that does not change the version creates no release. |
| 2026-11-25 23:12 UTC | ~~[O]000094~~ | Which other PR rules, such as the linked issue, title, and description, apply to Dependabot PRs? |
| 2026-11-25 23:13 UTC | [D]000095 | Resolves O000094: Dependabot PRs pass the process rules, but tests, builds, and other quality checks must pass. |
| 2026-11-25 23:19 UTC | [D]000096 | Git ignores the .idea directory. |
| 2026-11-25 23:22 UTC | [A]000097 | npm run dev uses its own data directory and port, never the real data, and Vite connects to that backend. |
| 2026-11-25 23:22 UTC | [A]000098 | start refuses when a server already runs on the same data directory, whatever the port; a stale record does not block it. |
| 2026-11-25 23:22 UTC | ~~[O]000099~~ | On a branch in the maintainer's own copy, what stops the outdated-build message leading to a plain install on real data? |
| 2026-11-25 23:22 UTC | ~~[O]000100~~ | How is a development build kept from replacing the build that runs against real data? |
| 2026-11-25 23:22 UTC | ~~[O]000101~~ | Do Dependabot PRs keep their exemption after someone else adds commits? |
| 2026-11-25 23:38 UTC | [D]000102 | Claude works with real data, including the server, plans, and later comments; only development must not use it. |
| 2026-11-25 23:38 UTC | [D]000103 | Diagnosis is read-only: Claude reads logs and data and asks before making a fix. |
| 2026-11-25 23:38 UTC | [D]000104 | Resolves O000065 and O000100: plain install saves the real app in .claude-plans, apart from development builds. |
| 2026-11-25 23:38 UTC | [D]000105 | Resolves O000099: plain install works only from the main copy on an unchanged master; otherwise it changes nothing. |
| 2026-11-25 23:38 UTC | [D]000106 | The version check compares the saved app with local master, so work on other branches does not trigger it. |
| 2026-11-25 23:38 UTC | [D]000107 | Development scripts never use real data by default, replacing A000030's per-worktree default. |
| 2026-11-25 23:38 UTC | [D]000108 | Claude rules forbid any git clean that removes ignored files in the maintainer's own copy. |
| 2026-11-25 23:38 UTC | [D]000109 | Resolves O000066: back up the database before install migrates it, replacing the no-backups part of D000014. |
| 2026-11-25 23:38 UTC | [A]000110 | A failed backup stops the migration. |
| 2026-11-25 23:38 UTC | [D]000111 | Resolves O000048: development picks a free port; the real server reports a taken port without switching. |
| 2026-11-25 23:38 UTC | [D]000112 | Resolves the rest of O000049: lockfiles and generated files are exempt, as is the root from the 10-file limit. |
| 2026-11-25 23:38 UTC | [D]000113 | Migrations keep the 300-line limit. |
| 2026-11-25 23:38 UTC | [D]000114 | Resolves the rest of O000050: install changes nothing for a newer database and leaves the server running. |
| 2026-11-25 23:38 UTC | [D]000115 | Resolves O000058: the log level is info by default, overridden by YAML, then by start --log-level. |
| 2026-11-25 23:38 UTC | [D]000116 | Resolves O000060: web page errors are not logged to files during the bootstrap. |
| 2026-11-25 23:38 UTC | [D]000117 | Resolves O000059: add packages/logging for only the backend and CLI, an exception to D000012. |
| 2026-11-25 23:38 UTC | [D]000118 | Resolves O000101: Dependabot-authored PRs skip structure and version checks until someone else adds a commit. |
| 2026-11-25 23:38 UTC | [D]000119 | Resolves O000037: suite limits start at unit 30s, integration 2m, component 3m, and E2E 5m. |
| 2026-11-25 23:38 UTC | [D]000120 | Suite limits may rise when tests cannot reliably be faster; reporting individual slow tests matters more. |
| 2026-11-25 23:38 UTC | [D]000121 | Resolves O000036: Claude decides which ADRs to write, as long as each meets the ADR criteria. |
| 2026-11-25 23:38 UTC | ~~[D]000122~~ | Resolves O000041: issues #3 to #38 split the bootstrap; checks arrive with the work in issues #4, #12, #16, and #33. |
| 2026-11-25 23:38 UTC | [D]000123 | Until issue #24 is complete, development does not run against real data. |
| 2026-11-25 23:38 UTC | [D]000124 | Until issue #34, versions are checked by hand; they stay below 0.1.0 until the final release and are not released. |
| 2026-11-25 23:38 UTC | [D]000125 | Claude asks before making CI checks and up-to-date branches required. |
| 2026-11-25 23:45 UTC | [A]000126 | A plain install refuses when local master has commits that the remote master does not. |
| 2026-11-25 23:45 UTC | [A]000127 | Naming the real data directory in an option does not bypass its protections, and development scripts reject it. |
| 2026-11-25 23:45 UTC | [A]000128 | An outdated-build message says a plain install needs the main copy on an unchanged master. |
| 2026-11-25 23:45 UTC | [A]000129 | install replaces the saved app only after the backup and all migrations succeed; backups are never overwritten. |
| 2026-11-25 23:45 UTC | ~~[O]000130~~ | How are the database and server recovered when a migration fails partway? |
| 2026-11-25 23:45 UTC | ~~[O]000131~~ | Where are backups kept, given that deleting the data directory deletes anything stored in it? |
| 2026-11-25 23:45 UTC | [O]000132 | How does a Dependabot PR meet the normal rules, such as branch naming, after another commit, even a merge from master? |
| 2026-11-25 23:51 UTC | [D]000133 | Replaces D000009: PRs except Dependabot's raise one shared version; from v0.1.0, merges that raise it release it; branches must be up to date. |
| 2026-11-25 23:51 UTC | [D]000134 | Replaces D000012: npm workspaces hold domain, logging, backend, CLI, and frontend; backend, CLI, and frontend may import domain, and only backend and CLI may import logging. |
| 2026-11-25 23:51 UTC | [D]000135 | Replaces D000014: use node:sqlite, plain SQL, and forward-only transactional migrations; backups follow D000109. |
| 2026-11-25 23:51 UTC | [D]000136 | Replaces D000078: install builds the app; if the saved build and local master versions differ, commands that depend on the build block and say to run it. |
| 2026-11-25 23:51 UTC | [D]000137 | Resolves O000041 and replaces D000122. Scope by issue: #3 decisions; #4 repository setup; #9 Claude setup; #12 repository and PR checks; #15 documentation; #18 backend; #24 CLI; #29 web page; #33 releases; #36 finish. |
| 2026-11-25 23:51 UTC | [D]000138 | Checks arrive in order: #6 lint and format; #7 Python; #8 CI, tests, secrets, and audits; #13 structure; #14 PR rules; #16 documents; #19 import boundaries; #32 end-to-end; #34 version. |
| 2026-11-25 23:51 UTC | ~~[A]000139~~ | Proposed answer to O000130: if a migration fails, install restores the backup it just made, and reports its location if the restore fails. |
| 2026-11-25 23:51 UTC | ~~[A]000140~~ | Proposed answer to O000131: backups go in backups/ in the data directory, so deleting that directory also deletes them. |
| 2026-11-25 23:52 UTC | [D]000141 | Resolves O000130, replacing A000139: if a migration fails, install restores the backup it just made, and reports its location if the restore fails. |
| 2026-11-25 23:52 UTC | [D]000142 | Resolves O000131, replacing A000140: backups go in backups/ in the data directory, so deleting that directory also deletes them. |
| 2026-11-25 23:54 UTC | [D]000143 | Sub-issues of #4: #5 open source and ignored files; #6 TypeScript workspaces, lint, and format; #7 Python tooling; #8 CI, security scans, and Dependabot. |
| 2026-11-25 23:54 UTC | [D]000144 | Sub-issues of #9: #10 CLAUDE.md and rules; #11 Claude settings and Git hooks against unsafe actions. |
| 2026-11-25 23:54 UTC | [D]000145 | Sub-issues of #12: #13 structure, naming, and suppression checks; #14 PR checks with the Dependabot exemption. |
| 2026-11-25 23:54 UTC | [D]000146 | Sub-issues of #15: #16 scripts to create, index, and check documents; #17 first architecture design document. |
| 2026-11-25 23:54 UTC | [D]000147 | Sub-issues of #18: #19 domain package and import boundaries; #20 data directories and settings; #21 logging; #22 database and migrations; #23 health check, server controls, and request protection. |
| 2026-11-25 23:54 UTC | [D]000148 | Sub-issues of #24: #25 start, stop, and health; #26 saved app and install protections; #27 pre-migration backups; #28 outdated-build blocking. |
| 2026-11-25 23:54 UTC | [D]000149 | Sub-issues of #29: #30 hello world page and Storybook; #31 themes and color vision without a color flash; #32 end-to-end tests. |
| 2026-11-25 23:54 UTC | [D]000150 | Sub-issues of #33: #34 version check; #35 automated releases. |
| 2026-11-25 23:54 UTC | [D]000151 | Sub-issues of #36: #37 README and final design documents; #38 remove tmp and publish v0.1.0. |
| 2026-11-26 00:29 UTC | [D]000152 | Security and conduct reports use GitHub private vulnerability reporting, now enabled; no email is published. |
| 2026-11-26 00:29 UTC | [A]000153 | Use TypeScript 6.0, because typescript-eslint does not yet support TypeScript 7. |
| 2026-11-26 00:29 UTC | [A]000154 | Require Node.js 24.15 or newer within 24, which the JSDoc lint plugin needs. |
| 2026-11-26 00:29 UTC | [A]000155 | The root package.json starts at version 0.0.1. |
| 2026-11-26 00:29 UTC | [A]000156 | Prettier keeps the memlog table compact, so formatting never rewrites rows and no file is excluded. |
| 2026-11-26 00:29 UTC | ~~[O]000157~~ | How should #8's audit treat low and moderate findings in lint-only tools that have no clean fix? |
| 2026-11-26 00:34 UTC | [A]000158 | npm run typecheck covers only root files; #19 must add the first package to it, and later packages must be added too. |
| 2026-11-26 00:43 UTC | [D]000159 | Deliver #7 as two sub-issues to stay within the size limit: #42 script launcher; #43 Python tools and environment setup. |
| 2026-11-26 00:43 UTC | [A]000160 | A small TypeScript launcher in scripts/ finds Python and runs the scripts, since no one Python command name works on every system; the scripts themselves are Python. |
| 2026-11-26 00:43 UTC | [A]000161 | Vitest arrives with #42 to test the launcher. |
| 2026-11-26 00:43 UTC | [A]000162 | The 30-second unit limit applies to each language's suite separately. |
| 2026-11-26 00:47 UTC | [O]000163 | A time limit stops only the command itself; should it stop the whole process tree once a suite starts other processes, as in #32? |
| 2026-11-26 00:52 UTC | [A]000164 | Use mypy in strict mode, pytest, and pytest-cov; requirements.txt pins the direct Python tools. |
| 2026-11-26 00:52 UTC | [A]000165 | Coverage.py reports no function percentage, so Python coverage checks lines and branches combined. |
| 2026-11-26 01:02 UTC | ~~[O]000166~~ | requirements.txt pins only the direct Python tools; should their dependencies also be locked with hashes, as package-lock.json does for npm, for #8? |
| 2026-11-26 01:12 UTC | [D]000167 | Resolves O000157: npm audit fails on any finding in shipped dependencies, and in development tools only from high severity. |
| 2026-11-26 01:12 UTC | [D]000168 | Resolves O000166: requirements.in pins the direct Python tools, and uv generates requirements.txt, which locks them all with hashes. |
| 2026-11-26 01:12 UTC | [A]000169 | pip-audit reports no severity and the Python packages are all development tools, so any known Python finding fails. |
| 2026-11-26 01:29 UTC | [D]000170 | CI checks run on pull requests only, not on merges to master, since branches must be up to date. The release job still runs on merges to master. |
| 2026-11-26 01:30 UTC | [D]000171 | The master ruleset now requires up-to-date branches and the eight CI checks from GitHub Actions; CodeRabbit is not required. |
| 2026-11-26 01:43 UTC | [D]000172 | Extends D000108: in the main copy, Claude runs no command that removes or moves ignored files, including a stash of all files. |
| 2026-11-26 04:40 UTC | [D]000173 | Claude settings block unsafe commands with deny rules plus a tested script that reads each shell command first. It catches mistakes, not deliberate disguises. |
| 2026-11-26 04:40 UTC | ~~[D]000174~~ | npm install turns on the pre-push hook through core.hooksPath, unless the clone already uses its own Git hooks. |
| 2026-11-26 04:40 UTC | [D]000175 | Extends D000172: outside worktrees, Claude settings block git clean with -x or -X and a stash of all files. |
| 2026-11-26 04:40 UTC | [A]000176 | The Claude check needs only Python 3.12 or newer, not .venv, and blocks the command if it cannot run. |
| 2026-11-26 04:40 UTC | [A]000177 | The Claude check runs from the project directory, or from a worktree under it while the project directory has no check. |
| 2026-11-26 04:51 UTC | [D]000178 | Replaces D000174: npm install copies the pre-push hook into the clone's own hooks directory, because a core.hooksPath that points into the tree would run any checked-out branch's hooks. |
| 2026-11-26 04:51 UTC | [A]000179 | When the checked-out branch cannot be told, as after cd, the Claude check blocks a push that does not name its branch. |
| 2026-11-26 05:06 UTC | [A]000180 | The Claude check needs Claude Code 2.1.295 or newer, so that a check that times out blocks the command. |
| 2026-11-26 05:30 UTC | [D]000181 | Abbreviated names: the unicorn lint rule alone for TypeScript; our own banned list for Python and file names. |
| 2026-11-26 05:30 UTC | [D]000182 | Duplicated code: jscpd, which fails on any copied block above a minimum size, in tests too. |
| 2026-11-26 05:30 UTC | [D]000183 | `docs/adrs/` and `docs/designs/` are exempt from both the 300-line and 10-file limits, and from directory name rules. |
| 2026-11-26 05:30 UTC | [A]000184 | A directory named `migrations` is exempt from the 10-file limit, though its subdirectories are not. |
| 2026-11-26 05:30 UTC | [A]000185 | A catch-all name is one that is, or ends in, util, utils, helper, helpers, or misc, or is exactly common. |
| 2026-11-26 05:38 UTC | [A]000186 | No generated file is committed yet, so the first one adds the list that exempts generated files from the limits. |
