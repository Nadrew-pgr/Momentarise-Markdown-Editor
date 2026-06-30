import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const workspaceRoot = process.cwd();
const packageNames = [
  "@momentarise/md-core",
  "@momentarise/md-format",
  "@momentarise/md-save",
  "@momentarise/md-policy",
  "@momentarise/md-ai",
  "@momentarise/md-editor",
  "@momentarise/md-theme",
  "@momentarise/md-surface",
  "@momentarise/md-react",
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
  "@lezer/highlight": "^1.2.3",
  "codemirror": "^6.0.0",
  "prosemirror-commands": "^1.7.1",
  "prosemirror-history": "^1.5.0",
  "prosemirror-keymap": "^1.2.3",
  "prosemirror-model": "^1.25.4",
  "prosemirror-state": "^1.4.4",
  "prosemirror-transform": "^1.10.5",
  "prosemirror-view": "^1.41.4",
  "react": "^18.2.0"
};
const devDependencies = {
  "@types/react": "^18.2.0",
  "typescript": "^5.0.0",
  "vite": "^8.0.14"
};
const nextDependencies = {
  "next": "^15.0.0",
  "react-dom": "^18.2.0"
};
const nextDevDependencies = {
  "@types/node": "^20.19.0",
  "@types/react": "^18.2.0",
  "@types/react-dom": "^18.2.0",
  "typescript": "^5.0.0"
};
const vanillaPackageNames = packageNames.filter((packageName) => packageName !== "@momentarise/md-react");
const offlineMode = process.env.MME_CONSUMER_MATRIX_OFFLINE === "1";

const tempRoot = await mkdtemp(join(tmpdir(), "mme-consumer-matrix-"));
try {
  run("npm", ["run", "build"], { cwd: workspaceRoot });
  const packDir = join(tempRoot, "packs");
  await mkdirp(packDir);
  const tarballs = await packWorkspacePackages(packDir);

  await runConsumerLeg({
    fixtureDir: "examples/consumer-smoke",
    id: "vite-vanilla-ts:npm",
    internalPackageNames: vanillaPackageNames,
    manager: "npm",
    tarballs
  });
  await runConsumerLeg({
    fixtureDir: "examples/consumer-smoke",
    id: "vite-vanilla-ts:pnpm-strict",
    internalPackageNames: vanillaPackageNames,
    manager: "pnpm",
    tarballs
  });
  await runConsumerLeg({
    dependencies: nextDependencies,
    baseDevDependencies: false,
    devDependencies: nextDevDependencies,
    fixtureDir: "examples/consumer-next-app-router",
    id: "next-app-router:npm",
    manager: "npm",
    skipEnv: "MME_SKIP_CONSUMER_NEXT",
    tarballs
  });
  await runConsumerLeg({
    dependencies: nextDependencies,
    baseDevDependencies: false,
    devDependencies: nextDevDependencies,
    fixtureDir: "examples/consumer-next-app-router",
    id: "next-app-router:pnpm-strict",
    manager: "pnpm",
    skipEnv: "MME_SKIP_CONSUMER_NEXT",
    tarballs
  });
  await runTypeResolutionConsumer(tarballs);
  await runTreeShakeConsumer(tarballs);
} finally {
  if (process.env.MME_KEEP_SMOKE_TEMP !== "1") {
    await rm(tempRoot, { force: true, recursive: true });
  } else {
    console.log(`Keeping consumer matrix temp directory: ${tempRoot}`);
  }
}

async function packWorkspacePackages(packDir) {
  const tarballs = {};
  for (const packageName of packageNames) {
    const packageDir = packageDirs[packageName];
    const output = run("npm", ["pack", `./${packageDir}`, "--pack-destination", packDir, "--silent"], { cwd: workspaceRoot });
    const tarballName = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).at(-1);
    if (!tarballName) {
      throw new Error(`npm pack did not return a tarball name for ${packageName}.`);
    }
    tarballs[packageName] = resolve(packDir, tarballName);
  }
  return tarballs;
}

async function runConsumerLeg(options) {
  if (isSkipped(options.id, offlineMode ? "MME_CONSUMER_MATRIX_OFFLINE" : (options.skipEnv ?? skipEnvForManager(options.manager)))) {
    return;
  }
  const internalPackageNames = options.internalPackageNames ?? packageNames;
  const consumerDir = await createConsumer(join(tempRoot, sanitizeId(options.id)), options.fixtureDir, options.tarballs, {
    dependencies: {
      ...externalDependencies,
      ...(options.dependencies ?? {})
    },
    devDependencies: {
      ...(options.baseDevDependencies === false ? {} : devDependencies),
      ...(options.devDependencies ?? {})
    },
    internalPackageNames
  });
  install(consumerDir, options.manager);
  runScript(consumerDir, options.manager, "typecheck");
  assertImportTimeSafe(consumerDir, options.id, internalPackageNames);
  runScript(consumerDir, options.manager, "build");
  assertSingleEditorInstances(consumerDir, options.id);
}

async function runTypeResolutionConsumer(tarballs) {
  if (isSkipped("type-resolution", offlineMode ? "MME_CONSUMER_MATRIX_OFFLINE" : "MME_SKIP_CONSUMER_TYPECHECK")) {
    return;
  }
  const targetDir = join(tempRoot, "type-resolution");
  await mkdirp(join(targetDir, "src"));
  const internalDependencies = internalDependencyMap(tarballs, packageNames);
  await writeFile(
    join(targetDir, "package.json"),
    `${JSON.stringify({
      name: "momentarise-type-resolution-consumer",
      version: "0.0.0",
      private: true,
      type: "module",
      scripts: {
        "typecheck:bundler": "tsc -p tsconfig.bundler.json --noEmit",
        "typecheck:node16": "tsc -p tsconfig.node16.json --noEmit"
      },
      dependencies: {
        ...internalDependencies,
        ...externalDependencies
      },
      devDependencies
    }, null, 2)}\n`
  );
  await writePnpmOverrides(targetDir, internalDependencies);
  await writeFile(
    join(targetDir, "src/index.ts"),
    [
      'import type { MarkdownEditorReactOptions } from "@momentarise/md-react";',
      'import { createMemorySaveTarget } from "@momentarise/md-save";',
      "",
      'const content = "# Type consumer\\n\\nNo exact optional property types here.\\n";',
      "const options: MarkdownEditorReactOptions = {",
      "  content,",
      "  scheduler: {",
      "    schedule(callback) {",
      "      callback();",
      "      return () => undefined;",
      "    }",
      "  },",
      "  target: createMemorySaveTarget({ initialContent: content })",
      "};",
      "",
      "void options;",
      ""
    ].join("\n")
  );
  await writeFile(join(targetDir, "tsconfig.bundler.json"), `${JSON.stringify(typeScriptConfig("ESNext", "bundler"), null, 2)}\n`);
  await writeFile(join(targetDir, "tsconfig.node16.json"), `${JSON.stringify(typeScriptConfig("Node16", "Node16"), null, 2)}\n`);
  install(targetDir, "npm");
  run("npm", ["run", "typecheck:bundler"], { cwd: targetDir });
  run("npm", ["run", "typecheck:node16"], { cwd: targetDir });
}

async function runTreeShakeConsumer(tarballs) {
  if (isSkipped("tree-shake-md-format", offlineMode ? "MME_CONSUMER_MATRIX_OFFLINE" : "MME_SKIP_CONSUMER_TREE_SHAKE")) {
    return;
  }
  const targetDir = join(tempRoot, "tree-shake-md-format");
  await mkdirp(join(targetDir, "src"));
  const internalDependencies = internalDependencyMap(tarballs, ["@momentarise/md-core", "@momentarise/md-format"]);
  await writeFile(
    join(targetDir, "package.json"),
    `${JSON.stringify({
      name: "momentarise-tree-shake-consumer",
      version: "0.0.0",
      private: true,
      type: "module",
      scripts: {
        build: "vite build"
      },
      dependencies: internalDependencies,
      devDependencies
    }, null, 2)}\n`
  );
  await writePnpmOverrides(targetDir, internalDependencies);
  await writeFile(join(targetDir, "index.html"), '<div id="app"></div><script type="module" src="/src/main.ts"></script>\n');
  await writeFile(
    join(targetDir, "src/main.ts"),
    [
      'import { createMarkdownAstParser } from "@momentarise/md-format";',
      "",
      'const result = createMarkdownAstParser().parse("# Tree shake\\n", { dialect: "momentarise-enhanced" });',
      'document.querySelector<HTMLDivElement>("#app")!.textContent = result.snapshot.hash;',
      ""
    ].join("\n")
  );
  install(targetDir, "npm");
  run("npm", ["run", "build"], { cwd: targetDir });
  const output = await readBuiltAssets(join(targetDir, "dist"));
  if (/prosemirror/i.test(output)) {
    throw new Error("Tree-shake consumer importing only @momentarise/md-format pulled ProseMirror into build output.");
  }
}

async function createConsumer(targetDir, fixtureDir, tarballs, options) {
  await cp(join(workspaceRoot, fixtureDir), targetDir, { recursive: true });
  const manifestPath = join(targetDir, "package.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const internalDependencies = internalDependencyMap(tarballs, options.internalPackageNames);
  manifest.dependencies = {
    ...internalDependencies,
    ...options.dependencies
  };
  manifest.devDependencies = options.devDependencies;
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  await writePnpmOverrides(targetDir, internalDependencies);
  return targetDir;
}

function internalDependencyMap(tarballs, names) {
  return Object.fromEntries(names.map((packageName) => [packageName, `file:${tarballs[packageName]}`]));
}

async function writePnpmOverrides(targetDir, internalDependencies) {
  await writeFile(
    join(targetDir, "pnpm-workspace.yaml"),
    [
      "overrides:",
      ...Object.entries(internalDependencies).map(([packageName, spec]) => `  ${JSON.stringify(packageName)}: ${JSON.stringify(spec)}`),
      ""
    ].join("\n")
  );
}

function install(consumerDir, manager) {
  if (manager === "pnpm") {
    run("npx", ["pnpm", "install", "--strict-peer-dependencies", "--ignore-scripts"], { cwd: consumerDir });
    return;
  }
  run("npm", ["install"], { cwd: consumerDir });
}

function runScript(consumerDir, manager, script) {
  if (manager === "pnpm") {
    run("npx", ["pnpm", "run", script], { cwd: consumerDir });
    return;
  }
  run("npm", ["run", script], { cwd: consumerDir });
}

function assertImportTimeSafe(consumerDir, label, names) {
  const importTargets = names.filter((packageName) => packageName !== "@momentarise/md-cli");
  const script = `${importTargets.map((packageName) => `await import(${JSON.stringify(packageName)})`).join("; ")}; console.log('import-safe')`;
  run("node", ["-e", script], {
    cwd: consumerDir
  });
  console.log(`[consumer-matrix] ${label}: import-time safe`);
}

function assertSingleEditorInstances(consumerDir, label) {
  const singletonPackages = [
    "@codemirror/state",
    "@codemirror/view",
    "prosemirror-model",
    "prosemirror-state",
    "prosemirror-view"
  ];
  const output = run("npm", ["ls", ...singletonPackages, "--all", "--json"], {
    cwd: consumerDir,
    logStdout: false
  });
  const tree = JSON.parse(output);
  if (tree.problems?.length) {
    throw new Error(`${label} consumer dependency tree has problems:\n${tree.problems.join("\n")}`);
  }
  for (const packageName of singletonPackages) {
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

async function readBuiltAssets(directory) {
  let output = "";
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      output += await readBuiltAssets(path);
    } else if (entry.isFile()) {
      output += await readFile(path, "utf8");
    }
  }
  return output;
}

function typeScriptConfig(module, moduleResolution) {
  return {
    compilerOptions: {
      allowSyntheticDefaultImports: true,
      module,
      moduleResolution,
      noEmit: true,
      skipLibCheck: true,
      strict: true,
      target: "ES2022"
    },
    include: ["src"]
  };
}

function isSkipped(label, envName) {
  if (!envName || process.env[envName] !== "1") {
    return false;
  }
  console.warn(`[consumer-matrix] SKIPPED ${label}: ${envName}=1`);
  return true;
}

function skipEnvForManager(manager) {
  return manager === "pnpm" ? "MME_SKIP_CONSUMER_PNPM" : null;
}

function sanitizeId(id) {
  return id.replace(/[^a-z0-9._-]+/gi, "-");
}

async function mkdirp(path) {
  await mkdir(path, { recursive: true });
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? workspaceRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      NPM_CONFIG_CACHE: join(tempRoot, ".npm-cache"),
      npm_config_cache: join(tempRoot, ".npm-cache")
    },
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
  const stdout = result.stdout.trim();
  if (stdout && options.logStdout !== false) {
    console.log(stdout);
  }
  return stdout;
}
