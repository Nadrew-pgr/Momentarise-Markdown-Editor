import { existsSync, readFileSync } from "node:fs";

const requiredFiles = [
  "scripts/visual-check-mme0013.mjs",
  "docs/internal/visual-checks/MME-0013/README.md",
  "apps/md-demo/src/main.ts",
  "apps/md-demo/src/styles.css",
  "packages/md-surface/src/index.ts"
];

for (const file of requiredFiles) {
  if (!existsSync(file)) {
    throw new Error(`Missing MME-0013 required file: ${file}`);
  }
}

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
if (packageJson.scripts["visual:mme-0013"] !== "node scripts/visual-check-mme0013.mjs") {
  throw new Error("Missing visual:mme-0013 script.");
}
if (!packageJson.scripts.test.includes("test:rich-commands")) {
  throw new Error("Root npm test must include rich command checks.");
}
if (!packageJson.scripts.test.includes("test:demo-commands")) {
  throw new Error("Root npm test must include demo command baseline checks.");
}

const main = readFileSync("apps/md-demo/src/main.ts", "utf8");
const surface = readFileSync("packages/md-surface/src/index.ts", "utf8");
for (const snippet of [
  "createToolbar",
  "createSlashMenu",
  "mountReferenceSurfaceComponents",
  "SlashCommandState",
  "handleSlashMenuKeyboard",
  "runRichCommand",
  "openSlashMenuForTest",
  "getSlashMenuState"
]) {
  if (!main.includes(snippet)) {
    throw new Error(`Demo missing MME-0013 command UI snippet: ${snippet}`);
  }
}

for (const snippet of [
  "rich-command-toolbar",
  "toolbar-command-heading1",
  "toolbar-command-bold",
  "toolbar-command-todo",
  "toolbar-command-codeBlock",
  "toolbar-more-menu",
  "slash-command-menu",
  "slash-command-item-${item.id}",
  "role\", \"toolbar\"",
  "role\", \"listbox\"",
  "handleKeyDown"
]) {
  if (!surface.includes(snippet)) {
    throw new Error(`Surface package missing MME-0013 command UI snippet: ${snippet}`);
  }
}

for (const snippet of [
  '${toolbarIcon("heading")}<span>H1</span>',
  '${toolbarIcon("heading")}<span>H2</span>',
  '${toolbarIcon("todo")}<span>Todo</span>',
  '${toolbarIcon("list")}<span>List</span>',
  '${toolbarIcon("quote")}<span>Quote</span>',
  '${toolbarIcon("code")}<span>Code block</span>',
  '${toolbarIcon("link")}<span>Link</span>',
  '${toolbarIcon("divider")}<span>Divider</span>',
  '${toolbarIcon("ai")}<span>AI</span>',
  '${toolbarIcon("more")}<span>More</span>'
]) {
  if (main.includes(snippet) || surface.includes(snippet)) {
    throw new Error(`Primary toolbar buttons must be compact and rely on tooltip/accessibility labels, not visible text: ${snippet}`);
  }
}

for (const snippet of [
  'testId: "toolbar-command-heading1"',
  'testId: "toolbar-command-heading2"',
  'testId: "toolbar-command-todo"',
  'testId: "toolbar-command-bulletList"',
  'testId: "toolbar-command-blockquote"',
  'testId: "toolbar-command-codeBlock"',
  'testId: "toolbar-command-link"',
  'testId: "toolbar-command-divider"',
  'button.dataset.testid = "toolbar-ai-button"',
  'button.dataset.testid = "toolbar-more-button"',
  'button.setAttribute("aria-label", label)',
  "button.title = label"
]) {
  if (!surface.includes(snippet)) {
    throw new Error(`Compact toolbar missing accessible label/tooltip snippet: ${snippet}`);
  }
}

const styles = readFileSync("apps/md-demo/src/styles.css", "utf8");
for (const snippet of [".rich-command-toolbar", ".toolbar-button", ".slash-command-menu", ".slash-command-item"]) {
  if (!styles.includes(snippet)) {
    throw new Error(`Demo styles missing MME-0013 command UI snippet: ${snippet}`);
  }
}

const visual = readFileSync("scripts/visual-check-mme0013.mjs", "utf8");
for (const artifact of [
  "rich-toolbar-loaded.png",
  "toolbar-more-menu-open.png",
  "slash-menu-keyboard-navigation.png",
  "slash-menu-heading-query.png",
  "heading-command-applied.png",
  "toolbar-todo-code-applied.png"
]) {
  if (!visual.includes(artifact)) {
    throw new Error(`MME-0013 visual script missing artifact: ${artifact}`);
  }
}
