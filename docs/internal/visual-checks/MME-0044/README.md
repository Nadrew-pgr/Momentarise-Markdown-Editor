# MME-0044 Visual Checks

Script: `npm run visual:mme-0044`

Expected artifacts:

- `status-chrome-initial.png` proves the topbar exposes New, a single Open file action, Save As, and compact status chrome.
- `open-markdown-imported-copy.png` proves fallback Markdown import stays download/export-required.
- `open-html-source-preview-only.png` proves standalone HTML artifacts route through the unified open path and expose Source/Preview only.
- `new-file-writable-target.png` proves New file can become a writable disk target.
- `save-as-writable-target.png` proves Save As updates the active filename and future Save/autosave target.
- `conflict-actions-explicit.png` proves dirty external conflicts expose reload external, download local copy, and retry save without a vague dismiss action.
