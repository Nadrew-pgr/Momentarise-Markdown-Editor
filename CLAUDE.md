# Claude Instructions for Momentarise Markdown Editor

This repository uses `AGENT.md` as the canonical agent instruction file.

Before reviewing or editing anything, read in order:

1. `AGENT.md`
2. `README.md`
3. `docs/internal/PRD.md`
4. `docs/internal/QUALITY_GATES.md`
5. `docs/internal/ISSUES.md`
6. the latest relevant entries in `docs/internal/build-log.md`
7. `git status --short`

Follow the project rules:

- one implementation issue at a time;
- no parallel implementation without explicit human approval;
- test-first for behavior changes;
- visual verification for UI changes;
- no false done;
- no toy implementations;
- never log or commit API keys;
- do not start `MME-0019` until `MME-0018` is accepted or redirected by the human.

For review-only Claude Fable 5 API usage, run:

```sh
npm run ai:review:claude
```

For a dry run without API access:

```sh
npm run ai:review:dry-run
```

The Claude reviewer CLI is internal build tooling, not product AI. Product AI must stay behind host/provider contracts such as `@momentarise/md-ai`.
