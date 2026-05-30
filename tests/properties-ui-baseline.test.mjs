import { existsSync, readFileSync } from "node:fs";

const requiredFiles = [
  "apps/md-demo/src/main.ts",
  "apps/md-demo/src/styles.css",
  "scripts/visual-check-mme0011.mjs",
  "docs/internal/visual-checks/MME-0011/README.md"
];

for (const file of requiredFiles) {
  if (!existsSync(file)) {
    throw new Error(`Missing MME-0011 required file: ${file}`);
  }
}

const main = readFileSync("apps/md-demo/src/main.ts", "utf8");
const style = readFileSync("apps/md-demo/src/styles.css", "utf8");
const visualScript = readFileSync("scripts/visual-check-mme0011.mjs", "utf8");
const visualReadme = readFileSync("docs/internal/visual-checks/MME-0011/README.md", "utf8");

const mainRequirements = [
  ["properties block", 'data-testid="properties-panel"'],
  ["properties visible control", 'data-testid="properties-mode-visible"'],
  ["properties hidden control", 'data-testid="properties-mode-hidden"'],
  ["properties source control", 'data-testid="properties-mode-source"'],
  ["properties raw YAML", 'data-testid="frontmatter-source"'],
  ["properties hidden state", 'data-testid="properties-hidden-state"'],
  ["properties mode state", "type PropertiesDisplayMode"],
  ["properties render function", "renderPropertiesPanel"],
  ["properties visual state hook", "getPropertiesState"],
  ["frontmatter source extraction", "extractFrontmatterSource"]
];

for (const [label, snippet] of mainRequirements) {
  if (!main.includes(snippet)) {
    throw new Error(`MME-0011 demo missing ${label}: ${snippet}`);
  }
}

const styleRequirements = [
  "[hidden]",
  ".properties-controls",
  ".property-mode",
  ".frontmatter-source",
  ".properties-hidden-state"
];

for (const snippet of styleRequirements) {
  if (!style.includes(snippet)) {
    throw new Error(`MME-0011 styles missing: ${snippet}`);
  }
}

const visualRequirements = [
  "properties-visible-frontmatter.png",
  "properties-hidden.png",
  "properties-source-yaml.png",
  "properties-roundtrip-after-edit.png"
];

for (const artifact of visualRequirements) {
  if (!visualScript.includes(artifact)) {
    throw new Error(`MME-0011 visual script missing artifact: ${artifact}`);
  }
  if (!visualReadme.includes(artifact)) {
    throw new Error(`MME-0011 visual README missing artifact: ${artifact}`);
  }
}
