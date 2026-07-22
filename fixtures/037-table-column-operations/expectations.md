# Expectations

- Expose reusable column insert-before, insert-after, and delete APIs plus Rich command-registry entries.
- Refuse missing, stale, source-only, malformed, outside-table, invalid-coordinate, and final-column deletion targets without mutation.
- Preserve untouched Markdown byte-for-byte and keep bytes outside a changed table exact.
- Keep inserted columns rectangular with semantic header/body cells, neutral alignment, and predictable current-row selection.
- Preserve top-level and direct/list/task footnote hierarchy, indentation, prefixes, ordered starts, task state, loose state, inline Markdown, and LF/CRLF convention.
- Keep column actions compatible with row actions, cell navigation, final-cell Tab append, one-step undo/redo, and truthful Save Engine persistence.
- Expose accessible context-aware command entries without putting table mutation logic in the demo.
