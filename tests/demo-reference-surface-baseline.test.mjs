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
  "DEFAULT_PREFERENCE_SCHEMA",
  "resolvePreferences",
  "toolbarMode",
  "toolbarStyle",
  "visibleCommandGroups",
  "aiEntryPoints",
  "technicalStatusDisclosure",
  "optionalStats",
  "layoutDensity",
  "readableLineWidth",
  "keymapDelegateToHost",
  "keymapProfile",
  "locks",
  "userPreferences",
  "userVisible",
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
  "createMomentariseSourceCompartments",
  "createMomentariseSourceReconfigureEffects",
  "reconfigureRichPlugins",
  "sourcePreferenceCompartments",
  "applyReferenceSurfacePreferences",
  "sourcePreferencesFromReferenceSurface",
  "richPreferencesFromReferenceSurface",
  "referenceAiActionsForRegisteredEntryPoint(\"slash\")",
  "referenceAiActionsForRegisteredEntryPoint(\"command-palette\")",
  "registeredReferenceAiActions",
  "buildAiActionPrompt",
  "setReferenceSurfacePreferencesForTest",
  "referenceSurfacePreferences",
  "layoutDensity",
  "readableLineWidth",
  "keymapDelegateToHost",
  "keymapProfile",
  "REFERENCE_AI_ACTIONS"
]) {
  if (!main.includes(snippet)) {
    throw new Error(`Demo missing MME-0018 reference surface snippet: ${snippet}`);
  }
}

if (main.includes('class="document-strip"')) {
  throw new Error("Permanent document metadata strip must be demoted from the main editor chrome.");
}

const openFileHandler = extractBlock(main, 'openFileButton.addEventListener("click", () => {', "\n});");
if (!openFileHandler.includes("void openLocalFile();")) {
  throw new Error("Primary Open file action must route through the real local-file opener.");
}
if (openFileHandler.includes("openFileInput.click")) {
  throw new Error("Primary Open file action must not silently fall back to imported-copy file input.");
}

const openLocalFileFunction = extractFunction(main, "async function openLocalFile");
if (openLocalFileFunction.includes("openFileInput.click")) {
  throw new Error("Real local-file opener must not silently fall back to imported-copy file input.");
}
if (!openLocalFileFunction.includes("showRealFileOpenUnavailable")) {
  throw new Error("Real local-file opener must show explicit user feedback when File System Access is unavailable.");
}
if (openLocalFileFunction.includes("loadHtmlArtifact")) {
  throw new Error("Primary Open file action must not route HTML artifacts into imported-copy/export mode.");
}
if (openLocalFileFunction.includes('"text/html"')) {
  throw new Error("Primary Open file picker must not offer HTML artifacts; use the separate HTML reader.");
}
if (!main.includes("restored browser draft; reopen the original file for writable autosave")) {
  throw new Error("Reload-restored Markdown must explicitly explain that writable disk autosave requires reopening the original file.");
}
if (!main.includes("Export copy")) {
  throw new Error("Imported/download-required documents must label the primary action as exporting a copy.");
}

if (main.includes('aiCommandSurface.hidden = !toolbarAiVisible || editorMode === "rich"')) {
  throw new Error("Header AI entry point must remain visible in rich mode when toolbar AI is also available.");
}
if (!main.includes("aiCommandSurface.hidden = !toolbarAiVisible;")) {
  throw new Error("Header AI visibility must depend on preferences, not on source/rich mode.");
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

const aiAssistantPanelStyle = extractCssRule(styles, ".ai-assistant-panel");
if (!aiAssistantPanelStyle.includes("position: fixed")) {
  throw new Error("User-facing AI assistant must be a compact editor popover, not an in-flow panel above the document.");
}
if (aiAssistantPanelStyle.includes("margin: 8px 12px 0")) {
  throw new Error("AI assistant panel must not push the editor document down as full-width demo chrome.");
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

function extractBlock(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  if (start < 0) {
    throw new Error(`Missing block start marker: ${startMarker}`);
  }
  const bodyStart = start + startMarker.length;
  const end = source.indexOf(endMarker, bodyStart);
  if (end < 0) {
    throw new Error(`Missing block end marker after: ${startMarker}`);
  }
  return source.slice(bodyStart, end);
}

function extractFunction(source, signature) {
  const start = source.indexOf(signature);
  if (start < 0) {
    throw new Error(`Missing function signature: ${signature}`);
  }
  const bodyStart = source.indexOf("{", start);
  if (bodyStart < 0) {
    throw new Error(`Missing function body: ${signature}`);
  }
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(bodyStart + 1, index);
      }
    }
  }
  throw new Error(`Unclosed function body: ${signature}`);
}

function extractCssRule(source, selector) {
  const start = source.indexOf(`${selector} {`);
  if (start < 0) {
    throw new Error(`Missing CSS rule: ${selector}`);
  }
  const end = source.indexOf("\n}", start);
  if (end < 0) {
    throw new Error(`Unclosed CSS rule: ${selector}`);
  }
  return source.slice(start, end + 2);
}
