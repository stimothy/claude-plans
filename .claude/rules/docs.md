---
paths:
  - "docs/**"
---

# Documentation

`docs/adrs/` holds architecture decision records (ADRs), and `docs/designs/` holds design documents.

- Name files `####-<kebab-summary>.md`, numbered in sequence within each directory, without duplicates.
- ADR frontmatter has `title`, `description`, and `date`, the UTC date the ADR was created. Design document
  frontmatter has `title` and `description`. Neither has a status field.
- Write an ADR for one decision that would be hard or costly to reverse. ADRs are never superseded: update the
  ADR itself and add a line to the changelog at its end, newest last, such as `2026-11-25 05:37 UTC - Summary`.
- Design documents explain how the system works and why, without repeating ADRs, and have no changelog. Split
  a growing one by subject: one part keeps the number, and the others get new numbers.
- Draw diagrams in raw Mermaid. Put images and screenshots in an `assets/` directory beside the documents.
- When updating, revise the surrounding sentences instead of adding new ones at the end.
- When sources disagree, ADRs outrank code, and code outranks design documents.
- Issue #16 adds scripts that create documents and build the `docs/README.md` index. Once they exist, use them
  instead of doing either by hand.
