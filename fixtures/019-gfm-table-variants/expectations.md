# Expectations

- Preserve supported GFM table rows, alignment markers, escaped pipes, inline marks, and surrounding paragraphs byte-for-byte when untouched.
- Normalized render output may add semantic HTML table structure, but parser and rich round-trip output must not normalize source table bytes.
- Opaque handling is required for malformed table-like syntax that is not a valid GFM table.
- Source-only fallback is acceptable in rich mode for supported and malformed table forms until editable cells ship.
- Render supported GFM tables as safe semantic table HTML.
