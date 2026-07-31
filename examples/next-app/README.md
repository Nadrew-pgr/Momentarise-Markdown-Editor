# Momentarise Next.js App Router Example

A working MME editor, installed from the real published `@momentarise/*` npm alpha packages — proof that a stranger can adopt MME today.

## Run it

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. React StrictMode is on (`next.config.mjs`); the editor mounts, unmounts, and remounts once in dev, then stays editable.

## What this proves

- `@momentarise/md-react` and `@momentarise/md-save` install from the registry with no `workspace:`/`file:` links.
- React 19 (this example's pinned version) does not break the StrictMode-survival fix from MME-0081.
- The editor's mode and save status are read live from the session (see the line under the editor).

## Release metadata

- Package: momentarise-next-app-example
- Release status: experimental
- Version policy: 0.x semver: public APIs are versioned, and breaking changes may ship in minor releases until 1.0. See docs/public/compatibility-promise.md.
- License: Apache-2.0
