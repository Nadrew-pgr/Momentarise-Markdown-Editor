# Changesets

Use Changesets for package versioning after the initial `0.1.0` public-readiness seed.

Run `npm run changeset` for public API changes, `npm run version-packages` to apply queued changesets, and `npm run release` only from an approved release workflow.

Private demo/example packages are ignored by Changesets but still carry version, license, and release-status metadata for repo hygiene.
