import { readFileSync } from "node:fs";

// MME-0102 — contrast floors are machine-checked in both schemes against the
// resolved token file, not against a hand-maintained JS mirror. tokens.css is the
// single source of truth; the JS theme is checked for agreement at the bottom so
// the two can never drift.
//
// Floors (docs/internal/ISSUES.md → MME-0102):
//   primary text >= 7:1, secondary text >= 4.6:1, muted/disabled >= 3:1.

const tokensCss = readFileSync("packages/md-theme/src/tokens.css", "utf8");
const theme = await import("../packages/md-theme/dist/index.js");

const contrastChecks = [
  {
    background: "--mme-color-bg",
    foreground: "--mme-color-text",
    minRatio: 7,
    name: "primary text on app background"
  },
  {
    background: "--mme-color-surface-raised",
    foreground: "--mme-color-text",
    minRatio: 7,
    name: "primary text on a raised surface (menus, popovers)"
  },
  {
    background: "--mme-color-bg",
    foreground: "--mme-color-text-muted",
    minRatio: 4.6,
    name: "secondary text on app background"
  },
  {
    background: "--mme-color-surface-raised",
    foreground: "--mme-color-text-muted",
    minRatio: 4.6,
    name: "secondary text on a raised surface"
  },
  {
    background: "--mme-color-bg",
    foreground: "--mme-color-text-subtle",
    minRatio: 3,
    name: "muted/disabled text on app background"
  },
  {
    background: "--mme-color-accent",
    foreground: "--mme-color-accent-contrast",
    minRatio: 4.6,
    name: "accent contrast text on the accent solid"
  },
  {
    background: "--mme-color-bg",
    foreground: "--mme-color-accent-text",
    minRatio: 4.6,
    name: "accent text (links, active mode) on app background"
  },
  {
    background: "--mme-color-accent-soft",
    foreground: "--mme-color-accent-text",
    minRatio: 4.6,
    name: "accent text on the soft accent surface (selected menu items)"
  },
  {
    background: "--mme-color-surface",
    foreground: "--mme-color-focus-ring",
    minRatio: 3,
    name: "focus ring on surface"
  },
  {
    background: "--mme-color-bg",
    foreground: "--mme-color-danger",
    minRatio: 4.6,
    name: "danger text on app background"
  }
];

for (const scheme of ["dark", "light"]) {
  const variables = resolveSchemeTokens(tokensCss, scheme);
  for (const check of contrastChecks) {
    const foregroundValue = variables[check.foreground];
    const backgroundValue = variables[check.background];
    assert(
      foregroundValue && backgroundValue,
      `${scheme} scheme must resolve ${check.foreground} and ${check.background} (got ${foregroundValue} / ${backgroundValue}).`
    );
    const foreground = parseCssColor(foregroundValue);
    const background = parseCssColor(backgroundValue);
    const ratio = contrastRatio(composite(foreground, background), background);
    assert(
      ratio >= check.minRatio,
      `${scheme} ${check.name} contrast must be >= ${check.minRatio}:1, got ${ratio.toFixed(2)} (${check.foreground} ${foregroundValue} on ${check.background} ${backgroundValue}).`
    );
  }

  // The JS theme mirrors tokens.css for every token it exposes. Both sides are
  // compared fully resolved, so "var(--mme-font-family-ui)" and the stack it
  // points at count as agreement.
  const jsVariables = theme.resolveThemeToCssVariables({}, scheme);
  for (const [name, jsValue] of Object.entries(jsVariables)) {
    const cssValue = variables[name];
    if (cssValue === undefined) {
      continue;
    }
    const resolvedJsValue = jsValue.replace(
      /var\((--mme-[a-z0-9-]+)\)/g,
      (whole, referenced) => variables[referenced] ?? whole
    );
    assert(
      normalize(cssValue) === normalize(resolvedJsValue),
      `${scheme} ${name} must agree between tokens.css (${cssValue}) and the JS theme (${jsValue}).`
    );
  }
}

console.log("theme-contrast: MME-0102 contrast floors met in both schemes; JS theme agrees with tokens.css.");

/**
 * Resolves one scheme's token map from tokens.css: the scheme-independent :root
 * block, then the explicit scheme pin, then var() aliases flattened to literals.
 */
function resolveSchemeTokens(css, scheme) {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, " ");
  const declarations = {};
  for (const match of withoutComments.matchAll(/(:root[^{]*)\{([^{}]*)\}/g)) {
    const label = match[1].trim();
    const isBase = label === ":root";
    const isPin = label === `:root[data-mme-scheme="${scheme}"]`;
    if (!isBase && !isPin) {
      continue;
    }
    for (const declaration of match[2].matchAll(/(--mme-[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
      declarations[declaration[1]] = declaration[2].trim();
    }
  }
  const resolved = {};
  for (const name of Object.keys(declarations)) {
    resolved[name] = flatten(name, declarations, new Set());
  }
  return resolved;
}

function flatten(name, declarations, seen) {
  const value = declarations[name];
  if (value === undefined || seen.has(name)) {
    return value;
  }
  seen.add(name);
  return value.replace(/var\((--mme-[a-z0-9-]+)\)/g, (whole, referenced) => {
    const flattened = flatten(referenced, declarations, seen);
    return flattened === undefined ? whole : flattened;
  });
}

function normalize(value) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function parseCssColor(value) {
  const normalized = value.trim().toLowerCase();
  if (normalized.startsWith("#")) {
    return parseHexColor(normalized);
  }
  const rgba = /^rgba?\(([^)]+)\)$/.exec(normalized);
  if (!rgba) {
    throw new Error(`Unsupported CSS color in contrast test: ${value}`);
  }
  const parts = rgba[1].split(",").map((part) => part.trim());
  if (parts.length < 3 || parts.length > 4) {
    throw new Error(`Invalid rgb/rgba color in contrast test: ${value}`);
  }
  return {
    a: parts[3] === undefined ? 1 : Number(parts[3]),
    b: Number(parts[2]),
    g: Number(parts[1]),
    r: Number(parts[0])
  };
}

function parseHexColor(value) {
  const hex = value.slice(1);
  if (hex.length !== 6) {
    throw new Error(`Expected 6-digit hex color in contrast test: ${value}`);
  }
  return {
    a: 1,
    b: Number.parseInt(hex.slice(4, 6), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    r: Number.parseInt(hex.slice(0, 2), 16)
  };
}

function composite(foreground, background) {
  if (foreground.a >= 1) {
    return foreground;
  }
  return {
    a: 1,
    b: foreground.b * foreground.a + background.b * (1 - foreground.a),
    g: foreground.g * foreground.a + background.g * (1 - foreground.a),
    r: foreground.r * foreground.a + background.r * (1 - foreground.a)
  };
}

function contrastRatio(first, second) {
  const l1 = relativeLuminance(first);
  const l2 = relativeLuminance(second);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(color) {
  const [r, g, b] = [color.r, color.g, color.b].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
