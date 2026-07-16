---
title: CLI For Agents And Developers
description: Inspect, validate, format, and scaffold Markdown safely.
nav_section: Reference
nav_order: 16
audience: developers
tags:
  - package
  - cli
packages:
  - "@momentarise/md-cli"
llms: include
updated: 2026-07-08
---

# CLI For Agents And Developers

`@momentarise/md-cli` gives developers and agents a command-line surface for MME checks.

Use it when the proof should come from local files, fixtures, policy checks, or machine-readable output instead of a browser screenshot.

## Use It For

- initializing integration scaffolds;
- checking fixture and parser health;
- inspecting Markdown files;
- formatting dry runs and explicit writes;
- machine-readable `--json` output.

## Commands

### init

Create a starter workspace shape for integrating MME.

```bash
node packages/md-cli/dist/index.js init
```

### check

Run repository and fixture checks that are useful before publishing or handing work to another agent.

```bash
node packages/md-cli/dist/index.js check
node packages/md-cli/dist/index.js check --json
```

### inspect

Inspect a Markdown file and return parser, frontmatter, outline, and preservation diagnostics.

```bash
node packages/md-cli/dist/index.js inspect README.md --json
```

### format

Format is dry-run by default. It writes only when `--write` is explicit.

```bash
node packages/md-cli/dist/index.js format README.md
node packages/md-cli/dist/index.js format README.md --write
```

### test:fixtures

Run the fixture corpus so parser and preservation behavior stay repeatable.

```bash
node packages/md-cli/dist/index.js test:fixtures
```

## Security

The CLI resolves Document Access Policy before reading, exporting, or writing files. It denies symlink escapes and policy-denied paths.

Agents should treat a denied file as a real boundary. They should not retry by reading through another path unless the host or user grants access.

## JSON Output

Use `--json` for automation. Human-readable output may change; JSON keys are the safer integration surface for scripts and coding agents.

```bash
node packages/md-cli/dist/index.js inspect docs/public/index.md --json
```

## Related Docs

- [Agentic Experience](../concepts/agentic-experience.md)
- [Document Access Policy](../concepts/policy.md)
- [Compatibility Promise](../compatibility-promise.md)
