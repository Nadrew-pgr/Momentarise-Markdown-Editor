# Expectations

- Mount the unique top-level `nested-bullets` and `nested-ordered` definitions as semantic editable Rich definitions.
- Represent recursively safe bullet and ordered lists with package-owned ProseMirror list nodes and preserve every representable ordered-list start value.
- Editing one deeply nested item reconstructs only its containing top-level list child and preserves unchanged definition blocks plus unrelated Markdown byte-for-byte.
- Preserve definition prefix spelling and spacing, block separators, footnote container indentation, nested hierarchy, and LF/CRLF convention.
- Mount recursively safe mixed standard/task lists as semantic Rich definitions; keep loose or multi-paragraph items, multiple nested child blocks, quotes, raw HTML, nested-container definitions, duplicates, malformed definitions, stale source, and unmappable ranges source-only.
- Keep whole-definition replacement, definition selection, insertion, identifier rename, undo/redo, and Save Engine truth compatible.
- Never expose exact child-source or fingerprint metadata through rendered DOM attributes.
