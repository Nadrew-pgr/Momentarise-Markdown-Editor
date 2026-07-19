# MME-0045 Visual Checks

Toolbar, slash menu, selection bubble, and mode-control UX is checked against the local demo.

## Artifacts

- `slash-fuzzy-grouped-desktop.png` — desktop Rich mode with fuzzy slash query, grouped sections, focusable listbox ownership, and active-descendant state.
- `slash-ai-entrypoints-desktop.png` — slash menu exposing AI entry-point commands from the registry/action contract.
- `toolbar-active-disabled-desktop.png` — desktop Rich mode with command toolbar and selection bubble visible.
- `mode-control-single-toggle.png` — host preference switches mode control to single-toggle without exposing unavailable document-kind modes.
- `command-surfaces-constrained.png` — constrained viewport keeps command surfaces and topbar controls reachable.
- `command-surfaces-mobile.png` — mobile-width viewport keeps topbar controls, mode control, selection bubble, and slash menu horizontally and vertically reachable.
- `command-surfaces-after-external-apply.png` — clean external file apply closes stale slash and selection-bubble overlays after editor remount/update.

## Command

`npm run visual:mme-0045`
