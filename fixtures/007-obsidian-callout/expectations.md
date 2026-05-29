# Expectations

- Preserve the Obsidian callout marker, title, quoted body lines, list items, formatting, and following paragraph.
- Normalized output may standardize quote spacing but must not convert the callout to a plain quote unless explicitly requested.
- Opaque handling is acceptable if callouts are unsupported in the current parser/rich mode.
- Source-only handling is acceptable for rich mode while preserving exact Markdown source.
- Render as a callout where the host supports Obsidian-compatible callouts; otherwise render safely as a blockquote.
