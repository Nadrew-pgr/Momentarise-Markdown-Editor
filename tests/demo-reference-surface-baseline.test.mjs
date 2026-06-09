import { existsSync, readFileSync } from "node:fs";

const requiredFiles = [
  "apps/md-demo/src/main.ts",
  "apps/md-demo/src/reference-surface.ts",
  "apps/md-demo/src/styles.css",
  "scripts/visual-check-mme0018.mjs",
  "docs/internal/visual-checks/MME-0018/README.md"
];

for (const file of requiredFiles) {
  if (!existsSync(file)) {
    throw new Error(`Missing MME-0018 required file: ${file}`);
  }
}

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
for (const [scriptName, expected] of [
  ["test:demo-reference-surface", "node tests/demo-reference-surface-baseline.test.mjs"],
  ["visual:mme-0018", "node scripts/visual-check-mme0018.mjs"]
]) {
  if (packageJson.scripts[scriptName] !== expected) {
    throw new Error(`Missing ${scriptName} script.`);
  }
}

if (!packageJson.scripts.test.includes("test:demo-reference-surface")) {
  throw new Error("Root npm test must include MME-0018 reference surface checks.");
}

const referenceSurface = readFileSync("apps/md-demo/src/reference-surface.ts", "utf8");
for (const snippet of [
  "ReferenceEditorPreferences",
  "ReferenceEditorPreferenceInput",
  "toolbarMode",
  "toolbarStyle",
  "visibleCommandGroups",
  "aiEntryPoints",
  "technicalStatusDisclosure",
  "optionalStats",
  "resolveReferenceEditorPreferences",
  "referenceAiActionsForEntryPoint",
  "REFERENCE_AI_ACTIONS",
  "continue",
  "draft",
  "rewrite",
  "improve",
  "shorten",
  "expand",
  "summarize",
  "tone",
  "explain",
  "translate",
  "checklist",
  "table"
]) {
  if (!referenceSurface.includes(snippet)) {
    throw new Error(`Reference surface contract missing MME-0018 snippet: ${snippet}`);
  }
}

const main = readFileSync("apps/md-demo/src/main.ts", "utf8");
for (const snippet of [
  "reference-editor-shell",
  "editor-command-surface",
  "editor-status-button",
  "document-status-popover",
  "ai-command-surface",
  "editor-ai-assistant-panel",
  "editor-ai-start-session-button",
  "editor-ai-accept-button",
  "editor-ai-reject-button",
  "selected-text-ai-action",
  "command-palette",
  "command-palette-button",
  "surface-settings-panel",
  "toolbar-ai-button",
  "debug-inspector-toggle",
  "debug-inspector",
  "runEditorNativeAiCommand",
  "isAiEntryPointEnabled",
  "richSelectionMarkdownRange",
  "repeatedAt",
  "handleCommandPaletteKeyboard",
  "commandPaletteActions",
  "referenceAiActionsForEntryPoint(referenceSurfacePreferences, \"slash\")",
  "referenceAiActionsForEntryPoint(referenceSurfacePreferences, \"command-palette\")",
  "setReferenceSurfacePreferencesForTest",
  "referenceSurfacePreferences",
  "REFERENCE_AI_ACTIONS"
]) {
  if (!main.includes(snippet)) {
    throw new Error(`Demo missing MME-0018 reference surface snippet: ${snippet}`);
  }
}

if (main.includes('class="document-strip"')) {
  throw new Error("Permanent document metadata strip must be demoted from the main editor chrome.");
}

const aiEntryPointIndex = main.indexOf("ai-command-surface");
const inspectorIndex = main.indexOf("debug-inspector");
if (aiEntryPointIndex < 0 || inspectorIndex < 0 || aiEntryPointIndex > inspectorIndex) {
  throw new Error("AI editor entry points must appear before the debug inspector in the DOM.");
}

const styles = readFileSync("apps/md-demo/src/styles.css", "utf8");
for (const snippet of [
  ".reference-editor-shell",
  ".editor-command-surface",
  ".document-status-popover",
  ".ai-command-surface",
  ".ai-assistant-panel",
  ".command-palette",
  ".toolbar-ai-button",
  ".selected-text-ai-action",
  ".debug-inspector",
  ".surface-settings-panel",
  "@media (max-width: 720px)"
]) {
  if (!styles.includes(snippet)) {
    throw new Error(`Demo styles missing MME-0018 reference surface snippet: ${snippet}`);
  }
}

const visual = readFileSync("scripts/visual-check-mme0018.mjs", "utf8");
for (const artifact of [
  "reference-surface-desktop.png",
  "reference-surface-command-palette.png",
  "reference-surface-selected-ai.png",
  "reference-surface-rich-ai.png",
  "reference-surface-slash-ai.png",
  "reference-surface-narrow.png",
  "reference-surface-tablet.png",
  "reference-surface-ide-constrained.png",
  "reference-surface-html-preview.png"
]) {
  if (!visual.includes(artifact)) {
    throw new Error(`MME-0018 visual script missing artifact: ${artifact}`);
  }
}
