# MME-0019 Visual Verification — Rich-Mode Round-Trip Fidelity Gate

Dev server command: `npm run dev -w @momentarise/md-demo -- --host 127.0.0.1 --port 5174`

Local URL: `http://127.0.0.1:5174/`

Capture command: `npm run visual:mme-0019` (headless Chrome via CDP; the script also asserts behavior in the live browser and fails on any mismatch).

## Artifacts

- `fidelity-source-table.png` — the fidelity-check document (GFM table, strikethrough, todo) opened in source mode.
- `fidelity-rich-table-raw-block.png` — rich mode: the GFM table renders as a raw/opaque unsupported block (monospace pre, bytes intact, including the compact `| :-- | :-: | --: |` delimiter row) instead of a flattened editable paragraph; `~~struck words~~` renders with the new strikethrough mark; the todo renders as a checkbox row.
- `fidelity-rich-after-edit.png` — rich mode after running a block command on the paragraph: the table, strikethrough, and todo source lines remain byte-identical (asserted in-browser before the capture).

## In-browser assertions enforced by the script

1. After mounting rich mode with no edits, `getMarkdown()` returns the input byte-for-byte.
2. The rich editor DOM contains `pre[data-unsupported="true"]` carrying the raw table source.
3. After an edit elsewhere, the table delimiter row, strikethrough span, and todo line still appear verbatim in the serialized Markdown.
