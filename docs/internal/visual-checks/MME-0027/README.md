# MME-0027 Extension Registry Visual Check

Dev server command: `npm run dev -w @momentarise/md-demo -- --host 127.0.0.1 --port 5174 --strictPort --force`

Local URL: `http://127.0.0.1:5174/`

Visual scenario: `MME_DEMO_URL=http://127.0.0.1:5174/ npm run visual:mme-0027`

Artifacts:

- `extension-toolbar-host.png` proves a host toolbar item registered through `session.extensions` renders in the rich toolbar, and the primary toolbar uses compact glyph/icon buttons with names left to tooltip/accessibility labels.
- `extension-custom-block-inserted.png` proves the host toolbar item inserts a fenced custom block serialized through the registry.
- `extension-slash-host.png` proves a host slash item is searchable through the same registry surface as built-ins.
- `extension-slash-host-inserted.png` proves selecting the host slash item consumes the typed `/car` query and inserts at the rich selection.
- `rich-code-block-exit.png` proves a user can leave a rich code block with a double Enter instead of being trapped in the fenced block.
- `extension-ai-command-palette.png` proves a host parameterized AI action is visible in the command palette.
- `extension-ai-host-prompt.png` proves the host parameterized AI action builds the expected prompt and reaches the demo AI provider.

Notes:

- The host custom block uses a fenced directive so the Markdown formatter preserves it as opaque extension syntax.
- The visual check validates registry plumbing, not final inline AI UX. Inline prompt composition remains parked for the dedicated AI interaction issue.
