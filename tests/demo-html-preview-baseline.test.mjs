import { existsSync, readFileSync } from "node:fs";

const demoSource = readFileSync("apps/md-demo/src/main.ts", "utf8");
const surfaceSource = readFileSync("packages/md-surface/src/index.ts", "utf8");
const styles = readFileSync("apps/md-demo/src/styles.css", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const demoPackageJson = JSON.parse(readFileSync("apps/md-demo/package.json", "utf8"));

for (const snippet of [
  "@momentarise/md-preview-html",
  "createSandboxedHtmlPreview",
  "data-testid=\"open-html-file-button\"",
  "data-testid=\"html-file-input\"",
  "data-testid=\"html-preview-host\"",
  "data-testid=\"html-preview-frame\"",
  "data-testid=\"html-preview-details\"",
  "data-testid=\"html-preview-details-toggle\"",
  "data-testid=\"html-preview-details-menu\"",
  "data-testid=\"html-preview-sandbox-tokens\"",
  "data-testid=\"html-preview-scripts\"",
  "data-testid=\"html-preview-save-truth\"",
  "data-testid=\"html-preview-status\"",
  "loadHtmlArtifactForTest",
  "getHtmlPreviewState",
  "html-artifact"
]) {
  if (!demoSource.includes(snippet)) {
    throw new Error(`MME-0015 demo HTML preview baseline missing: ${snippet}`);
  }
}

if (demoSource.includes("data-testid=\"html-preview-banner\"")) {
  throw new Error("MME-0046 normal HTML preview must not keep a permanent technical banner.");
}

if (!surfaceSource.includes("preview-mode-button")) {
  throw new Error("MME-0015 mode control surface must still expose the HTML Preview mode button.");
}

for (const snippet of [
  ".html-preview-host",
  ".html-preview-details",
  ".html-preview-details-menu",
  ".html-preview-frame"
]) {
  if (!styles.includes(snippet)) {
    throw new Error(`MME-0015 demo HTML preview style missing: ${snippet}`);
  }
}
// MME-0100: the mode control is md-surface markup; its CSS ships in the packaged stylesheet.
for (const snippet of [".mode-button:disabled"]) {
  if (!readFileSync("packages/md-theme/src/styles.css", "utf8").includes(snippet)) {
    throw new Error(`MME-0015 mode-control style missing from packaged stylesheet: ${snippet}`);
  }
}

if (styles.includes(".html-preview-banner")) {
  throw new Error("MME-0046 styles must remove the permanent HTML preview banner strip.");
}

if (!packageJson.scripts?.["visual:mme-0015"]) {
  throw new Error("Root package must expose visual:mme-0015.");
}
if (!packageJson.scripts?.["visual:mme-0046"]) {
  throw new Error("Root package must expose visual:mme-0046.");
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
for (const artifact of ["html-source-opened.png", "html-sandbox-preview.png", "html-restored-after-reload.png"]) {
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
  "html-restored-after-reload.png",
  "Page.reload",
  "sandboxAllowsScripts"
]) {
  if (!visualScript.includes(snippet)) {
    throw new Error(`MME-0015 visual script missing: ${snippet}`);
  }
}

const htmlPolishVisualScript = readFileSync("scripts/visual-check-mme0046.mjs", "utf8");
for (const snippet of [
  "normal-html-reading-desktop.png",
  "normal-html-reading-constrained.png",
  "html-preview-details-open.png",
  "html-preview-script-blocked.png",
  "html-preview-details-toggle",
  "html-preview-details-menu",
  "sandboxAllowsScripts"
]) {
  if (!htmlPolishVisualScript.includes(snippet)) {
    throw new Error(`MME-0046 visual script missing: ${snippet}`);
  }
}
