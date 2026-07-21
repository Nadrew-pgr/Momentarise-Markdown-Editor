# Expectations

- Mount the unique top-level `quote-top`, `quote-list`, and `quote-task` definitions as semantic editable Rich definitions.
- Represent paragraph-only blockquotes with package-owned ProseMirror quote nodes at definition and safe standard/task list-item depth.
- Editing one quoted paragraph reconstructs only its bounded top-level definition child or list child and emits quoted blank lines between paragraphs.
- Preserve ordered starts, loose spacing, task state, definition prefix, outer indentation, line endings, unchanged definition children, references, unknown syntax, and unrelated Markdown.
- Keep safe callouts compatible; keep nested quotes, quote-contained lists/code/tables/raw HTML, mixed multiple-container items, and nested-container definitions source-only.
- Keep one-step undo/redo, whole-definition helpers, identifier rename, insertion, and Save Engine truth compatible.
- Require intentionally changed output to reparse to the same paragraph/blockquote/list/task hierarchy.
- Never expose exact child-source or fingerprint metadata through rendered DOM attributes.
