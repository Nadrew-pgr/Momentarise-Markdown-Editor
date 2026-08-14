---
title: Properties Fixture
priority: 3
published: true
created: 2026-08-14
reviewed: 2026-08-14T09:30:00
tags:
  - markdown
  - preservation
quoted: "A value: with a colon"
# Reviewers keep this note in the block; the panel must never touch it.
nested:
  owner: docs-team
  stage: draft
summary: |
  A block scalar the panel must never rewrite,
  because it cannot be spliced safely.
anchored: &shared reusable
---

# Properties Fixture

Body bytes that must survive every property edit.

The panel edits values positionally, so this paragraph, the comment above, and
every key it did not touch stay byte-identical.
