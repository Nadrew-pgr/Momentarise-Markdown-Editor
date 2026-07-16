import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { watch } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { syncDocsSiteRaw } from "./sync-docs-site-raw.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const docsRoot = join(repoRoot, "docs/public");
const docsSiteRoot = join(repoRoot, "apps/docs-site");
const nextCli = join(docsSiteRoot, "node_modules/next/dist/bin/next");
const watchers = new Map();
let syncQueue = Promise.resolve();
let closed = false;

await syncDocsSiteRaw();
await refreshWatchers();

const child = spawn(process.execPath, [nextCli, "dev", ...process.argv.slice(2)], {
  cwd: docsSiteRoot,
  env: {
    ...process.env,
    NEXT_IGNORE_INCORRECT_LOCKFILE: "1"
  },
  stdio: "inherit"
});

child.on("exit", (code, signal) => {
  closeWatchers();
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    closeWatchers();
    child.kill(signal);
  });
}

async function scheduleRawSync() {
  syncQueue = syncQueue
    .then(async () => {
      await syncDocsSiteRaw();
      await refreshWatchers();
    })
    .catch((error) => {
      console.error(`[docs-site] raw Markdown sync failed: ${error instanceof Error ? error.message : String(error)}`);
    });
  await syncQueue;
}

async function refreshWatchers() {
  if (closed) {
    return;
  }
  const directories = await collectDirectories(docsRoot);
  for (const directory of directories) {
    if (watchers.has(directory)) {
      continue;
    }
    const watcher = watch(directory, { persistent: true }, (_event, fileName) => {
      if (!fileName || String(fileName).endsWith(".md")) {
        void scheduleRawSync();
      }
    });
    watchers.set(directory, watcher);
  }
  for (const [directory, watcher] of watchers) {
    if (!directories.includes(directory)) {
      watcher.close();
      watchers.delete(directory);
    }
  }
}

async function collectDirectories(root) {
  if (!existsSync(root)) {
    return [];
  }
  const directories = [root];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const fullPath = join(root, entry.name);
    const entryStat = await stat(fullPath);
    if (entryStat.isDirectory()) {
      directories.push(...(await collectDirectories(fullPath)));
    }
  }
  return directories;
}

function closeWatchers() {
  closed = true;
  for (const watcher of watchers.values()) {
    watcher.close();
  }
  watchers.clear();
}
