# Claude Framework Reviewer

This is internal build tooling, not product AI.

Use it to ask Claude Fable 5 to review Momentarise Markdown Editor against the repository docs, current diff, and selected implementation files.

## Setup

Create a local ignored env file:

```sh
cp .env.example .env.local
```

Then set:

```sh
ANTHROPIC_API_KEY=your_key_here
CLAUDE_REVIEW_MODEL=claude-fable-5
```

Never commit `.env.local`, `.env`, API keys, raw request dumps, or provider logs.

## Commands

Dry-run without calling the API:

```sh
npm run ai:review:dry-run
```

Run the review:

```sh
npm run ai:review:claude
```

Add a focused instruction:

```sh
npm run ai:review:claude -- --focus "Review MME-0018 against BlockNote/Tiptap/Notion-level editor expectations."
```

Reports are written under `docs/internal/ai-reviews/`. Generated reports are ignored by Git by default.

## What Claude receives

The script sends a controlled context packet:

- core build instructions;
- PRD, quality gates, issues, README;
- latest build-log tail;
- current `git status`;
- current `git diff`;
- selected source files relevant to the active editor/AI surface.

The script does not send `.env`, `.env.local`, `node_modules`, `dist`, generated AI review outputs, or arbitrary private files.

## Expected review shape

Claude should return:

- P0/P1/P2 findings;
- docs/code/vision gaps;
- architecture risks;
- UX/editor-quality gaps versus BlockNote, Tiptap, Notion, and Obsidian-class expectations;
- tests and visual verification gaps;
- concrete correction plan;
- suggested issue/backlog entries.

## Terminal access boundary

The direct Anthropic Messages API does not grant terminal access by itself.

This reviewer only reads local files, sends a review request, and writes a markdown report. Any code change must still be applied by the implementation agent or by a future explicit tool-running agent with separate permissions, logs, and patch review.
