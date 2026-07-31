import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Proves examples/next-app is a real, self-contained registry consumer: copy it to a temp
// directory (no access to this repo's node_modules or workspace symlinks), install its committed
// dependencies from the real npm registry, and build it with Next.js.
const exampleDir = "examples/next-app";
assert(existsSync(exampleDir), `${exampleDir} must exist.`);

const tempDir = await mktempExampleCopy();
try {
  const install = run("npm", ["install"], tempDir);
  assert.equal(install.status, 0, `npm install failed in the copied example:\n${install.output}`);

  const typecheck = run("npm", ["run", "typecheck"], tempDir);
  assert.equal(typecheck.status, 0, `typecheck failed in the copied example:\n${typecheck.output}`);

  const build = run("npm", ["run", "build"], tempDir);
  assert.equal(build.status, 0, `next build failed in the copied example:\n${build.output}`);
  assert(existsSync(join(tempDir, ".next")), "next build must produce a .next output directory.");

  console.log("example-next-registry: install + typecheck + build passed against the real registry.");
} finally {
  await rm(tempDir, { force: true, recursive: true });
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
  return {
    output: `${result.stdout ?? ""}\n${result.stderr ?? ""}`,
    status: result.status
  };
}
