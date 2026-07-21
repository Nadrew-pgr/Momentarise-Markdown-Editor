# Expectations

- Mount the unique top-level single-paragraph continuation definition as one editable semantic Rich definition.
- Preserve its identifier, first-line prefix, four-space continuation indentation, marks, links, and line endings.
- Expose plain blank-line multi-paragraph definitions as editable rich footnotes.
- Render direct inline HTML as inert editable source; keep nested-container, duplicate, malformed, and unmappable definitions source-only.
- Rewrite only the edited definition source range; preserve neighboring and unknown syntax byte-for-byte.
- Keep insertion, identifier rename, undo/redo, Source mode, and Save Engine truth compatible.
