# MME-0032 visual checks

Artifacts:

- `markdown-read-view.png` — Markdown document opened in the read-only sanitized Read view.
- `markdown-read-sanitized-html.png` — Markdown containing unsafe inline/block HTML rendered inline after sanitizer stripping; source remains Markdown.
- `html-preview-empty-sandbox` check happens in script runtime assertions (no artifact capture required).

Run command:

```sh
npm run visual:mme-0032
```

Default URL: `http://127.0.0.1:5174/` unless `MME_DEMO_URL` is set.
