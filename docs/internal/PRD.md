# Momentarise Markdown Editor — PRD V0 Strict

## Status

Ready for restart-from-zero implementation.

Scope: framework only.

This PRD follows the `/to-prd` spirit: problem, users, goals, non-goals, decisions, user stories, requirements, acceptance criteria, and risks.

## One-line summary

Momentarise Markdown Editor is a Markdown-native framework for building modern, portable, AI-ready document editors where durable documents remain real `.md` files.

## Problem

Modern editors force a bad trade-off.

Block editors offer rich UX, slash commands, AI writing, and structured editing, but often make a JSON/block model the true persistence format.

Markdown editors preserve portability and user ownership, but often lack modern UX, safe AI writing, rich document behaviors, and reusable adapter architecture.

Momentarise Markdown Editor solves this by making Markdown the persisted source while rich editing, source mode, slash commands, HTML artifacts, AI writing, and host integrations remain derived layers.

## Product thesis

Markdown is the durable source.

Rich editing is a view.

HTML is an artifact.

AI is assistive writing.

Adapters are host-specific shells.

The core is independent.

## Users

### Framework adopter

A developer integrating the framework into a web app, Theia app, VS Code/Cursor extension, desktop app, future mobile surface, or Momentarise Workbench.

### End user

A person editing real Markdown files with modern UX: source/rich modes, slash commands, toolbar, folding, save confidence, HTML preview, and optional AI writing.

### Implementing developer or coding agent

A developer or agent building the framework issue by issue. They need strict, unambiguous docs, tests, and gates.

### Internal Momentarise builder

Momentarise will use the framework as its document layer. Workbench features remain outside V0.

## Goals

V0 must prove:

1. real Markdown can be opened, edited, saved, and round-tripped safely;
2. source mode uses CodeMirror 6 and has modern editor behavior;
3. real file persistence is honest and testable;
4. parser/serializer are serious enough for future rich editing;
5. unknown syntax is preserved;
6. edited-range preservation is tested before rich mode;
7. mini web demo proves host independence from Theia;
8. Save Engine supports dirty/saving/saved/conflict/error;
9. rich mode can be spiked safely after parser gates;
10. HTML reader uses sandboxed preview;
11. Document Access Policy exists before AI writing sends content;
12. AI writing remains BYOK and document-local;
13. CLI helps devs and AI coding agents initialize, inspect, validate, and integrate the framework.

## Non-goals

V0 must not build:

- SaaS;
- Momentarise Workbench;
- Mission Control;
- execution calendar;
- RAG or agentic RAG;
- long-running agents;
- user-facing subagents;
- browser agent;
- OpenClaw/Codex/Claude runtime integration;
- Notion database system;
- managed AI billing;
- production collaboration/CRDT;
- full mobile rich editor;
- desktop standalone app;
- advanced HTML artifact templates.

## Non-negotiable decisions

1. Markdown plus YAML frontmatter is the canonical persisted format.
2. In-memory state may be structured, including AST, source maps, ProseMirror doc, opaque nodes, and transient editor state.
3. In-memory state is acceptable only if it serializes safely back to Markdown.
4. Unknown syntax must not be silently destroyed.
5. Raw/source fallback is mandatory.
6. CodeMirror 6 is the V0 source mode.
7. Source mode must support undo/redo, including `Cmd/Ctrl+Z`.
8. Source mode must support baseline modern editor behavior: newline, indentation, list continuation, checkbox continuation, bracket/quote/backtick pairing where appropriate.
9. ProseMirror is the first rich-mode spike, not an irreversible choice.
10. Mini web demo is mandatory in V0.
11. Theia is an adapter/client, not the core.
12. HTML is artifact/preview format, not durable document source.
13. HTML preview must be sandboxed.
14. AI V0 is writing assistance only, not workspace agency.
15. Folding UI is interface state and must not mutate Markdown.
16. Toggle blocks are document content and are inserted only explicitly.
17. Save state must describe the actual persistence target.
18. A toy parser is not acceptable for V0 framework foundations.
19. A CLI is required for developer and agent adoption.

## User stories

### Source editing

As an end user, I can edit Markdown in a serious source editor with undo/redo, keyboard behavior, selection, indentation, list continuation, and `Cmd/Ctrl+S`.

### Real save trust

As an end user, I know whether my document is saved to disk, memory-only, downloadable, conflicted, unsupported, or errored.

### Preservation

As an end user, I can open Markdown with frontmatter, tables, code fences, callouts, wikilinks, HTML, Mermaid, LaTeX, and unknown syntax without silent corruption.

### Rich editing

As an end user, I can use a rich mode for supported Markdown blocks while source mode remains available.

### Slash commands

As an end user, I can type `/` and find commands via aliases such as `/h1`, `/H1`, `/heading`, `/todo`, `/code`, `/callout`.

### Folding

As an end user, I can fold headings, sections, code blocks, and callouts without modifying the Markdown source.

### HTML reader

As an end user, I can open an `.html` file in source mode and preview it safely in a sandbox.

### AI writing

As an end user, I can use BYOK AI for completion, rewrite, summary, improvement, transformation of selected text, and insertion assistance, subject to policy.

### Developer integration

As a framework adopter, I can import the core without importing Theia, VS Code, React, CodeMirror, ProseMirror, Electron, or browser-only APIs.

### CLI setup

As a developer or AI coding agent, I can use a CLI to initialize, inspect, validate, run fixtures, and scaffold adapter integration.

## Functional requirements

### Core independence

Core packages must not depend on host/editor UI libraries.

Forbidden in core:

- React;
- Theia;
- VS Code/Cursor APIs;
- CodeMirror;
- ProseMirror;
- Electron;
- browser-only APIs;
- mobile-only APIs.

### Target package structure

- `@momentarise/md-core`
- `@momentarise/md-format`
- `@momentarise/md-source-codemirror`
- `@momentarise/md-rich-prosemirror`
- `@momentarise/md-save`
- `@momentarise/md-policy`
- `@momentarise/md-preview-html`
- `@momentarise/md-ai`
- `@momentarise/md-cli`
- `@momentarise/md-adapter-web`
- `@momentarise/md-adapter-theia`
- `@momentarise/md-adapter-vscode`

Future host adapter candidates, not required for V0 unless promoted by an issue:

- `@momentarise/md-adapter-chrome-extension`

### Dialects

V0 dialects:

- `commonmark`
- `gfm`
- `obsidian-compatible`
- `momentarise-enhanced`

Default emission is portable Markdown. Obsidian-like syntax can be read and preserved. Emitting Obsidian-like syntax must be explicit or workspace-configured.

### Parser

Parser must use a real Markdown AST foundation such as micromark, remark, unified/mdast, or a documented equivalent.

Public Momentarise types must remain independent from third-party AST types.

Parser must support or preserve:

- YAML frontmatter;
- CommonMark/GFM subset;
- headings;
- paragraphs;
- emphasis/strong;
- inline code;
- lists and todos;
- blockquotes;
- links/images;
- horizontal rules;
- code fences;
- raw HTML;
- Mermaid fenced block;
- LaTeX inline/block;
- Obsidian-style callouts;
- wikilinks;
- unknown custom syntax as opaque/raw nodes;
- diagnostics;
- source ranges where feasible.

### Serializer

Serializer must:

- emit YAML frontmatter;
- serialize known V0 nodes;
- preserve untouched opaque nodes;
- preserve raw HTML when untouched;
- preserve code fences;
- preserve Mermaid/LaTeX if unsupported;
- avoid rewriting unrelated ranges where feasible;
- report normalizations and diagnostics.

Before rich mode, tests must prove edited-range behavior for at least heading, paragraph, list item, and code fence.

### Fixtures

A fixture corpus is mandatory before rich mode.

It must include simple Markdown, frontmatter, GFM tasks, GFM table, code fence, blockquote, callout, wikilink, link/image, HTML, Mermaid, LaTeX, unknown custom syntax, mixed real-world document, sanitized vault sample, policy-sensitive case, long heading document, and nested lists/todos.

### Source mode

Source mode uses CodeMirror 6.

Mandatory baseline:

- Markdown language support;
- undo/redo;
- `Cmd/Ctrl+Z`;
- redo shortcut where conventional;
- auto-closing pairs where appropriate;
- list continuation;
- checkbox continuation;
- indentation;
- selection access;
- read-only mode;
- dirty state;
- `Cmd/Ctrl+S` hook;
- integration with Save Engine.

### Mini web demo

The mini web demo is the first adapter and must be included in V0.

It must support fixture mode, real-file mode where browser APIs allow it, source mode, parser diagnostics, round-trip status, Save Engine state, and truthful persistence labels.

Persistence labels:

- disk;
- memory only;
- download required;
- unsupported;
- conflict;
- error.

The UI must never say simply `saved` if nothing was persisted to a real target.

### Save Engine

Save Engine tracks base hash, current hash, last saved hash, external hash when known, dirty/saving/saved/conflict/error, write queue, dirty timestamp, and last saved timestamp.

Triggers:

- `Cmd/Ctrl+S`;
- debounced autosave;
- tab switch flush;
- close guard;
- mode switch sync.

Default autosave: 800–1500 ms unless host overrides.

External change handling is adapter-owned, not Markdown-core-owned.

Each host adapter must document its external-change strategy:

- local web file adapter: File System Access handle plus focus refresh, periodic polling when appropriate, and save-time hash verification;
- Theia or IDE adapter: workspace/file-service events when the host exposes them;
- database or realtime sync adapter: server events, WebSocket, SSE, polling, CRDT, or app-specific sync state;
- Chrome extension adapter: extension permissions and browser APIs, with explicit limits for pages that cannot expose local file handles.

The core Save Engine owns dirty/conflict/error state and hash comparison. It must not depend on a specific watcher, database, IDE, browser extension, or OS API.

### Rich mode

Rich mode must not start until parser/serializer/range-preservation gates pass.

ProseMirror is the first spike engine.

V0 rich subset:

- paragraph;
- headings;
- emphasis;
- strong;
- inline code;
- bullet/ordered lists;
- todo;
- blockquote;
- links;
- images;
- horizontal rule;
- code fence display/edit basic;
- callout simple if feasible;
- raw/opaque fallback.

Mandatory rich baseline:

- Enter/newline works;
- undo/redo works;
- code fence content can be edited;
- editing around code fences does not corrupt Markdown;
- source/rich switching preserves content;
- unsupported blocks remain safe.

### Slash menu and toolbar

Slash menu is keyboard-first, fuzzy, compact, toolbar-friendly, and supports aliases `/h1`, `/H1`, `/heading`, `/todo`, `/quote`, `/code`, `/callout`, `/image`.

Toolbar V0 includes heading, bold, italic, list, todo, quote, code, callout, link, image, source/rich/preview switch, and more menu.

### Folding and toggles

Folding UI is a sidecar/session state and does not modify Markdown.

Toggle blocks are content and emit `<details><summary>...</summary>...</details>` only when explicitly inserted.

### HTML File Reader

V0 supports `.html` files with source mode and sandboxed preview. Scripts are disabled by default. External browser opening can be provided.

HTML artifact templates are future work.

### Document Access Policy

Capabilities:

- `exists`
- `metadata`
- `read`
- `index`
- `write`
- `execute`
- `share`
- `export`

Policy sources: framework defaults, app defaults, workspace rules, folder rules, future database rules, document properties, user settings, host constraints, hard-deny rules.

Hard deny includes `.env`, secrets, tokens, keys, identity documents, banking documents, and private folders.

### AI writing

V0 AI is writing assistance only.

Actions: inline completion, rewrite selection, improve selection, summarize selection, change tone, turn into checklist, generate title, insert block from prompt, explain selection if cheap.

BYOK-first. Managed AI later.

### CLI

V0 CLI commands:

- `mme init`
- `mme check`
- `mme test:fixtures`
- `mme inspect <file>`
- `mme format <file>` dry-run
- `mme format <file> --write`
- `mme create-fixture <name>`

CLI must not depend on Theia.

## Documentation requirements

Required documentation set:

- Overview;
- Quickstart;
- Core Concepts;
- Markdown Canonical Model;
- Parser and Serializer;
- Block Registry;
- Source Mode;
- Rich Mode;
- Adapters;
- CLI;
- Save Engine;
- Document Access Policy;
- AI and Privacy;
- HTML Artifacts;
- Testing and Fixtures;
- Recipes;
- API Reference;
- Compatibility Matrix;
- Migration;
- Contributing;
- Roadmap;
- Changelog;
- Threat Model;
- Compatibility Promise;
- Adapter Contract.

## License direction

Recommended:

- core packages: MPL-2.0;
- examples/demos/templates: Apache-2.0 or MIT;
- Momentarise Workbench/cloud/runtime: private/source-available later.

Final license must be confirmed before public release.

## Acceptance criteria V0

V0 is complete when:

1. `.md` with mixed syntax opens and saves without silent corruption;
2. unknown syntax survives;
3. source mode uses CodeMirror 6;
4. source editing has modern baseline behavior;
5. mini web demo can open a real local file where supported;
6. Save Engine shows truthful persistence state;
7. parser uses a real AST foundation;
8. edited-range preservation is tested;
9. rich mode edits V0 subset;
10. source/rich switching preserves content;
11. HTML reader shows source and sandboxed preview;
12. Document Access Policy blocks AI when required;
13. BYOK AI can propose accept/reject suggestions;
14. CLI validates fixtures and inspects files;
15. Theia adapter uses the same core.
