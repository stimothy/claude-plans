# Documentation

<!-- Built by `npm run document:index`. Do not edit it by hand. -->

When sources disagree, ADRs outrank code, and code outranks design documents.

## Architecture decision records

| Document                                                              | Description                                                                        |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| [SQLite through node:sqlite](adrs/0001-sqlite-through-node-sqlite.md) | The database is SQLite, used with plain SQL through the module built into Node.js. |
| [Forward-only migrations](adrs/0002-forward-only-migrations.md)       | The database only moves forward, one transaction for each numbered migration.      |
| [Fastify for the REST API](adrs/0003-fastify-for-the-rest-api.md)     | The backend serves a REST API with Fastify.                                        |

## Design documents

| Document                                     | Description                                                       |
| -------------------------------------------- | ----------------------------------------------------------------- |
| [Architecture](designs/0001-architecture.md) | How the repository's tools, safeguards, and checks work, and why. |
