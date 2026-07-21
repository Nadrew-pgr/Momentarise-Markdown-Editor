# Expectations

- Mount the unique top-level `loose-bullets`, `loose-task`, and `loose-ordered` definitions as semantic editable Rich definitions.
- Preserve list-level and item-level loose semantics as package-owned ProseMirror attributes without exposing exact source metadata through rendered DOM.
- Edit second-or-later paragraphs, safe nested items, and task state while reconstructing only the bounded top-level list child.
- Preserve blank-line boundaries, standard/task hierarchy, ordered starts, definition prefix, outer indentation, line endings, unchanged definition children, and unrelated Markdown.
- Keep multiple nested lists, blockquotes, code, tables, callouts, raw HTML, nested-container definitions, duplicates, stale source, and unmappable layouts source-only.
- Keep one-step undo/redo, whole-definition helpers, identifier rename, insertion, and Save Engine truth compatible.
- Require intentionally changed output to reparse to the same semantic loose paragraph/list/task shape.
