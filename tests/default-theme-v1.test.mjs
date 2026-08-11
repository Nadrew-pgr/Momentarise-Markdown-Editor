import { existsSync, readFileSync } from "node:fs";

const requiredFiles = [
  "scripts/visual-check-mme0030.mjs",
  "docs/internal/visual-checks/MME-0030/README.md",
  "apps/md-demo/src/styles.css",
  "apps/md-demo/src/main.ts",
  "packages/md-surface/src/index.ts",
  "packages/md-theme/src/tokens.css"
];

for (const file of requiredFiles) {
  assert(existsSync(file), `Missing MME-0030 required file: ${file}`);
}

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
assert(packageJson.scripts["visual:mme-0030"] === "node scripts/visual-check-mme0030.mjs", "Missing visual:mme-0030 script.");
assert(packageJson.scripts.test.includes("test:default-theme"), "Root npm test must include MME-0030 default-theme checks.");

const surface = readFileSync("packages/md-surface/src/index.ts", "utf8");
const main = readFileSync("apps/md-demo/src/main.ts", "utf8");
// MME-0100 moved package-owned component CSS out of the demo into the packaged stylesheet;
// the default-theme selectors now live there (the demo keeps only demo-shell chrome).
const styles = readFileSync("packages/md-theme/src/styles.css", "utf8");
const visual = readFileSync("scripts/visual-check-mme0030.mjs", "utf8");
const readme = readFileSync("docs/internal/visual-checks/MME-0030/README.md", "utf8");

for (const forbidden of [
  'icon: null, id: "mme:heading1"',
  'icon: null, id: "mme:heading2"',
  'text: "H1"',
  'text: "H2"',
  'data-rich-bubble-command="bold" aria-label="Bold">B</button>',
  'data-rich-bubble-command="italic" aria-label="Italic">I</button>'
]) {
  assert(!surface.includes(forbidden) && !main.includes(forbidden), `MME-0030 must remove visible text-only toolbar control: ${forbidden}`);
}

for (const snippet of [
  'icon: "heading", id: "mme:heading1"',
  'icon: "heading", id: "mme:heading2"',
  "slash-command-icon",
  "ai-command-icon",
  "toolbarIcon(options, slashIconName(item.id, item.group))",
  "toolbarIcon(options, \"ai\")",
  'icon: "bold", id: "mme:bold"',
  'icon: "italic", id: "mme:italic"'
]) {
  assert(surface.includes(snippet) || main.includes(snippet), `MME-0030 icon-first UI missing snippet: ${snippet}`);
}

for (const snippet of [
  ".toolbar-button",
  ".slash-command-item",
  ".slash-command-icon",
  ".ai-command-item",
  ".ai-command-icon",
  ".ProseMirror [data-todo-toggle]",
  '.ProseMirror pre[data-unsupported="true"]::before',
  "@media (max-width: 720px)"
]) {
  assert(styles.includes(snippet), `MME-0030 styles missing public-theme selector: ${snippet}`);
}

/*
 * MME-0116: this loop used to also `existsSync` and size-check each PNG on disk.
 * Screenshots are no longer committed — they are gate output, regenerated on every
 * `npm run visual` and uploaded by CI — so an on-disk check here would assert that
 * whoever runs `npm test` has previously run the browser suite on this machine.
 * The property it was reaching for ("the gate actually produced its proof") is
 * enforced better by the runner's `countFreshArtifacts`, which requires the file to
 * have been written *during this run* rather than merely to exist. What stays here
 * is the deterministic half: the gate script and its README must both still name
 * every artifact, so dropping one silently is still caught by `npm test`.
 */
for (const artifact of [
  "theme-dark-desktop.png",
  "theme-dark-mobile.png",
  "theme-dark-tablet.png",
  "theme-dark-ide-pane.png",
  "theme-light-desktop.png",
  "theme-light-mobile.png",
  "theme-light-tablet.png",
  "theme-light-ide-pane.png",
  "theme-dark-slash-menu.png",
  "theme-light-command-palette.png",
  "theme-dark-block-affordances.png",
  "theme-light-preserved-markdown.png"
]) {
  assert(visual.includes(artifact), `MME-0030 visual script missing artifact: ${artifact}`);
  assert(readme.includes(artifact), `MME-0030 visual README missing artifact: ${artifact}`);
}

for (const benchmark of ["BlockNote", "Notion", "Obsidian"]) {
  assert(readme.includes(benchmark), `MME-0030 benchmark comparison must mention ${benchmark}.`);
}
assert(
  readme.includes("visual reference only") && readme.includes("No assets, CSS, or protected styling copied"),
  "MME-0030 benchmark README must document the license boundary."
);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
