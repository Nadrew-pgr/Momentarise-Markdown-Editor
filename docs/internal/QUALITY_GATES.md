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

For UI issues, define the manual UI scenario before implementation.

For core, parser, serializer, save, and policy issues, automated tests are mandatory.

For visual polish issues, screenshots and manual/reviewer verification are mandatory.

## Gate 0.6 — Canonical build log

The canonical build log path is `docs/internal/build-log.md`.

Do not create or update a second build log elsewhere.

Every issue must append its final report to this file.

## Gate 0.62 — Backlog sources

Backlog context lives in both:

- `docs/internal/ISSUES.md`, for executable issues plus any `MME-BACKLOG` / future split candidate notes near the issue sequence;
- `docs/internal/BACKLOG.md`, for the product-level backlog and parking lot.

Before deciding that an idea is missing, deferred, or already planned, check both files.

Do not implement directly from `docs/internal/BACKLOG.md`. Promote a backlog item into `docs/internal/ISSUES.md` first with acceptance criteria, verification, visual impact, execution model, and reviewer plan.

Do not duplicate a backlog item into a new issue unless it is now actionable and scoped.

## Gate 0.64 — Commit and push discipline

A completed issue must end in an issue-scoped commit before the implementation agent starts the next issue.

An issue is completed only after:

- required tests/checks pass;
- required manual or visual verification is complete;
- reviewer/subagent verification or fallback review is documented;
- `docs/internal/build-log.md` is updated;
- required human review has accepted the issue, if applicable.

If an issue is `code-complete, human review pending`, it is not completed. It may be committed with an explicit pending status only when the human asks for that, and it must not be pushed as accepted work.

After a completed issue is human-validated/accepted and committed, push the current branch to the configured remote unless the human says not to push, no remote/auth/network is available, unrelated/unreviewed changes would be pushed, or the push would expose secrets/private files/local artifacts.

Commit and push evidence must be recorded in the final report and in `docs/internal/build-log.md`:

- commit hash, or explicit commit blocker;
- push status, or explicit push blocker.

## Gate 0.65 — Sequential issue execution

The project is built one issue at a time.

An implementation agent must not start a new issue until the previous issue has:

- passing required tests;
- completed manual verification if applicable;
- reviewer/subagent pass or documented fallback review;
- updated `docs/internal/build-log.md`;
- an issue-scoped commit, or an explicit documented commit blocker;
- clean or intentionally documented `git status`;
- pushed current branch after validation, or an explicit documented push blocker;
- human review when required by the issue.

Parallel implementation is forbidden by default.

Allowed parallel work:

- reviewer pass;
- test review;
- architecture review;
- UX screenshot review;
- security review;
- DX/docs review;
- research for a future issue, only if it does not modify production code.

Forbidden without explicit human approval:

- two agents implementing separate issues at the same time;
- two agents modifying overlapping packages;
- one agent starting the next issue while the previous issue is not accepted;
- one agent changing parser, serializer, Save Engine, policy, source mode, rich mode, or package boundaries while another implementation is active.

Reviewer subagents may run in parallel, but they must only review and report.

Reviewer report format:

- normal reviewer/subagent loop: reviewer returns findings directly, builder fixes immediately, build log summarizes;
- markdown review artifact: only for fallback self-review, external/read-only API reviewers, explicit audit/decision records, or human-requested review files.

Do not create a review `.md` just to satisfy the reviewer gate when the reviewer can interact with the implementation agent.

## Gate 0.7 — No false done

An issue is not done if one of its acceptance criteria is only implied.

Every acceptance criterion must be proven by one of:

- automated test;
- manual UI check;
- screenshot or visual artifact;
- fixture regression;
- build log evidence;
- reviewer statement.

Do not mark an issue complete just because it builds.

## Gate 0.75 — Visual impact reporting

Every issue must include a visual impact summary in its final report and in `docs/internal/build-log.md`.

The visual impact summary must state:

- editing-surface changes;
- general UI or inspector changes;
- `No visible editing or general UI changes` when the slice is internal-only.

This gate applies even when no screenshots are required.

## Gate 0.8 — UI visual verification

For every issue that creates or changes visible UI, the issue is not complete until the implementation agent has:

1. started the relevant dev server;
2. recorded the exact command used to start it;
3. recorded the local URL;
4. opened the UI in a browser or host preview;
5. executed the issue's manual UI scenario;
6. captured at least one screenshot or visual artifact;
7. saved the screenshot/artifact path in `docs/internal/build-log.md`;
8. asked a reviewer/subagent to inspect the screenshot or UI behavior when available;
9. documented whether human review is required.

The local URL used for visual verification must match the human-facing review URL. If `localhost`, `127.0.0.1`, and network aliases differ, verify the URL the human is actually using or explicitly verify both. When using `localhost`, prefer a dual-stack dev server binding such as Vite `--host ::` or explicitly verify both IPv4 and IPv6 loopback. A UI issue is not visually verified if the automated screenshot passes on one loopback alias while the human-facing browser tab shows stale or different UI.

If browser or screenshot tooling is unavailable, the issue must not be marked visually verified. It must be marked `code-complete, visual verification pending`.

Store UI screenshots and visual verification artifacts under `docs/internal/visual-checks/<issue-id>/`.

Each UI issue must include a short `README.md` in its visual-checks folder or a build-log entry explaining what each screenshot proves.

### Required UI review levels

Use human review gates for the first major visual slice of each area:

- MME-0002, first mini web demo;
- MME-0007, source editing baseline;
- MME-0008 and MME-0009, save/open real file behavior;
- MME-0011, properties UI;
- MME-0012, first rich mode;
- MME-0013, slash menu and toolbar;
- MME-0015, HTML preview;
- MME-0017, AI writing UI.

Minor UI-only changes can be reviewer-verified without human review, but only if screenshots are included.

## Gate 0.9 — Minimal, not toy

Minimal implementation is allowed. Toy implementation is forbidden.

Minimal means narrow scope with serious architecture.

Toy means superficial code that passes shallow checks while compromising the framework.

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

## Gate 4.5 — Derived-view fidelity

Added 2026-06-09. Applies to rich mode now and to any future live-preview or derived editing view.

- Mounting a derived view and serializing back without edits must return the input bytes for the full fixture corpus.
- An edit in a derived view must change only the edited blocks; unrelated source bytes survive byte-for-byte, including list markers, blank-line runs, heading styles, and emphasis characters.
- Constructs the derived view cannot represent must be carried as raw/opaque content, never flattened or approximated.
- Untouched documents must produce zero byte changes through save, copy, download, or mode switch.
- No derived-view feature work may build on a view that fails this gate.

Mandatory automated proof: a corpus-wide identity round-trip test and an edited-block preservation test.

## Gate 5 — Source editor baseline

Before rich mode, source mode must support:

- CodeMirror 6;
- undo/redo;
- `Cmd/Ctrl+Z`;
- redo with `Cmd/Ctrl+Shift+Z` or platform equivalent;
- normal newline behavior;
- normal multiline editing;
- list continuation;
- checkbox continuation;
- indentation;
- selection;
- copy/paste;
- Markdown text editing;
- `Cmd/Ctrl+S` hook;
- dirty state.

MME-0002 must prove that CodeMirror is a real source editor, not a textarea-like demo.

If auto-closing pairs are enabled, `{}`, `[]`, `()`, quotes, and backticks must behave correctly.

If auto-closing pairs are not yet enabled, this must be explicitly documented as a follow-up before source mode can be considered production-grade.

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

Reviewer verification is usually recorded in `docs/internal/build-log.md`, not as a separate file. Separate markdown reports belong to external/read-only review tooling such as `docs/internal/ai-reviews/`, fallback self-review, or explicit audit/human-requested records.

## Gate 13 — Theming and preference contracts

Added 2026-06-09. Applies once `@momentarise/md-theme` and the preference contracts exist.

- Surface components consume only design tokens, preference values, the icon-set contract, and an injected string dictionary; no hardcoded colors, fonts, spacing, shortcuts, or UI literals.
- Colors are centralised in one source of truth (`--mme-*` tokens). Every UI-touching issue consumes those tokens and introduces zero raw color/shadow/radius values; a static check rejects raw hex colors outside the token blocks.
- No standalone "UI polish" slices after the MME-0039 interim refresh: visual/UX refinement folds into the issue that owns the component (e.g. MME-0028 surface, MME-0029 affordances, MME-0030 default theme). MME-0039 was a one-time, human-directed exception and its values are absorbed by MME-0025.
- Preference resolution (framework, host, workspace, document, user) and lock/allowlist semantics are headless and unit-tested.
- MME ships no mandatory settings UI; the host decides what is configurable, locked, or exposed.
- Preference changes apply at runtime without recreating the editor.
- Contract types stay DOM-free, framework-free, and host-independent.

## Gate 14 — Publishability

Mandatory before any npm publish or public repository flip.

- View packages declare CodeMirror/ProseMirror as peer dependencies; no phantom dependencies anywhere (pnpm strict install passes).
- `npm pack` artifacts install and run in external consumer apps (vanilla Vite, Next.js) without workspace links.
- A duplicate-instance check proves single `@codemirror/state` and `prosemirror-model` instances in consumers.
- Every published package has license metadata, README, version policy, and an experimental/stable label.
- Public exports are audited and intentional; no accidental test-helper exports.
- CI runs all gates plus the consumer matrix on pull requests.

## Gate 15 — AX / agent experience

AX is a first-class DX category.

- Public docs are plain CommonMark/GFM with stable heading anchors and runnable examples; raw Markdown is retrievable per page.
- `llms.txt` and `llms-full.txt` are generated from the docs; an automated check fails when docs change without regeneration.
- CLI machine-readable output (`--json`) is treated as a contract; breaking it is a breaking change.
- Public APIs require no hidden state to use reliably; examples can be followed end-to-end by a coding agent.
- AI-assisted flows stay staged with explicit accept/reject and policy-gated content egress.

## Gate 16 — Public docs site readiness

Applies to the docs site issue and any later site change.

- Docs pages are served from the real Markdown files in `docs/public/`; no forked content.
- Center content renders through MME read-only rendering, not an unrelated renderer; the site is not editable by default.
- Left navigation and the right heading outline work on pages with and without frontmatter; the outline derives from headings, never frontmatter.
- Copy-as-Markdown, copy-as-prompt, copy-section, copy-link, and Open-in-chat actions work, with copy-prompt fallback where deep links are unreliable.
- Internal links follow the chosen Markdown linking convention and resolve on the site and inside MME.
- The site meets the accessibility baseline (keyboard operation, contrast) and remains readable by both humans and coding agents.
