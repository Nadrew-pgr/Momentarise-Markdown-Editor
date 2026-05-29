# Expectations

- Preserve unknown directive fences, attributes, template tags, list content, and ordering exactly where feasible.
- Normalized output must not rewrite unknown syntax into a supported construct.
- Opaque handling is required for the custom directive and template block until dedicated support exists.
- Source-only handling is required in rich mode unless an extension explicitly supports these blocks.
- Render as safe raw/source fallback or extension-provided blocks, never as silently dropped content.
