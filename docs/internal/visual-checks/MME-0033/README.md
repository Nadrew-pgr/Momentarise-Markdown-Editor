# MME-0033 Visual Checks

Expected artifacts:

- `source-find-highlights.png`: find surface open in source mode with CodeMirror match highlights.
- `source-replace-preserved.png`: one source-mode replacement applied through the find surface.
- `rich-find-highlights.png`: find surface open in rich mode with ProseMirror match highlights.
- `rich-replace-preserved.png`: one rich-mode replacement applied and synchronized back to Markdown source.

Run with:

```sh
MME_DEMO_URL=http://127.0.0.1:5175/ npm run visual:mme-0033
```
