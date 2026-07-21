# Expectations

- Preserve untouched inline HTML tokens, comments, attributes, quoting, surrounding Markdown, hierarchy, line endings, and unrelated source byte-for-byte.
- Represent exact single-line parser-owned inline HTML tokens as editable inert marked text in safe top-level, multi-paragraph, list, task, quote, and callout-body footnote paragraphs.
- Never activate inline payload elements, scripts, styles, URLs, event handlers, or custom elements in editor DOM, and never copy payload bytes into wrapper attributes.
- Keep raw HTML inside emphasis/strong/strikethrough/link wrappers, multiline tokens, table-cell HTML, duplicate definitions, nested-container definitions, invalid indentation, and stale mappings opaque and source-only.
- Keep MME-0070 block raw-HTML editing compatible and reconstruct only the bounded changed paragraph or owning container child.
- Render or preview HTML only through existing sanitizer/sandbox policy; Rich inline-HTML editing is literal source editing, not HTML execution.
