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
// Overlays (MME-0100 + MME-0101): the example imports @momentarise/md-theme/styles.css (the
// packaged component stylesheet) and uses the rich-mode-capable md-react + md-surface. Those
// changes are not in the currently published alphas yet, so after the registry install we overlay
// the *workspace* packs — the exact artifacts to be published next — proving the example builds
// against the real to-be-published packages. When the alphas are republished, these overlays can be
// dropped and the example becomes a pure-registry install again.
const exampleDir = "examples/next-app";
assert(existsSync(exampleDir), `${exampleDir} must exist.`);

const overlayPacks = ["packages/md-theme", "packages/md-surface", "packages/md-react"].map(packWorkspace);
const tempDir = await mktempExampleCopy();
try {
  const install = run("npm", ["install"], tempDir);
  assert.equal(install.status, 0, `npm install failed in the copied example:\n${install.output}`);

  // Install all overlay packs in one command so npm resolves them together — installing them one
  // at a time lets a later pack's dependency resolution re-pull an earlier overlaid package from
  // the registry and clobber it.
  const overlay = run("npm", ["install", ...overlayPacks, "--no-save"], tempDir);
  assert.equal(overlay.status, 0, `overlaying workspace packs failed:\n${overlay.output}`);
  assert(
    existsSync(join(tempDir, "node_modules/@momentarise/md-theme/src/styles.css")),
    "the overlaid md-theme must ship src/styles.css (the packaged component stylesheet)."
  );
  assert(
    existsSync(join(tempDir, "node_modules/@momentarise/md-react/dist/rich-view.js")),
    "the overlaid md-react must ship dist/rich-view.js (the rich-mode surface)."
  );

  const typecheck = run("npm", ["run", "typecheck"], tempDir);
  assert.equal(typecheck.status, 0, `typecheck failed in the copied example:\n${typecheck.output}`);

  const build = run("npm", ["run", "build"], tempDir);
  assert.equal(build.status, 0, `next build failed in the copied example:\n${build.output}`);
  assert(existsSync(join(tempDir, ".next")), "next build must produce a .next output directory.");

  console.log("example-next-registry: registry install + workspace overlays + build passed.");
} finally {
  await rm(tempDir, { force: true, recursive: true });
}

function packWorkspace(pkgDir) {
  const outDir = mkdtempSyncSafe();
  execFileSync("npm", ["pack", `./${pkgDir}`, "--pack-destination", outDir], { encoding: "utf8" });
  const tgz = readdirSync(outDir).find((f) => f.endsWith(".tgz"));
  assert(tgz, `npm pack must produce a tarball for ${pkgDir}.`);
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
