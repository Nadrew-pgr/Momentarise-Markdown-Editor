# MME-0018 Visual Checks

Expected artifacts:

- `reference-surface-desktop.png` proves the editor-first desktop shell, discreet status affordance, and demoted debug inspector.
- `reference-surface-command-palette.png` proves command-palette-style AI entry is present.
- `reference-surface-selected-ai.png` proves selected-text AI opens a user-facing review panel outside technical diagnostics.
- `reference-surface-rich-ai.png` proves rich mode still exposes toolbar/slash-capable editing and AI actions from editor-native chrome.
- `reference-surface-slash-ai.png` proves slash-menu AI actions are discoverable.
- `reference-surface-narrow.png` proves the surface remains usable in a narrow mobile-like viewport.
- `reference-surface-tablet.png` proves the surface remains usable in a tablet viewport.
- `reference-surface-ide-constrained.png` proves the surface remains usable in a constrained IDE-like viewport.
- `reference-surface-html-preview.png` proves HTML artifact preview uses the same compact mode/status surface.

Current run:

- `reference-surface-desktop.png` was captured through the in-app browser on `http://127.0.0.1:5174/`.
- `reference-surface-rich-ai.png` was captured through the in-app browser after switching to Rich mode and opening the editor AI menu.
- `reference-surface-narrow.png` was captured through the in-app browser with a 390px viewport override.
- `reference-surface-html-preview.png` and the deeper scripted interaction captures are produced by `npm run visual:mme-0018` when headless Chrome/CDP is available.
- In this environment, `npm run visual:mme-0018` could not start headless Chrome/CDP; Chrome exited with `SIGABRT` before CDP became available. Browser-integrated captures were produced for the available states.

Human review is required before accepting this first reference editor surface direction.
