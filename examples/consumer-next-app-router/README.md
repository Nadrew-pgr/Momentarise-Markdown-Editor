# Next App Router Consumer Fixture

This fixture is owned by `scripts/consumer-smoke.mjs`.

Its `package.json` intentionally starts with empty dependency blocks. The consumer matrix copies the fixture into a temp directory, rewrites dependencies to use fresh `npm pack` tarballs, then runs:

- `npm install`, `tsc --noEmit`, import-time safety, and `next build`
- `pnpm install --strict-peer-dependencies --ignore-scripts`, `tsc --noEmit`, import-time safety, and `next build`

For local troubleshooting, run the root command:

```sh
npm run test:consumer-matrix
```

For offline/constrained environments that cannot install registry packages, use:

```sh
MME_CONSUMER_MATRIX_OFFLINE=1 npm run test:consumer-matrix
```

Offline mode still builds and packs workspace packages, then loudly reports skipped external-consumer legs.

## Release metadata

- Package: momentarise-next-app-router-consumer
- Release status: experimental
- Version policy: 0.x semver: public APIs are versioned, and breaking changes may ship in minor releases until 1.0. See docs/public/compatibility-promise.md.
- License: Apache-2.0
- Public API: root package exports are audited by `npm run test:public-api`.
