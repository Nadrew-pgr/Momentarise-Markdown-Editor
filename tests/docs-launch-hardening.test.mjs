import { existsSync, readFileSync } from "node:fs";

const approvedApi = JSON.parse(readFileSync("tests/fixtures/public-api-approved.json", "utf8"));
const visualScript = readFileSync("scripts/visual-check-mme0038.mjs", "utf8");
const docsPageSource = readFileSync("apps/docs-site/src/DocsPageView.tsx", "utf8");
const axGuide = readFileSync("docs/public/concepts/agentic-experience.md", "utf8");

const packageExpectations = {
  "@momentarise/md-ai": [
    "createOpenAiCompatibleProvider",
    "createMockAiProvider",
    "requestAiSuggestion",
    "acceptAiSuggestion",
    "rejectAiSuggestion"
  ],
  "@momentarise/md-cli": ["runCli", "init", "check", "inspect", "format", "test:fixtures", "--json"],
  "@momentarise/md-editor": [
    "createMarkdownEditorSession",
    "createExtensionRegistry",
    "editorModesForDocumentKind",
    "resolvePreferences"
  ],
  "@momentarise/md-render-html": ["renderMarkdownToHtml", "mmeSanitizeSchema"],
  "@momentarise/md-save": [
    "createSaveEngine",
    "createMemorySaveTarget",
    "createDownloadRequiredSaveTarget",
    "persistenceTargetLabel"
  ],
  "@momentarise/md-surface": [
    "createToolbar",
    "createSlashMenu",
    "createSelectionBubbleToolbar",
    "createDocumentStatus",
    "createModeControl"
  ]
};

for (const [packageName, requiredTerms] of Object.entries(packageExpectations)) {
  const relDoc = `docs/public/packages/${packageName.replace("@momentarise/", "")}.md`;
  assert(existsSync(relDoc), `${relDoc} must exist.`);
  const source = readFileSync(relDoc, "utf8");
  assert(source.includes("## Public API Checkpoints"), `${relDoc} must include Public API Checkpoints.`);
  assert(source.includes("## Release Notes"), `${relDoc} must include release/status notes.`);
  assert(source.includes("0.x"), `${relDoc} must state the 0.x compatibility boundary.`);
  for (const term of requiredTerms) {
    assert(source.includes(term), `${relDoc} must mention launch-critical API/command ${term}.`);
  }
  for (const term of requiredTerms.filter((term) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(term))) {
    assert(
      approvedApi[packageName]?.includes(term) || packageName === "@momentarise/md-cli",
      `${packageName} launch checkpoint ${term} must stay aligned with public API fixture.`
    );
  }
}

assert(
  docsPageSource.includes('href="#docs-actions"') &&
    docsPageSource.includes("Open page actions for AI prompts") &&
    docsPageSource.includes(">Ask AI<"),
  "Docs topbar Ask AI must be a page-actions affordance, not a hosted assistant claim."
);

const notShippedSection = sectionAfter(axGuide, "## Not Shipped Yet");
for (const claim of [
  "hosted Ask AI",
  "semantic docs search",
  "live edit-on-GitHub",
  "automatic global skill installation"
]) {
  assert(notShippedSection.includes(claim), `AX guide must keep ${claim} under Not Shipped Yet.`);
}
for (const shipped of ["docs/agent/manifest.json", "docs/agent/actions.json", "docs/agent/skills"]) {
  assert(axGuide.includes(shipped), `AX guide must document generated artifact ${shipped}.`);
}

for (const artifact of [
  "docs-package-md-cli.png",
  "docs-agentic-experience.png",
  "docs-package-code-dark.png",
  "docs-mobile-package.png"
]) {
  assert(visualScript.includes(artifact), `MME-0048 visual proof must capture ${artifact}.`);
}

function sectionAfter(source, heading) {
  const start = source.indexOf(heading);
  assert(start >= 0, `Missing section ${heading}.`);
  const rest = source.slice(start + heading.length);
  const next = rest.search(/\n##\s+/);
  return next >= 0 ? rest.slice(0, next) : rest;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
