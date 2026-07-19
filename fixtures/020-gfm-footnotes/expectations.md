# Expectations

- Preserve GFM footnote references and definitions as Markdown source.
- Preserve duplicate and malformed footnote-like syntax with diagnostics instead of dropping content.
- Rich mode may use source-only fallback blocks for complex definitions, but no-op rich serialization must remain byte-for-byte.
- Render mode should emit stable footnote anchors and backlinks while preserving safe visible text.
- Source mode remains authoritative for complex footnote edits.
