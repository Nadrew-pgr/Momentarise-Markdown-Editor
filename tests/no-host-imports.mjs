import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const checkedSourceRoots = [
  "packages/md-core/src",
  "packages/md-format/src",
  "packages/md-save/src",
  "packages/md-policy/src",
  "packages/md-ai/src",
  "packages/md-editor/src",
  "packages/md-theme/src",
  "packages/md-preview-html/src",
  "packages/md-cli/src"
];

const forbiddenImports = [
  "react",
  "@theia/",
  "vscode",
  "@codemirror/",
  "codemirror",
  "prosemirror",
  "electron"
];

const forbiddenGlobalUsages = [
  ["window", [String.raw`(?<!\.)\bwindow\s*\.`, String.raw`\btypeof\s+window\b`]],
  ["document", [String.raw`(?<!\.)\bdocument\s*\.`, String.raw`\btypeof\s+document\b`]],
  ["navigator", [String.raw`(?<!\.)\bnavigator\s*\.`, String.raw`\btypeof\s+navigator\b`]],
  ["localStorage", [String.raw`(?<!\.)\blocalStorage\s*\.`, String.raw`\btypeof\s+localStorage\b`]],
  ["sessionStorage", [String.raw`(?<!\.)\bsessionStorage\s*\.`, String.raw`\btypeof\s+sessionStorage\b`]],
  ["indexedDB", [String.raw`(?<!\.)\bindexedDB\s*\.`, String.raw`\btypeof\s+indexedDB\b`]],
  ["HTMLElement", [String.raw`\bHTMLElement\b`]],
  ["HTMLDocument", [String.raw`\bHTMLDocument\b`]],
  ["FileReader", [String.raw`\bFileReader\b`]],
  ["FileSystemFileHandle", [String.raw`\bFileSystemFileHandle\b`]],
  ["Blob", [String.raw`\bnew\s+Blob\b`, String.raw`:\s*Blob\b`, String.raw`\bBlob\s*\[`]],
  ["Worker", [String.raw`\bnew\s+Worker\b`, String.raw`:\s*Worker\b`]],
  ["ServiceWorkerRegistration", [String.raw`\bServiceWorkerRegistration\b`]],
  ["ReactNative", [String.raw`\bReactNative\s*\.`, String.raw`\btypeof\s+ReactNative\b`]],
  ["Capacitor", [String.raw`\bCapacitor\s*\.`, String.raw`\btypeof\s+Capacitor\b`]],
  ["Cordova", [String.raw`\bCordova\s*\.`, String.raw`\btypeof\s+Cordova\b`]]
];

for (const sourceRoot of checkedSourceRoots) {
  const entry = join(sourceRoot, "index.ts");
  if (!existsSync(entry)) {
    throw new Error(`Missing host-independent public entrypoint: ${entry}`);
  }
}

const sourceFiles = checkedSourceRoots.flatMap((sourceRoot) => collectTypeScriptFiles(sourceRoot));

for (const file of sourceFiles) {
  const text = readFileSync(file, "utf8");
  for (const forbidden of forbiddenImports) {
    const importPattern = new RegExp(
      String.raw`(?:from\s+["']${escapeRegExp(forbidden)}|import\s+["']${escapeRegExp(forbidden)})`
    );
    if (importPattern.test(text)) {
      throw new Error(
        `Forbidden host/editor import "${forbidden}" found in ${relative(process.cwd(), file)}`
      );
    }
  }
  for (const [forbidden, patterns] of forbiddenGlobalUsages) {
    if (patterns.some((pattern) => new RegExp(pattern).test(text))) {
      throw new Error(
        `Forbidden host/browser/mobile API "${forbidden}" found in ${relative(process.cwd(), file)}`
      );
    }
  }
}

function collectTypeScriptFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      files.push(...collectTypeScriptFiles(path));
    } else if (path.endsWith(".ts")) {
      files.push(path);
    }
  }
  return files;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
