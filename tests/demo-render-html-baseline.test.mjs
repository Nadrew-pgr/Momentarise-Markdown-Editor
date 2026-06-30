import { existsSync, readFileSync } from "node:fs";

const demoSource = readFileSync("apps/md-demo/src/main.ts", "utf8");
const styles = readFileSync("apps/md-demo/src/styles.css", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const demoPackageJson = JSON.parse(readFileSync("apps/md-demo/package.json", "utf8"));

for (const snippet of [
  "@momentarise/md-render-html",
  "renderMarkdownToHtml",
  "data-testid=\"markdown-read-host\"",
  "data-testid=\"markdown-read-article\"",
  "data-testid=\"markdown-read-banner\"",
  "renderMarkdownReadView",
  "getMarkdownReadState",
  "Markdown read view"
]) {
  if (!demoSource.includes(snippet)) {
    throw new Error(`MME-0032 demo render baseline missing: ${snippet}`);
  }
}

for (const snippet of [
  ".markdown-read-host",
  ".markdown-read-banner",
  ".markdown-read-article",
  ".markdown-read-article pre",
  ".markdown-read-article :where(code"
]) {
  if (!styles.includes(snippet)) {
    throw new Error(`MME-0032 demo render style missing: ${snippet}`);
  }
}

if (!packageJson.scripts?.["test:render-html"]) {
  throw new Error("Root package must expose test:render-html.");
}
if (!packageJson.scripts?.["test:demo-render-html"]) {
  throw new Error("Root package must expose test:demo-render-html.");
}
if (!packageJson.scripts?.["visual:mme-0032"]) {
  throw new Error("Root package must expose visual:mme-0032.");
}
if (!packageJson.scripts?.test?.includes("test:render-html")) {
  throw new Error("Root npm test must include render HTML package tests.");
}
if (!packageJson.scripts?.test?.includes("test:demo-render-html")) {
  throw new Error("Root npm test must include demo render HTML baseline tests.");
}
if (!demoPackageJson.dependencies?.["@momentarise/md-render-html"]) {
  throw new Error("Demo package must depend on @momentarise/md-render-html.");
}

const visualReadme = "docs/internal/visual-checks/MME-0032/README.md";
if (!existsSync(visualReadme)) {
  throw new Error("MME-0032 visual checks README must exist.");
}

const visualReadmeText = readFileSync(visualReadme, "utf8");
for (const artifact of ["markdown-read-view.png", "markdown-read-sanitized-html.png"]) {
  if (!visualReadmeText.includes(artifact)) {
    throw new Error(`MME-0032 visual README missing artifact: ${artifact}`);
  }
}

const visualScript = readFileSync("scripts/visual-check-mme0032.mjs", "utf8");
for (const snippet of [
  "__MME_RENDER_HTML_SCRIPT_RAN__",
  "markdown-read-view.png",
  "markdown-read-sanitized-html.png",
  "getMarkdownReadState",
  "getHtmlPreviewState"
]) {
  if (!visualScript.includes(snippet)) {
    throw new Error(`MME-0032 visual script missing: ${snippet}`);
  }
}

for (const artifact of ["markdown-read-view.png", "markdown-read-sanitized-html.png"]) {
  const artifactPath = `docs/internal/visual-checks/MME-0032/${artifact}`;
  const artifactStat = readFileSync(artifactPath);
  if (artifactStat.length < 1000) {
    throw new Error(`MME-0032 visual artifact appears too small: ${artifact}`);
  }
}
