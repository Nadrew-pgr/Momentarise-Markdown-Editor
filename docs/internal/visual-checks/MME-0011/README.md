# MME-0011 Visual Checks

## Manual UI scenario

1. Start or keep running the demo with `npm run dev -w @momentarise/md-demo -- --host 127.0.0.1 --port 5174`.
2. Open `http://127.0.0.1:5174/`.
3. Load a Markdown document with YAML frontmatter.
4. Verify the Properties panel displays parsed YAML fields in list mode.
5. Switch the Properties panel to hidden mode and verify the source editor content does not change.
6. Switch the Properties panel to YAML mode and verify raw frontmatter is visible.
7. Edit body Markdown, verify raw YAML remains in CodeMirror source mode, and verify round-trip status still passes.

## Expected artifacts

- `properties-visible-frontmatter.png` — proves parsed YAML properties are visible in the inspector.
- `properties-hidden.png` — proves properties can be hidden without changing the editor source.
- `properties-source-yaml.png` — proves raw YAML frontmatter can be inspected from the properties panel while still remaining in source mode.
- `properties-roundtrip-after-edit.png` — proves body edits keep frontmatter in source and round-trip status remains passing.

## Commands used

- Dev server: `npm run dev -w @momentarise/md-demo -- --host 127.0.0.1 --port 5174`
- Local URL: `http://127.0.0.1:5174/`
- Visual scenario: `MME_DEMO_URL=http://127.0.0.1:5174/ npm run visual:mme-0011`

## Human review status

Human review is required because MME-0011 is the first properties UI slice.
