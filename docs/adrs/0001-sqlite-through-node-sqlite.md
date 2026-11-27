---
title: "SQLite through node:sqlite"
description: "The database is SQLite, used with plain SQL through the module built into Node.js."
date: "2026-11-27"
---

## Context

The studio runs on one person's computer, on Linux, Windows, or macOS. It needs to keep its data there, without a
separate database server to install and run.

Node.js has a SQLite module, `node:sqlite`. The Node.js 24 documentation calls it a release candidate, one step
short of stable, from version 24.15.0. That is already the oldest version that the project accepts. A package
from npm would be a dependency to keep up to date, and one built from native code can fail to install on some
systems.

## Decision

Keep the data in a SQLite database, and use it through `node:sqlite` with plain SQL, without an object-relational
mapper.

## Consequences

- SQLite needs no extra dependency, and comes with the version of Node.js in use.
- The module can still change before it is stable. Raising the major version of Node.js needs a check of the code
  that uses it. Newer documentation renames its main class, `DatabaseSync`, to `Database`, and keeps the old name
  as a deprecated alias.
- The class that Node.js 24 offers is synchronous, so a slow query holds up everything else in its program.
- Queries are written by hand, and the rows they return are checked where they are read.

## Changelog

- 2026-11-27 04:11 UTC - Created
