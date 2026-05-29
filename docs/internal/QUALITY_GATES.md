# Quality Gates

These gates are mandatory. Do not bypass them.

## Gate 0 — Repo docs read

Before coding, the agent must summarize:

- PRD objective;
- current issue;
- out-of-scope items;
- acceptance criteria;
- reviewer plan.

## Gate 0.5 — TDD / test-first

Before implementation starts, the agent must create or identify the test that proves the issue.

For code issues, the preferred order is:

1. Add or update fixture/test/manual check.
2. Confirm the check fails or documents the missing behavior.
3. Implement the smallest serious solution.
4. Run the check again.
5. Run reviewer/subagent verification.
6. Update `docs/internal/build-log.md`.

Manual tests do not replace automated tests for core behavior. Manual tests are acceptable only for UI feel, host integration, and browser/OS-specific behavior.

Documentation-only and pure repository bootstrap issues are exempt from TDD, but must still document acceptance criteria, file checks, reviewer verification, and build-log results.

## Gate 1 — Core independence

No core package may import React, Theia, VS Code, CodeMirror, ProseMirror, Electron, browser-only APIs, or mobile-only APIs.

## Gate 2 — Fixture corpus before rich mode

A representative fixture corpus must exist before rich mode.

### Fixture definition

A fixture means a real Markdown file stored in the repository for repeatable automated and manual tests. Fixtures are not abstract mock strings.

Fixtures must represent real document situations: frontmatter, code fences, callouts, wikilinks, HTML, Mermaid, LaTeX, unknown syntax, sensitive-policy cases, and real sanitized vault-like files.

Fixtures do not replace real local file smoke tests. The framework must also be tested with an actual `.md` file opened from the user's computer when the host supports it.

## Gate 3 — Real parser foundation

Parser must use a real Markdown AST foundation or a documented equivalent.

A handwritten parser cannot be the V0 long-term foundation without explicit human approval.

## Gate 4 — Round-trip and preservation

Round-trip tests must prove:

- frontmatter survives;
- HTML survives if untouched;
- code fences survive;
- unknown syntax survives as opaque/raw;
- edited heading preserves unrelated ranges;
- edited paragraph preserves unrelated ranges;
- edited code fence preserves fence boundaries.

## Gate 5 — Source editor baseline

Before rich mode, source mode must support:

- CodeMirror 6;
- undo/redo;
- `Cmd/Ctrl+Z`;
- normal newline behavior;
- list continuation;
- checkbox continuation;
- indentation;
- selection;
- `Cmd/Ctrl+S` hook;
- dirty state.

## Gate 6 — Real file persistence

The demo must distinguish:

- fixture mode;
- imported copy;
- real writable file;
- download-only mode;
- unsupported mode;
- conflict mode.

The UI must not say `saved` unless it specifies the actual target.

### Save truthfulness

Save state must describe the actual persistence target: disk, memory-only, download-required, unsupported, conflict, or error.

Never display plain `saved` if the user cannot tell where the content was persisted.

If the document is a built-in fixture, the UI must say it is a demo/fixture document and not written to disk.

If the document was imported through a fallback upload, the UI must say the original file cannot be overwritten and offer download/export.

If the document was opened through a real writable file handle, then `Cmd/Ctrl+S` and Save must write to the original file.

## Gate 7 — Save Engine

No serious rich mode until Save Engine has dirty/saving/saved/conflict/error, write queue, autosave, `Cmd/Ctrl+S`, tab switch flush, close guard, and conflict detection.

Mandatory automated tests before proceeding to rich mode:

- fixture corpus tests;
- parser tests;
- serializer tests;
- round-trip tests;
- edited-range preservation tests;
- opaque node preservation tests;
- Document Access Policy tests;
- Save Engine tests;
- conflict detection tests;
- real file persistence manual smoke test;
- CodeMirror source editing baseline verification.

## Gate 8 — Rich mode entry

Rich mode can start only after Gates 1–7 pass.

## Gate 9 — HTML sandbox

Any HTML preview must be sandboxed. Scripts disabled by default.

## Gate 10 — Document Access Policy

AI writing cannot send content until policy resolution exists.

## Gate 11 — AI writing boundary

AI V0 must remain writing assistance. No workspace agent, no RAG, no tool execution, no subagents.

## Gate 12 — Reviewer pass

Every completed issue must have reviewer verification. Use subagents if available. If unavailable, document fallback verification.
