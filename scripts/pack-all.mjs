import { mkdir, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const workspaceRoot = process.cwd();
const outDir = resolve(workspaceRoot, process.argv[2] ?? "dist-pack");

const packagesDir = resolve(workspaceRoot, "packages");
const dirs = (await readdir(packagesDir, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const publishable = [];
for (const dir of dirs) {
  const manifestPath = resolve(packagesDir, dir, "package.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (manifest.private) {
    continue;
  }
  publishable.push({ dir, manifest });
}

await mkdir(outDir, { recursive: true });

const results = [];
for (const { dir, manifest } of publishable) {
  const packageDir = resolve(packagesDir, dir);
  const output = run("npm", ["pack", packageDir, "--pack-destination", outDir, "--json"], { cwd: workspaceRoot });
  const [entry] = JSON.parse(output);
  results.push({
    filename: entry.filename,
    files: entry.files.map((file) => file.path),
    name: manifest.name,
    tarballPath: resolve(outDir, entry.filename)
  });
}

console.log(JSON.stringify(results, null, 2));

function run(command, args, options) {
  const result = spawnSync(command, args, { encoding: "utf8", ...options });
  if (result.status !== 0) {
    throw new Error(`Command failed (${result.status}): ${command} ${args.join(" ")}\n${result.stdout}\n${result.stderr}`);
  }
  return result.stdout;
}
