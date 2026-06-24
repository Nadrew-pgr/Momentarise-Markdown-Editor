# MME-0039 Visual Verification — Interim Demo Visual Refresh

Dev server command: `npm run dev -w @momentarise/md-demo -- --host 127.0.0.1 --port 5174`

Local URL: `http://127.0.0.1:5174/`

Capture command: `npm run visual:mme-0039`

The refreshed values are the draft defaults for the MME-0025 design-token set. Later
follow-ups also simplified demo chrome and added mobile source-mode checks.

## Artifacts

- `refresh-source-desktop.png` — restyled chrome in source mode: quiet ghost topbar with a
  single primary action, segmented mode control, pill document-status button, centered
  readable editing column.
- `refresh-open-file-unavailable.png` — real local-file open unavailable feedback: the
  primary `Open file` path does not silently import a copy or switch to export mode.
- `refresh-source-mobile.png` — 390px source-mode layout: compact header, mobile gutters
  hidden, active-line highlight removed, and no document-level horizontal overflow.
- `refresh-rich-blocks.png` — rich mode showcase: refined typography scale, premium todo
  checkboxes (checked state mutes the text), quiet "Preserved Markdown" dashed block for
  unsupported content, soft code block, sober blockquote, accent link/strikethrough tones.
- `refresh-slash-menu.png` — slash menu with the refreshed menu surface (radius, shadow,
  accent-soft selection).
- `refresh-narrow.png` — 390px-wide layout with the responsive chrome.

Note: `docs/internal/visual-checks/MME-0019/*.png` were re-captured after this refresh
(the MME-0019 capture script targets its own directory and was re-run); the behaviors
they prove — raw preserved table block, strikethrough, byte-identity assertions — are
unchanged; only the styling differs from the original captures.
