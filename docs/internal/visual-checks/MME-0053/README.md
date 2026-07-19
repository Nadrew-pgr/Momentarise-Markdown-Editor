# MME-0053 SVG Runtime Proof

This folder stores runtime proof for standalone SVG artifact handling.

- `svg-source-opened.png` proves an imported `.svg` opens as an SVG artifact with Source and Preview only.
- `svg-sanitized-preview.png` proves the hostile SVG fixture renders through the sanitized preview path with scripts disabled and unsafe active content removed from iframe `srcdoc`.
- `svg-preview-details-open.png` proves sandbox/script/save truth stays discoverable in the preview details affordance.
- `svg-writable-source-saved.png` proves a writable SVG source edit saves source text back to the disk target, not the sanitized preview artifact.

Human review required: yes. Final product review for wording and preview chrome is queued in `docs/internal/BACKLOG.md`.
