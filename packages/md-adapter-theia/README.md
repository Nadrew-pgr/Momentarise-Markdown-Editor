# @momentarise/md-adapter-theia

Alpha Theia shell adapter for Momentarise Markdown Editor.

The adapter keeps Theia responsibilities outside core packages:

- `FileService` is wrapped as a Markdown `SaveTarget`;
- the editor view mounts `@momentarise/md-editor`, `@momentarise/md-source-codemirror`, and `@momentarise/md-surface`;
- Theia owns `KeybindingRegistry` registration, with MME source mode configured as `delegateToHost`;
- Theia owns `PreferenceService` lookup and passes resolved host preferences into MME;
- source mode is the alpha editing path, while rich mode remains mount-capable future polish.
- external-change observation is adapter-owned: a production Theia host should use workspace/FileService change events when available, then route clean reload or dirty conflict state through the shared editor session and Save Engine.

The package exposes `dist/browser/theia-markdown-frontend-module` through `theiaExtensions`. That module registers the widget factory, `.md` OpenHandler, save/find commands, and delegated keybindings. The adapter does not copy parser, serializer, save-engine, or demo orchestration logic.

## Alpha Build Shape

`apps/theia-demo` is the local application shell for manual verification. Expected commands:

```sh
npm run build -w @momentarise/md-adapter-theia
npm run build -w @momentarise/theia-demo
npm run start -w @momentarise/theia-demo
```

The demo uses the same package APIs a real Theia host would use; it is not a fork of `apps/md-demo`.

## Release metadata

- Release status: experimental
- Version policy: 0.x semver: public APIs are versioned, and breaking changes may ship in minor releases until 1.0. See docs/public/compatibility-promise.md.
- License: MPL-2.0
- Public API: root package exports are audited by `npm run test:public-api`.
