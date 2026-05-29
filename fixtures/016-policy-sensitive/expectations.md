# Expectations

- Preserve referenced paths, placeholder values, code fence, and explanatory text without introducing real private data.
- Normalized output may trim trailing spaces but must not remove denied-path evidence.
- Opaque handling is not the main goal, but unsupported policy annotations must be preserved if added later.
- Source-only handling is acceptable for policy metadata until a policy UI exists.
- Render as a normal Markdown note while tests use it to prove access-policy decisions.
