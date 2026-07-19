# MME-0041 Visual Check

Command:

```sh
npm run visual:mme-0041
```

Expected local URL:

```text
http://127.0.0.1:5174/
```

Artifacts:

- `footnote-read-backlinks.png`: read mode renders the real `fixtures/020-gfm-footnotes/input.md` with footnote anchors, backlinks, duplicate/unreferenced preserved source, and malformed footnote-like text visible.
- `rich-preserved-footnote-fallback.png`: rich mode shows explicit source-only preserved-footnote fallbacks and keeps Markdown byte-identical after rich mount.
