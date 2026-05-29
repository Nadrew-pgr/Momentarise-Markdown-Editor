# Expectations

- Preserve link label, link target, image alt text, relative image path, title text, and paragraph order.
- Normalized output may escape spaces consistently if needed.
- Opaque handling is not expected for standard Markdown links and images.
- Source-only handling is acceptable for image rendering failures, but the Markdown must remain unchanged.
- Render the link as a navigation target and the image as media when the asset exists.
