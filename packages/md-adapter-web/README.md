# @momentarise/md-adapter-web

Web host capability helpers for Momentarise Markdown Editor.

This package keeps browser-specific file access at the adapter boundary:

- File System Access handles are wrapped as source-document `SaveTarget`s.
- `createNewMarkdownFile()` and `saveMarkdownAsFile()` use the browser save picker when available and return a writable disk target only after the initial source bytes are written.
- `openWritableMarkdownFile()` and `createImportedCopyDocument()` report whether the opened source is Markdown or lightweight source text.
- Unsupported file names return unsupported document results instead of being treated as Markdown.
- Hosts can check `canCreateWritableFile()` separately from `canUseFileSystemAccess()` because some browsers may support opening files without supporting save-picker creation.
- Writable targets expose `readExternalHash()` for save-time verification and `readExternalContent()` for safe clean reloads.
- `createFocusRefreshWatcher()` is DOM-free: hosts inject `listen()` from `window` focus, `visibilitychange`, polling, or another web event source.
- The Save Engine remains the hard no-overwrite guarantee. The focus watcher is an early UX signal so a host can apply clean external changes or show a conflict before the next save.

For local web files, the recommended strategy is focus/visibility refresh plus save-time hash verification. Imported-copy and unsupported modes cannot overwrite the original source and should keep export/download language explicit.

## Release metadata

- Release status: experimental
- Version policy: 0.x semver: public APIs are versioned, and breaking changes may ship in minor releases until 1.0. See docs/public/compatibility-promise.md.
- License: MPL-2.0
- Public API: root package exports are audited by `npm run test:public-api`.
