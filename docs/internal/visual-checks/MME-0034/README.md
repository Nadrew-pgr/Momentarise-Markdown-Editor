# MME-0034 Visual Checks

Expected artifacts:

- `theia-shell-loaded.png`: Theia browser shell loaded from the local `apps/theia-demo` application after the frontend reaches the `ready` state.
- `theia-markdown-open-find.png`: a Markdown resource opened through the Theia OpenHandler, source mode mounted, and the MME find surface opened through the Theia command service.

Run with a Theia demo server:

```sh
MME_THEIA_DEMO_URL=http://127.0.0.1:5176/ npm run visual:mme-0034
```

In the current repository path, the Theia CLI cannot build from a path containing spaces, so this artifact may need a no-space temporary worktree for the app build/run.

The visual script defaults to `mme-demo:///visual-sample.md`, backed by the demo app's in-memory Theia `FileService` provider. This keeps the proof on the real OpenHandler and widget path without depending on host `file:` provider availability in the stripped demo shell.
