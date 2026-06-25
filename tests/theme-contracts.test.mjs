const theme = await import("../packages/md-theme/dist/index.js");

const expectedTokenVariables = [
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
assert(lightVariables["--mme-color-bg"] === "#ffffff", "light scheme must lift the MME-0039 light background.");
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
      space4: "18px"
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
assert(hostVariables["--mme-space-4"] === "18px", "host spacing partial must override space tokens.");
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
