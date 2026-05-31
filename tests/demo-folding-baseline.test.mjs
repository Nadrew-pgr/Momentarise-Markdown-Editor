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

for (const snippet of [
  "getRichFoldVisibility",
  "getRichHeadingFoldItems",
  "toggleRichHeadingFold",
  "data-testid=\"folding-session-state\"",
  "data-testid=\"fold-clear-button\"",
  "getFoldState",
  "toggleRichFoldForText"
]) {
  if (!demoSource.includes(snippet)) {
    throw new Error(`Demo missing MME-0014 folding snippet: ${snippet}`);
  }
}

for (const snippet of [
  ".rich-fold-toggle",
  ".rich-fold-hidden",
  ".folding-strip",
  "[data-rich-folded=\"true\"]"
]) {
  if (!styles.includes(snippet)) {
    throw new Error(`Demo styles missing MME-0014 folding snippet: ${snippet}`);
  }
}

const visualReadme = "docs/internal/visual-checks/MME-0014/README.md";
if (!existsSync(visualReadme)) {
  throw new Error("MME-0014 visual checks README must exist.");
}

const visualScript = readFileSync("scripts/visual-check-mme0014.mjs", "utf8");
for (const artifact of [
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
