# @momentarise/md-adapter-web

Web host capability helpers for Momentarise Markdown Editor.

This package keeps browser-specific file access at the adapter boundary:

- File System Access handles are wrapped as Markdown `SaveTarget`s.
- Writable targets expose `readExternalHash()` for save-time verification and `readExternalContent()` for safe clean reloads.
- `createFocusRefreshWatcher()` is DOM-free: hosts inject `listen()` from `window` focus, `visibilitychange`, polling, or another web event source.
- The Save Engine remains the hard no-overwrite guarantee. The focus watcher is an early UX signal so a host can apply clean external changes or show a conflict before the next save.

For local web files, the recommended strategy is focus/visibility refresh plus save-time hash verification. Imported-copy and unsupported modes cannot overwrite the original source and should keep export/download language explicit.
