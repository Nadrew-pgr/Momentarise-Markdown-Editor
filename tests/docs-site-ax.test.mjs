import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const rootPackage = await readJson("package.json");
assertScript("build:docs-site");
assertScript("test:docs-site");
assertScript("test:llms-sync");
assertScript("visual:mme-0038");

const appRoot = "apps/docs-site";
assert(existsSync(appRoot), "apps/docs-site must exist.");
assert(existsSync(join(appRoot, "src")), "apps/docs-site/src must exist.");
assert(existsSync("llms.txt"), "llms.txt must be committed.");
assert(existsSync("llms-full.txt"), "llms-full.txt must be committed.");

const manifest = await readJson(join(appRoot, "package.json"));
assert(manifest.name === "@momentarise/docs-site", "docs site app must use the expected workspace package name.");
assert(manifest.license === "Apache-2.0", "docs site app must use the demo/example Apache-2.0 license.");
assert(manifest.dependencies?.["@momentarise/md-render-html"], "docs site must depend on the MME renderer.");
assert(manifest.dependencies?.["@momentarise/md-editor"], "docs site must depend on the MME editor outline API.");
assert(manifest.dependencies?.["@momentarise/md-source-codemirror"], "docs site live demo must use the MME CodeMirror source package.");
assert(manifest.dependencies?.next, "docs site must be implemented as a Next.js app.");
assert(manifest.dependencies?.react, "docs site Next app must depend on React.");
assert(manifest.scripts?.["sync:raw"], "docs site must sync raw Markdown from docs/public before dev/build.");
assert(
  manifest.scripts?.build?.includes("generate-public-discovery.mjs"),
  "docs site build must regenerate public LLM and agent discovery artifacts."
);
assert(manifest.scripts?.dev?.includes("dev-docs-site.mjs"), "docs site dev script must watch raw Markdown sync.");
assert(manifest.scripts?.preview?.includes("preview-docs-site.mjs"), "docs site preview script must serve static out.");
assert(!manifest.scripts?.preview?.includes("next start"), "static-export docs site must not preview through next start.");
assert(!manifest.devDependencies?.vite && !manifest.dependencies?.vite, "docs site must not keep the superseded Vite app dependency.");

const appReadme = await readText(join(appRoot, "README.md"));
for (const required of ["@momentarise/docs-site", "Release status:", "Version policy:", "License: Apache-2.0"]) {
  assert(appReadme.includes(required), `docs site README must document ${required}.`);
}
const appLicense = await readText(join(appRoot, "LICENSE"));
assert(appLicense.includes("Apache License"), "docs site app must carry an Apache-2.0 LICENSE.");

const nextConfig = await readText(join(appRoot, "next.config.mjs"));
for (const required of [
  "output: \"export\"",
  "transpilePackages",
  "@momentarise/md-render-html"
]) {
  assert(nextConfig.includes(required), `docs site Next config must include ${required}.`);
}

const layoutSource = await readText(join(appRoot, "app/layout.tsx"));
const robotsSource = await readText(join(appRoot, "app/robots.ts"));
const sitemapSource = await readText(join(appRoot, "app/sitemap.ts"));
const faviconSource = await readText(join(appRoot, "app/favicon.ico/route.ts"));
const pageSource = await readText(join(appRoot, "app/page.tsx"));
const docsPageSource = await readText(join(appRoot, "app/docs/page.tsx"));
const slugPageSource = await readText(join(appRoot, "app/docs/[...slug]/page.tsx"));
const dataSource = await readText(join(appRoot, "src/docs-data.ts"));
const brandSource = await readText(join(appRoot, "src/BrandMark.tsx"));
const viewSource = await readText(join(appRoot, "src/DocsPageView.tsx"));
const actionsSource = await readText(join(appRoot, "src/DocActions.tsx"));
const agentActionsSource = await readText(join(appRoot, "src/agent-actions.ts"));
const generatedAgentActions = await readText("docs/agent/actions.json");
const searchSource = await readText(join(appRoot, "src/DocsSearch.tsx"));
const liveDemoSource = await readText(join(appRoot, "src/LiveMarkdownDemo.tsx"));
const themeSource = await readText(join(appRoot, "src/ThemeToggle.tsx"));
const htmlSource = await readText(join(appRoot, "src/rendered-html.ts"));
const stylesSource = await readText(join(appRoot, "src/styles.css"));
const appSource = `${layoutSource}\n${pageSource}\n${docsPageSource}\n${slugPageSource}\n${dataSource}\n${brandSource}\n${viewSource}\n${actionsSource}\n${agentActionsSource}\n${generatedAgentActions}\n${searchSource}\n${liveDemoSource}\n${themeSource}\n${htmlSource}`;
assert(faviconSource.includes("image/svg+xml"), "docs site must handle /favicon.ico outside the docs catch-all route.");
assert(!existsSync(join(appRoot, "app/[...slug]/page.tsx")), "docs routes must live under /docs, not as a root catch-all.");
for (const required of [
  "data-mme-scheme=\"light\"",
  "landing-hero",
  "/docs",
  "generateStaticParams",
  "next",
  "renderMarkdownToHtml",
  "createMarkdownEditorSession",
  "createMemorySaveTarget",
  "createMomentariseSourceView",
  "landing-story",
  "landing-workflow",
  "Rendered by Momentarise Markdown Editor",
  "copy-markdown",
  "copy-prompt",
  "copy-section",
  "copy-link",
  "open-in-chat",
  "getDocsAgentActionRegistry",
  "docs/agent/actions.json",
  "actionsRegistryJson",
  "assertAgentActionRegistry",
  "actionRegistry",
  "docs-outline",
  "docs-live-demo",
  "live-editor-frame",
  "lineWrapping: false",
  "serializeRenderedPreviewToMarkdown",
  "inlineNodeToMarkdown",
  "isMmeCustomHtmlBlock",
  "isSafeMarkdownHref",
  "Styled HTML Block",
  "slash editor",
  "mme-html-panel",
  "mme-slash-editor",
  "docs-search-trigger",
  "theme-toggle",
  "mme-docs-scheme",
  "safeDecodeComponent",
  "resolveAbsoluteDocsTarget",
  "removeDuplicatePageTitleHeading",
  "isSafeExternalHref",
  "escapeHtmlAttribute(href)",
  "noopener noreferrer",
  "dangerouslySetInnerHTML",
  "Popup blocked",
  "window.open"
]) {
  assert(appSource.includes(required), `docs site app source must include ${required}.`);
}
assert(!/--mme-space-[789]\b/.test(stylesSource), "docs site CSS must not reference undefined MME spacing tokens.");

const syncRawSource = await readText("scripts/sync-docs-site-raw.mjs");
for (const required of [
  "docs/public",
  "apps/docs-site/public",
  "docsSitePublicBaseRoot",
  "join(docsSitePublicBaseRoot, \"docs\")",
  "collectAllowedFiles",
  "collectAllFiles",
  "realpath",
  "lstat",
  "assertSafeWriteTarget",
  "Symlinks are not allowed"
]) {
  assert(syncRawSource.includes(required), `raw sync script must include ${required}.`);
}
for (const required of ["agentArtifactsRoot", "rootArtifacts", "collectAllowedFiles", "docsSiteAgentRoot"]) {
  assert(syncRawSource.includes(required), `raw sync script must publish discovery artifact source ${required}.`);
}

const devScript = await readText("scripts/dev-docs-site.mjs");
for (const required of ["watch", "syncDocsSiteRaw", "generatePublicDiscovery", "next", "docs/public"]) {
  assert(devScript.includes(required), `dev wrapper must include ${required}.`);
}

const previewScript = await readText("scripts/preview-docs-site.mjs");
for (const required of ["apps/docs-site/out", "createServer", "404.html", "text/markdown"]) {
  assert(previewScript.includes(required), `static preview script must include ${required}.`);
}
assert(previewScript.includes("normalizeRequestPath"), "static preview script must normalize request paths.");
assert(previewScript.includes("replace(/\\/+$/, \"\")"), "static preview script must strip trailing slashes before resolving static pages.");
assert(previewScript.includes("application/xml; charset=utf-8"), "static preview must serve sitemap.xml with an XML content type.");

const sharedSource = await readText(join(appRoot, "src/docs-shared.mjs"));
for (const required of [
  "parsePublicDocsFrontmatter",
  "comparePublicDocsPages",
  "sanitizeLlmsLineField",
  "assertSafePublicMarkdownPath",
  "validateAbsoluteUrl"
]) {
  assert(sharedSource.includes(required), `shared docs module must include ${required}.`);
}

const promptSource = await readText(join(appRoot, "src/prompt.ts"));
for (const required of [
  "Use web search if available.",
  "Prefer official docs.",
  "Cite sources when browsing.",
  "Respect Momentarise Markdown Editor's Markdown-as-source constraints.",
  "Do not assume JSON/block DB persistence.",
  "Separate framework-neutral guidance from host-specific integration."
]) {
  assert(promptSource.includes(required), `prompt template must include ${required}.`);
}

assert(agentActionsSource.includes("docs/agent/actions.json"), "docs site must load generated agent action descriptors.");
for (const required of [
  "chatgpt",
  "claude",
  "gemini",
  "mistral",
  "t3-chat",
  "scira",
  "v0",
  "claude-code",
  "codex",
  "cursor",
  "openclaw",
  "copilot"
]) {
  assert(generatedAgentActions.includes(required), `generated open-in-chat descriptors must include ${required}.`);
}

const publicDocs = await collectMarkdownFiles("docs/public");
assert(publicDocs.length > 0, "docs/public must contain Markdown docs.");
const publicDocPaths = publicDocs.map((doc) => relative("docs/public", doc).replaceAll("\\", "/"));
assert(publicDocPaths.includes("concepts/agentic-experience.md"), "public docs must include an Agentic Experience guide.");
assert(publicDocPaths.includes("packages/md-cli.md"), "public docs must include the CLI guide.");
for (const doc of publicDocs) {
  const relPath = relative("docs/public", doc).replaceAll("\\", "/");
  const publicRaw = join(appRoot, "public/docs", relPath);
  const builtRaw = join(appRoot, "out/docs", relPath);
  assert(existsSync(publicRaw), `docs site sync must emit raw Markdown at ${publicRaw}.`);
  assertEqual(await readText(publicRaw), await readText(doc), `synced raw Markdown must match docs/public/${relPath}.`);
  assert(existsSync(builtRaw), `docs site build must emit raw Markdown at ${builtRaw}.`);
  assertEqual(await readText(builtRaw), await readText(doc), `built raw Markdown must match docs/public/${relPath}.`);
}

const agentManifest = await readJson("docs/agent/manifest.json");
for (const [source, publicPath, builtPath] of [
  ["llms.txt", join(appRoot, "public/llms.txt"), join(appRoot, "out/llms.txt")],
  ["llms-full.txt", join(appRoot, "public/llms-full.txt"), join(appRoot, "out/llms-full.txt")],
  ["docs/agent/README.md", join(appRoot, "public/agent/README.md"), join(appRoot, "out/agent/README.md")],
  ["docs/agent/manifest.json", join(appRoot, "public/agent/manifest.json"), join(appRoot, "out/agent/manifest.json")],
  ["docs/agent/actions.json", join(appRoot, "public/agent/actions.json"), join(appRoot, "out/agent/actions.json")]
]) {
  assertEqual(await readText(publicPath), await readText(source), `${publicPath} must match ${source}.`);
  assertEqual(await readText(builtPath), await readText(source), `${builtPath} must match ${source}.`);
}
for (const skill of agentManifest.skills) {
  const publicSkill = join(appRoot, "public/agent/skills", skill.id, "SKILL.md");
  const builtSkill = join(appRoot, "out/agent/skills", skill.id, "SKILL.md");
  assertEqual(await readText(publicSkill), await readText(skill.path), `${publicSkill} must match ${skill.path}.`);
  assertEqual(await readText(builtSkill), await readText(skill.path), `${builtSkill} must match ${skill.path}.`);
}

const builtRobots = await readText(join(appRoot, "out/robots.txt"));
assert(builtRobots.includes("Allow: /"), "built robots.txt must allow public crawling.");
assert(
  builtRobots.includes("Sitemap: https://momentarise.dev/sitemap.xml"),
  "built robots.txt must advertise the canonical sitemap."
);
const builtSitemap = await readText(join(appRoot, "out/sitemap.xml"));
assert(builtSitemap.includes("<loc>https://momentarise.dev/</loc>"), "built sitemap must include the product landing.");
assert(builtSitemap.includes("<loc>https://momentarise.dev/docs</loc>"), "built sitemap must include docs.");
assert(robotsSource.includes('dynamic = "force-static"'), "robots route must support static export.");
assert(sitemapSource.includes('dynamic = "force-static"'), "sitemap route must support static export.");
assert(sitemapSource.includes("allDocsPages"), "sitemap must derive public docs routes from Markdown pages.");

const axGuide = await readText("docs/public/concepts/agentic-experience.md");
for (const required of [
  "# Agentic Experience",
  "llms.txt",
  "llms-full.txt",
  "Open-in-chat",
  "copy current section",
  "Markdown remains the source",
  "@momentarise/md-cli",
  "docs/agent/manifest.json",
  "docs/agent/actions.json",
  "docs/agent/skills"
]) {
  assert(axGuide.includes(required), `Agentic Experience guide must document ${required}.`);
}

const cliGuide = await readText("docs/public/packages/md-cli.md");
for (const required of [
  "init",
  "check",
  "inspect",
  "format",
  "test:fixtures",
  "--json",
  "Document Access Policy"
]) {
  assert(cliGuide.includes(required), `CLI guide must document ${required}.`);
}

const visualScript = await readText("scripts/visual-check-mme0038.mjs");
for (const required of [
  "assertLocalDocsUrl",
  "local loopback dev server",
  "Prompt copied",
  "Section copied",
  "Page link copied",
  "Paste into Codex",
  "docs/internal/visual-checks/MME-0038",
  "site-landing.png",
  "site-footer.png",
  "docs-home.png",
  "docs-dark.png",
  "docs-home-demo.png",
  "docs-footer.png",
  "docs-page-actions.png",
  "docs-mobile.png",
  "Footer critical routes did not resolve",
  "docs-pager",
  "Agentic Experience",
  "CLI"
]) {
  assert(visualScript.includes(required), `visual script must capture ${required}.`);
}

const llmsSource = await readText("scripts/generate-llms.mjs");
assert(llmsSource.includes("encodeURIComponent"), "llms URL generation must URL-encode route segments.");

async function collectMarkdownFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectMarkdownFiles(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }
  return files.sort();
}

async function readJson(path) {
  return JSON.parse(await readText(path));
}

async function readText(path) {
  return readFile(path, "utf8");
}

function assertScript(name) {
  assert(rootPackage.scripts?.[name], `root package.json must expose ${name}.`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message);
  }
}
