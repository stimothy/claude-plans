---
title: "Fastify for the REST API"
description: "The backend serves a REST API with Fastify."
date: "2026-11-27"
---

## Context

The command-line tool and the planned web page both reach the studio's data through the backend. The backend
needs a server for a REST API, which will also deliver the built web page. The maintainer chose Fastify over
Express, Hono, NestJS, and Koa.

## Decision

Serve a REST API with Fastify. The shapes of its requests and answers are Zod schemas in `domain`, so that its
clients do not depend on Fastify.

## Consequences

- Fastify and what it depends on must be kept up to date.
- The routes, and what applies to every request, are written for Fastify. Replacing it means rewriting them.
- Fastify has a logger of its own. It stays off, so that only the studio's logger writes, under its rules about
  secrets and the bodies of requests.

## Changelog

- 2026-11-27 05:16 UTC - Created
