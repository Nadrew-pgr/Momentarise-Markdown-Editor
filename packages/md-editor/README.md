# @momentarise/md-editor

Host-independent headless Markdown editor session for Momentarise Markdown Editor.

## Mode model

The headless session accepts `source`, `rich`, `live-preview`, and `preview` mode ids. Use `classifyEditorDocumentKind()`, `editorModesForDocumentKind()`, or `isEditorModeAvailableForDocumentKind()` before exposing controls: Markdown documents expose Source, Rich, and Live Preview; standalone HTML artifacts expose Source and Preview; lightweight source files expose Source only.


## Release metadata

- Release status: experimental
- Version policy: 0.x semver: public APIs are versioned, and breaking changes may ship in minor releases until 1.0. See docs/public/compatibility-promise.md.
- License: MPL-2.0
- Public API: root package exports are audited by `npm run test:public-api`.
