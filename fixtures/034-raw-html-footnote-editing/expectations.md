# Expectations

- Preserve untouched raw HTML, comments, attribute quoting, whitespace, list/task hierarchy, footnote syntax, and unrelated Markdown byte-for-byte.
- Represent exactly one parser-owned block-HTML child at safe top-level, ordered-list, or task-list depth as editable inert source text in Rich mode.
- Never activate raw HTML elements, scripts, styles, URLs, event handlers, or custom elements in editor DOM.
- Render parser-owned single-line inline HTML elements as inert editable source; keep malformed, quote-contained block, mixed-container, multiple-container, duplicate, and nested-container HTML definitions opaque and source-only.
- Only intentionally changed container indentation may be normalized; keep the literal edited HTML payload intact.
- Render sanitized HTML only through existing read/live-preview policy; Rich raw-HTML editing is not HTML preview.
