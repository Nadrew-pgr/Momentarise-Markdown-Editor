# Expectations

- Preserve inline math delimiters, display math delimiters, backslashes, braces, superscripts, and surrounding text.
- Normalized output must not rewrite LaTeX commands or spacing inside math regions.
- Opaque handling is acceptable if LaTeX is unsupported by the current parser.
- Source-only handling is acceptable in rich mode until math editing is safe.
- Render math where a trusted math renderer is available; otherwise show preserved source.
