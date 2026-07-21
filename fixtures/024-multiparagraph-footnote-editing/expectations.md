# Expectations

- The unique top-level `detail` definition is editable as three plain paragraphs in Rich Mode.
- Editing one paragraph changes only that paragraph's bounded source bytes.
- The marker, blank-line separators, continuation indentation, inline Markdown, and unrelated source remain exact.
- The nested-list, nested-container, and raw-HTML definitions remain source-only.
- Duplicate, malformed, stale, or unmappable definitions remain source-only.
- Undo, redo, rename, insertion, and save truth remain compatible.
- CRLF and non-default valid continuation indentation survive an edit.
