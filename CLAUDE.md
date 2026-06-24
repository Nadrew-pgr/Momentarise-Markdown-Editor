# Claude Instructions for Momentarise Markdown Editor

This repository uses `AGENT.md` as the canonical agent instruction file.

These instructions are a short handoff for Claude Code / terminal-based Claude agents. They do not replace the repository docs.

## Required Context Rebuild

Before reviewing or editing anything, read in order:

1. `AGENT.md`
2. `README.md`
3. `docs/internal/PRD.md`
4. `docs/internal/QUALITY_GATES.md`
5. `docs/internal/ISSUES.md`
6. `docs/internal/BACKLOG.md`
7. the latest relevant entries in `docs/internal/build-log.md`
8. `git status --short`
9. the files related to the current issue

Do not rely on chat memory. Rebuild context from the repository.

## Implementation Workflow

Implement exactly one issue/slice at a time.

Before coding, output a Slice Start Brief:

- current issue ID and goal;
- previous issue status;
- acceptance criteria;
- gates that apply;
- expected files/packages to change;
- tests/manual checks to create first;
- reviewer/subagent plan;
- out-of-scope items;
- stop conditions.

If the brief is missing or incomplete, do not code.

For behavior changes, use test-first/TDD:

1. Add or identify the failing test/fixture/manual check.
2. Confirm it fails or documents the missing behavior.
3. Implement the smallest serious solution.
4. Run the check again.
5. Run reviewer/subagent verification when available.
6. Update `docs/internal/build-log.md`.
7. Commit the completed issue before starting another issue.
8. Push the committed issue after human validation/acceptance unless a documented blocker applies.

## Hard Rules

- one implementation issue at a time;
- no parallel implementation without explicit human approval;
- test-first for behavior changes;
- visual verification for UI changes;
- no false done;
- no toy implementations;
- never log or commit API keys;
- commit every completed issue before starting the next issue;
- push after human validation/acceptance when a remote is configured and no blocker applies;
- reviewers/subagents review only unless explicitly asked to implement;
- do not continue to the next issue unless the human explicitly asks for autonomous issue-by-issue execution and the continuation gates below are satisfied;
- do not mark an issue done unless every acceptance criterion has evidence.

## Current Issue Selection

Do not treat this file as the source of truth for the current issue number.

Determine the next issue from:

- `README.md`;
- `docs/internal/ISSUES.md`;
- the latest relevant entries in `docs/internal/build-log.md`;
- current `git status`;
- the human's latest instruction.

If those sources conflict, stop and ask for clarification.

If an issue says human review is required, do not mark it complete or move past it without the human decision recorded in `docs/internal/build-log.md`.

## Autonomous Issue-By-Issue Mode

If the human explicitly asks you to continue autonomously, you may continue to the next issue only when all of these are true:

- every acceptance criterion for the current issue is proven;
- required tests pass;
- required visual verification passes when the issue changes visible UI;
- reviewer/subagent verification is complete, or fallback review is documented;
- `docs/internal/build-log.md` is updated;
- `git status` is clean or intentionally documented;
- the completed issue has an issue-scoped commit, or an explicit commit blocker is documented;
- the committed issue has been pushed after validation, or an explicit push blocker is documented;
- the current issue does not require human review;
- the next issue is not blocked by product, architecture, security, licensing, privacy, analytics, billing, provider-policy, or public-release decisions;
- no blocker or uncertainty remains.

Stop and ask the human if any of those conditions fail.

Do not start:

- adapter work before the docs allow it;
- public release work before publishability gates allow it;
- unrelated UI polish;
- paid features, tracking, SaaS, billing, privacy/GDPR, or commercial work unless a dedicated issue and human decision authorize it.

For preservation issues, be especially strict:

- no silent Markdown corruption;
- no full-document normalization presented as preservation;
- unsupported rich nodes must preserve raw/opaque source, never flatten into approximate paragraphs;
- do not weaken fixtures or skip failing fixture classes to pass tests.

## Final Report Requirements

After implementation, report:

- what changed;
- visual impact;
- tests run;
- manual verification;
- reviewer pass;
- build log updated;
- commit hash or explicit commit blocker;
- push status or explicit push blocker;
- next issue;
- blockers or open questions.
