# Expectations

- Expose reusable body-row insert-before, insert-after, and delete APIs plus Rich command-registry entries.
- Protect the semantic header row from insertion/deletion and refuse missing, stale, source-only, malformed, and outside-table targets without mutation.
- Preserve untouched Markdown byte-for-byte and keep bytes outside a changed table exact.
- Keep inserted rows rectangular body rows with header-derived alignment and predictable selection.
- Preserve top-level and direct/list/task footnote hierarchy, indentation, prefixes, ordered starts, task state, loose state, inline Markdown, and LF/CRLF convention.
- Keep explicit row actions and final-cell Tab append compatible with one-step undo/redo and truthful Save Engine persistence.
- Expose accessible context-aware command entries without putting table mutation logic in the demo.
