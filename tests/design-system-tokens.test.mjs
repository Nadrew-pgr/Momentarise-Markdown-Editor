import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// MME-0102 — the design foundation is a formal system, not accumulated values.
//
// This gate proves the *numbers* of the system exist and are respected:
//   1. tokens.css declares the type scale, spacing ladder, radius/elevation/motion
//      scales, and the neutral/accent ramps, in every scheme block;
//   2. the semantic color tokens are aliases into the ramps (so a rebrand is a ramp
//      swap, never a hunt through selectors);
//   3. styles.css spends only ladder values — every px/ms literal outside the
//      ladders must carry an inline `/* allow: reason */` escape, and the escape
//      list must stay short.
//
// Contrast floors are enforced separately in tests/theme-contrast.test.mjs.

const tokensPath = "packages/md-theme/src/tokens.css";
const stylesPath = "packages/md-theme/src/styles.css";

const tokensCss = await readFile(tokensPath, "utf8");
const stylesCss = await readFile(stylesPath, "utf8");

// --- the normative ladders (docs/internal/ISSUES.md → MME-0102) ---

const SPACE_LADDER = [2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80];
const SPACE_STEP_NAMES = [
  "2xs",
  "xs",
  "sm",
  "md",
  "lg",
  "xl",
  "2xl",
  "3xl",
  "4xl",
  "5xl",
  "6xl",
  "7xl",
  "8xl"
];
const RADIUS_SCALE = { xs: 4, sm: 6, md: 8, lg: 10, xl: 12 };
const MOTION_SCALE = { fast: 100, base: 150, slow: 200 };

// Border/outline hairlines are structural, not spacing: 1px hairlines, 2px focus
// rings, and the 3px accent rails are part of the chrome spec itself. They are
// allowed everywhere rather than forcing an escape comment on every border.
const STRUCTURAL_WIDTHS = new Set([0, 1, 1.5, 2, 3]);
const RADIUS_VALUES = new Set([...Object.values(RADIUS_SCALE), 999]);
const ALLOWED_PX = new Set([...SPACE_LADDER, ...RADIUS_VALUES, ...STRUCTURAL_WIDTHS]);
const ALLOWED_MS = new Set(Object.values(MOTION_SCALE));

const MAX_ESCAPES = 24;

// --- 1. scheme blocks ------------------------------------------------------

const schemeBlocks = collectSchemeBlocks(stripComments(tokensCss));
assert(
  schemeBlocks.length >= 3,
  `tokens.css must declare the base :root block, the prefers-color-scheme dark block, and the explicit scheme pins (found ${schemeBlocks.length}).`
);

// --- 2. scale tokens are declared once, in the scheme-independent :root ---

const rootBlock = schemeBlocks.find((block) => block.label === ":root");
assert(rootBlock, "tokens.css must declare a base :root block.");

for (const [index, step] of SPACE_STEP_NAMES.entries()) {
  const expected = `${SPACE_LADDER[index]}px`;
  assertDeclares(rootBlock, `--mme-space-${step}`, expected);
}
assertMonotonic(
  SPACE_STEP_NAMES.map((step) => pxValue(rootBlock, `--mme-space-${step}`)),
  "spacing ladder"
);

for (const [step, value] of Object.entries(RADIUS_SCALE)) {
  assertDeclares(rootBlock, `--mme-radius-${step}`, `${value}px`);
}
assertDeclares(rootBlock, "--mme-radius-full", "999px");
assertMonotonic(
  Object.keys(RADIUS_SCALE).map((step) => pxValue(rootBlock, `--mme-radius-${step}`)),
  "radius scale"
);

for (const [step, value] of Object.entries(MOTION_SCALE)) {
  assertDeclares(rootBlock, `--mme-motion-${step}`, `${value}ms`);
}
assertDeclares(rootBlock, "--mme-motion-ease", "cubic-bezier(0.2, 0, 0, 1)");

// --- 3. typography roles ---------------------------------------------------

assertDeclares(rootBlock, "--mme-font-size-content", "16px");
assertDeclares(rootBlock, "--mme-font-size-ui", "13px");
assertDeclares(rootBlock, "--mme-font-size-ui-sm", "12px");
assertDeclares(rootBlock, "--mme-font-size-ui-xs", "11px");
assertDeclares(rootBlock, "--mme-line-height-content", "1.65");
assertDeclares(rootBlock, "--mme-line-height-ui", "1.45");

for (const family of ["ui", "content", "mono"]) {
  assert(
    declarationOf(rootBlock, `--mme-font-family-${family}`),
    `tokens.css must split the font role --mme-font-family-${family}.`
  );
}
for (const [weightName, weight] of Object.entries({
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700
})) {
  assertDeclares(rootBlock, `--mme-font-weight-${weightName}`, String(weight));
}

// Content heading scale, in em, relative to the content size.
const HEADING_SCALE = {
  1: { size: "1.875em", weight: "var(--mme-font-weight-bold)", tracking: "-0.021em" },
  2: { size: "1.5em", weight: "var(--mme-font-weight-semibold)", tracking: "-0.017em" },
  3: { size: "1.25em", weight: "var(--mme-font-weight-semibold)", tracking: "-0.012em" },
  4: { size: "1.125em", weight: "var(--mme-font-weight-semibold)" },
  5: { size: "1em", weight: "var(--mme-font-weight-semibold)" },
  6: { size: "0.875em", weight: "var(--mme-font-weight-semibold)" }
};
for (const [level, spec] of Object.entries(HEADING_SCALE)) {
  assertDeclares(rootBlock, `--mme-heading-${level}-size`, spec.size);
  assertDeclares(rootBlock, `--mme-heading-${level}-weight`, spec.weight);
  if (spec.tracking) {
    assertDeclares(rootBlock, `--mme-heading-${level}-tracking`, spec.tracking);
  }
}
assertDeclares(rootBlock, "--mme-heading-1-margin-top", "2em");
assertDeclares(rootBlock, "--mme-heading-2-margin-top", "1.75em");
assertDeclares(rootBlock, "--mme-heading-3-margin-top", "1.5em");
assertDeclares(rootBlock, "--mme-heading-margin-bottom", "0.5em");

// Block rhythm.
assertDeclares(rootBlock, "--mme-block-gap", "0.625em");
assertDeclares(rootBlock, "--mme-list-item-gap", "0.25em");
assertDeclares(rootBlock, "--mme-block-gap-lg", "1em");

// Measure and content padding.
assertDeclares(rootBlock, "--mme-content-measure", "708px");
assertDeclares(rootBlock, "--mme-content-padding-block-start", "var(--mme-space-7xl)");
assertDeclares(rootBlock, "--mme-content-padding-inline", "var(--mme-space-3xl)");

// Chrome geometry.
assertDeclares(rootBlock, "--mme-control-height", "28px");
assertDeclares(rootBlock, "--mme-topbar-height", "48px");
assertDeclares(rootBlock, "--mme-menu-item-height", "32px");
assertDeclares(rootBlock, "--mme-icon-size", "16px");
assertDeclares(rootBlock, "--mme-touch-target-size", "44px");

// --- 4. color ramps in every scheme, semantic tokens alias into them -------

const colorBlocks = schemeBlocks.filter((block) => /color-scheme:/.test(block.body));
assert(
  colorBlocks.length >= 3,
  `every scheme block must set color-scheme and carry a full ramp (found ${colorBlocks.length}).`
);

const SEMANTIC_ALIASES = [
  "--mme-color-bg",
  "--mme-color-surface",
  "--mme-color-surface-raised",
  "--mme-color-surface-muted",
  "--mme-color-surface-hover",
  "--mme-color-surface-active",
  "--mme-color-border",
  "--mme-color-border-subtle",
  "--mme-color-border-strong",
  "--mme-color-text",
  "--mme-color-text-muted",
  "--mme-color-text-subtle",
  "--mme-color-accent",
  "--mme-color-accent-hover",
  "--mme-color-accent-text",
  "--mme-color-accent-soft",
  "--mme-color-accent-softer",
  "--mme-color-code-bg"
];

for (const block of colorBlocks) {
  for (let step = 1; step <= 12; step += 1) {
    assert(
      declarationOf(block, `--mme-neutral-${step}`),
      `${block.label} must declare --mme-neutral-${step} (the ramp is the rebrand surface).`
    );
    assert(
      declarationOf(block, `--mme-accent-${step}`),
      `${block.label} must declare --mme-accent-${step}.`
    );
  }
  for (const alias of SEMANTIC_ALIASES) {
    const value = declarationOf(block, alias);
    assert(value, `${block.label} must declare the semantic alias ${alias}.`);
    assert(
      /^var\(--mme-(neutral|accent)-\d{1,2}\)$/.test(value),
      `${block.label} ${alias} must alias a ramp step, not a raw value (got "${value}"). A rebrand must be a ramp swap.`
    );
  }
  for (const level of [1, 2, 3]) {
    assert(
      declarationOf(block, `--mme-elevation-${level}`),
      `${block.label} must declare --mme-elevation-${level}.`
    );
  }
}

// --- 5. styles.css spends ladder values only -------------------------------

const stylesBody = stripComments(stylesCss);
assert(
  !/font-size:\s*[\d.]+px/.test(stylesBody),
  "styles.css must not set a raw px font-size; every font size comes from a --mme-font-size-* token."
);
assert(
  !/var\(--mme-font-size-base\)/.test(stylesBody),
  "styles.css must use the explicit content/ui font-size roles, not the legacy --mme-font-size-base alias."
);

const escapes = collectEscapes(stylesCss);
assert(
  escapes.size <= MAX_ESCAPES,
  `the token-discipline allowlist must stay short: ${escapes.size} escaped lines, max ${MAX_ESCAPES}.`
);

const offenders = [];
for (const [lineNumber, line] of stripComments(stylesCss, { keepLines: true }).split("\n").entries()) {
  const number = lineNumber + 1;
  if (escapes.has(number)) {
    continue;
  }
  // Media-query conditions are exempt by necessity, not by convention: CSS custom
  // properties are not usable inside a media condition, so breakpoints cannot be
  // ladder tokens. They are layout thresholds, not spending decisions.
  if (/^\s*@media\b/.test(line)) {
    continue;
  }
  for (const match of line.matchAll(/(-?[\d.]+)px\b/g)) {
    const value = Math.abs(Number(match[1]));
    if (!ALLOWED_PX.has(value)) {
      offenders.push(`${stylesPath}:${number} — ${match[0]} is not a ladder value`);
    }
  }
  for (const match of line.matchAll(/(-?[\d.]+)ms\b/g)) {
    const value = Math.abs(Number(match[1]));
    if (!ALLOWED_MS.has(value)) {
      offenders.push(`${stylesPath}:${number} — ${match[0]} is not a motion-scale value`);
    }
  }
}
assert(
  offenders.length === 0,
  `styles.css spends values outside the ladders (add a ladder token, or an inline "/* allow: reason */" escape):\n${offenders.join("\n")}`
);

// Motion is token-driven and the typing path never animates.
assert(
  /@media \(prefers-reduced-motion: reduce\)/.test(stylesCss),
  "styles.css must disable motion under prefers-reduced-motion: reduce."
);
assert(
  !/\.ProseMirror\s*\{[^}]*transition:/.test(stylesBody) && !/\.cm-content\s*\{[^}]*transition:/.test(stylesBody),
  "the typing path (.ProseMirror / .cm-content) must carry zero animation."
);

// The coarse-pointer contract from MME-0078 survives the redesign.
assert(
  /@media \(pointer: coarse\)/.test(stylesCss) && /var\(--mme-touch-target-size\)/.test(stylesCss),
  "the 44px coarse-pointer target contract must survive (MME-0078)."
);

// --- 6. machine-readable mirror (AX) ---------------------------------------

const themeManifest = JSON.parse(await readFile("packages/md-theme/package.json", "utf8"));
assert.equal(
  themeManifest.exports?.["./tokens.json"],
  "./src/tokens.json",
  "md-theme must export ./tokens.json so tools and agents can read the system."
);
assert(
  themeManifest.files?.includes("src/tokens.json"),
  "md-theme files must ship src/tokens.json."
);

for (const mirror of ["packages/md-theme/src/tokens.json", "docs/agent/tokens.json"]) {
  const document = JSON.parse(await readFile(mirror, "utf8"));
  assert.equal(document.source, tokensPath, `${mirror} must record tokens.css as its source.`);
  for (const scheme of ["light", "dark"]) {
    const tokens = document.schemes?.[scheme];
    assert(tokens, `${mirror} must carry the ${scheme} scheme.`);
    for (const [name, token] of Object.entries(tokens)) {
      assert(token.name === name, `${mirror} ${scheme} ${name} must carry its own name.`);
      assert(token.value, `${mirror} ${scheme} ${name} must carry a value.`);
      assert(token.role, `${mirror} ${scheme} ${name} must carry a role.`);
      assert(
        token.role !== "unclassified",
        `${mirror} ${scheme} ${name} has no role — teach scripts/generate-design-tokens.mjs about it.`
      );
      assert(
        !/var\(/.test(token.resolved ?? ""),
        `${mirror} ${scheme} ${name} must resolve to a literal (got "${token.resolved}").`
      );
    }
    assert.equal(
      tokens["--mme-font-size-content"]?.resolved,
      "16px",
      `${mirror} ${scheme} must report the 16px content size.`
    );
    assert(
      tokens["--mme-neutral-1"] && tokens["--mme-accent-12"],
      `${mirror} ${scheme} must carry both full ramps.`
    );
  }
  assert(
    document.rules?.accentScarcity && document.rules?.contrastFloors && document.rules?.schemeOverride,
    `${mirror} must document the accent-scarcity rule, contrast floors, and scheme override.`
  );
}

console.log(
  `design-system-tokens: ladders, ramps, styles.css discipline, and the tokens.json mirror verified (${escapes.size}/${MAX_ESCAPES} escapes used).`
);

// --- helpers ---------------------------------------------------------------

function collectSchemeBlocks(css) {
  // Token blocks are flat (no nested braces), so a non-greedy body match is exact.
  const blocks = [];
  for (const match of css.matchAll(/(:root[^{]*)\{([^{}]*)\}/g)) {
    blocks.push({ label: match[1].trim(), body: match[2] });
  }
  return blocks;
}

function declarationOf(block, name) {
  const match = new RegExp(`${name}\\s*:\\s*([^;]+);`).exec(block.body);
  return match ? match[1].trim() : undefined;
}

function assertDeclares(block, name, expected) {
  const actual = declarationOf(block, name);
  assert(actual !== undefined, `tokens.css ${block.label} must declare ${name}.`);
  assert.equal(actual, expected, `tokens.css ${block.label} ${name} must be "${expected}", got "${actual}".`);
}

function pxValue(block, name) {
  const raw = declarationOf(block, name);
  return Number.parseFloat(raw);
}

function assertMonotonic(values, label) {
  for (let index = 1; index < values.length; index += 1) {
    assert(
      values[index] > values[index - 1],
      `${label} must increase monotonically (step ${index + 1} = ${values[index]} is not greater than ${values[index - 1]}).`
    );
  }
}

function collectEscapes(css) {
  const escaped = new Set();
  for (const [index, line] of css.split("\n").entries()) {
    if (/\/\*\s*allow:/.test(line)) {
      escaped.add(index + 1);
    }
  }
  return escaped;
}

function stripComments(css, { keepLines = false } = {}) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (comment) => (keepLines ? comment.replace(/[^\n]/g, " ") : " "));
}
