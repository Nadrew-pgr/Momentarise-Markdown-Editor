import { existsSync, readFileSync } from "node:fs";

const requiredFiles = [
  "scripts/visual-check-mme0007.mjs",
  "docs/internal/visual-checks/MME-0007/README.md",
  "apps/md-demo/src/main.ts",
  "packages/md-source-codemirror/src/index.ts"
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
const sourcePackage = readFileSync("packages/md-source-codemirror/src/index.ts", "utf8");
const mainRequirements = [
  ["source package adapter", "@momentarise/md-source-codemirror"],
  ["status refresh test hook", "forceStatusRefresh"],
  ["selection read test hook", "getSelectionRange"],
  ["cursor text test hook", "setCursorAfterText"],
  ["baseline copy lists list exit", "List continuation and exit"],
  ["baseline copy lists indentation", "Indentation"],
  ["baseline copy lists code fence editing", "Code fence editing"]
];

for (const [label, snippet] of mainRequirements) {
  if (!main.includes(snippet)) {
    throw new Error(`MME-0007 source UX baseline missing ${label}: ${snippet}`);
  }
}

const packageRequirements = [
  ["official markdown keymap", "markdownKeymap"],
  ["save shortcut delegation", "Mod-s"],
  ["explicit history extension", "history()"],
  ["explicit close brackets", "closeBrackets()"],
  ["explicit bracket matching", "bracketMatching()"],
  ["explicit search keymap", "searchKeymap"],
  ["CodeMirror markdown language without hidden keymap", "markdown({ addKeymap: false })"],
  ["history keymap", "historyKeymap"]
];

for (const [label, snippet] of packageRequirements) {
  if (!sourcePackage.includes(snippet)) {
    throw new Error(`MME-0007 source package baseline missing ${label}: ${snippet}`);
  }
}

if (sourcePackage.includes("basicSetup")) {
  throw new Error("MME-0022 source package baseline must not use basicSetup because it duplicates keymaps/extensions.");
}

for (const removedHelper of [
  "continueMarkdownList",
  "exitEmptyCheckboxItem",
  "exitEmptyMarkdownListItem",
  "continueCheckboxItem",
  "continueListItem"
]) {
  if (sourcePackage.includes(`function ${removedHelper}`)) {
    throw new Error(`MME-0022 source package baseline must not keep removed helper: ${removedHelper}`);
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
