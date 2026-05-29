# MME-0005 Visual Checks

## Manual UI scenario

1. Start or keep running the demo with `npm run dev -w @momentarise/md-demo -- --host 127.0.0.1`.
2. Open `http://127.0.0.1:5173/`.
3. Verify the inspector shows parser status as `pass (remark AST)`.
4. Verify frontmatter displays `title` and `mode` from the built-in fixture.
5. Verify diagnostics include `ast_parser_foundation` and `frontmatter_extracted`.
6. Type an unsupported wikilink in source mode.
7. Verify diagnostics include `opaque_preserved`.
8. Capture the required screenshots.

## Expected artifacts

- `parser-frontmatter-loaded.png`
- `parser-opaque-diagnostics-after-edit.png`

## Commands used

- Dev server: `npm run dev -w @momentarise/md-demo -- --host 127.0.0.1`
- Local URL: `http://127.0.0.1:5173/`
- Visual scenario: `npm run visual:mme-0005`

## Human review status

Human review is not required unless the parser dependency choice is rejected. Reviewer checks must inspect parser behavior, package boundaries, diagnostics, and screenshots.
