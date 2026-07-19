# MME-0040 visual checks

Command:

```sh
npm run visual:mme-0040
```

Local URL:

```txt
http://127.0.0.1:5174/
```

Artifacts:

- `table-read-semantic.png`: proves a supported GFM pipe table renders as a semantic read-mode table while malformed table-like Markdown remains visible as source text.
- `rich-preserved-table-fallback.png`: proves rich mode mounts supported and malformed table-like blocks as preserved source-only table fallbacks and keeps Markdown byte-identical.
