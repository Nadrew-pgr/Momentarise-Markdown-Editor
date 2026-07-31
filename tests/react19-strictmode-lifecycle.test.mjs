import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

// React 19 leg of the MME-0081 StrictMode-survival proof (tests/react-strictmode-lifecycle.test.mjs
// proves React 18.3.1 only, since that's what the root workspace hoists). Runs in an isolated
// fixture directory with its own node_modules because Node cannot resolve two different "react"
// package versions from a single node_modules tree; see tests/fixtures/react19-strictmode/run.mjs
// for the actual assertions and rationale.
//
// This is a **pure registry install**. MME-0101 temporarily overlaid the workspace md-react pack
// because the published alpha was source-only; the 0.1.0-alpha.2 republish (MME-0102) shipped rich
// mode, so the overlay was dropped and the rich surface is asserted against the registry artifact.
const fixtureDir = "tests/fixtures/react19-strictmode";
assert(existsSync(fixtureDir), `${fixtureDir} must exist.`);

const install = run("npm", ["install"], fixtureDir);
assert.equal(install.status, 0, `npm install failed in the react19 fixture:\n${install.output}`);

assert(
  existsSync(join(fixtureDir, "node_modules/@momentarise/md-react/dist/rich-view.js")),
  "the registry md-react must ship dist/rich-view.js (the dynamically-imported rich surface)."
);

const result = run("node", ["run.mjs"], fixtureDir);
assert.equal(result.status, 0, `react19-strictmode fixture failed:\n${result.output}`);
console.log(result.output.trim());

function run(command, args, cwd) {
  const spawned = spawnSync(command, args, { cwd, encoding: "utf8" });
  return {
    output: `${spawned.stdout ?? ""}\n${spawned.stderr ?? ""}`,
    status: spawned.status
  };
}
