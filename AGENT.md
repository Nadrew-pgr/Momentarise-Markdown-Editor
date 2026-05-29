# AGENT.md — Mandatory Build Instructions

## Mission

Build **Momentarise Markdown Editor**, a production-oriented Markdown-native framework.

This is a restart from zero. The repository starts with docs only. Do not reuse disposable implementation choices from previous attempts.

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
2. `Tests run:`
3. `Manual verification:`
4. `Reviewer pass:`
5. `Build log updated:`
6. `Suggested commit message:`
7. `Next issue:`

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

## Reviewer protocol

Use reviewer subagents when available. This is a build-process rule, not a product feature.

Required reviewer roles by issue type:

- Architecture Reviewer: package boundaries, host independence, public contracts.
- Test Reviewer: fixtures, round-trip tests, save engine, edited-range behavior.
- UX Reviewer: source editing baseline, demo clarity, real-file persistence, editor behavior.
- Security Reviewer: HTML sandbox, Document Access Policy, BYOK keys.
- DX Reviewer: exports, CLI, docs, examples, naming.

Do not rely only on the implementation agent’s own review. If subagents are unavailable, record that in `docs/internal/build-log.md` and label the review as fallback verification.

## Build log

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
- suggested commit message.

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
