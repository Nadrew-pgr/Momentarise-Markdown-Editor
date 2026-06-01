import { existsSync, readFileSync } from "node:fs";

const demoSource = readFileSync("apps/md-demo/src/main.ts", "utf8");
const styles = readFileSync("apps/md-demo/src/styles.css", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const demoPackageJson = JSON.parse(readFileSync("apps/md-demo/package.json", "utf8"));

for (const snippet of [
  "@momentarise/md-preview-html",
  "createSandboxedHtmlPreview",
  "data-testid=\"open-html-file-button\"",
  "data-testid=\"html-file-input\"",
  "data-testid=\"preview-mode-button\"",
  "data-testid=\"html-preview-host\"",
  "data-testid=\"html-preview-banner\"",
  "data-testid=\"html-preview-frame\"",
  "data-testid=\"html-preview-status\"",
  "loadHtmlArtifactForTest",
  "getHtmlPreviewState",
  "html-artifact"
]) {
  if (!demoSource.includes(snippet)) {
    throw new Error(`MME-0015 demo HTML preview baseline missing: ${snippet}`);
  }
}

for (const snippet of [
  ".html-preview-host",
  ".html-preview-banner",
  ".html-preview-frame",
  ".mode-button:disabled"
]) {
  if (!styles.includes(snippet)) {
    throw new Error(`MME-0015 demo HTML preview style missing: ${snippet}`);
  }
}

if (!packageJson.scripts?.["visual:mme-0015"]) {
  throw new Error("Root package must expose visual:mme-0015.");
}
if (!packageJson.scripts?.test?.includes("test:html-preview")) {
  throw new Error("Root npm test must include HTML preview package tests.");
}
if (!packageJson.scripts?.test?.includes("test:demo-html-preview")) {
  throw new Error("Root npm test must include demo HTML preview baseline tests.");
}
if (!demoPackageJson.dependencies?.["@momentarise/md-preview-html"]) {
  throw new Error("Demo package must depend on @momentarise/md-preview-html.");
}

const visualReadme = "docs/internal/visual-checks/MME-0015/README.md";
if (!existsSync(visualReadme)) {
  throw new Error("MME-0015 visual checks README must exist.");
}

const visualReadmeText = readFileSync(visualReadme, "utf8");
for (const artifact of ["html-source-opened.png", "html-sandbox-preview.png"]) {
  if (!visualReadmeText.includes(artifact)) {
    throw new Error(`MME-0015 visual README missing artifact: ${artifact}`);
  }
}

const visualScript = readFileSync("scripts/visual-check-mme0015.mjs", "utf8");
for (const snippet of [
  "__MME_HTML_PREVIEW_SCRIPT_RAN__",
  "DOM.setFileInputFiles",
  "html-file-input",
  "html-source-opened.png",
  "html-sandbox-preview.png",
  "sandboxAllowsScripts"
]) {
  if (!visualScript.includes(snippet)) {
    throw new Error(`MME-0015 visual script missing: ${snippet}`);
  }
}
