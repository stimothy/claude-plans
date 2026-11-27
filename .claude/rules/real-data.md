# Real data

The real data is the Git-ignored `.claude-plans/` directory in the main checkout, not a worktree, of the person
you are working for, usually the maintainer. It holds the studio's database, settings, logs, backups, and
installed application. Every protection below applies to that directory and that checkout. What you are doing
decides which section below applies, not the branch or the directory you are in. If you cannot tell which
applies, ask.

## Using the studio

When asked to use the studio, use the real data. This includes starting the real server, building plans through
the `claude-plans` command, and later watching for comments.

Until issue #27 is merged, nothing backs up the database before an install migrates it. Before running a plain
`claude-plans install` on the real data, tell the user this. Once #27 is merged, this no longer applies.

When asked to diagnose a problem in the real studio, only read: its logs in `.claude-plans/logs/`, its data,
and its output. Open the database read-only, such as with `sqlite3 -readonly`, because a normal connection can
write to it. Change nothing, including the data, the settings, the installed application, and the running
server. Report what you found and ask before making a fix.

## Developing and testing

Development and testing must never use, lose, or alter the real data, on any branch and in any directory,
including branches checked out in that main checkout. This covers writing and running tests, trying a change,
reproducing a bug, and building, installing, or starting changed code.

- Run development through the repository's scripts with a separate data directory, such as your job's
  temporary directory, a separate port, and a separate build.
- Never point a development command, test, or build at the real data directory.
- Never run a plain `claude-plans install`, without another data directory, for development. It replaces the
  installed application that runs on the real data.
- Never run `npm run install:studio`, or pass `--studio`, for development or testing. It is the one way the
  repository's copy reaches the real data: it performs a plain install, writing to the real data and putting the
  `claude-plans` command on the user's path.
- To fix a problem found in the real studio, reproduce it this way, not in the real data.

The `claude-plans` command run from the repository, and copies installed into any other data directory, refuse
the real data directory and everything inside it, except for `install --studio` run from the repository, which
installs into it as described above. Otherwise only a copy saved by a plain install may use it. This protects
only the command. Other code, such as the backend server program run directly or a test or script given the
path, is not stopped, so give the separate data directory explicitly in every development command.

## Deleting ignored files

In that main checkout, never run a Git command that removes or moves ignored files, such as `git clean -x`,
`git clean -X`, or `git stash --all` (`-a`). `.claude-plans/` is ignored, so these delete or move the real data.
To remove build output or caches, delete those directories by name.
