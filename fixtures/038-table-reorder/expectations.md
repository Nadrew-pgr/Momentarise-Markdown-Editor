# Expectations

- Expose reusable arbitrary-index body-row and column reorder APIs plus adjacent Rich command-registry entries.
- Protect the semantic header row and refuse invalid, stale, source-only, outside-table, boundary, and no-op targets without mutation or exceptions.
- Preserve untouched Markdown byte-for-byte and keep bytes outside a changed table exact.
- Preserve rectangular shape, semantic header/body cells, column alignment, inline Markdown, and moved-cell selection.
- Preserve top-level and direct/list/task footnote hierarchy, indentation, prefixes, ordered starts, task state, loose state, and LF/CRLF convention.
- Keep reorder compatible with row/column insert-delete, cell navigation, final-cell Tab append, one-step undo/redo, and truthful Save Engine persistence.
- Expose accessible context-aware adjacent move commands without putting ProseMirror mutation logic in the demo.
