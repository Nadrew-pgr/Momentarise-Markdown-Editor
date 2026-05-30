import { existsSync, readFileSync } from "node:fs";

const requiredFiles = [
  "packages/md-rich-prosemirror/src/index.ts",
  "scripts/visual-check-mme0012.mjs",
  "docs/internal/visual-checks/MME-0012/README.md",
  "apps/md-demo/src/main.ts",
  "apps/md-demo/src/styles.css"
];

for (const file of requiredFiles) {
  if (!existsSync(file)) {
    throw new Error(`Missing MME-0012 required file: ${file}`);
  }
}

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
if (packageJson.scripts["visual:mme-0012"] !== "node scripts/visual-check-mme0012.mjs") {
  throw new Error("Missing visual:mme-0012 script.");
}
if (!packageJson.scripts.test.includes("test:rich-prosemirror")) {
  throw new Error("Root npm test must include rich ProseMirror package checks.");
}
if (!packageJson.scripts.test.includes("test:demo-rich")) {
  throw new Error("Root npm test must include rich demo baseline checks.");
}

const demoPackage = JSON.parse(readFileSync("apps/md-demo/package.json", "utf8"));
if (!demoPackage.dependencies["@momentarise/md-rich-prosemirror"]) {
  throw new Error("Demo must depend on @momentarise/md-rich-prosemirror.");
}

const richPackage = JSON.parse(readFileSync("packages/md-rich-prosemirror/package.json", "utf8"));
if (richPackage.private) {
  throw new Error("@momentarise/md-rich-prosemirror must be publishable like sibling framework packages.");
}
if (richPackage.sideEffects !== false) {
  throw new Error("@momentarise/md-rich-prosemirror must declare sideEffects false.");
}
if (!Array.isArray(richPackage.files) || !richPackage.files.includes("dist")) {
  throw new Error("@momentarise/md-rich-prosemirror must publish dist files only.");
}
if (richPackage.scripts?.build !== "tsc -b") {
  throw new Error("@momentarise/md-rich-prosemirror must expose a package-level build script.");
}

const main = readFileSync("apps/md-demo/src/main.ts", "utf8");
for (const snippet of [
  "@momentarise/md-rich-prosemirror",
  "source-mode-button",
  "rich-mode-button",
  "rich-editor-host",
  "primaryActionLabel",
  "switchEditorMode",
  "syncRichMarkdownToSource",
  "getEditorMode",
  "setRichSelectionAfterText"
]) {
  if (!main.includes(snippet)) {
    throw new Error(`Demo missing rich mode baseline snippet: ${snippet}`);
  }
}

const styles = readFileSync("apps/md-demo/src/styles.css", "utf8");
for (const snippet of [".rich-editor-host", ".ProseMirror", ".mode-switch"]) {
  if (!styles.includes(snippet)) {
    throw new Error(`Demo styles missing rich mode baseline snippet: ${snippet}`);
  }
}

const visual = readFileSync("scripts/visual-check-mme0012.mjs", "utf8");
for (const artifact of [
  "rich-mode-loaded.png",
  "rich-heading-paragraph-edited.png",
  "rich-code-fence-edited.png",
  "source-after-rich-roundtrip.png"
]) {
  if (!visual.includes(artifact)) {
    throw new Error(`MME-0012 visual script missing artifact: ${artifact}`);
  }
}
