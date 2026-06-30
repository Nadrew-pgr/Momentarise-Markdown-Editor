# MME-0028 Surface Package Visual Check

Dev server command: `npm run dev -w @momentarise/md-demo -- --host 127.0.0.1 --port 5174 --strictPort --force`

Local URL: `http://127.0.0.1:5174/`

Visual scenario: `MME_DEMO_URL=http://127.0.0.1:5174/ npm run visual:mme-0028`

Artifacts:

- `surface-rich-toolbar.png` proves the extracted `@momentarise/md-surface` toolbar renders the rich toolbar with `role="toolbar"` and existing compact controls.
- `surface-command-palette-a11y.png` proves the extracted command palette opens from a visible focusable search button as a dialog with listbox active-descendant keyboard semantics.
- `surface-slash-menu-a11y.png` proves the extracted slash menu renders as a listbox after rich text input, without palette overlap or viewport clipping.
- `surface-ai-panel.png` proves the extracted AI assistant panel renders as a dialog from the toolbar entry point.
- `surface-status-popover.png` proves the extracted document status disclosure expands and reports `aria-expanded`.

Accessibility audit:

- Toolbar: `role="toolbar"` with roving tabindex in `tests/surface-components.test.mjs`.
- Command palette: visible/focusable opener, `role="dialog"`, `aria-modal`, listbox, `aria-activedescendant`, Escape/keyboard execution, and focus return in `tests/surface-components.test.mjs` and `scripts/visual-check-mme0028.mjs`.
- Slash menu: `role="listbox"` with option selection and Enter/Escape keyboard behavior in `tests/surface-components.test.mjs`; visual proof asserts the menu remains inside the viewport.
- Status popover: disclosure pattern with `aria-expanded`.
- AI panel: `role="dialog"` and keyboard-reachable session/action buttons.
