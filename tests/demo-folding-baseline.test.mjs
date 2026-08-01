import { existsSync, readFileSync } from "node:fs";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const demoSource = readFileSync("apps/md-demo/src/main.ts", "utf8");
const styles = readFileSync("apps/md-demo/src/styles.css", "utf8");

if (!packageJson.scripts.test.includes("test:rich-folding")) {
  throw new Error("Root npm test must include rich folding package checks.");
}
if (!packageJson.scripts.test.includes("test:demo-folding")) {
  throw new Error("Root npm test must include demo folding baseline checks.");
}
if (packageJson.scripts["visual:mme-0014"] !== "node scripts/visual-check-mme0014.mjs") {
  throw new Error("Root package scripts must expose visual:mme-0014.");
}
if (packageJson.scripts["visual:mme-0047"] !== "node scripts/visual-check-mme0047.mjs") {
  throw new Error("Root package scripts must expose visual:mme-0047.");
}

for (const snippet of [
  "getRichFoldItems",
  "getRichFoldVisibility",
  "getRichHeadingFoldItems",
  "toggleRichFold",
  "toggleRichHeadingFold",
  "toggleRichFoldBlockForText",
  "getFoldState",
  "toggleRichFoldForText"
]) {
  if (!demoSource.includes(snippet)) {
    throw new Error(`Demo missing MME-0014 folding snippet: ${snippet}`);
  }
}

// MME-0087: fold affordances are package-emitted decorations, so their styling
// moved to the packaged stylesheet where it ships to consumers. The demo keeps
// the plugin wiring; the styles are asserted against md-theme.
const packageFoldStyles = readFileSync("packages/md-theme/src/styles.css", "utf8");
for (const snippet of [
  ".rich-fold-block",
  ".rich-fold-gutter",
  ".rich-fold-toggle",
  ".rich-fold-hidden",
  "[data-rich-folded=\"true\"]"
]) {
  if (!packageFoldStyles.includes(snippet)) {
    throw new Error(`Packaged stylesheet missing MME-0014 folding snippet: ${snippet}`);
  }
}

for (const forbiddenSnippet of [
  "data-testid=\"folding-session-state\"",
  "data-testid=\"fold-clear-button\"",
  "Section folds",
  "hidden blocks"
]) {
  if (demoSource.includes(forbiddenSnippet)) {
    throw new Error(`Demo must not expose a persistent folding debug strip: ${forbiddenSnippet}`);
  }
}

if (!packageFoldStyles.includes("content: \"...\"")) {
  throw new Error("Collapsed headings must use a subtle ellipsis marker instead of hidden-count text.");
}
if (!packageFoldStyles.includes("[data-fold-kind=\"code\"]") || !packageFoldStyles.includes("[data-fold-kind=\"callout\"]")) {
  throw new Error("MME-0047 must style code/callout folding as first-class fold targets.");
}
if (packageFoldStyles.includes("▾") || packageFoldStyles.includes("▸")) {
  throw new Error("Rich folding chevrons must be drawn with CSS, not font-dependent triangle glyphs.");
}

const visualReadme = "docs/internal/visual-checks/MME-0014/README.md";
if (!existsSync(visualReadme)) {
  throw new Error("MME-0014 visual checks README must exist.");
}

const visualScript = readFileSync("scripts/visual-check-mme0014.mjs", "utf8");
for (const artifact of [
  "folding-hover-affordance.png",
  "folding-h1-h6-loaded.png",
  "folding-h3-collapsed.png",
  "folding-nested-parent-collapsed.png",
  "folding-nested-child-still-collapsed.png",
  "folding-h1-collapsed.png",
  "toggle-block-explicit-details.png"
]) {
  if (!visualScript.includes(artifact)) {
    throw new Error(`MME-0014 visual script must capture ${artifact}.`);
  }
}

const visualScript0047 = readFileSync("scripts/visual-check-mme0047.mjs", "utf8");
for (const snippet of [
  'toggleRichFoldBlockForText("const durable")',
  'toggleRichFoldForText("Child")'
]) {
  if (!visualScript0047.includes(snippet)) {
    throw new Error(`MME-0047 visual script must exercise runtime folding hook: ${snippet}.`);
  }
}
for (const artifact of [
  "folding-quiet-gutter-focus.png",
  "folding-code-block-collapsed.png",
  "folding-callout-collapsed.png",
  "folding-opaque-block-collapsed.png",
  "folding-parent-child-state.png"
]) {
  if (!visualScript0047.includes(artifact)) {
    throw new Error(`MME-0047 visual script must capture ${artifact}.`);
  }
}
