# Expectations

- Mount the unique top-level `task-flat`, `task-nested`, and `task-ordered` definitions as semantic editable Rich definitions.
- Represent checked and unchecked items with package-owned accessible `todo_item` nodes inside safe flat, nested, mixed, bullet, and ordered hierarchies.
- Editing one deepest task paragraph or toggling one task state reconstructs only its containing top-level list child.
- Preserve unchanged definition children, references, unknown syntax, ordered start values, prefix spacing, container indentation, line endings, and unrelated Markdown byte-for-byte.
- Keep loose or multi-paragraph items, multiple nested children, quotes, unsafe content, and nested-container definitions source-only.
- Keep insertion, selection, replacement, rename, one-step undo/redo, and Save Engine truth compatible.
- Never expose exact child-source or fingerprint metadata through rendered DOM attributes.
