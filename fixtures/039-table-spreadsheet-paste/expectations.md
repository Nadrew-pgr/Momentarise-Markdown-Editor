# Expectations

- Expose reusable strict rectangular spreadsheet/TSV paste for supported Rich Markdown tables.
- Preserve pasted values as literal text instead of interpreting Markdown, HTML, links, footnotes, or executable payload syntax.
- Reject malformed, unsafe-control, oversized, stale, source-only, outside-table, and invalid-coordinate input without mutation.
- Preserve untouched Markdown byte-for-byte and keep bytes outside a changed table exact.
- Expand right and down with semantic header/body cells, neutral new-column alignment, final-cell selection, and one-step undo/redo.
- Preserve top-level and direct/list/task footnote hierarchy, indentation, prefixes, ordered starts, task state, loose state, sibling syntax, and LF/CRLF convention.
- Keep ordinary text, sanitized HTML, and image paste on their existing paths; only accepted table matrices prevent default.
- Keep existing table edit, navigation, row/column operation, reorder, and truthful Save Engine behavior compatible.
