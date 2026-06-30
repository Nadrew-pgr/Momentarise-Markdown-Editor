# MME-0030 Visual Checks

Default theme V1 is checked against the local demo and captured in both schemes. The visual script defaults to `http://localhost:5174/`; set `MME_DEMO_URL` when the human review URL differs.

## Artifacts

- `theme-dark-desktop.png` — dark scheme, desktop editor surface.
- `theme-dark-mobile.png` — dark scheme, 390px mobile viewport.
- `theme-dark-tablet.png` — dark scheme, 768px tablet viewport.
- `theme-dark-ide-pane.png` — dark scheme, constrained IDE-pane width.
- `theme-light-desktop.png` — light scheme, desktop editor surface.
- `theme-light-mobile.png` — light scheme, 390px mobile viewport.
- `theme-light-tablet.png` — light scheme, 768px tablet viewport.
- `theme-light-ide-pane.png` — light scheme, constrained IDE-pane width.
- `theme-dark-slash-menu.png` — dark scheme slash menu with icon, label, and alias alignment.
- `theme-light-command-palette.png` — light scheme command palette with icon and action alignment.
- `theme-dark-block-affordances.png` — dark scheme block handle focus state.
- `theme-light-preserved-markdown.png` — light scheme quiet preserved-Markdown fallback.

## Benchmark Notes

BlockNote, Notion, and Obsidian were used as visual reference only for quality targets: calm density, keyboard-readable menus, quiet block affordances, and serious editor typography. No assets, CSS, or protected styling copied.

MME keeps stronger source-truth boundaries than those references: Markdown remains durable source, unsupported syntax is preserved as Markdown, and controls must still consume MME tokens.

## Compatibility Token Audit

The CSS-only compatibility tokens carried from MME-0039 remain in `tokens.css` for this slice because the accepted demo CSS already consumes them. They stay outside the typed `MmeTheme` contract for now; public-release hardening can promote or collapse them once the public token surface is frozen.
