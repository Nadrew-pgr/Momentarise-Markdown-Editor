# Expectations

- Preserve the YAML frontmatter block, key order where feasible, scalar values, list values, and body Markdown.
- Normalized output may use consistent trailing newline behavior.
- Opaque handling is not expected for valid YAML frontmatter, but invalid future properties must not be dropped.
- Source-only mode must allow direct editing of the raw YAML block.
- Render the body heading and paragraph while exposing frontmatter as properties in future UI.
