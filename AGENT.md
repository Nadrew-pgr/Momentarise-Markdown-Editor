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

In autonomous issue-by-issue mode, once reviewer/fallback verification has accepted an issue and no human-review gate blocks it, the agent must create an issue-scoped commit before moving to the next issue. This is not optional.

If an issue is only `code-complete, human review pending`, do not call it finished. It may be committed with an explicit pending status only when the human asks for that, but it must not be treated as accepted.

Once an issue is validated/accepted and committed, push the current branch to the configured remote unless one of these is true:

- the human explicitly says not to push;
- no remote is configured;
- authentication or network access is unavailable;
- the branch contains unrelated or unreviewed changes that would be pushed accidentally;
- pushing would expose secrets, private files, or local-only artifacts.

If commit or push cannot be done, document the blocker in the final report and in `docs/internal/build-log.md`.

Commits must be issue-scoped. Do not commit unrelated dirty files, secrets, `.env` files, `node_modules`, or generated local-only artifacts.

## Fresh issue context rule

Each new implementation issue must start from a fresh context rebuild. A new agent/conversation is allowed, but not required when the human explicitly asks for autonomous issue-by-issue execution in the same session.

The implementation agent must not rely on previous conversation memory. Before each issue, including when continuing in the same session, it must rebuild context from repository documents and current repository state.

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

Before implementation, the agent must output a Pre-Issue Execution Plan:

- current issue ID and goal;
- previous issue status;
- acceptance criteria;
- gates that apply;
- expected files/packages to change;
- tests/manual checks to create first;
- reviewer/subagent plan;
- out-of-scope items;
- stop conditions.

If the Pre-Issue Execution Plan is missing or incomplete, the agent must not code.

## Sequential implementation rule

Only one implementation agent may modify production code at a time.

Execution order is defined solely by the block table in `docs/internal/ISSUES.md` under `Conversation blocks and queue order`. The physical order of `## MME-` sections in that file is arbitrary and must never be used to select the next issue. An issue whose heading is followed by a `**Status: SHIPPED**` line is finished: never re-implement it, and read it only for the acceptance criteria later issues cite.

When the human asks for autonomous issue-by-issue execution, keep going through every subsequent unblocked issue after each issue-scoped commit until a HITL gate, blocker, or uncertainty requires stopping. Do not stop at the first issue merely because it was the current starting point.

When `docs/internal/ISSUES.md` defines conversation blocks, a block boundary is a mandatory HITL stop: finish the block's last issue, commit, push, report, and stop. Never start an issue outside the assigned block, even in autonomous mode.

Do not run multiple implementation agents in parallel on separate issues unless explicit human approval is given.

Reviewer subagents are allowed in parallel because they do not implement production code. Their role is limited to review, verification, test analysis, UX screenshot review, architecture review, security review, or DX/docs review.

Reviewers are strictly read-only. A reviewer subagent must not create, modify, or delete any file, must not run git commands that change state, and must not run commands with side effects on the working tree — even to demonstrate a fix. It returns findings; the builder applies them.

This must be stated in the reviewer's own prompt, not merely assumed: every reviewer spawn begins with an explicit read-only instruction, and notes that another agent may be working in the tree concurrently. A reviewer that edits files can silently destroy the builder's uncommitted work or get its changes swept into someone else's commit — both have happened on this project.

The only exception is an explicit human instruction to a specific reviewer for a specific change.

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

### A resurrected survivor means a lost assertion, not a flaky gate

If a mutation round reports a survivor that a previous round killed, the assertion that killed it is gone. Look for a lost edit before suspecting flakiness: this has now happened twice, both times from a slice-and-replace across a line range that silently deleted neighbouring work — once in the block table, once inside a test file during the same session that added the assertions.

Never edit by replacing a line range or a computed slice. Anchor every edit on unique surrounding text, and after any multi-edit pass re-read the region and confirm every intended change is present and nothing adjacent disappeared.

### Rebuild after mutation testing, before trusting any suite

Gate scripts run against built `dist/`, not source. A mutation round leaves `dist/` in whatever state the last mutant produced, so a suite run straight after mutation can report a failure that exists only in stale build output — this has already cost one false diagnosis. Run the package build after any mutation round and before any suite run whose result you intend to report or act on.

### Rebaseline contract changes in the same commit

An issue that deliberately changes a rendered string, DOM id, class name, exported field, or default must run `npm run visual` as well as `npm test` before its commit, and update every assertion its change invalidated in that same commit. The visual suite is not inside `npm test`, which is exactly how nine stale pins survived three shipped issues unnoticed. Leaving a gate red for a later issue is quarantine, and quarantine requires the recorded reason and owning issue from the MME-0114 mechanism.

### Mutation-test every new gate

A passing test is not evidence until it has been observed to fail. This rule exists because it has been violated repeatedly and expensively: Block B3 shipped three gates that reported green while checking nothing (one silently disabled because this repository's directory name contains a space), and Block C found nine assertions that passed against knowingly broken code — including a framed-block matrix whose table case re-tested a code fence, which is exactly how a table-corruption defect escaped into a shipped attempt.

For every new or modified test, before claiming it green:

1. Break the implementation it covers, deliberately and specifically.
2. Observe the assertion fail, and record which reversion produces which failure.
3. Restore, observe it pass.

Record the reversion-to-failure table in the issue's build-log entry or its visual-checks README. An assertion that cannot be made to fail is not a test; delete it or fix it.

A mutant must be the **smallest change that would still ship**: a wrong argument, a stale variable, an inverted guard, an off-by-one, one flipped CSS property. Deleting a call or emptying a function is not a mutant — it tests only that the code runs at all, and it passes a round while the refined form of the same defect survives untouched. This rule was added at MME-0125 after a builder's round reported 6 of 6 killed and a reviewer's refined matrix got 8 survivors against 3 kills on the same code.

A mutant that survives is a finding, not a nuisance: repair the assertion so it exercises the property, then re-measure. A mutant that cannot be killed because the structure makes it equivalent is a legitimate recorded outcome — say so, and replace it with one that targets the same defect through the mechanism that actually prevents it.

Assertions must also exercise the real path: use the interaction the user performs (pointer or key event) rather than the programmatic API that bypasses the code under test, and assert on the specific element the issue introduced rather than on whatever the query happened to return.

### Reachability

A feature that exists but cannot be reached is not implemented. This project has shipped both shapes: a function written and exported with zero call sites, and a plugin that worked perfectly but lived outside the default plugin set, so every consumer got an invisible feature.

Every function, plugin, command, keybinding, or style rule an issue introduces must be reachable from the default configuration a consumer installs — the exported plugin set, the packaged stylesheet, the default keymap — and the issue must name the call site that reaches it. An export with zero call sites is a stub that looks implemented.

### Verify build-log claims against the repository

Every factual claim written into `docs/internal/build-log.md` — a file path, a count, a commit hash, a test name — must be re-read from the repository at the moment of writing. A claim written from memory is the same defect class as an assertion that cannot fail, and this project has already recorded a build-log entry citing a file its own script had deleted.

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

Third-party browser extensions inject attributes into the page before the application runs, which produces console noise that is not an application defect. A React hydration mismatch whose only difference is an injected attribute such as `cz-shortcut-listen` (ColorZilla-class) is extension noise: do not chase it, do not "fix" application code for it, and reproduce in a clean profile before treating any console error as a defect. Applying `suppressHydrationWarning` to the element receiving the injected attribute is the correct response when the noise is worth silencing.

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

Do not rely only on the implementation agent’s own review.

When an issue's execution model requires a reviewer, spawning an inspect-only reviewer subagent is mandatory, not optional. Self-review by the implementing agent is not a reviewer pass: the agent verifying its own work shares its own blind spots, which is the exact failure the reviewer protocol exists to prevent.

Fallback self-review is permitted only when the subagent capability is genuinely unavailable — the tool is absent or returns an error. The following are NOT valid reasons to fall back:

- subagents are "disabled by default" or "disabled unless the human asks" in this session;
- the reviewer would cost tokens or time;
- the implementing agent judges its own work to be low-risk or already verified.

If subagents appear disabled, the agent must stop and ask the human to enable them before proceeding. Only after the human declines or the capability genuinely fails may a fallback self-review be recorded — and the build log must then state the exact attempt made, the exact error or refusal received, and the human acknowledgement. A fallback review recorded without that evidence is an incomplete issue.

No specific review model is imposed. Use the smallest model that can review honestly: a small fast model for mechanical checks, the builder's own tier for standard code review, the builder's tier or above for preservation, security, and public-API review. See the Reviewer policy in `docs/internal/ISSUES.md`.

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
