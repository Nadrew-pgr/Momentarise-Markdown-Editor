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

A person editing real Markdown files with modern UX: source/rich/live-preview modes, slash commands, toolbar, block affordances, folding, save confidence, HTML preview, and optional AI writing across web, desktop, mobile, tablet, and IDE-like host surfaces.

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
7. reference editor surface proves the product UX is credible before adapters;
8. Save Engine supports dirty/saving/saved/conflict/error;
9. rich mode can be spiked safely after parser gates;
10. HTML reader uses sandboxed preview;
11. Document Access Policy exists before AI writing sends content;
12. AI writing remains BYOK and document-local;
13. CLI helps devs and AI coding agents initialize, inspect, validate, and integrate the framework;
14. mini web demo proves host independence before deeper Theia/IDE/mobile adapters.

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
- non-Markdown office/PDF editing such as `.docx`, `.pptx`, Google Docs, PDF, or similar source-format round-tripping.

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

As an end user, I can fold Markdown sections hierarchically from any heading depth, plus code blocks and callouts where supported, without modifying the Markdown source.

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

Public-framework packages added by the 2026-06-09 readiness review:

- `@momentarise/md-editor` — headless editor session, events, mode registry, AI controller; host-independent, DOM-free.
- `@momentarise/md-theme` — design tokens, host theme contract, icon set contract; contract types are DOM-free.
- `@momentarise/md-surface` — framework-free DOM components (toolbar, slash menu, command palette, status, AI panel) consuming tokens, preferences, icons, and an i18n dictionary.
- `@momentarise/md-react` — React binding only; vanilla remains the primary path.
- `@momentarise/md-render-html` — safe, sanitized, themable Markdown-to-HTML renderer for read-only rendering, print/export, server/static rendering, and the docs site.

Package tiers: model and services (md-core, md-format, md-policy, md-save, md-ai), headless engine (md-editor), view engines (md-source-codemirror, md-rich-prosemirror, md-preview-html, md-render-html), UI surface (md-theme, md-surface), framework bindings (md-react), host capability providers and shells (md-adapter-web, md-adapter-theia, md-adapter-vscode), tools (md-cli). View packages must declare CodeMirror/ProseMirror as peer dependencies so consumers never bundle duplicate editor cores. Nothing in the architecture may be React-only, Next-only, Theia-only, or browser-only.

Host-target strategy (so "which adapters?" has one answer): the value of the headless engine + framework-free surface is that most targets are NOT bespoke adapters.

- Vanilla web / Vite / any bundler: consume `md-editor` + view packages + `md-surface` directly. No adapter.
- React / Next.js: consume the `md-react` binding; Next adds an SSR boundary recipe. Vue/Svelte are the same binding shape, later. These are bindings, not adapters; proven by the MME-0031 external-consumer matrix (Vite vanilla, Next App Router, pnpm strict, duplicate-instance, tree-shake).
- Web file access: `md-host-web-fs` capability provider (File System Access). Not a shell.
- IDE / web-IDE shells (own widget system, file service, keybinding service, preferences): Theia, then VS Code/Cursor. Theia is the FIRST reference shell because it is the hardest integration — making the adapter contract hold against Theia de-risks every lighter target. It is a proof vehicle, not the only or final adapter.
- Desktop shells (Electron / Tauri): host shells that supply OS file IO, secure key storage, and OS file associations through the same SaveTarget-style capability contracts; tracked as host adapters, not core work.
- Mobile / tablet: a later layout/input pass plus a host shell where applicable.

Adapters and bindings stay thin precisely because orchestration lives in `md-editor` and UI in `md-surface`; adding a host means implementing capability contracts (file IO, external-change, settings storage, key storage, keybinding delegation), not re-implementing the editor.

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

Host adapters may also register Momentarise Markdown Editor as the default Markdown reader/editor when the host allows it.
This is adapter-owned:

- Theia or IDE adapters may register default `.md` editor contributions or workspace associations;
- desktop adapters may register OS file associations when the app owns that installer flow;
- Chrome extension adapters may offer browser/extension entrypoints where permissions allow, but cannot replace OS-level defaults by themselves.

The core must not assume it is the default editor. Default-reader/editor registration is a host integration capability, not a parser, serializer, or Save Engine responsibility.

### Rich mode

Rich mode must not start until parser/serializer/range-preservation gates pass.

ProseMirror is the first spike engine.

Rich editing UX should be benchmarked against leading Markdown/rich editors such as Notion, Obsidian, and BlockNote, without copying their product model or compromising Markdown as the durable source.

MME is not just another plain Markdown reader. Plain Markdown readers already exist. The product value is to make portable `.md` files feel like a premium block/rich editor across web apps, desktop apps, mobile/tablet surfaces, web IDEs, native IDEs, and mixed IDE/product shells.

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

Advanced rich editing backlog:

- Markdown input rules: typing `#`, `##`, `-`, `1.`, `- [ ]`, `>`, and code-fence patterns should transform the current rich block live when safe;
- live rich editing must not require switching to Source and back to see common Markdown constructs such as headings, todos, lists, quotes, and code fences;
- todos should render as checkbox rows and toggle checked state without losing Markdown task syntax;
- code blocks should expose language/meta controls for the hidden fence info string;
- users must be able to insert a paragraph after the last code block, callout, opaque/raw block, or other framed block;
- keyboard behavior around block boundaries, backspace, Enter, paste, and selection must feel editor-grade;
- toolbar and slash menu presentation must be reviewed as editor UX, including whether controls are always visible, contextual, compact, configurable by host settings, or exposed through preferences;
- rich/source/live-preview naming and labels must be reviewed for user clarity and host integration;
- mode controls must be document-kind aware so Markdown and HTML do not expose confusing inactive modes;
- file opening must use an editor-grade Open flow rather than separate demo buttons for every supported extension;
- HTML preview technical status chrome and nested scroll behavior must be polished for daily reading, with sandbox/save truth moved into a discreet status pattern rather than permanent preview chrome;
- folding affordances should benchmark against Obsidian/CodeMirror-style editor gutters: subtle left-margin controls, hover/focus reveal, minimal collapsed markers, and no persistent debug strip in normal editing UI;
- optional word/character document stats may be exposed as a small hideable editor status control when useful;
- the UI may take inspiration from Notion, Obsidian, BlockNote, and similar editors, but the persisted Markdown contract remains stricter than those products.

Before host adapters, MME must define a reference editor surface V0. This is not final polish, but it must be credible enough that adapters integrate a product direction rather than a lab demo.

Reference editor surface V0 must establish:

- an editor-first layout with debug/status panels demoted from normal user chrome;
- responsive behavior for desktop, tablet, mobile, web app, desktop app, and IDE-like surfaces;
- user-facing toolbar, slash menu, selection/context controls, compact mode control, and document status patterns;
- AI writing entry points inside slash menu, toolbar/contextual toolbar, selected-text actions, and command palette-style flows rather than only an inspector/debug panel;
- host-configurable preferences for toolbar behavior, glass/compact styling, control visibility, AI entry points, document stats, and technical status disclosure;
- a settings contract that lets host apps plug their real preferences/workspace/admin settings into MME without forking UI logic;
- polished block behavior for headings, paragraphs, lists, todos, quotes, code fences, callouts, images, raw/opaque blocks, and document end insertion;
- precise indentation/nesting behavior, including visible indentation guides when useful for reading and editing nested structures;
- premium checkbox/todo affordances, not raw cheap-looking square controls;
- clear distinction between source, rich, live preview, and HTML preview states per document type;
- reference boundaries for third-party inspiration and license respect.

Final editor UI/UX/DX hardening is still required after the adapter/core feature set is in place. That later pass must revisit indentation, nested lists/todos, Tab/Shift+Tab, Enter/Backspace/paste/selection, live preview refresh, block insertion handles, folding affordances, toolbar/slash density, open-file flow, mode-switch presentation, HTML preview reading chrome/scroll behavior, optional document stats, host settings, and developer integration ergonomics as one coherent editor-quality review.

Reference inspiration:

- Notion and BlockNote for slash-menu categories, block insertion, and block-level affordances;
- BlockNote, Google Docs/Gemini, and Microsoft Copilot in Word for AI writing action families such as continue, draft, rewrite, improve, shorten, expand, summarize, tone change, explain, translate, turn into list/checklist/table where supported, and insert suggested content with explicit accept/reject;
- Obsidian default Live Preview for Markdown-first editing expectations;
- Obsidian Editing Toolbar-style interaction patterns for toolbar positioning, configurable command groups, dropdown/submenu organization, compact/shrink behavior, and optional glass-like presentation. The plugin is MPL-2.0; MME may use it only as design inspiration or with explicit license-compliant reuse, never by copying code, assets, or protected styling blindly.

### Slash menu and toolbar

Slash menu is keyboard-first, fuzzy, compact, toolbar-friendly, and supports aliases `/h1`, `/H1`, `/heading`, `/todo`, `/quote`, `/code`, `/callout`, `/image`.

Toolbar V0 includes heading, bold, italic, list, todo, quote, code, callout, link, image, source/rich/preview switch, and more menu.

### Folding and toggles

Folding UI is a sidecar/session state and does not modify Markdown.

Heading folding is hierarchical section folding for every heading depth from H1 through H6. A folded heading hides every following block until the next heading of the same or higher depth. Folding an H1 hides its H2/H3/H4/H5/H6 descendants and their content until the next H1. Folding an H3 hides its descendant H4/H5/H6 sections and content until the next H3, H2, or H1.

Toggle blocks are content and emit `<details><summary>...</summary>...</details>` only when explicitly inserted.

### HTML File Reader

V0 supports `.html` files with source mode and sandboxed preview. Scripts are disabled by default. External browser opening can be provided.

HTML artifact templates are future work.

The normal HTML preview surface should read like a document, not a debug panel. Technical sandbox/script/persistence details must remain truthful and discoverable, but they should move into an editor-grade status affordance during the final UI/UX pass.

### HTML inside Markdown vs HTML artifacts

HTML is not only standalone `.html` preview. MME distinguishes three cases:

1. Inline HTML inside Markdown (for example `<sup>`, `<kbd>` spans inside a paragraph).
2. Block HTML inside Markdown (for example a `<details>` or `<table>` block in a `.md` file).
3. Standalone `.html` artifact files opened through the HTML File Reader.

Rules:

- Raw inline and block HTML inside `.md` must always be preserved byte-for-byte in source, whether or not it is rendered.
- Unsupported or unsafe HTML must never be destroyed; it stays in the source and falls back to raw/opaque display.
- Render behavior for HTML inside Markdown is sanitized (allowlist, no script execution, diagnostics for stripped content at render time only); render output is an artifact and never mutates the persisted Markdown.
- Standalone `.html` artifacts keep the separate sandboxed-iframe preview path; the two render paths must not be conflated.
- Source mode remains the universal fallback for all three cases.
- Obsidian-like live rendering of HTML inside Markdown in the editing surface is tracked in `MME-BACKLOG`; the read-only renderer is `MME-0032`.

### Future file and document formats

Plain text and adjacent lightweight file types such as `.txt`, `.text`, `.log`, `.csv`, `.tsv`, `.json`, `.yaml`, `.yml`, and `.toml` are future source/preview candidates. Each type must define whether it is editable source, preview-only, import-to-Markdown, or adapter-specific.

Non-Markdown formats such as `.docx`, `.pptx`, Google Docs, PDF, and similar documents are future adapter/converter work. They are not V0 core behavior.

Future support must classify each format as one of:

- preview-only;
- import-to-Markdown;
- export-from-Markdown;
- editable round-trip with a real format-preserving adapter.

Any conversion that can lose layout, comments, tracked changes, speaker notes, formulas, embedded media, or other source-format semantics must expose that lossiness before overwrite/export. Never claim an imported/converted document was saved back to the original source format unless the adapter actually did that.

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

Repo-control files such as `.gitignore` are not hard-denied by default, but they are policy-sensitive. Hosts may allow read while denying write, share, export, AI sending, or indexing depending on workspace rules.

The core policy layer must not dictate UI. It returns structured decisions: allow, warn, or deny; reason; source of the rule; severity; whether the decision is overridable; and whether user confirmation is required. The host application chooses presentation: disabled action, warning toast, blocking dialog, confirmation flow, preferences page, workspace setting, admin rule, or another product-specific pattern.

Momentarise's own host should prefer user choice with clear warnings where that is safe, rather than frustrating disabled controls. Non-overridable hard-deny remains available for categories the host considers truly unsafe.

### AI writing

V0 AI is writing assistance only.

Actions: inline completion, rewrite selection, improve selection, summarize selection, change tone, turn into checklist, generate title, insert block from prompt, explain selection if cheap.

MME core exposes provider/session contracts, policy checks, and accept/reject suggestions. It must not import or depend on LiteLLM, OpenAI, Anthropic, Vercel AI SDK, browser-only fetch behavior, or provider SDKs.

Supported host patterns:

- mock provider for tests and demos;
- memory-only BYOK for local/personal demo sessions;
- host-managed backend sessions for production apps;
- local gateway for self-hosted/personal setups;
- future OpenAI-compatible provider adapter, which can point at LiteLLM.

Momentarise product should use `MME editor -> Momentarise backend -> LiteLLM -> model providers` for managed/paying AI. LiteLLM is the recommended Momentarise gateway, not an MME core dependency.

BYOK must be explicit and scoped by host. Browser-only BYOK is acceptable for demos or personal/local use only when the key stays memory-only. Production BYOK should go through a host backend, sidecar, secure storage, or user-controlled gateway.

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

The CLI is a living surface, already implemented in V0 (MME-0010) and kept updated as capabilities land: each new capability package adds or updates the relevant command and its `--json` output (for example a `render` command once `md-render-html` exists, policy/theme/preferences inspection as those contracts ship). `--json` output is an AX contract (Gate 15); breaking it is a breaking change. The CLI is in scope for the MME-0036 security pass because it reads arbitrary files, can write with `--write`, and emits machine-readable output consumed by agents.

Security is continuous, not a single late pass: Gate 9 (HTML sandbox), Gate 10 (policy before AI egress), and Gate 11 (AI writing boundary) hold from their respective slices; MME-0032 owns render sanitization; MME-0036 is the consolidated audit (URL sanitization in the rich schema, paste-handling policy, sandbox defaults, key-handling statement, CLI surface, `SECURITY.md`).

## Public framework readiness constraints

These constraints were added by the 2026-06-09 readiness review. They extend V0 toward a public, framework-agnostic, publishable framework. They do not relax any V0 non-negotiable: Markdown stays the durable source, rich/block/live editing stays a derived view, unknown syntax is preserved, source mode stays mandatory, core packages stay host-independent, AI stays assistive writing, no JSON/block database becomes the source of truth, and no provider-specific AI code enters core.

### Derived-view fidelity

- Any derived editing view (rich mode today, live preview later) must round-trip an untouched document byte-for-byte.
- Edits made in a derived view must change only the edited blocks in the persisted Markdown; unrelated source bytes are preserved.
- A derived view that cannot represent a construct must carry it as raw/opaque content, never approximate or flatten it.
- This invariant is also what keeps future collaboration adapters possible; it must not be broken for convenience.

### Headless engine and events

- The framework exposes a headless, DOM-free `MarkdownEditorSession` (`@momentarise/md-editor`) that owns canonical content, parse cache, targeted edits, save orchestration with injectable scheduling, policy hooks, and the AI suggestion controller.
- Hosts and bindings subscribe through an event API (change, save state, diagnostics, mode, selection context, destroy).
- Views (CodeMirror source, ProseMirror rich, previews) attach to a session; no host reimplements orchestration.

### Extension model

- Slash items, toolbar items, AI actions, input rules, and keybindings are registries open to host registration with namespaced ids, not closed unions.
- Custom blocks are possible through an explicit Markdown serialization contract (fenced directive, raw HTML, or opaque passthrough) and must survive round-trip untouched.
- Built-in commands register through the same public API as host extensions.

### Theming, preferences, and settings contracts

The framework must support host/developer control over theming and preferences. Six layers are deliberately separated:

1. Framework design tokens: `--mme-*` custom properties for color roles, typography, font scale, line height, radius, spacing/density, shadows, and layers, with light and dark schemes.
2. Host theme contract: a typed, deep-partial theme object resolved to tokens, an icon-set contract, per-component class-map overrides, and plain CSS as the documented last resort.
3. User preference contract: a declarative preference schema (key, type, default, scope, constraints, label key) with a pure resolver.
4. Editor behavior preferences: toolbar style, slash menu behavior, command palette behavior, block affordances, AI entry points, mode switcher style, status/save UI, folding UI, code block UI, mobile/tablet/desktop layout, keyboard shortcuts, readable line width, font scale, autosave interval, and similar keys.
5. Runtime feature flags/capabilities: host-declared facts (file system access, AI provider present, touch device, viewport class, offline) that components adapt to; they are not user choices.
6. Optional settings UI components, only if provided later, built on headless contracts.

Resolution order is framework defaults, host defaults, workspace, document (allowlisted safe subset), then user. Any higher layer can lock a key with a value and reason, and hosts declare which keys are user-visible at all.

The developer/host decides what is configurable, what is locked, what is exposed to end users, and where settings are shown. MME must not assume it owns the final settings UI. A host may expose settings through its own settings page, a modal, global app settings, workspace settings, project settings, document settings, a limited subset, or no user settings at all. In IDE hosts, keybindings may delegate entirely to the host keybinding service.

Preference locks are host governance and stay distinct from Document Access Policy capabilities, while sharing the same decision-metadata style.

Preference changes must apply at runtime without recreating the editor (CodeMirror compartments, ProseMirror plugin reconfiguration).

### Beautiful default theme

Even though theming is host-controlled, MME ships default light and dark themes good enough for a public demo and framework website: tasteful typography, polished spacing/density, serious editor feel, non-cheap toolbar/slash/menu/block affordances, accessible contrast (WCAG AA), coherent icons, and mobile/tablet/desktop quality. "Hosts can theme it later" is not an excuse for an ugly default.

### AX — Agentic Experience

AX is a first-class DX category, not a side note. MME must be readable and usable by AI agents acting as: coding agents integrating the framework, review agents checking docs/code drift, editing agents assisting inside documents, external product agents using MME APIs safely, and humans using LLMs/coding agents to understand, integrate, debug, or extend MME.

AX requirements:

- `llms.txt` and `llms-full.txt` generated from the public docs and kept in sync automatically;
- agent-readable public docs: plain CommonMark/GFM, stable heading anchors, runnable examples, raw Markdown retrievable per page;
- clear, typed API contracts with no hidden state required to use them reliably;
- machine-readable CLI outputs (`--json`) maintained as a contract;
- examples an agent can follow end-to-end;
- issue/build-log discipline preserved as agent-consumable repo history;
- safe review/apply flows (suggestions staged with explicit accept/reject, policy-gated content egress);
- public docs page actions that make pages easy to use with LLMs and coding agents (copy as Markdown, copy as prompt, open-in-chat).

AX means agent-readable docs and agent-friendly product surfaces, not bundled agent runtimes.

### Public docs site as a read-only MME showcase

- Docs source is real Markdown files in the repository under `docs/public/`.
- The public docs site renders those files through MME in read-only mode once the renderer exists; it is not a separate unrelated renderer and is not editable by default.
- Target UX: Vercel-docs-like layout; left navigation from docs sections/files; center content rendered through MME; right outline panel generated automatically from headings/subheadings, never from frontmatter; page-level copy/open actions.
- Page actions: copy page as Markdown, copy page as LLM prompt/context, copy current section where practical, copy page link, and an Open-in-chat menu targeting popular providers/agents (v0, ChatGPT, Claude, Claude Code, Codex, Gemini, Mistral, T3 Chat, Scira, Cursor, OpenClaw, Copilot-like agents) with copy-prompt fallback where reliable deep links are unavailable.
- Copied/opened prompts include the page content plus instructions: use web search if available, prefer official docs, cite sources when browsing, respect MME's Markdown-as-source constraints, do not assume JSON/block DB persistence, and separate framework-neutral guidance from host-specific integration.
- Internal page links follow the chosen MME Markdown linking convention, including wikilink or wikilink-equivalent internal links if that is the selected docs convention; link suggestions/autocomplete between pages are planned where relevant.
- Frontmatter is optional metadata only (title override, description, nav section, nav order, audience, tags, package/API relevance, llms inclusion, updated date). No page may require frontmatter to render, navigate, or produce an outline. Frontmatter is not the core AX system.
- The docs site doubles as the showcase of MME rendering quality for both humans and coding agents.

### Renderer, find/replace, and outline

- `@momentarise/md-render-html` provides safe sanitized read-only rendering in Node and browser (see HTML inside Markdown vs HTML artifacts).
- Document-level find/replace works across source and rich views and preserves unrelated source bytes on replace.
- An outline API derives the heading hierarchy (never from frontmatter) for host outline panels and the docs site right panel.

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
- Adapter Contract;
- Theming and Tokens;
- Preferences, Locks, and Settings;
- Extension Guide;
- AX Guide (docs for agents);
- `llms.txt` and `llms-full.txt` (generated).

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
14. reference editor surface is credible before adapters;
15. CLI validates fixtures and inspects files;
16. Theia adapter uses the same core.
