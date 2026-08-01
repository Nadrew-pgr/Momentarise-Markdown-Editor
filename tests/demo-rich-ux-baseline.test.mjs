import { existsSync, readFileSync } from "node:fs";

const requiredFiles = [
  "scripts/visual-check-mme00135.mjs",
  "scripts/visual-check-mme0029.mjs",
  "scripts/visual-check-mme0042.mjs",
  "docs/internal/visual-checks/MME-0013.5/README.md",
  "docs/internal/visual-checks/MME-0029/README.md",
  "docs/internal/visual-checks/MME-0042/README.md",
  "apps/md-demo/src/main.ts",
  "apps/md-demo/src/styles.css"
];

for (const file of requiredFiles) {
  if (!existsSync(file)) {
    throw new Error(`Missing MME-0013.5 required file: ${file}`);
  }
}

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
if (packageJson.scripts["visual:mme-0013.5"] !== "node scripts/visual-check-mme00135.mjs") {
  throw new Error("Missing visual:mme-0013.5 script.");
}
if (packageJson.scripts["visual:mme-0029"] !== "node scripts/visual-check-mme0029.mjs") {
  throw new Error("Missing visual:mme-0029 script.");
}
if (packageJson.scripts["visual:mme-0042"] !== "node scripts/visual-check-mme0042.mjs") {
  throw new Error("Missing visual:mme-0042 script.");
}
if (!packageJson.scripts.test.includes("test:rich-input-rules")) {
  throw new Error("Root npm test must include rich input rules checks.");
}
if (!packageJson.scripts.test.includes("test:demo-rich-ux")) {
  throw new Error("Root npm test must include demo rich UX baseline checks.");
}

const main = readFileSync("apps/md-demo/src/main.ts", "utf8");
const shellTemplate = main.slice(main.indexOf("app.innerHTML = `"), main.indexOf("const editorHost"));
for (const forbiddenStaticSnippet of ['data-rich-bubble-command=', 'data-testid="selected-text-ai-bubble-action"']) {
  if (shellTemplate.includes(forbiddenStaticSnippet)) {
    throw new Error(`Selection bubble controls must be rendered by md-surface, not static demo HTML: ${forbiddenStaticSnippet}`);
  }
}
// MME-0086: the block/code controls became a package surface (createRichBlockControls)
// anchored to its block, so the demo must mount a host rather than hand-write the bar.
for (const forbiddenStaticSnippet of ['data-testid="code-language-input"', 'data-testid="insert-after-block-button"']) {
  if (shellTemplate.includes(forbiddenStaticSnippet)) {
    throw new Error(`Block controls must be rendered by md-surface, not static demo HTML: ${forbiddenStaticSnippet}`);
  }
}
if (!shellTemplate.includes('data-testid="rich-block-controls-host"')) {
  throw new Error("Demo must mount the packaged block-controls surface into a host element (MME-0086).");
}

// MME-0086: the block-controls markup is emitted by md-surface now, so its test ids
// are asserted against the package source below. The demo keeps the wiring.
const surfaceSource = readFileSync("packages/md-surface/src/index.ts", "utf8");
for (const snippet of [
  "rich-block-controls",
  "code-block-controls",
  "code-language-input",
  "code-meta-input",
  "insert-after-block-button",
  "createRichBlockControls"
]) {
  if (!surfaceSource.includes(snippet)) {
    throw new Error(`md-surface missing MME-0086 block-controls snippet: ${snippet}`);
  }
}

for (const snippet of [
  "createRichBlockControls",
  "code-language-input",
  "code-meta-input",
  "rich-block-controls-host",
  "canInsertParagraphAfterCurrentBlock",
  "getRichUxState",
  "insertParagraphAfterCurrentBlock",
  "setCurrentCodeBlockInfo",
  "toggleCurrentTodoItem",
  "createRichBlockAffordancePlugin",
  "reorderRichTopLevelBlock",
  "rich-block-affordance",
  "rich-block-menu",
  "selection-bubble-toolbar",
  "selected-text-ai-bubble-action",
  "renderSelectionBubbleToolbar",
  "positionSelectionBubbleToolbar",
  "getBlockAffordanceState",
  "getSelectionBubbleState",
  "selectFinalRichBlockForTest"
]) {
  if (!main.includes(snippet)) {
    throw new Error(`Demo missing MME-0013.5 rich UX snippet: ${snippet}`);
  }
}

const styles = readFileSync("apps/md-demo/src/styles.css", "utf8");
// MME-0100: rich content + block affordances + selection bubble are package markup (styled in the
// packaged stylesheet). MME-0086 moved the block-controls / code-controls bar there too, leaving
// the demo only its own block-menu chrome.
const packageStyles = readFileSync("packages/md-theme/src/styles.css", "utf8");
for (const snippet of [".rich-block-menu"]) {
  if (!styles.includes(snippet)) {
    throw new Error(`Demo styles missing MME-0013.5 rich UX snippet: ${snippet}`);
  }
}
for (const snippet of [
  "[data-todo-toggle]",
  "[data-todo-content]",
  ".rich-block-affordance",
  ".selection-bubble-toolbar",
  ".rich-block-controls",
  ".code-block-controls",
  ".ProseMirror .empty-rich-document[data-placeholder]::before"
]) {
  if (!packageStyles.includes(snippet)) {
    throw new Error(`Packaged stylesheet missing MME-0013.5 rich UX snippet: ${snippet}`);
  }
}

const visual = readFileSync("scripts/visual-check-mme00135.mjs", "utf8");
for (const artifact of [
  "rich-heading-live-input-rule.png",
  "rich-todo-live-input-rule.png",
  "rich-todo-toggled.png",
  "rich-code-controls.png",
  "rich-paragraph-after-code.png"
]) {
  if (!visual.includes(artifact)) {
    throw new Error(`MME-0013.5 visual script missing artifact: ${artifact}`);
  }
}

const mme0029Visual = readFileSync("scripts/visual-check-mme0029.mjs", "utf8");
for (const artifact of [
  "block-handle-hover-focus.png",
  "block-menu-keyboard.png",
  "block-reordered-targeted.png",
  "selection-bubble-toolbar-ai.png",
  "empty-placeholder.png"
]) {
  if (!mme0029Visual.includes(artifact)) {
    throw new Error(`MME-0029 visual script missing artifact: ${artifact}`);
  }
}

const mme0042Visual = readFileSync("scripts/visual-check-mme0042.mjs", "utf8");
for (const artifact of [
  "keyboard-after-final-table.png",
  "mouse-after-final-callout.png"
]) {
  if (!mme0042Visual.includes(artifact)) {
    throw new Error(`MME-0042 visual script missing artifact: ${artifact}`);
  }
}
