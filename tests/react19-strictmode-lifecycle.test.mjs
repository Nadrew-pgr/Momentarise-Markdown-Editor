import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

// React 19 leg of the MME-0081 StrictMode-survival proof (tests/react-strictmode-lifecycle.test.mjs
// proves React 18.3.1 only, since that's what the root workspace hoists). Runs in an isolated
// fixture directory with its own node_modules because Node cannot resolve two different "react"
// package versions from a single node_modules tree; see tests/fixtures/react19-strictmode/run.mjs
// for the actual assertions and rationale.
//
// MME-0101 overlay: the fixture also proves rich-mode mounting survives a React 19 StrictMode
// remount. The published md-react alpha is source-only, so after the registry install we overlay
// the *workspace* md-react pack (the exact artifact to be published next), the same pre-publish
// pattern used by the Next example. Drop the overlay once md-react is republished with rich mode.
const fixtureDir = "tests/fixtures/react19-strictmode";
assert(existsSync(fixtureDir), `${fixtureDir} must exist.`);

const install = run("npm", ["install"], fixtureDir);
assert.equal(install.status, 0, `npm install failed in the react19 fixture:\n${install.output}`);

const reactPack = packWorkspace("packages/md-react");
const overlay = run("npm", ["install", reactPack, "--no-save"], fixtureDir);
assert.equal(overlay.status, 0, `overlaying the workspace md-react pack failed:\n${overlay.output}`);
assert(
  existsSync(join(fixtureDir, "node_modules/@momentarise/md-react/dist/rich-view.js")),
  "the overlaid md-react must ship dist/rich-view.js (the dynamically-imported rich surface)."
);

const result = run("node", ["run.mjs"], fixtureDir);
assert.equal(result.status, 0, `react19-strictmode fixture failed:\n${result.output}`);
console.log(result.output.trim());

function packWorkspace(pkgDir) {
  const outDir = execFileSync(process.execPath, ["-e", "process.stdout.write(require('node:fs').mkdtempSync(require('node:path').join(require('node:os').tmpdir(),'mme-pack-')))"], { encoding: "utf8" });
  execFileSync("npm", ["pack", `./${pkgDir}`, "--pack-destination", outDir], { encoding: "utf8" });
  const tgz = readdirSync(outDir).find((f) => f.endsWith(".tgz"));
  assert(tgz, `npm pack must produce a tarball for ${pkgDir}.`);
  return join(outDir, tgz);
}

function run(command, args, cwd) {
  const spawned = spawnSync(command, args, { cwd, encoding: "utf8" });
  return {
    output: `${spawned.stdout ?? ""}\n${spawned.stderr ?? ""}`,
    status: spawned.status
  };
}
