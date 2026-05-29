# Expectations

- Preserve GFM task markers, checked/unchecked state, indentation, nesting, and following paragraph.
- Normalized output may align indentation consistently, but must not change task state.
- Opaque handling is not expected if GFM tasks are supported; otherwise task syntax must remain opaque/raw and unchanged.
- Source-only handling is acceptable for unsupported task UI, provided Markdown stays intact.
- Render as a task list when the host supports GFM task checkboxes.
