# AGENT.md — Mandatory Build Instructions

## Mission

Build **Momentarise Markdown Editor**, a production-oriented Markdown-native framework.

This repository was restarted from zero with a docs-first process. Current implementation status is tracked in `README.md` and `docs/internal/build-log.md`.

Do not reuse disposable implementation choices from previous attempts.

## Global objective

Construct a real Markdown-native framework of production quality, not a demo.

The implementation may be minimal, but the architecture must never be disposable.

Each slice must advance a framework that is reusable, testable, documented, host-independent, and safe for real user files.

Do not satisfy an issue with a toy implementation if that implementation weakens the framework.

If a shortcut compromises the framework, stop and ask for clarification.

## Repository organization

Keep `README.md` and `AGENT.md` at the repository root.

Publishable documentation belongs in `docs/public/`.

Internal product, planning, quality, issue, and build-process documents belong in `docs/internal/`.

The default public documentation boundary is `README.md` plus `docs/public/`. Do not publish `docs/internal/` unless that decision is explicit.

## Backlog governance

Backlog context lives in both places:

- `docs/internal/ISSUES.md` contains the executable issue queue and may also contain `MME-BACKLOG` / future split candidate notes near the issue sequence.
- `docs/internal/BACKLOG.md` is the product-level backlog and parking lot for must-have editor hygiene, product differentiators, future adapters, research, and maybe-later ideas.

Do not treat `docs/internal/BACKLOG.md` as a second active issue tracker.

When a backlog item becomes implementation-ready, promote it into `docs/internal/ISSUES.md` with normal issue structure, acceptance criteria, test/manual verification, visual impact, execution model, and reviewer plan.

When doing planning or checking whether an idea is already captured, inspect both `docs/internal/ISSUES.md` and `docs/internal/BACKLOG.md`.

## Non-negotiable truths

- Markdown plus YAML frontmatter is the canonical persisted source.
- Rich editing is a derived view.
- HTML is an artifact/preview format, not the durable source.
- Raw/source fallback is mandatory.
- Unknown syntax must not be silently destroyed.
- Source mode must use CodeMirror 6 in V0.
- Source mode must support normal editor behavior: undo/redo, newline, selection, indentation, list continuation, bracket/quote/backtick pairing where appropriate.
- A textarea is not acceptable as V0 source mode.
- Parser/serializer must be framework-grade before rich mode.
- A handwritten Markdown parser is not acceptable as the long-term V0 parser foundation unless explicitly approved after a documented technical reason.
- Rich mode must not begin before AST and edited-range preservation gates pass.
- ProseMirror is the first rich-mode spike, not an irreversible decision.
- The mini web demo is mandatory and must prove host independence from Theia.
- Theia is an adapter/client, not the core.
- Save status must reflect actual persistence, not internal state only.
- `saved` is not allowed unless the target was actually saved or the UI explicitly says `memory saved`, `download generated`, or `not persisted`.
- HTML preview must be sandboxed.
- AI writing must not bypass Document Access Policy.
- BYOK keys must never be logged.

## V0 forbidden scope

Do not implement in V0:

- Momentarise Workbench;
- SaaS/cloud sync;
- Mission Control;
- calendar;
- RAG or agentic RAG;
- long-running agents;
- user-facing subagents;
- browser agent;
- OpenClaw/Codex/Claude runtime integration;
- Notion database system;
- production collaboration/CRDT;
- managed AI billing;
- full mobile rich editor;
- desktop standalone app;
- advanced HTML artifact templates.

Mention them only as future constraints where necessary.

## Required issue protocol

Each issue is implemented as a single controlled slice.

Before implementing an issue, output:

1. `Issue selected:`
2. `Acceptance criteria I will satisfy:`
3. `Implementation constraints:`
4. `Files I expect to create/change:`
5. `Tests/manual checks I will run:`
6. `Out of scope I will avoid:`
7. `Stop conditions:`

After implementation, output:

1. `What changed:`
2. `Visual impact:`
3. `Tests run:`
4. `Manual verification:`
5. `Reviewer pass:`
6. `Build log updated:`
7. `Commit created:`
8. `Push status:`
9. `Next issue:`

## Commit and push discipline

A finished issue must be committed before starting the next issue.

An issue is finished only when all required tests/checks pass, the build log is updated, reviewer/fallback verification is complete, and any required human review has accepted the issue.

If an issue is only `code-complete, human review pending`, do not call it finished. It may be committed with an explicit pending status only when the human asks for that, but it must not be treated as accepted.

Once an issue is validated/accepted and committed, push the current branch to the configured remote unless one of these is true:

- the human explicitly says not to push;
- no remote is configured;
- authentication or network access is unavailable;
- the branch contains unrelated or unreviewed changes that would be pushed accidentally;
- pushing would expose secrets, private files, or local-only artifacts.

If commit or push cannot be done, document the blocker in the final report and in `docs/internal/build-log.md`.

Commits must be issue-scoped. Do not commit unrelated dirty files, secrets, `.env` files, `node_modules`, or generated local-only artifacts.

## Fresh issue agent rule

Each new implementation issue must be handled by one fresh implementation agent or conversation unless the human explicitly continues the same conversation for that issue.

The fresh implementation agent must not rely on previous conversation memory. It must rebuild context from repository documents and current repository state.

Before coding, the agent must read, in this order:

1. `AGENT.md`
2. `README.md`
3. `docs/internal/PRD.md`
4. `docs/internal/QUALITY_GATES.md`
5. `docs/internal/ISSUES.md`
6. `docs/internal/BACKLOG.md`
7. the latest relevant entries in `docs/internal/build-log.md`
8. the current `git status`
9. the files related to the current issue

Before implementation, the agent must output a Slice Start Brief:

- current issue ID and goal;
- previous issue status;
- acceptance criteria;
- gates that apply;
- expected files/packages to change;
- tests/manual checks to create first;
- reviewer/subagent plan;
- out-of-scope items;
- stop conditions.

If the Slice Start Brief is missing or incomplete, the agent must not code.

## Sequential implementation rule

Only one implementation agent may modify production code at a time.

Do not run multiple implementation agents in parallel on separate issues unless explicit human approval is given.

Reviewer subagents are allowed in parallel because they do not implement production code. Their role is limited to review, verification, test analysis, UX screenshot review, architecture review, security review, or DX/docs review.

A reviewer subagent must not modify source code unless explicitly asked by the human.

## Build method

### Test-Driven Development rule

For every implementation issue that changes framework behavior, write or update the test or verification first, before implementing the feature.

The implementation agent must not start by coding the feature unless the issue is documentation-only or pure repository bootstrap.

For each issue, before implementation, output:

- what behavior must be proven;
- which automated test will fail before implementation;
- which manual UI check will prove the behavior if automated testing is not realistic yet;
- which fixture or real file will be used;
- which reviewer/subagent will verify the result.

Required testing by area:

- Parser, serializer, round-trip, opaque nodes, policy, Save Engine, sidecar, hashing, and conflict detection: automated tests are mandatory.
- Source mode, CodeMirror behavior, local file open/save, properties UI, rich mode, slash menu, and toolbar: automated tests when practical, plus manual UI verification.
- Demo-only UI polish: manual verification is acceptable, but it must be documented.
- Documentation-only issues: no TDD required, but acceptance criteria and file checks are required.

A slice is not complete if it only looks implemented. It is complete only when its tests or manual verification prove the acceptance criteria.

Do not satisfy an issue with a toy implementation that passes superficial checks but violates the framework goal. If the issue cannot be tested honestly, stop and ask for clarification.

### No false done

An issue is not done if one of its acceptance criteria is only implied.

Every acceptance criterion must be proven by one of:

- automated test;
- manual UI check;
- screenshot or visual artifact;
- fixture regression;
- build log evidence;
- reviewer statement.

Do not mark an issue complete just because it builds.

### Visual impact summary

Every completed issue must report its visible impact, even when the issue is not a UI issue.

In the final issue report and build log, explicitly state:

- what changed visually in the editing surface;
- what changed visually in the general UI or inspector;
- what did not change visually, if the slice is internal-only.

If there is no visible change, write `No visible editing or general UI changes`.

This is separate from the UI visual verification gate. UI issues still require screenshots and visual verification artifacts.

### Minimal, not toy

Minimal implementation is allowed. Toy implementation is forbidden.

Minimal means narrow scope with serious architecture.

Toy means superficial code that passes shallow checks while compromising the framework.

### UI visual verification

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

The local URL used for visual verification must be the same URL the human reviewer is expected to open. If `localhost`, `127.0.0.1`, and host-network aliases are all available, verify the human-facing URL or verify both aliases. When using `localhost`, prefer a dual-stack dev server binding such as Vite `--host ::` or explicitly verify both IPv4 and IPv6 loopback. Do not mark the issue visually verified when screenshots pass on one loopback alias but the human-facing browser tab still shows stale or different UI.

If browser or screenshot tooling is unavailable, the issue must not be marked visually verified. It must be marked `code-complete, visual verification pending`.

Store UI screenshots and visual verification artifacts under `docs/internal/visual-checks/<issue-id>/`.

Each UI issue must include a short `README.md` in its visual-checks folder or a build-log entry explaining what each screenshot proves.

### Human-facing editor baseline

Any user-facing editor surface must satisfy basic editor expectations before it can be called usable:

- undo/redo;
- multiline editing;
- selection;
- copy/paste;
- keyboard shortcuts;
- no accidental data loss;
- honest save state;
- no UI reload on save;
- no silent Markdown rewrite.

After MME-0002, stop for human review before moving to the next UI-heavy issue. The implementation agent may continue only if the human explicitly approves the mini web demo direction.

## Reviewer protocol

Use reviewer subagents when available. This is a build-process rule, not a product feature.

Required reviewer roles by issue type:

- Architecture Reviewer: package boundaries, host independence, public contracts.
- Test Reviewer: fixtures, round-trip tests, save engine, edited-range behavior.
- UX Reviewer: source editing baseline, demo clarity, real-file persistence, editor behavior.
- Security Reviewer: HTML sandbox, Document Access Policy, BYOK keys.
- DX Reviewer: exports, CLI, docs, examples, naming.

Do not rely only on the implementation agent’s own review. If subagents are unavailable, record that in `docs/internal/build-log.md` and label the review as fallback verification.

Normal reviewer loop:

1. builder implements;
2. reviewer inspects;
3. reviewer returns findings directly;
4. builder fixes immediately;
5. build log summarizes reviewer used, findings fixed, residual risks and human-review status.

Do not create a review `.md` just because a reviewer was used. Persist a markdown review only for fallback self-review, external/read-only API reviewers, explicit audit/decision records, or when the human asks.

## Build log

The canonical build log path is `docs/internal/build-log.md`.

Do not create or update a second build log elsewhere.

Create and maintain `docs/internal/build-log.md`.

For every issue append:

- issue ID;
- timestamp;
- summary;
- files changed;
- tests run;
- manual verification;
- reviewer/subagent used and result;
- deviations from PRD;
- open questions;
- commit hash or explicit commit blocker;
- push status or explicit push blocker.

## Stop conditions

Stop for human review if:

- the issue conflicts with the PRD;
- a dependency choice changes architecture;
- a solution would be demo-only;
- parser/serializer cannot preserve unknown syntax;
- real file persistence cannot be proven;
- source editor lacks mandatory editing behavior;
- rich mode would begin before gates pass;
- AI access policy is unclear;
- secrets/private files are encountered;
- a scope expansion is required.

## Dependency policy

For Markdown parsing, prefer a real Markdown AST foundation such as micromark, remark, unified/mdast, or a documented equivalent. The public Momentarise model must remain independent of third-party AST types.

For source editing, use CodeMirror 6.

For rich-mode spike, use ProseMirror first unless a documented blocker appears.

For CLI and tests, choose boring, stable tools.

## Final guardrail

If a pretty UI hides Markdown corruption, choose preservation and tests first.

If a feature makes the core depend on Theia, reject it or move it to an adapter.

If a feature turns AI writing into workspace agency, move it to future Momentarise Workbench.
