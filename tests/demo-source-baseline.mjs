import { existsSync, readFileSync } from "node:fs";

const requiredFiles = [
  "apps/md-demo/package.json",
  "apps/md-demo/index.html",
  "apps/md-demo/src/main.ts",
  "apps/md-demo/src/styles.css",
  "apps/md-demo/tsconfig.json",
  "docs/internal/visual-checks/MME-0002/README.md"
];

for (const file of requiredFiles) {
  if (!existsSync(file)) {
    throw new Error(`Missing MME-0002 required file: ${file}`);
  }
}

const packageJson = JSON.parse(readFileSync("apps/md-demo/package.json", "utf8"));
assertScript(packageJson, "dev");
assertScript(packageJson, "build");
assertDependency(packageJson, "codemirror");
assertDependency(packageJson, "@codemirror/lang-markdown");
assertDependency(packageJson, "@codemirror/autocomplete");
assertDependency(packageJson, "@codemirror/commands");

const html = readFileSync("apps/md-demo/index.html", "utf8");
if (/<textarea\b/i.test(html)) {
  throw new Error("MME-0002 source editor must not use a textarea.");
}

const main = readFileSync("apps/md-demo/src/main.ts", "utf8");
const sourceRequirements = [
  ["CodeMirror editor", "EditorView"],
  ["CodeMirror state", "EditorState"],
  ["Markdown language support", "markdown("],
  ["auto-closing pairs", "closeBrackets("],
  ["undo/redo keymap", "historyKeymap"],
  ["save shortcut", "Mod-s"],
  ["Save Engine import", "@momentarise/md-save"],
  ["Save Engine creation", "createSaveEngine"],
  ["truthful persistence label", "persistenceTargetLabel"],
  ["autosave scheduling", "scheduleAutosave"],
  ["external conflict simulation", "simulateExternalConflict"],
  ["tab switch flush", "visibilitychange"],
  ["close guard", "beforeunload"],
  ["list continuation", "continueMarkdownList"],
  ["checkbox continuation", "continueCheckboxItem"],
  ["dirty state", "dirty"],
  ["copy action", "copyMarkdown"],
  ["download action", "downloadMarkdown"],
  ["no textarea contract", "data-editor-host"]
];

for (const [label, snippet] of sourceRequirements) {
  if (!main.includes(snippet)) {
    throw new Error(`MME-0002 source baseline missing ${label}: ${snippet}`);
  }
}

const visualReadme = readFileSync("docs/internal/visual-checks/MME-0002/README.md", "utf8");
const visualRequirements = [
  "initial-demo-loaded",
  "editor-after-typing-markdown",
  "dirty-state-after-edit",
  "save-shortcut-event-log",
  "Human review required"
];

for (const requirement of visualRequirements) {
  if (!visualReadme.includes(requirement)) {
    throw new Error(`MME-0002 visual scenario missing: ${requirement}`);
  }
}

function assertScript(packageJson, name) {
  if (!packageJson.scripts || typeof packageJson.scripts[name] !== "string") {
    throw new Error(`apps/md-demo package is missing script: ${name}`);
  }
}

function assertDependency(packageJson, name) {
  const allDependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies
  };
  if (!allDependencies[name]) {
    throw new Error(`apps/md-demo package is missing dependency: ${name}`);
  }
}
