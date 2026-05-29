# Expectations

- Preserve frontmatter-like content in body, headings, callout, table, Mermaid fence, wikilink, Markdown link, raw HTML, and inline math.
- Normalized output may standardize table spacing and trailing newlines, but must not change semantic content.
- Opaque handling is required for unsupported callout, Mermaid, wikilink, HTML, or math constructs.
- Source-only handling is acceptable for constructs not yet supported in rich mode.
- Render supported Markdown normally and render unsupported artifacts only through safe previews or preserved source.
