# Expectations

- Preserve the opening fence, `ts` language info, code content, indentation, backticks in template strings, and closing fence.
- Normalized output must not change code bytes inside the fence unless the code block itself is explicitly edited.
- Opaque handling is not expected for fenced code blocks, but unsupported language metadata must remain intact.
- Source-only handling is acceptable for rich mode editing until a safe code editor is available.
- Render as a TypeScript code block with syntax highlighting where supported.
