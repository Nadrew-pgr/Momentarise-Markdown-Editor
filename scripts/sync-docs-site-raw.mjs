import { lstat, mkdir, readdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, normalize, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicDocsRoot = join(repoRoot, "docs/public");
const docsSitePublicBaseRoot = join(repoRoot, "apps/docs-site/public");
const docsSitePublicRoot = join(docsSitePublicBaseRoot, "docs");

export async function syncDocsSiteRaw() {
  await mkdir(docsSitePublicRoot, { recursive: true });
  const realRepoRoot = await realpath(repoRoot);
  await assertSafeDirectory(publicDocsRoot, realRepoRoot);
  const realDocsSitePublicBaseRoot = await assertSafeDirectory(docsSitePublicBaseRoot, realRepoRoot);
  const realDocsSitePublicRoot = await assertSafeDirectory(docsSitePublicRoot, realRepoRoot);
  const sourceFiles = await collectMarkdownFiles(publicDocsRoot);
  const sourceRelPaths = new Set(sourceFiles.map((path) => relative(publicDocsRoot, path).replaceAll("\\", "/")));

  for (const staleRootMarkdown of await collectMarkdownFiles(docsSitePublicBaseRoot)) {
    const relPath = relative(docsSitePublicBaseRoot, staleRootMarkdown).replaceAll("\\", "/");
    if (!relPath.startsWith("docs/")) {
      await assertInsideRoot(await realpath(staleRootMarkdown), realDocsSitePublicBaseRoot, "stale root raw Markdown output");
      await rm(staleRootMarkdown, { force: true });
    }
  }

  for (const existing of await collectMarkdownFiles(docsSitePublicRoot)) {
    await assertInsideRoot(await realpath(existing), realDocsSitePublicRoot, "existing raw Markdown output");
    const relPath = relative(docsSitePublicRoot, existing).replaceAll("\\", "/");
    if (!sourceRelPaths.has(relPath)) {
      await rm(existing, { force: true });
    }
  }

  for (const sourceFile of sourceFiles) {
    const relPath = relative(publicDocsRoot, sourceFile).replaceAll("\\", "/");
    const target = join(docsSitePublicRoot, relPath);
    await mkdir(dirname(target), { recursive: true });
    await assertSafeWriteTarget(target, realDocsSitePublicRoot);
    await writeFile(target, await readFile(sourceFile, "utf8"));
  }

  const gitignoreTarget = join(docsSitePublicRoot, ".gitignore");
  if (!existsSync(gitignoreTarget)) {
    await assertSafeWriteTarget(gitignoreTarget, realDocsSitePublicRoot);
    await writeFile(gitignoreTarget, "*.md\n**/*.md\n");
  }
}

async function collectMarkdownFiles(root) {
  const entries = existsSync(root) ? await readdir(root, { withFileTypes: true }) : [];
  const files = [];
  for (const entry of entries) {
    const fullPath = join(root, entry.name);
    const stats = await lstat(fullPath);
    if (stats.isSymbolicLink()) {
      throw new Error(`Symlinks are not allowed in docs-site raw sync: ${fullPath}`);
    }
    if (stats.isDirectory()) {
      files.push(...(await collectMarkdownFiles(fullPath)));
    } else if (stats.isFile() && entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }
  return files.sort();
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
