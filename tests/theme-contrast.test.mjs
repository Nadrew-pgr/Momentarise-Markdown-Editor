const theme = await import("../packages/md-theme/dist/index.js");

const contrastChecks = [
  {
    background: "--mme-color-bg",
    foreground: "--mme-color-text",
    minRatio: 4.5,
    name: "body text on app background"
  },
  {
    background: "--mme-color-bg",
    foreground: "--mme-color-text-muted",
    minRatio: 4.5,
    name: "muted text on app background"
  },
  {
    background: "--mme-color-accent",
    foreground: "--mme-color-accent-contrast",
    minRatio: 4.5,
    name: "accent contrast text on accent"
  },
  {
    background: "--mme-color-surface",
    foreground: "--mme-color-focus-ring",
    minRatio: 3,
    name: "focus ring on surface"
  }
];

for (const scheme of ["dark", "light"]) {
  const variables = theme.resolveThemeToCssVariables({}, scheme);
  for (const check of contrastChecks) {
    const foreground = parseCssColor(variables[check.foreground]);
    const background = parseCssColor(variables[check.background]);
    const ratio = contrastRatio(composite(foreground, background), background);
    assert(
      ratio >= check.minRatio,
      `${scheme} ${check.name} contrast must be >= ${check.minRatio}:1, got ${ratio.toFixed(2)} (${check.foreground} ${variables[check.foreground]} on ${check.background} ${variables[check.background]}).`
    );
  }
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
