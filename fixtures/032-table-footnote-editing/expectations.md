# Expectations

- Mount the unique top-level `table-top`, `table-list`, `table-task`, and `table-wide` definitions as semantic editable Rich definitions.
- Reuse package-owned ProseMirror table/row/header/cell nodes plus existing selection and keyboard navigation at definition and safe standard/task list-item depth.
- Preserve untouched table bytes, alignments, marked/escaped cell content, ordered starts, loose spacing, task state, definition prefix, outer indentation, line endings, unchanged definition children, references, unknown syntax, and unrelated Markdown.
- Editing a cell reconstructs only its bounded top-level definition child or list child and emits deterministic valid rectangular GFM Markdown.
- Keep fenced/indented code, safe-callout, and inert raw-HTML source behavior compatible; keep quote-contained tables, mixed multiple-container items, unsafe cells, and nested-container definitions source-only.
- Keep one-step undo/redo, whole-definition helpers, identifier rename, insertion, and Save Engine truth compatible.
- Require intentionally changed output to reparse to the same paragraph/table/list/task hierarchy.
- Never expose exact child-source or fingerprint metadata through rendered DOM attributes and never activate unsafe fallback content.
- Keep the eight-column table horizontally reachable inside the constrained editor without page-level overflow.
