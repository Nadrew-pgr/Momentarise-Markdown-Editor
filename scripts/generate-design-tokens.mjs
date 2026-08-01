#!/usr/bin/env node
/**
 * Generates the machine-readable mirror of the design system (MME-0102).
 *
 * tokens.css is the single source of truth. This script parses it and emits
 * tokens.json — every token with its name, raw value, fully resolved value,
 * role, and scheme — so tools and agents can read the system without parsing
 * CSS. Two copies are written:
 *
 *   packages/md-theme/src/tokens.json   shipped with the package
 *   docs/agent/tokens.json              the agent-facing mirror (AX)
 *
 * Run with --check to verify both files are current (used in CI / npm test).
 */

import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const TOKENS_CSS = "packages/md-theme/src/tokens.css";
const OUTPUTS = ["packages/md-theme/src/tokens.json", "docs/agent/tokens.json"];

/**
 * Token roles, resolved by name prefix. The order matters: the first match wins,
 * so more specific prefixes come first.
 */
const ROLES = [
  ["--mme-font-family-", "typography.family"],
  ["--mme-font-size-", "typography.size"],
  ["--mme-font-weight-", "typography.weight"],
  ["--mme-font-scale", "typography.scale"],
  ["--mme-line-height-", "typography.line-height"],
  ["--mme-line-height", "typography.line-height"],
  ["--mme-letter-spacing-", "typography.tracking"],
  ["--mme-heading-", "typography.heading-scale"],
  ["--mme-block-gap", "typography.block-rhythm"],
  ["--mme-list-item-gap", "typography.block-rhythm"],
  ["--mme-space-", "space.ladder"],
  ["--mme-radius-", "shape.radius"],
  ["--mme-elevation-", "elevation"],
  ["--mme-shadow-", "elevation.legacy-alias"],
  ["--mme-motion-", "motion"],
  ["--mme-neutral-", "color.ramp.neutral"],
  ["--mme-accent-", "color.ramp.accent"],
  ["--mme-color-", "color.semantic"],
  ["--mme-content-", "layout.content"],
  ["--mme-fold-gutter-width", "layout.content"],
  ["--mme-active-content-measure", "layout.content"],
  ["--mme-menu-width-", "layout.overlay"],
  ["--mme-panel-width-", "layout.overlay"],
  ["--mme-inspector-width", "layout.overlay"],
  ["--mme-control-", "layout.chrome"],
  ["--mme-topbar-", "layout.chrome"],
  ["--mme-menu-", "layout.chrome"],
  ["--mme-bubble-", "layout.chrome"],
  ["--mme-icon-size", "layout.chrome"],
  ["--mme-touch-target-size", "layout.chrome"],
  ["--mme-blur-", "layout.chrome"],
  ["--mme-density", "layout.density"],
  ["--mme-z-", "layer"],
  ["--mme-visual-viewport-", "viewport"],
  ["--mme-keyboard-inset", "viewport"]
];

/** Legacy names kept working after MME-0102 renamed the ladders. */
const LEGACY_ALIASES = new Set([
  "--mme-font-size-base",
  "--mme-line-height",
  "--mme-shadow-sm",
  "--mme-shadow-md",
  "--mme-space-1",
  "--mme-space-2",
  "--mme-space-3",
  "--mme-space-4",
  "--mme-space-5",
  "--mme-space-6"
]);

function roleOf(name) {
  for (const [prefix, role] of ROLES) {
    if (name.startsWith(prefix)) {
      return role;
    }
  }
  return "unclassified";
}

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, " ");
}

function blocksOf(css) {
  const blocks = [];
  for (const match of stripComments(css).matchAll(/(:root[^{]*)\{([^{}]*)\}/g)) {
    const declarations = {};
    for (const declaration of match[2].matchAll(/(--mme-[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
      declarations[declaration[1]] = declaration[2].replace(/\s+/g, " ").trim();
    }
    blocks.push({ declarations, label: match[1].trim() });
  }
  return blocks;
}

function schemeDeclarations(blocks, scheme) {
  const merged = {};
  for (const block of blocks) {
    const isBase = block.label === ":root";
    const isPin = block.label === `:root[data-mme-scheme="${scheme}"]`;
    if (isBase || isPin) {
      Object.assign(merged, block.declarations);
    }
  }
  return merged;
}

function resolve(name, declarations, seen = new Set()) {
  const value = declarations[name];
  if (value === undefined || seen.has(name)) {
    return value;
  }
  seen.add(name);
  return value.replace(/var\((--mme-[a-z0-9-]+)\)/g, (whole, referenced) => {
    const flattened = resolve(referenced, declarations, new Set(seen));
    return flattened === undefined ? whole : flattened;
  });
}

function buildScheme(blocks, scheme) {
  const declarations = schemeDeclarations(blocks, scheme);
  const tokens = {};
  for (const name of Object.keys(declarations).sort()) {
    tokens[name] = {
      legacyAlias: LEGACY_ALIASES.has(name) || undefined,
      name,
      resolved: resolve(name, declarations),
      role: roleOf(name),
      value: declarations[name]
    };
  }
  return tokens;
}

export async function buildDesignTokens() {
  const css = await readFile(TOKENS_CSS, "utf8");
  const blocks = blocksOf(css);
  const light = buildScheme(blocks, "light");
  const dark = buildScheme(blocks, "dark");
  const document = {
    $schema: "https://momentarise.dev/schemas/mme-design-tokens-1.json",
    description:
      "Machine-readable mirror of @momentarise/md-theme's design system. Generated from packages/md-theme/src/tokens.css by scripts/generate-design-tokens.mjs — do not edit by hand.",
    generator: "scripts/generate-design-tokens.mjs",
    issue: "MME-0102",
    ladders: {
      motion: ["100ms", "150ms", "200ms"],
      radius: ["4px", "6px", "8px", "10px", "12px", "999px"],
      space: ["2px", "4px", "6px", "8px", "12px", "16px", "20px", "24px", "32px", "40px", "48px", "64px", "80px"],
      typeContent: ["16px"],
      typeUi: ["13px", "12px", "11px"]
    },
    rules: {
      accentScarcity:
        "Accent color appears only on the primary action, the active mode, links, selection, focus, and checked todos. Never as decorative chrome.",
      contrastFloors: { muted: 3, primaryText: 7, secondaryText: 4.6 },
      customization: "Hosts override tokens, never selectors. A rebrand is a swap of the 12-step neutral and accent ramps.",
      schemeOverride: 'Pin a scheme with <html data-mme-scheme="light|dark">; otherwise prefers-color-scheme decides.'
    },
    schemes: { dark, light },
    source: TOKENS_CSS,
    version: 1
  };
  return `${JSON.stringify(document, null, 2)}\n`;
}

export const DESIGN_TOKEN_OUTPUTS = OUTPUTS;

// Importable by scripts/generate-agent-artifacts.mjs (which rebuilds docs/agent
// from scratch and must re-emit the mirror); only the CLI path below writes files
// when this module is executed directly.
// pathToFileURL percent-encodes; a naive "file://" + argv[1] does not, so any checkout
// path containing a space silently failed this comparison and turned the CLI — including
// its --check gate — into a no-op that exited 0 without verifying anything.
if (import.meta.url !== pathToFileURL(process.argv[1]).href) {
  // Imported as a module — expose the builder and stop here.
} else {
  await runCli();
}

async function runCli() {
const serialized = await buildDesignTokens();
const check = process.argv.includes("--check");

if (check) {
  let drift = false;
  for (const output of OUTPUTS) {
    const current = await readFile(output, "utf8").catch(() => undefined);
    if (current !== serialized) {
      console.error(`design tokens out of date: ${output}. Run "npm run generate:design-tokens".`);
      drift = true;
    }
  }
  if (drift) {
    process.exit(1);
  }
  console.log(`design tokens: ${OUTPUTS.length} generated files are current.`);
} else {
  for (const output of OUTPUTS) {
    await writeFile(output, serialized);
  }
  console.log(`design tokens: wrote ${OUTPUTS.join(", ")}.`);
}
}
