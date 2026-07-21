# Expectations

- Mount the unique top-level `indent-top`, `indent-list`, and `indent-task` definitions as semantic editable Rich definitions.
- Represent parser-recognized indented code with package-owned inert ProseMirror `code_block` nodes at definition and safe standard/task list-item depth.
- Preserve untouched indentation, blank lines, internal code whitespace, ordered starts, loose spacing, task state, definition prefix, outer indentation, line endings, unchanged definition children, references, unknown syntax, and unrelated Markdown.
- Editing code text reconstructs only its bounded top-level definition child or list child and emits deterministic four-space indented code at the code-block layer.
- Keep fenced-code, safe-table, safe-callout, and inert raw-HTML source behavior compatible; keep quote-contained code, mixed multiple-container items, and nested-container definitions source-only.
- Keep one-step undo/redo, whole-definition helpers, identifier rename, insertion, and Save Engine truth compatible.
- Require intentionally changed output to reparse to the same paragraph/code/list/task hierarchy.
- Never expose exact child-source or fingerprint metadata through rendered DOM attributes and never execute code content.
