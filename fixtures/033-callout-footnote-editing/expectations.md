# Expectations

- Preserve the full input byte-for-byte when Rich mode mounts without edits.
- Mount safe paragraph-only Obsidian callouts as semantic labelled Rich callout nodes at top-level definition and safe standard/task-list depth.
- Keep callout type, optional title, and optional `+`/`-` fold marker in package-owned semantic attributes while exposing only body paragraphs as editable content.
- Edit one body paragraph through bounded callout or containing-list reconstruction while preserving unrelated Markdown, definition prefix, indentation, ordered/task/loose state, LF/CRLF, unchanged sibling children, inline marks, and unknown syntax.
- Keep existing plain blockquotes, fenced/indented code, tables, definition selection/replacement, insertion, identifier rename, history, and Save Engine behavior compatible.
- Keep marker-only, malformed type/fold, nested callout/quote, list/raw-HTML body, mixed-container, duplicate, nested-container, unsafe, stale, invalid-indent, and unmappable definitions whole source-only.
- Never expose exact source/fingerprint metadata in rendered DOM or activate unsafe HTML.
