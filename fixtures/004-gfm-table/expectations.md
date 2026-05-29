# Expectations

- Preserve table rows, headers, cell content, alignment markers, and surrounding paragraph.
- Normalized output may pad table columns consistently, but must not reorder or drop cells.
- Opaque handling is acceptable if the table is not editable as structured rich content yet.
- Source-only handling is acceptable for rich mode, but the table must survive round trips.
- Render as a GFM table where supported.
