# @momentarise/react-demo

Workspace-backed React host, used to prove `@momentarise/md-react` renders correctly in a real browser.

This app exists to be **measured**, not to be a second demo. `apps/md-demo` is the reference bench and `examples/next-app` is the adoption proof (a pure registry install, whose purpose is catching workspace-versus-registry drift). Neither could catch what MME-0125 attempt 1 shipped: a layout defect in the React binding that made a default consumer's source editor unclickable, invisible to every gate because all React tests run in jsdom and jsdom has no layout.

Its gate is `npm run visual:mme-0125`; everything in `src/` exists because that gate needs it.

## Release metadata

- Release status: experimental
- Version policy: 0.x semver: public APIs are versioned, and breaking changes may ship in minor releases until 1.0. See docs/public/compatibility-promise.md.
- License: Apache-2.0
- Not published: this is a private workspace app.
