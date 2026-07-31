import { readFileSync } from "node:fs";

const theme = await import("../packages/md-theme/dist/index.js");

const expectedTokenVariables = [
  "--mme-neutral-1",
  "--mme-neutral-2",
  "--mme-neutral-3",
  "--mme-neutral-4",
  "--mme-neutral-5",
  "--mme-neutral-6",
  "--mme-neutral-7",
  "--mme-neutral-8",
  "--mme-neutral-9",
  "--mme-neutral-10",
  "--mme-neutral-11",
  "--mme-neutral-12",
  "--mme-accent-1",
  "--mme-accent-2",
  "--mme-accent-3",
  "--mme-accent-4",
  "--mme-accent-5",
  "--mme-accent-6",
  "--mme-accent-7",
  "--mme-accent-8",
  "--mme-accent-9",
  "--mme-accent-10",
  "--mme-accent-11",
  "--mme-accent-12",
  "--mme-color-bg",
  "--mme-color-surface",
  "--mme-color-surface-raised",
  "--mme-color-surface-muted",
  "--mme-color-surface-hover",
  "--mme-color-surface-active",
  "--mme-color-code-bg",
  "--mme-color-border",
  "--mme-color-border-subtle",
  "--mme-color-border-strong",
  "--mme-color-text",
  "--mme-color-text-muted",
  "--mme-color-text-subtle",
  "--mme-color-text-disabled",
  "--mme-color-accent",
  "--mme-color-accent-hover",
  "--mme-color-accent-text",
  "--mme-color-accent-soft",
  "--mme-color-accent-softer",
  "--mme-color-accent-contrast",
  "--mme-color-danger",
  "--mme-color-warning",
  "--mme-color-selection",
  "--mme-color-focus-ring",
  "--mme-font-family-ui",
  "--mme-font-family-content",
  "--mme-font-family-mono",
  "--mme-font-size-content",
  "--mme-font-size-ui",
  "--mme-font-size-ui-sm",
  "--mme-font-size-ui-xs",
  "--mme-font-size-code",
  "--mme-line-height-content",
  "--mme-line-height-ui",
  "--mme-font-size-base",
  "--mme-font-scale",
  "--mme-line-height",
  "--mme-radius-xs",
  "--mme-radius-sm",
  "--mme-radius-md",
  "--mme-radius-lg",
  "--mme-radius-xl",
  "--mme-radius-full",
  "--mme-space-2xs",
  "--mme-space-xs",
  "--mme-space-sm",
  "--mme-space-md",
  "--mme-space-lg",
  "--mme-space-xl",
  "--mme-space-2xl",
  "--mme-space-3xl",
  "--mme-space-4xl",
  "--mme-space-5xl",
  "--mme-space-6xl",
  "--mme-space-7xl",
  "--mme-space-8xl",
  "--mme-density",
  "--mme-touch-target-size",
  "--mme-elevation-1",
  "--mme-elevation-2",
  "--mme-elevation-3",
  "--mme-shadow-sm",
  "--mme-shadow-md",
  "--mme-motion-fast",
  "--mme-motion-base",
  "--mme-motion-slow",
  "--mme-motion-ease",
  "--mme-z-toolbar",
  "--mme-z-menu",
  "--mme-z-overlay"
];

assert(
  theme.themeContract?.packageName === "@momentarise/md-theme",
  "md-theme must expose a public themeContract marker."
);
assert(
  theme.DEFAULT_MME_SCHEME === "dark",
  "MME default scheme must be dark."
);
assert(
  JSON.stringify(theme.MME_TOKEN_VARIABLES) === JSON.stringify(expectedTokenVariables),
  "MME_TOKEN_VARIABLES must expose exactly the prescriptive public token set."
);

const darkVariables = theme.resolveThemeToCssVariables({}, "dark");
const lightVariables = theme.resolveThemeToCssVariables({}, "light");

for (const tokenVariable of expectedTokenVariables) {
  assert(darkVariables[tokenVariable], `dark theme must resolve ${tokenVariable}.`);
  assert(lightVariables[tokenVariable], `light theme must resolve ${tokenVariable}.`);
}

assert(darkVariables["--mme-color-bg"] === "#0a0a0a", "dark scheme must lift the MME-0039 dark background.");
assert(lightVariables["--mme-color-bg"] === "#fbfcff", "light scheme must expose the MME-0030 light background.");
assert(
  darkVariables["--mme-color-bg"] !== lightVariables["--mme-color-bg"],
  "scheme switching must change token values."
);

const hostVariables = theme.resolveThemeToCssVariables(
  {
    colors: {
      accent: "#ff00aa",
      text: "#101010"
    },
    shape: {
      radiusMd: "10px"
    },
    spacing: {
      density: "1.2",
      spaceXl: "18px",
      touchTargetSize: "48px"
    },
    typography: {
      fontScale: "1.08",
      fontFamilyContent: "Georgia, serif"
    }
  },
  "dark"
);

assert(hostVariables["--mme-color-accent"] === "#ff00aa", "host color partial must override defaults.");
assert(hostVariables["--mme-color-text"] === "#101010", "host color partial must override another color.");
assert(hostVariables["--mme-radius-md"] === "10px", "host shape partial must override radius.");
assert(hostVariables["--mme-density"] === "1.2", "host spacing partial must override density.");
assert(hostVariables["--mme-space-xl"] === "18px", "host spacing partial must override space tokens.");
assert(hostVariables["--mme-touch-target-size"] === "48px", "host spacing partial must override touch target size.");
assert(hostVariables["--mme-font-scale"] === "1.08", "host typography partial must override font scale.");
assert(
  hostVariables["--mme-font-family-content"] === "Georgia, serif",
  "host typography partial must override content font."
);
assert(
  hostVariables["--mme-color-bg"] === darkVariables["--mme-color-bg"],
  "host partial merge must preserve unspecified defaults."
);

const saveIcon = theme.defaultIconSet.render("save");
assert(saveIcon.includes("<svg"), "default icon set must return SVG markup.");
assert(saveIcon.includes("currentColor"), "default icons must use currentColor.");
assert(saveIcon.includes("viewBox=\"0 0 16 16\""), "default icons must use a 16px grid.");
const themeSource = readFileSync("packages/md-theme/src/index.ts", "utf8");
assert(
  themeSource.includes("trusted icon markup") && themeSource.includes("user-authored or remote HTML"),
  "IconSet must document its trusted HTML boundary."
);

const allIcons = [
  "bold",
  "italic",
  "code",
  "list",
  "todo",
  "quote",
  "heading",
  "link",
  "image",
  "divider",
  "ai",
  "more",
  "chevron",
  "check",
  "close",
  "search",
  "save"
];
for (const iconName of allIcons) {
  assert(theme.defaultIconSet.render(iconName).includes("<svg"), `default icon ${iconName} must render.`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
