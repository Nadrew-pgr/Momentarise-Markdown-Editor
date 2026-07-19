# @momentarise/md-surface

Framework-free DOM surface components for Momentarise Markdown Editor.

`md-surface` owns reusable editor chrome without owning a framework runtime. Hosts
provide DOM containers, icons, localized strings, preferences, session state, and
callbacks. Components render only into the supplied host and keep command dispatch
inside the editor session or host callback boundary.

## Command Surfaces

- `createToolbar` renders the rich editor command toolbar. State can mark command
  ids as active or disabled, preferences can hide whole command groups, and
  non-built-in toolbar items are rendered from the supplied registry state
  without assuming a special `host:` namespace prefix.
- `createSelectionBubbleToolbar` renders selected-text actions as reusable
  package chrome. It supports active mark state, disabled command ids, AI
  selection gating, roving keyboard focus, and existing-host or package-owned
  root mounting.
- `createSlashMenu` renders grouped slash commands and AI entries. It respects
  slash enablement, visible command groups, slash-specific group preferences,
  empty state strings, keyboard selection, and `aria-activedescendant`.
- `createModeControl` renders document-kind-aware editor modes. Hosts can use
  compact tabs, a single cycling toggle, or hide the built-in control when a
  host-provided mode switcher is used.

## Host Contract

- Markdown remains the durable source; surfaces dispatch commands only.
- Hosts are responsible for translating command ids into editor actions.
- Preferences are plain data so hosts can bind workspace, user, or locked
  settings without importing app state into this package.
- Surface strings and icons are injected; no global document, storage, React,
  Theia, or VS Code dependency is used.

## Release metadata

- Release status: experimental
- Version policy: 0.x semver: public APIs are versioned, and breaking changes may ship in minor releases until 1.0. See docs/public/compatibility-promise.md.
- License: MPL-2.0
- Public API: root package exports are audited by `npm run test:public-api`.
