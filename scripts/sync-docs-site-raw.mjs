import { lstat, mkdir, readdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, extname, join, normalize, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicDocsRoot = join(repoRoot, "docs/public");
const agentArtifactsRoot = join(repoRoot, "docs/agent");
const docsSitePublicBaseRoot = join(repoRoot, "apps/docs-site/public");
const docsSitePublicRoot = join(docsSitePublicBaseRoot, "docs");
const docsSiteAgentRoot = join(docsSitePublicBaseRoot, "agent");
const rootArtifacts = ["llms.txt", "llms-full.txt"];

export async function syncDocsSiteRaw() {
  const realRepoRoot = await realpath(repoRoot);
  await assertSafeDirectory(publicDocsRoot, realRepoRoot);
  await assertSafeDirectory(agentArtifactsRoot, realRepoRoot);
  const realDocsSitePublicBaseRoot = await assertSafeDirectory(docsSitePublicBaseRoot, realRepoRoot);
  await ensureSafeDirectory(docsSitePublicRoot, realDocsSitePublicBaseRoot);
  await ensureSafeDirectory(docsSiteAgentRoot, realDocsSitePublicBaseRoot);

  await syncFileTree(publicDocsRoot, docsSitePublicRoot, new Set([".md"]), realRepoRoot, realDocsSitePublicBaseRoot);
  await syncFileTree(
    agentArtifactsRoot,
    docsSiteAgentRoot,
    new Set([".json", ".md"]),
    realRepoRoot,
    realDocsSitePublicBaseRoot
  );

  for (const relPath of rootArtifacts) {
    const source = join(repoRoot, relPath);
    const target = join(docsSitePublicBaseRoot, relPath);
    await copySafeFile(source, target, realRepoRoot, realDocsSitePublicBaseRoot);
  }
}

async function syncFileTree(sourceRoot, targetRoot, allowedExtensions, realRepoRoot, realPublicRoot) {
  const realSourceRoot = await assertSafeDirectory(sourceRoot, realRepoRoot);
  const realTargetRoot = await assertSafeDirectory(targetRoot, realPublicRoot);
  const sourceFiles = await collectAllowedFiles(sourceRoot, allowedExtensions);
  const sourceRelPaths = new Set(sourceFiles.map((path) => relative(sourceRoot, path).replaceAll("\\", "/")));

  for (const existing of await collectAllFiles(targetRoot)) {
    await assertInsideRoot(await realpath(existing), realTargetRoot, "existing static discovery output");
    const relPath = relative(targetRoot, existing).replaceAll("\\", "/");
    if (relPath !== ".gitignore" && !sourceRelPaths.has(relPath)) {
      await rm(existing, { force: true });
    }
  }

  for (const sourceFile of sourceFiles) {
    await assertInsideRoot(await realpath(sourceFile), realSourceRoot, "static discovery source");
    const relPath = relative(sourceRoot, sourceFile).replaceAll("\\", "/");
    const target = join(targetRoot, relPath);
    await mkdir(dirname(target), { recursive: true });
    await assertSafeWriteTarget(target, realTargetRoot);
    await writeFile(target, await readFile(sourceFile));
  }
}

async function copySafeFile(source, target, realSourceRoot, realTargetRoot) {
  const sourceStats = await lstat(source);
  if (sourceStats.isSymbolicLink() || !sourceStats.isFile()) {
    throw new Error(`Static discovery source must be a regular file, not a symlink: ${source}`);
  }
  await assertInsideRoot(await realpath(source), realSourceRoot, "static discovery source");
  await assertSafeWriteTarget(target, realTargetRoot);
  await writeFile(target, await readFile(source));
}

async function collectAllowedFiles(root, allowedExtensions) {
  const entries = existsSync(root) ? await readdir(root, { withFileTypes: true }) : [];
  const files = [];
  for (const entry of entries) {
    const fullPath = join(root, entry.name);
    const stats = await lstat(fullPath);
    if (stats.isSymbolicLink()) {
      throw new Error(`Symlinks are not allowed in docs-site raw sync: ${fullPath}`);
    }
    if (stats.isDirectory()) {
      files.push(...(await collectAllowedFiles(fullPath, allowedExtensions)));
    } else if (stats.isFile() && allowedExtensions.has(extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }
  return files.sort();
}

async function collectAllFiles(root) {
  const entries = existsSync(root) ? await readdir(root, { withFileTypes: true }) : [];
  const files = [];
  for (const entry of entries) {
    const fullPath = join(root, entry.name);
    const stats = await lstat(fullPath);
    if (stats.isSymbolicLink()) {
      throw new Error(`Symlinks are not allowed in docs-site raw sync: ${fullPath}`);
    }
    if (stats.isDirectory()) {
      files.push(...(await collectAllFiles(fullPath)));
    } else if (stats.isFile()) {
      files.push(fullPath);
    }
  }
  return files.sort();
}

async function ensureSafeDirectory(path, root) {
  if (existsSync(path)) {
    return assertSafeDirectory(path, root);
  }
  await assertInsideRoot(await realpath(dirname(path)), root, "raw sync directory parent");
  await mkdir(path);
  return assertSafeDirectory(path, root);
}

async function assertSafeDirectory(path, root) {
  const stats = await lstat(path);
  if (stats.isSymbolicLink()) {
    throw new Error(`Raw sync directory must not be a symlink: ${path}`);
  }
  const realPath = await realpath(path);
  await assertInsideRoot(realPath, root, "raw sync directory");
  return realPath;
}

async function assertSafeWriteTarget(path, root) {
  const parent = await realpath(dirname(path));
  await assertInsideRoot(parent, root, "raw sync target parent");
  if (existsSync(path)) {
    const stats = await lstat(path);
    if (stats.isSymbolicLink()) {
      throw new Error(`Raw sync target must not be a symlink: ${path}`);
    }
  }
}

async function assertInsideRoot(path, root, label) {
  const normalizedRoot = normalize(root);
  const normalizedPath = normalize(path);
  if (normalizedPath !== normalizedRoot && !normalizedPath.startsWith(`${normalizedRoot}${sep}`)) {
    throw new Error(`${label} escapes expected root: ${path}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await syncDocsSiteRaw();
}
