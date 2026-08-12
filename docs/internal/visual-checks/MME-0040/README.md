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
- `rich-native-table-and-preserved-fallback.png`: proves rich mode mounts the well-formed table natively — with the escaped pipe intact inside a real cell — while the malformed table-like block stays a preserved source-only fallback, and the mount keeps Markdown byte-identical. **Renamed from `rich-preserved-table-fallback.png` by MME-0116:** until MME-0055 shipped native rich tables both blocks fell back, and the old name and gate still described that.
