import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

// Prerelease versions such as 0.1.0-alpha.1 do not satisfy a plain "^0.1.0" range
// under node-semver's prerelease-matching rule (a comparator must itself carry a
// matching prerelease tag). Every internal @momentarise/* dependency edge must
// therefore be pinned to the exact alpha range, or a registry install of one
// alpha package pulling in another would fail to resolve.
const ALPHA_VERSION = "0.1.0-alpha.1";
const ALPHA_RANGE = `^${ALPHA_VERSION}`;

const packageDirs = (await readdir("packages", { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

const manifestsByName = new Map();
for (const dir of packageDirs) {
  const manifest = await readJson(`packages/${dir}/package.json`);
  manifestsByName.set(manifest.name, { manifest, path: `packages/${dir}/package.json` });
}

for (const [name, { manifest, path }] of manifestsByName) {
  if (manifest.private) {
    continue;
  }
  assert(manifest.version === ALPHA_VERSION, `${path} version must be ${ALPHA_VERSION} for the first alpha publish, got ${manifest.version}.`);
  for (const [dependency, range] of Object.entries(manifest.dependencies ?? {})) {
    if (!dependency.startsWith("@momentarise/")) {
      continue;
    }
    assert(
      range === ALPHA_RANGE,
      `${path} dependency on ${dependency} must use ${ALPHA_RANGE} (prerelease-aware), got "${range}".`
    );
  }
}

for (const appDir of ["md-demo", "docs-site", "theia-demo"]) {
  const path = `apps/${appDir}/package.json`;
  const manifest = await readJson(path);
  for (const [dependency, range] of Object.entries(manifest.dependencies ?? {})) {
    if (!dependency.startsWith("@momentarise/")) {
      continue;
    }
    assert(
      range === ALPHA_RANGE,
      `${path} dependency on ${dependency} must use ${ALPHA_RANGE} (prerelease-aware), got "${range}".`
    );
  }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}
