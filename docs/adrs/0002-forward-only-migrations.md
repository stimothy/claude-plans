---
title: "Forward-only migrations"
description: "The database only moves forward, one transaction for each numbered migration."
date: "2026-11-27"
---

## Context

The database holds real data that must survive new versions of the application. A new version may change both
the schema and the data in it. Code that reverses a change is rarely run, and often cannot bring back data that
the change removed.

## Decision

Number the migrations 1, 2, 3, and so on. Each moves the database forward in a transaction of its own, and none
has a step back. The database records which ones have run. Only installing the application is meant to run them.

## Consequences

- A failed migration leaves no changes of its own. Those that ran before it stay, so undoing a whole upgrade
  needs a backup. One is made before an existing database is migrated, and restored after a failure.
- An older application cannot use a newer database. Migrating refuses one and leaves it as it was.
- A migration that has reached real data cannot be edited to fix it, because it does not run again. The fix is a
  new migration.
- A migration must not begin or end a transaction. Ending one saves whatever came before, and the runner can only
  notice afterward if no new transaction was begun.
- Foreign keys are not enforced while migrations run. SQLite needs this to rebuild a table without deleting the
  rows that refer to it. A migration must make for itself any change that a cascade would have made. The whole
  database is checked before each one is saved, and a reference to a missing row fails it.

## Changelog

- 2026-11-27 04:11 UTC - Created
- 2026-11-27 16:56 UTC - A backup is now made before migrating, and restored after a failure
