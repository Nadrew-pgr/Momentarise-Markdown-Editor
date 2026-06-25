import { existsSync, readFileSync } from "node:fs";

const tokenCssPath = "packages/md-theme/src/tokens.css";
const demoCssPath = "apps/md-demo/src/styles.css";
const sourceCodeMirrorPath = "packages/md-source-codemirror/src/index.ts";

assert(existsSync(tokenCssPath), "md-theme must ship packages/md-theme/src/tokens.css.");

const tokenCss = readFileSync(tokenCssPath, "utf8");
const demoCss = readFileSync(demoCssPath, "utf8");
const sourceCodeMirror = readFileSync(sourceCodeMirrorPath, "utf8");

assert(
  demoCss.includes('@import "@momentarise/md-theme/tokens.css";'),
  "demo CSS must import the md-theme token artifact instead of owning token values."
);
assert(
  !/--mme-color-bg\s*:/.test(demoCss),
  "demo CSS must not redeclare the canonical MME token values."
);
assert(
  !/(--line|--font-mono)/.test(demoCss + sourceCodeMirror),
  "MME-0025 must remove the legacy --line and --font-mono aliases after CodeMirror migration."
);
assert(
  sourceCodeMirror.includes("HighlightStyle.define"),
  "md-source-codemirror must own a token-based CodeMirror highlight style instead of defaultHighlightStyle."
);
assert(
  !sourceCodeMirror.includes("defaultHighlightStyle"),
  "md-source-codemirror must not use CodeMirror's light-oriented defaultHighlightStyle."
);

assertNoRawColorOutsideTokenBlocks(tokenCss, tokenCssPath);
assertNoRawColor(demoCss, demoCssPath);
assertNoRawColor(sourceCodeMirror, sourceCodeMirrorPath);

for (const tokenVariable of [
  "--mme-color-bg",
  "--mme-color-surface",
  "--mme-color-surface-raised",
  "--mme-color-border",
  "--mme-color-text",
  "--mme-color-text-muted",
  "--mme-color-accent",
  "--mme-color-accent-contrast",
  "--mme-color-danger",
  "--mme-color-selection",
  "--mme-color-focus-ring",
  "--mme-font-family-ui",
  "--mme-font-family-content",
  "--mme-font-family-mono",
  "--mme-font-size-base",
  "--mme-font-scale",
  "--mme-line-height",
  "--mme-radius-sm",
  "--mme-radius-md",
  "--mme-radius-lg",
  "--mme-space-1",
  "--mme-space-2",
  "--mme-space-3",
  "--mme-space-4",
  "--mme-space-5",
  "--mme-space-6",
  "--mme-density",
  "--mme-shadow-sm",
  "--mme-shadow-md",
  "--mme-z-toolbar",
  "--mme-z-menu",
  "--mme-z-overlay"
]) {
  assert(tokenCss.includes(`${tokenVariable}:`), `tokens.css must define ${tokenVariable}.`);
}

function assertNoRawColorOutsideTokenBlocks(text, filePath) {
  const withoutTokenBlocks = text.replace(/:root(?:\[data-mme-scheme="(?:dark|light)"\])?\s*\{[\s\S]*?\}/g, "");
  assertNoRawColor(withoutTokenBlocks, filePath);
}

function assertNoRawColor(text, filePath) {
  const match = /#[0-9a-fA-F]{3,8}\b|rgba?\(/.exec(text);
  assert(!match, `${filePath} contains raw color value outside token blocks: ${match?.[0] ?? "unknown"}`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
