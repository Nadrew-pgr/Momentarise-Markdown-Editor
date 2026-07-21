# Expectations

- Mount the unique top-level `code-top`, `code-list`, `code-task`, and now-safe `indented-code` definitions as semantic editable Rich definitions.
- Represent parser-recognized fenced code with package-owned inert ProseMirror `code_block` nodes at definition and safe standard/task list-item depth.
- Preserve untouched fence marker/length/info/body bytes, language/meta semantics, ordered starts, loose spacing, task state, definition prefix, outer indentation, line endings, unchanged definition children, references, unknown syntax, and unrelated Markdown.
- Editing code text reconstructs only its bounded top-level definition child or list child and emits a deterministic backtick/tilde fence longer than any colliding body run.
- Keep quote-contained code, mixed multiple-container items, tables, callouts, raw HTML, and nested-container definitions source-only; safe indented code is covered by MME-0067.
- Keep one-step undo/redo, whole-definition helpers, identifier rename, insertion, and Save Engine truth compatible.
- Require intentionally changed output to reparse to the same paragraph/code/list/task hierarchy.
- Never expose exact child-source or fingerprint metadata through rendered DOM attributes and never execute code content.
