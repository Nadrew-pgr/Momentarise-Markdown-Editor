import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Proves examples/next-app is a real, self-contained consumer: copy it to a temp directory (no
// access to this repo's node_modules or workspace symlinks), install its committed dependencies
// from the real npm registry, and build it with Next.js.
//
// This is a **pure registry install**. MME-0100 and MME-0101 temporarily overlaid workspace packs
// here because the packaged stylesheet and the rich-mode React binding were not published yet; the
// 0.1.0-alpha.2 republish (MME-0102) shipped both, so the overlays were dropped. The assertions
// below now check the *registry* artifacts directly — if a future change lands in the workspace but
// not on the registry, this test fails, which is exactly the drift it exists to catch.
const exampleDir = "examples/next-app";
assert(existsSync(exampleDir), `${exampleDir} must exist.`);

const tempDir = await mktempExampleCopy();
try {
  const install = run("npm", ["install"], tempDir);
  assert.equal(install.status, 0, `npm install failed in the copied example:\n${install.output}`);

  const modules = join(tempDir, "node_modules/@momentarise");
  assert(
    existsSync(join(modules, "md-theme/src/styles.css")),
    "the registry md-theme must ship src/styles.css (the packaged component stylesheet)."
  );
  assert(
    existsSync(join(modules, "md-theme/src/tokens.json")),
    "the registry md-theme must ship src/tokens.json (the machine-readable design system, MME-0102)."
  );
  assert(
    existsSync(join(modules, "md-react/dist/rich-view.js")),
    "the registry md-react must ship dist/rich-view.js (the rich-mode surface)."
  );

  // The published stylesheet must carry the MME-0102 system, not the pre-redesign values.
  const publishedTokens = JSON.parse(
    await readTextFile(join(modules, "md-theme/src/tokens.json"))
  );
  assert.equal(
    publishedTokens.schemes?.light?.["--mme-font-size-content"]?.resolved,
    "16px",
    "the registry md-theme must carry the 16px content size from the design foundation."
  );
  assert(
    publishedTokens.schemes?.dark?.["--mme-neutral-12"],
    "the registry md-theme must carry the full neutral ramp."
  );

  const typecheck = run("npm", ["run", "typecheck"], tempDir);
  assert.equal(typecheck.status, 0, `typecheck failed in the copied example:\n${typecheck.output}`);

  const build = run("npm", ["run", "build"], tempDir);
  assert.equal(build.status, 0, `next build failed in the copied example:\n${build.output}`);
  assert(existsSync(join(tempDir, ".next")), "next build must produce a .next output directory.");

  console.log("example-next-registry: pure registry install + build passed (no workspace overlays).");
} finally {
  await rm(tempDir, { force: true, recursive: true });
}

async function readTextFile(path) {
  const { readFile } = await import("node:fs/promises");
  return readFile(path, "utf8");
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
