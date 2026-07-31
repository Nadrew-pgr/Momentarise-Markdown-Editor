import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const workspaceRoot = process.cwd();

const packagesDir = resolve(workspaceRoot, "packages");
const packageDirs = (await readdir(packagesDir, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const manifests = new Map();
for (const dir of packageDirs) {
  const manifest = JSON.parse(await readFile(resolve(packagesDir, dir, "package.json"), "utf8"));
  manifests.set(dir, manifest);
}

for (const [dir, manifest] of manifests) {
  if (manifest.private) {
    continue;
  }
  assert(
    manifest.scripts?.prepack?.includes("tsc -b --force"),
    `${manifest.name} must declare a prepack script that forces a clean rebuild (packages/${dir}).`
  );
  assert(
    manifest.files?.includes("README.md"),
    `${manifest.name} must declare README.md in files (packages/${dir}).`
  );
  assert(
    manifest.files?.includes("LICENSE"),
    `${manifest.name} must declare LICENSE in files (packages/${dir}).`
  );
  assert(
    manifest.files?.includes("!dist/tsconfig.tsbuildinfo"),
    `${manifest.name} must exclude dist/tsconfig.tsbuildinfo from published files (packages/${dir}).`
  );
}

const tempRoot = await mkdtemp(join(tmpdir(), "mme-tarball-install-"));
const packDir = join(tempRoot, "packs");

try {
  const packOutput = execFileSync("node", ["scripts/pack-all.mjs", packDir], {
    cwd: workspaceRoot,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024
  });
  const packed = JSON.parse(packOutput);

  assert(
    packed.length === Array.from(manifests.values()).filter((manifest) => !manifest.private).length,
    "pack-all must produce exactly one tarball per publishable package."
  );

  for (const entry of packed) {
    const dir = entry.name.replace("@momentarise/", "");
    const manifest = manifests.get(dir);
    const extraAllowed = new Set(
      (manifest.files ?? []).filter(
        (pattern) => pattern !== "dist" && pattern !== "!dist/tsconfig.tsbuildinfo" && pattern !== "README.md" && pattern !== "LICENSE"
      )
    );

    const tarEntries = execFileSync("tar", ["-tzf", entry.tarballPath], { encoding: "utf8" })
      .split("\n")
      .filter(Boolean)
      .map((line) => line.replace(/^package\//, ""));

    assert(tarEntries.includes("package.json"), `${entry.name} tarball must include package.json.`);
    assert(tarEntries.includes("README.md"), `${entry.name} tarball must include README.md.`);
    assert(tarEntries.includes("LICENSE"), `${entry.name} tarball must include LICENSE.`);
    assert(
      tarEntries.some((path) => path === "dist/index.js"),
      `${entry.name} tarball must include a built dist/index.js.`
    );
    assert(
      tarEntries.some((path) => path === "dist/index.d.ts"),
      `${entry.name} tarball must include dist/index.d.ts.`
    );

    if (entry.name === "@momentarise/md-theme") {
      // MME-0100: the packaged component stylesheet (and its token layer) must ship so a
      // registry consumer can import @momentarise/md-theme/styles.css.
      assert(tarEntries.includes("src/styles.css"), "@momentarise/md-theme tarball must include src/styles.css.");
      assert(tarEntries.includes("src/tokens.css"), "@momentarise/md-theme tarball must include src/tokens.css.");
    }

    for (const path of tarEntries) {
      // tsc's outDir only ever emits .js, .d.ts, and .d.ts.map (declarationMap is on, sourceMap is
      // not) — a file under dist/ with any other extension is a stray build artifact, not a
      // legitimate compiler output, and must not slip through as "anything under dist/ is fine".
      const isExpectedDistOutput = path.startsWith("dist/") && /\.(js|d\.ts|d\.ts\.map)$/.test(path);
      const allowed =
        path === "package.json" ||
        path === "README.md" ||
        path === "LICENSE" ||
        isExpectedDistOutput ||
        extraAllowed.has(path);
      assert(allowed, `${entry.name} tarball leaks an unexpected file: ${path}.`);
      assert(
        !path.includes("tsconfig.tsbuildinfo"),
        `${entry.name} tarball must not ship the internal TypeScript build cache (${path}).`
      );
      assert(
        !path.startsWith("src/") || extraAllowed.has(path),
        `${entry.name} tarball must not ship undeclared source files (${path}).`
      );
      assert(
        !/\.test\.(mjs|ts|js)$/.test(path) && !path.startsWith("tests/"),
        `${entry.name} tarball must not ship test files (${path}).`
      );
    }
  }

  const licenseBytes = (await readFile(resolve(workspaceRoot, "LICENSE"))).length;
  for (const entry of packed) {
    const extractDir = join(tempRoot, "extract", entry.name.replace("@momentarise/", ""));
    await mkdirp(extractDir);
    execFileSync("tar", ["-xzf", entry.tarballPath, "-C", extractDir], { encoding: "utf8" });
    const extractedLicense = await readFile(join(extractDir, "package", "LICENSE"));
    assert(
      extractedLicense.length === licenseBytes,
      `${entry.name} tarball's LICENSE must match the repository root LICENSE exactly.`
    );
  }

  const coreEntry = packed.find((entry) => entry.name === "@momentarise/md-core");
  const installDir = join(tempRoot, "install-smoke");
  await mkdirp(installDir);
  await writeJson(join(installDir, "package.json"), {
    name: "mme-tarball-install-smoke",
    private: true,
    version: "0.0.0"
  });
  run("npm", ["install", coreEntry.tarballPath, "--no-audit", "--no-fund"], { cwd: installDir });
  const importResult = spawnSync(
    "node",
    ["-e", "import('@momentarise/md-core').then((m) => { if (typeof m.hashMarkdownContent !== 'function') throw new Error('missing export'); console.log('import-ok'); })"],
    { cwd: installDir, encoding: "utf8" }
  );
  assert(importResult.status === 0, `Installed @momentarise/md-core tarball must be importable: ${importResult.stderr}`);
  assert(importResult.stdout.includes("import-ok"), "Installed tarball import must resolve the expected export.");
} finally {
  if (process.env.MME_KEEP_SMOKE_TEMP !== "1") {
    await rm(tempRoot, { force: true, recursive: true });
  }
}

async function mkdirp(path) {
  await import("node:fs/promises").then(({ mkdir }) => mkdir(path, { recursive: true }));
}

async function writeJson(path, value) {
  await import("node:fs/promises").then(({ writeFile }) => writeFile(path, `${JSON.stringify(value, null, 2)}\n`));
}

function run(command, args, options) {
  const result = spawnSync(command, args, { encoding: "utf8", ...options });
  if (result.status !== 0) {
    throw new Error(`Command failed (${result.status}): ${command} ${args.join(" ")}\n${result.stdout}\n${result.stderr}`);
  }
  return result.stdout;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

console.log("consumer-tarball-install: all assertions passed.");
