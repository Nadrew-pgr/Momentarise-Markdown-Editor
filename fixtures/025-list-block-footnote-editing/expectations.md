# Expectations

- Mount the unique top-level `steps`, `ordered`, and `nested-list` definitions as semantic editable Rich definitions.
- Represent safe flat and nested bullet or ordered lists with package-owned ProseMirror list nodes and preserve ordered start value `3`.
- Editing one list-item paragraph reconstructs only its bounded list child and preserves unchanged definition blocks plus unrelated Markdown byte-for-byte.
- Preserve definition prefix spelling and spacing, block separators, footnote container indentation, and LF/CRLF convention.
- Mount safe task and loose multi-paragraph lists as semantic Rich definitions; keep quotes, raw HTML, nested-container definitions, duplicates, malformed definitions, stale source, and unmappable ranges source-only.
- Keep whole-definition replacement, definition selection, insertion, identifier rename, undo/redo, and Save Engine truth compatible.
- Never expose exact child-source or fingerprint metadata through rendered DOM attributes.
