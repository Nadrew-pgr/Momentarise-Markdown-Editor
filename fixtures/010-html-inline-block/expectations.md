# Expectations

- Preserve inline HTML, block HTML, attributes, nested tags, disabled button state, and following Markdown.
- Normalized output must not parse and rewrite raw HTML unless an explicit HTML formatter is selected.
- Opaque handling is acceptable for block HTML and inline HTML if the Markdown model cannot represent it safely.
- Source-only handling is acceptable in rich mode; raw HTML must remain available in source mode.
- Render inline HTML and sandbox preview output safely where supported.
