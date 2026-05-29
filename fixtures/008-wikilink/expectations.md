# Expectations

- Preserve wikilink targets, aliases, folder-like paths, brackets, and surrounding list structure.
- Normalized output must not convert wikilinks to Markdown links without an explicit dialect decision.
- Opaque handling is acceptable for wikilinks until the parser has a dedicated node.
- Source-only handling is acceptable in rich mode if wikilinks cannot be edited structurally.
- Render as internal note links where supported; otherwise render as safe text/link-like spans.
