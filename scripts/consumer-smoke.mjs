import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const workspaceRoot = process.cwd();
const packageNames = [
  "@momentarise/md-core",
  "@momentarise/md-format",
  "@momentarise/md-save",
  "@momentarise/md-policy",
  "@momentarise/md-ai",
  "@momentarise/md-editor",
  "@momentarise/md-preview-html",
  "@momentarise/md-rich-prosemirror",
  "@momentarise/md-source-codemirror",
  "@momentarise/md-adapter-web",
  "@momentarise/md-cli"
];
const packageDirs = Object.fromEntries(
  packageNames.map((packageName) => [packageName, `packages/${packageName.replace("@momentarise/", "")}`])
);
const externalDependencies = {
  "@codemirror/autocomplete": "^6.0.0",
  "@codemirror/commands": "^6.0.0",
  "@codemirror/lang-markdown": "^6.0.0",
  "@codemirror/language": "^6.0.0",
  "@codemirror/search": "^6.0.0",
  "@codemirror/state": "^6.0.0",
  "@codemirror/view": "^6.0.0",
  "codemirror": "^6.0.0",
  "prosemirror-commands": "^1.7.1",
  "prosemirror-history": "^1.5.0",
  "prosemirror-keymap": "^1.2.3",
  "prosemirror-model": "^1.25.4",
  "prosemirror-state": "^1.4.4",
  "prosemirror-transform": "^1.10.5",
  "prosemirror-view": "^1.41.4"
};
const devDependencies = {
  "typescript": "^5.0.0",
  "vite": "^8.0.14"
};

const tempRoot = await mkdtemp(join(tmpdir(), "mme-consumer-smoke-"));
try {
  run("npm", ["run", "build"], { cwd: workspaceRoot });
  const packDir = join(tempRoot, "packs");
  await mkdirp(packDir);
  const tarballs = {};
  for (const packageName of packageNames) {
    const packageDir = packageDirs[packageName];
    const output = run("npm", ["pack", `./${packageDir}`, "--pack-destination", packDir], { cwd: workspaceRoot });
    const tarballName = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).at(-1);
    if (!tarballName) {
      throw new Error(`npm pack did not return a tarball name for ${packageName}.`);
    }
    tarballs[packageName] = resolve(packDir, tarballName);
  }

  const npmConsumer = await createConsumer(join(tempRoot, "npm-consumer"), tarballs);
  run("npm", ["install"], { cwd: npmConsumer });
  run("npm", ["run", "typecheck"], { cwd: npmConsumer });
  run("npm", ["run", "build"], { cwd: npmConsumer });
  assertSingleEditorInstances(npmConsumer, "npm");

  const pnpmConsumer = await createConsumer(join(tempRoot, "pnpm-consumer"), tarballs);
  run("npx", ["pnpm", "install", "--strict-peer-dependencies"], { cwd: pnpmConsumer });
  run("npx", ["pnpm", "run", "typecheck"], { cwd: pnpmConsumer });
  run("npx", ["pnpm", "run", "build"], { cwd: pnpmConsumer });
  assertSingleEditorInstances(pnpmConsumer, "pnpm");
} finally {
  if (process.env.MME_KEEP_SMOKE_TEMP !== "1") {
    await rm(tempRoot, { force: true, recursive: true });
  } else {
    console.log(`Keeping smoke temp directory: ${tempRoot}`);
  }
}

async function createConsumer(targetDir, tarballs) {
  await cp(join(workspaceRoot, "examples/consumer-smoke"), targetDir, { recursive: true });
  const manifestPath = join(targetDir, "package.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const internalDependencies = Object.fromEntries(
    packageNames.map((packageName) => [packageName, `file:${tarballs[packageName]}`])
  );
  manifest.dependencies = {
    ...internalDependencies,
    ...externalDependencies
  };
  manifest.devDependencies = devDependencies;
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(
    join(targetDir, "pnpm-workspace.yaml"),
    [
      "overrides:",
      ...Object.entries(internalDependencies).map(([packageName, spec]) => `  ${JSON.stringify(packageName)}: ${JSON.stringify(spec)}`),
      ""
    ].join("\n")
  );
  return targetDir;
}

function assertSingleEditorInstances(consumerDir, label) {
  const output = run("npm", ["ls", "@codemirror/state", "prosemirror-model", "--all", "--json"], {
    cwd: consumerDir
  });
  const tree = JSON.parse(output);
  if (tree.problems?.length) {
    throw new Error(`${label} consumer dependency tree has problems:\n${tree.problems.join("\n")}`);
  }
  for (const packageName of ["@codemirror/state", "prosemirror-model"]) {
    const versions = collectPackageVersions(tree, packageName);
    if (versions.size !== 1) {
      throw new Error(
        `${label} consumer expected one ${packageName} version, got ${versions.size}: ${[...versions].join(", ")}`
      );
    }
  }
}

function collectPackageVersions(node, packageName, versions = new Set()) {
  const dependency = node.dependencies?.[packageName];
  if (dependency?.version) {
    versions.add(dependency.version);
  }
  for (const child of Object.values(node.dependencies ?? {})) {
    collectPackageVersions(child, packageName, versions);
  }
  return versions;
}

async function mkdirp(path) {
  await mkdir(path, { recursive: true });
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? workspaceRoot,
    encoding: "utf8",
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (result.status !== 0) {
    throw new Error(
      `Command failed (${result.status}): ${command} ${args.join(" ")}\n` +
        `cwd: ${options.cwd ?? workspaceRoot}\n` +
        `stdout:\n${result.stdout}\n` +
        `stderr:\n${result.stderr}`
    );
  }
  const stderr = result.stderr.trim();
  if (stderr) {
    console.error(stderr);
  }
  return result.stdout.trim();
}
