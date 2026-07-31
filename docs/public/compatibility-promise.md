# Compatibility Promise

Momentarise Markdown Editor packages start at `0.1.0` and are experimental until a package is explicitly marked stable.

## Semver

Packages follow semver with a `0.x` pre-1.0 policy:

- patch releases fix bugs without intentional public API breaks;
- minor releases may add APIs and may include breaking API changes while the package is experimental;
- breaking changes must be documented in the changelog or a Changeset before release;
- public exports are the root package exports audited by `npm run test:public-api`.

## Experimental

All current `@momentarise/*` framework packages are experimental. Hosts can build against them, but should pin compatible ranges and read the changelog before upgrading.

Experimental packages still keep the core preservation contract: Markdown remains durable source, unknown syntax is preserved where supported, and save status must stay truthful.

## Stable

A package becomes stable only when its package metadata says `momentarise.releaseStatus: "stable"` and its README states the same. Stable packages must not ship breaking API changes outside a major release.

## Module Format

Every published `@momentarise/*` package is ESM-only: `"type": "module"`, and package `exports` declare no `require` condition. Import with `import`/`export`, not `require`. There is no CommonJS build, and none is planned; CommonJS-only consumers must use a bundler or loader that can consume ESM dependencies (Next.js, Vite, and modern Node all do this by default).

## License

Framework packages under `packages/*` use `MPL-2.0`.

Demos and consumer examples under `apps/*` and `examples/*` use `Apache-2.0`.
