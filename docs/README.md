# Documentation Map

This repository separates public documentation from internal build and product documents.

## Public docs

Publishable documentation lives in `docs/public/`.

These files are intended for framework adopters and users once the project has a docs site. They should avoid private planning notes, unfinished decisions, and build-process logs unless explicitly promoted.

## Internal docs

Internal governance and planning documents live in `docs/internal/`.

This includes the PRD, issue list, quality gates, and build log. These files may become public later, but they are excluded from the default publishing boundary until that decision is explicit.

## Root docs

`README.md` is the public GitHub entrypoint.

`AGENT.md` remains at the repository root so coding agents and contributors can reliably find the mandatory build instructions before touching code.
