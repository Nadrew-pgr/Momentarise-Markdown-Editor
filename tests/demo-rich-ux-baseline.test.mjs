import { existsSync, readFileSync } from "node:fs";

const requiredFiles = [
  "scripts/visual-check-mme00135.mjs",
  "docs/internal/visual-checks/MME-0013.5/README.md",
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
if (!packageJson.scripts.test.includes("test:rich-input-rules")) {
  throw new Error("Root npm test must include rich input rules checks.");
}
if (!packageJson.scripts.test.includes("test:demo-rich-ux")) {
  throw new Error("Root npm test must include demo rich UX baseline checks.");
}

const main = readFileSync("apps/md-demo/src/main.ts", "utf8");
for (const snippet of [
  "rich-block-controls",
  "code-block-controls",
  "code-language-input",
  "code-meta-input",
  "insert-after-block-button",
  "canInsertParagraphAfterCurrentBlock",
  "getRichUxState",
  "insertParagraphAfterCurrentBlock",
  "setCurrentCodeBlockInfo",
  "toggleCurrentTodoItem"
]) {
  if (!main.includes(snippet)) {
    throw new Error(`Demo missing MME-0013.5 rich UX snippet: ${snippet}`);
  }
}

const styles = readFileSync("apps/md-demo/src/styles.css", "utf8");
for (const snippet of [
  ".rich-block-controls",
  ".code-block-controls",
  "[data-todo-toggle]",
  "[data-todo-content]"
]) {
  if (!styles.includes(snippet)) {
    throw new Error(`Demo styles missing MME-0013.5 rich UX snippet: ${snippet}`);
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
