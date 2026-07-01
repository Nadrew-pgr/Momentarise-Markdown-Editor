# @momentarise/md-render-html

Experimental host-independent Markdown-to-HTML renderer for read-only Momentarise surfaces.

## Contract

`renderMarkdownToHtml(markdown, options)` returns sanitized HTML and render-time diagnostics. It does not mutate the Markdown source and it does not require DOM APIs, so hosts can use it in Node, SSR/static builds, workers, or browser code.

## HTML Policy

Markdown remains durable source:

- inline HTML in `.md` is preserved in source and sanitized only in the render artifact;
- block HTML in `.md` is preserved in source and sanitized only in the render artifact;
- standalone `.html` artifacts are not Markdown and stay on the `@momentarise/md-preview-html` sandboxed iframe path.

Source mode remains the fallback for every case.

## Sanitization Schema

The schema starts from the `rehype-sanitize` default schema, then applies MME-specific divergences:

- `script`, `style`, and `iframe` elements are denied;
- `on*` event handler attributes are denied;
- URL-bearing attributes are filtered to block external schemes (`http`, `https`, `javascript`, `data`, etc.) by default;
- images whose `src` is stripped render as visible alt text instead of broken image placeholders;
- `className` is allowed for token styling, restricted to `language-*`, `token-*`, and `mme-*`;
- disabled task-list checkboxes are allowed with `input[type=checkbox][disabled]`;
- clobbered IDs/names use the `mme-render-` prefix.

When sanitization removes elements or attributes, the renderer emits a `render_html_stripped` diagnostic. Diagnostics describe the render artifact only; the Markdown source is never rewritten.
