# Expectations

- Preserve the `mermaid` fence info, diagram source, labels, arrows, braces, and closing fence.
- Normalized output must not reformat diagram syntax inside the fence.
- Opaque handling is acceptable if Mermaid is not parsed into structured nodes.
- Source-only handling is acceptable while still allowing preview rendering.
- Render as a Mermaid diagram only in a safe preview pipeline.
