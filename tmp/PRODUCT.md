# Product requirements

This file covers the user experience of the bootstrap. See [SPEC.md](SPEC.md) for scope.

## Users

The first user is the maintainer, running the studio on their own computer. The maintainer uses the web page,
while Claude mainly uses the CLI.

## Web page

The page shows a hello world message and two settings:

| Setting | Choices | Default |
|---|---|---|
| Theme | System, Light, Dark | System |
| Color vision | Default, Protan, Deutan, Tritan | Default |

- System follows the operating system's light or dark setting. The other theme choices override it.
- Both themes support all four color vision choices, for eight palettes in total.
- Choices are saved through the backend, so they remain after a reload or restart.
- The page appears in the correct colors from its first paint, with no flash of another palette.
- In development, the page uses the defaults if the backend is unavailable.
- Every palette meets WCAG AA contrast.

## Storybook

Storybook is part of the frontend. It lets the viewer switch both theme and color vision,
so every component can be checked in all eight palettes.

## Command line

| Command | What the user gets |
|---|---|
| `claude-plans install` | A database that is ready for the current version |
| `claude-plans start` | A server running in the foreground |
| `claude-plans start --detached` | A server running in the background |
| `claude-plans stop` | A graceful shutdown of the server |
| `claude-plans health` | A readable health report |
| `claude-plans health --json` | The same report as JSON, for Claude |

- `install` also puts `claude-plans` on the user's path. Before the first run the command is not there yet,
  so the first `install` runs through a script inside the repository. Later commands use `claude-plans` directly.
- The `claude-plans` command on the user's path works with the real data from any branch or directory.
- A plain `install` works only from the user's own copy, on `master`, with no local code changes.
  Otherwise, it changes nothing and explains how to use a separate data directory.
- `install` and `start` offer an option for a different data directory. `start` also offers options
  for the port and log level. Development runs these through scripts in the repository.
- The port is 4310 and the log level is `info` unless the YAML settings file sets another.
  A command option overrides both. If the port is taken, the real server reports an error.
- Before `install` migrates an existing database, it makes a backup.
- If the database is newer than the application supports, `install` explains why and changes nothing.
- If a server is running, `install` stops it, installs, and ends with a message to start the server again.
- If the saved build's version does not match local `master`, commands that depend on the build do not run.
  They say to run `claude-plans install`. As proposed, this check never blocks `install` or `stop`.
- The health report shows status, application version, database access, and migration version.
- If the server is not running, `health` says so clearly and does not start it.
- If the database is out of date, `start` refuses to run and says to run `claude-plans install`.
- If the database is newer than the application supports, `start` refuses to run and explains why.

## Out of scope

The bootstrap has no plan creation, editing, viewing, or comments.
It also has no login or hosted deployment.

## Future direction

This section gives context only. The details are not designed, and none of it is a bootstrap requirement.

The studio is expected to become the way the maintainer writes specifications for future changes.
YAML files may be the source format for plans. The maintainer may later comment on parts of a plan,
while Claude watches those threads and responds by adjusting or fixing the plan.
