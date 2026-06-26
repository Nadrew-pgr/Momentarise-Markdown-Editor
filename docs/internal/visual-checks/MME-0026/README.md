# MME-0026 Runtime Preferences Visual Check

Dev server command: `npm run dev -w @momentarise/md-demo -- --host 127.0.0.1 --port 5174 --strictPort --force`

Local URL: `http://127.0.0.1:5174/`

Visual scenario: `MME_DEMO_URL=http://127.0.0.1:5174/ npm run visual:mme-0026`

Artifacts:

- `runtime-preferences-debug.png` proves the demo host can apply runtime preferences through the reference surface harness, including host overrides, user-visible allowlist behavior, workspace locks, delegated keymap mode, and the debug surface state after live reconfiguration.

Notes:

- The screenshot is intentionally a debug-host simulation, not a user-facing settings UI.
- Headless resolver tests cover the document `mme:` allowlist subset for `layout.readableLineWidth` and `stats.enabled`.
