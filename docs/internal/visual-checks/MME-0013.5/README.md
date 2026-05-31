# MME-0013.5 visual verification

Command:

```sh
MME_DEMO_URL=http://localhost:5174/ npm run visual:mme-0013.5
```

Expected dev server:

```sh
npm run dev -w @momentarise/md-demo -- --host :: --port 5174 --strictPort
```

Artifacts:

- `rich-heading-live-input-rule.png` proves typing `# Reco` in Rich mode renders a heading without switching modes.
- `rich-todo-live-input-rule.png` proves typing `- [ ] Task` in Rich mode renders a todo checkbox row.
- `rich-todo-toggled.png` proves toggling the checkbox updates Markdown task syntax.
- `rich-code-controls.png` proves code block language/meta controls are visible and update the fence info string.
- `rich-paragraph-after-code.png` proves content can be inserted after the final code block and still passes parser/serializer checks.

Additional scripted assertions:

- Adjacent todo rows are loaded and the second checkbox toggles the second task without changing the first.
- Code fence creation uses the normal ` ```ts` + Enter flow before typing code content.

Human review:

- Required before accepting this UI/UX slice.
