import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Proves examples/next-app is a real, self-contained consumer: copy it to a temp directory (no
// access to this repo's node_modules or workspace symlinks), install its committed dependencies
// from the real npm registry, and build it with Next.js.
//
// One overlay (MME-0100): the example imports @momentarise/md-theme/styles.css, the packaged
// component stylesheet added in this issue. That export does not exist in the currently published
// md-theme alpha yet, so after the registry install we overlay the *workspace* md-theme pack — the
// exact artifact that will be published next — proving the example builds and is styled against the
// real to-be-published package. When md-theme is republished with styles.css, this overlay can be
// dropped and the example becomes a pure-registry install again.
const exampleDir = "examples/next-app";
assert(existsSync(exampleDir), `${exampleDir} must exist.`);

const themePack = packWorkspaceTheme();
const tempDir = await mktempExampleCopy();
try {
  const install = run("npm", ["install"], tempDir);
  assert.equal(install.status, 0, `npm install failed in the copied example:\n${install.output}`);

  const overlay = run("npm", ["install", themePack, "--no-save"], tempDir);
  assert.equal(overlay.status, 0, `overlaying the workspace md-theme pack failed:\n${overlay.output}`);
  assert(
    existsSync(join(tempDir, "node_modules/@momentarise/md-theme/src/styles.css")),
    "the overlaid md-theme must ship src/styles.css (the packaged component stylesheet)."
  );

  const typecheck = run("npm", ["run", "typecheck"], tempDir);
  assert.equal(typecheck.status, 0, `typecheck failed in the copied example:\n${typecheck.output}`);

  const build = run("npm", ["run", "build"], tempDir);
  assert.equal(build.status, 0, `next build failed in the copied example:\n${build.output}`);
  assert(existsSync(join(tempDir, ".next")), "next build must produce a .next output directory.");

  console.log("example-next-registry: registry install + workspace md-theme overlay + build passed.");
} finally {
  await rm(tempDir, { force: true, recursive: true });
}

function packWorkspaceTheme() {
  const outDir = mkdtempSyncSafe();
  execFileSync("npm", ["pack", "./packages/md-theme", "--pack-destination", outDir], { encoding: "utf8" });
  const tgz = readdirSync(outDir).find((f) => f.endsWith(".tgz"));
  assert(tgz, "npm pack must produce an md-theme tarball.");
  return join(outDir, tgz);
}

function mkdtempSyncSafe() {
  return execFileSync(process.execPath, ["-e", "process.stdout.write(require('node:fs').mkdtempSync(require('node:path').join(require('node:os').tmpdir(),'mme-theme-pack-')))"], { encoding: "utf8" });
}

async function mktempExampleCopy() {
  const tempDir = await mkdtemp(join(tmpdir(), "mme-next-app-example-"));
  await cp(exampleDir, tempDir, {
    recursive: true,
    filter: (source) => {
      const base = source.split("/").pop() ?? "";
      return base !== "node_modules" && base !== ".next" && base !== "package-lock.json";
    }
  });
  return tempDir;
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  return { output: `${result.stdout ?? ""}\n${result.stderr ?? ""}`, status: result.status };
}
