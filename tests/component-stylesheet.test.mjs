import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

// MME-0100: the framework ships a packaged component stylesheet, not just tokens.
// This gate proves the stylesheet exists, is exported/shipped, styles every required
// package-owned surface, keeps package styling out of the demo, and that the registry
// example references only tokens the theme actually defines.

const stylesPath = "packages/md-theme/src/styles.css";
const tokensPath = "packages/md-theme/src/tokens.css";
const demoPath = "apps/md-demo/src/styles.css";
const exampleGlobalsPath = "examples/next-app/app/globals.css";

assert(existsSync(stylesPath), `${stylesPath} must exist (the packaged component stylesheet).`);
const styles = await readFile(stylesPath, "utf8");
const tokens = await readFile(tokensPath, "utf8");
const demo = await readFile(demoPath, "utf8");
const exampleGlobals = await readFile(exampleGlobalsPath, "utf8");

// --- package.json export + ship contract ---
const themeManifest = JSON.parse(await readFile("packages/md-theme/package.json", "utf8"));
assert.equal(themeManifest.exports?.["./styles.css"], "./src/styles.css", "md-theme must export ./styles.css.");
assert(themeManifest.files?.includes("src/styles.css"), "md-theme files must ship src/styles.css.");
assert(
  Array.isArray(themeManifest.sideEffects) && themeManifest.sideEffects.includes("./src/styles.css"),
  "md-theme must mark src/styles.css as a side effect so bundlers keep it."
);

// --- every required package-owned surface is styled ---
const requiredSurfaces = {
  "source view": ".cm-editor",
  "rich view content": ".ProseMirror",
  toolbar: ".toolbar-button",
  "selection bubble": ".selection-bubble-toolbar",
  "slash menu": ".slash-command-item",
  "block handles": ".rich-block-affordance",
  "anchored block controls": ".rich-block-controls",
  "code fence info fields": ".code-block-controls",
  "command palette": ".command-palette",
  "mode control": ".mode-button",
  "status control": ".editor-status-button",
  tables: ".ProseMirror table",
  callouts: "[data-mme-callout",
  "code blocks": ".ProseMirror pre",
  footnotes: "data-mme-footnote",
  "task lists": "data-todo-row",
  "react shell": ".mme-react-editor-shell",
  "coarse-pointer / mobile": "pointer: coarse"
};
for (const [surface, needle] of Object.entries(requiredSurfaces)) {
  assert(styles.includes(needle), `packaged stylesheet must style the ${surface} surface (missing "${needle}").`);
}

// --- token-driven: rules consume --mme-* custom properties ---
assert(styles.includes("var(--mme-"), "packaged stylesheet rules must consume --mme-* tokens.");
// no raw hex colors in the component stylesheet (colors come from tokens)
const rawHex = styles.replace(/@import[^;]+;/g, "").match(/#[0-9a-fA-F]{3,8}\b/g);
assert(!rawHex, `packaged stylesheet must not hardcode colors; found ${rawHex ? rawHex.join(", ") : ""}.`);

// --- light + dark both supported, default follows prefers-color-scheme ---
assert(tokens.includes("@media (prefers-color-scheme: dark)"), "tokens must default to prefers-color-scheme for dark.");
assert(tokens.includes('[data-mme-scheme="light"]') && tokens.includes('[data-mme-scheme="dark"]'), "tokens must expose explicit scheme override hooks.");
assert(/:root\s*\{[^}]*color-scheme:\s*light/.test(tokens), "the default :root scheme must be light (dark comes from the media query).");

// --- demo parity: the demo no longer defines package-owned component classes as its own rules ---
const forbiddenInDemo = [".mode-button", ".toolbar-button", ".slash-command-item", ".selection-bubble-toolbar",
  ".command-palette", ".editor-status-button", ".rich-command-toolbar", ".rich-block-affordance",
  ".rich-block-controls", ".code-block-controls"];
for (const cls of forbiddenInDemo) {
  // a standalone rule like `.mode-button {` or `.mode-button:hover {` or `.mode-button,` — but
  // demo-scoped descendant selectors (`.editor-host .cm-content`) are allowed.
  const standalone = new RegExp(`(^|\\n)\\s*\\${cls}[\\s,:.\\[{]`);
  assert(!standalone.test(demo), `demo stylesheet must not define package-owned ${cls} (moved to md-theme).`);
}
assert(demo.includes('@import "@momentarise/md-theme/styles.css"'), "demo must consume the packaged stylesheet.");

// --- example references only tokens the theme actually defines ---
const definedTokens = new Set([...tokens.matchAll(/(--mme-[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
const referencedTokens = [...exampleGlobals.matchAll(/var\((--mme-[a-z0-9-]+)/g)].map((m) => m[1]);
assert(referencedTokens.length > 0, "example globals must consume theme tokens.");
for (const t of referencedTokens) {
  assert(definedTokens.has(t), `examples/next-app/app/globals.css references ${t}, which the theme does not define.`);
}
assert(exampleGlobals.includes('@import "@momentarise/md-theme/styles.css"'), "example must import the packaged stylesheet.");

console.log("component-stylesheet: all assertions passed.");
