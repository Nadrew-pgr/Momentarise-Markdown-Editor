# Expectations

- Preserve untouched Markdown bytes, reference spelling, and unrelated source exactly.
- Render the unique single-line safe definition as editable rich content.
- Render direct inline HTML as inert editable source; keep nested-container, duplicate, malformed, and unsupported definitions opaque and source-only.
- Expose safe continuation and plain multi-paragraph definitions as editable rich footnotes.
- Normalize only the explicitly edited simple definition body into valid GFM Markdown.
- Keep Source mode available as the exact fallback for every unsupported definition.
