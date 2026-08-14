# Expectations

- Preserve the whole YAML block byte-for-byte unless a specific value is edited: key order, the comment line, the anchor, the block scalar, and the list indentation.
- Editing one property value rewrites only that value's bytes; normalized whole-block re-dumping is forbidden.
- Nested maps, block scalars, and anchors are complex values: they render read-only in the Properties panel and keep their raw/opaque source rather than being flattened.
- Source-only editing of the raw YAML block stays available and is the escape hatch the panel points to for complex values.
- Render the six safe property types (text, list, number, checkbox, date, date & time) as editable rows above the document title; body Markdown renders unchanged.
