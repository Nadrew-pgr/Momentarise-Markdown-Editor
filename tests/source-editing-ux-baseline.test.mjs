import { existsSync, readFileSync } from "node:fs";

const requiredFiles = [
  "scripts/visual-check-mme0007.mjs",
  "docs/internal/visual-checks/MME-0007/README.md",
  "apps/md-demo/src/main.ts"
];

for (const file of requiredFiles) {
  if (!existsSync(file)) {
    throw new Error(`Missing MME-0007 required file: ${file}`);
  }
}

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
if (packageJson.scripts["visual:mme-0007"] !== "node scripts/visual-check-mme0007.mjs") {
  throw new Error("Missing visual:mme-0007 script.");
}

const main = readFileSync("apps/md-demo/src/main.ts", "utf8");
const sourceRequirements = [
  ["empty list exit", "exitEmptyMarkdownListItem"],
  ["empty checkbox exit", "exitEmptyCheckboxItem"],
  ["status refresh test hook", "forceStatusRefresh"],
  ["selection read test hook", "getSelectionRange"],
  ["cursor text test hook", "setCursorAfterText"],
  ["baseline copy lists list exit", "List continuation and exit"],
  ["baseline copy lists indentation", "Indentation"],
  ["baseline copy lists code fence editing", "Code fence editing"]
];

for (const [label, snippet] of sourceRequirements) {
  if (!main.includes(snippet)) {
    throw new Error(`MME-0007 source UX baseline missing ${label}: ${snippet}`);
  }
}

const visualScript = readFileSync("scripts/visual-check-mme0007.mjs", "utf8");
const visualRequirements = [
  "source-editing-baseline-loaded.png",
  "source-editing-list-checkbox-exit.png",
  "source-editing-code-fence-keyboard.png",
  "source-editing-selection-preserved.png",
  "undo",
  "redo",
  "opaque_preserved"
];

for (const requirement of visualRequirements) {
  if (!visualScript.includes(requirement)) {
    throw new Error(`MME-0007 visual script missing requirement: ${requirement}`);
  }
}

const visualReadme = readFileSync("docs/internal/visual-checks/MME-0007/README.md", "utf8");
for (const requirement of visualRequirements.slice(0, 4)) {
  if (!visualReadme.includes(requirement)) {
    throw new Error(`MME-0007 visual README missing artifact: ${requirement}`);
  }
}
