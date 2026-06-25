export type MmeScheme = "light" | "dark";

export interface ThemeContract {
  readonly packageName: "@momentarise/md-theme";
  readonly contract: "theme";
}

export interface MmeColorTokens {
  readonly bg: string;
  readonly surface: string;
  readonly surfaceRaised: string;
  readonly border: string;
  readonly text: string;
  readonly textMuted: string;
  readonly accent: string;
  readonly accentContrast: string;
  readonly danger: string;
  readonly selection: string;
  readonly focusRing: string;
}

export interface MmeTypographyTokens {
  readonly fontFamilyUi: string;
  readonly fontFamilyContent: string;
  readonly fontFamilyMono: string;
  readonly fontSizeBase: string;
  readonly fontScale: string;
  readonly lineHeight: string;
}

export interface MmeShapeTokens {
  readonly radiusSm: string;
  readonly radiusMd: string;
  readonly radiusLg: string;
}

export interface MmeSpacingTokens {
  readonly space1: string;
  readonly space2: string;
  readonly space3: string;
  readonly space4: string;
  readonly space5: string;
  readonly space6: string;
  readonly density: string;
}

export interface MmeElevationTokens {
  readonly shadowSm: string;
  readonly shadowMd: string;
}

export interface MmeLayerTokens {
  readonly zToolbar: string;
  readonly zMenu: string;
  readonly zOverlay: string;
}

export interface ResolvedMmeTheme {
  readonly colors: MmeColorTokens;
  readonly typography: MmeTypographyTokens;
  readonly shape: MmeShapeTokens;
  readonly spacing: MmeSpacingTokens;
  readonly elevation: MmeElevationTokens;
  readonly layers: MmeLayerTokens;
}

export interface MmeTheme {
  readonly colors?: Partial<MmeColorTokens>;
  readonly typography?: Partial<MmeTypographyTokens>;
  readonly shape?: Partial<MmeShapeTokens>;
  readonly spacing?: Partial<MmeSpacingTokens>;
  readonly elevation?: Partial<MmeElevationTokens>;
  readonly layers?: Partial<MmeLayerTokens>;
}

export type IconName =
  | "bold"
  | "italic"
  | "code"
  | "list"
  | "todo"
  | "quote"
  | "heading"
  | "link"
  | "image"
  | "divider"
  | "ai"
  | "more"
  | "chevron"
  | "check"
  | "close"
  | "search"
  | "save";

export interface IconSet {
  render(name: IconName): string;
}

export interface ComponentClassOverrides {
  readonly [componentKey: string]: string;
}

export const themeContract: ThemeContract = {
  packageName: "@momentarise/md-theme",
  contract: "theme"
};

export const DEFAULT_MME_SCHEME: MmeScheme = "dark";

export const MME_TOKEN_VARIABLES = [
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
] as const;

export type MmeTokenVariable = (typeof MME_TOKEN_VARIABLES)[number];

export const DEFAULT_MME_THEME: Readonly<Record<MmeScheme, ResolvedMmeTheme>> = {
  dark: {
    colors: {
      bg: "#0a0a0a",
      surface: "#141414",
      surfaceRaised: "#1c1c1c",
      border: "#2a2a2a",
      text: "#ededed",
      textMuted: "#8f8f8f",
      accent: "#3b82f6",
      accentContrast: "#ffffff",
      danger: "#f87171",
      selection: "rgba(59, 130, 246, 0.32)",
      focusRing: "rgba(59, 130, 246, 0.6)"
    },
    typography: {
      fontFamilyUi: '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, "Segoe UI", Roboto, ui-sans-serif, sans-serif',
      fontFamilyContent: "var(--mme-font-family-ui)",
      fontFamilyMono: 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
      fontSizeBase: "12.5px",
      fontScale: "1",
      lineHeight: "1.6"
    },
    shape: {
      radiusSm: "6px",
      radiusMd: "8px",
      radiusLg: "12px"
    },
    spacing: {
      space1: "4px",
      space2: "8px",
      space3: "12px",
      space4: "16px",
      space5: "20px",
      space6: "24px",
      density: "1"
    },
    elevation: {
      shadowSm: "0 1px 2px rgba(0, 0, 0, 0.4)",
      shadowMd: "0 8px 28px rgba(0, 0, 0, 0.5)"
    },
    layers: {
      zToolbar: "20",
      zMenu: "45",
      zOverlay: "70"
    }
  },
  light: {
    colors: {
      bg: "#ffffff",
      surface: "#fafafa",
      surfaceRaised: "#f4f4f5",
      border: "#ededed",
      text: "#171717",
      textMuted: "#666666",
      accent: "#0070f3",
      accentContrast: "#ffffff",
      danger: "#e5484d",
      selection: "rgba(0, 112, 243, 0.18)",
      focusRing: "rgba(0, 112, 243, 0.45)"
    },
    typography: {
      fontFamilyUi: '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, "Segoe UI", Roboto, ui-sans-serif, sans-serif',
      fontFamilyContent: "var(--mme-font-family-ui)",
      fontFamilyMono: 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
      fontSizeBase: "12.5px",
      fontScale: "1",
      lineHeight: "1.6"
    },
    shape: {
      radiusSm: "6px",
      radiusMd: "8px",
      radiusLg: "12px"
    },
    spacing: {
      space1: "4px",
      space2: "8px",
      space3: "12px",
      space4: "16px",
      space5: "20px",
      space6: "24px",
      density: "1"
    },
    elevation: {
      shadowSm: "0 1px 2px rgba(18, 24, 31, 0.06)",
      shadowMd: "0 8px 28px rgba(18, 24, 31, 0.12)"
    },
    layers: {
      zToolbar: "20",
      zMenu: "45",
      zOverlay: "70"
    }
  }
};

export function resolveThemeToCssVariables(
  theme: MmeTheme = {},
  scheme: MmeScheme = DEFAULT_MME_SCHEME
): Readonly<Record<MmeTokenVariable, string>> {
  const resolved = resolveTheme(theme, scheme);
  return {
    "--mme-color-bg": resolved.colors.bg,
    "--mme-color-surface": resolved.colors.surface,
    "--mme-color-surface-raised": resolved.colors.surfaceRaised,
    "--mme-color-border": resolved.colors.border,
    "--mme-color-text": resolved.colors.text,
    "--mme-color-text-muted": resolved.colors.textMuted,
    "--mme-color-accent": resolved.colors.accent,
    "--mme-color-accent-contrast": resolved.colors.accentContrast,
    "--mme-color-danger": resolved.colors.danger,
    "--mme-color-selection": resolved.colors.selection,
    "--mme-color-focus-ring": resolved.colors.focusRing,
    "--mme-font-family-ui": resolved.typography.fontFamilyUi,
    "--mme-font-family-content": resolved.typography.fontFamilyContent,
    "--mme-font-family-mono": resolved.typography.fontFamilyMono,
    "--mme-font-size-base": resolved.typography.fontSizeBase,
    "--mme-font-scale": resolved.typography.fontScale,
    "--mme-line-height": resolved.typography.lineHeight,
    "--mme-radius-sm": resolved.shape.radiusSm,
    "--mme-radius-md": resolved.shape.radiusMd,
    "--mme-radius-lg": resolved.shape.radiusLg,
    "--mme-space-1": resolved.spacing.space1,
    "--mme-space-2": resolved.spacing.space2,
    "--mme-space-3": resolved.spacing.space3,
    "--mme-space-4": resolved.spacing.space4,
    "--mme-space-5": resolved.spacing.space5,
    "--mme-space-6": resolved.spacing.space6,
    "--mme-density": resolved.spacing.density,
    "--mme-shadow-sm": resolved.elevation.shadowSm,
    "--mme-shadow-md": resolved.elevation.shadowMd,
    "--mme-z-toolbar": resolved.layers.zToolbar,
    "--mme-z-menu": resolved.layers.zMenu,
    "--mme-z-overlay": resolved.layers.zOverlay
  };
}

export function resolveTheme(theme: MmeTheme = {}, scheme: MmeScheme = DEFAULT_MME_SCHEME): ResolvedMmeTheme {
  const defaults = DEFAULT_MME_THEME[scheme];
  return {
    colors: {
      ...defaults.colors,
      ...theme.colors
    },
    typography: {
      ...defaults.typography,
      ...theme.typography
    },
    shape: {
      ...defaults.shape,
      ...theme.shape
    },
    spacing: {
      ...defaults.spacing,
      ...theme.spacing
    },
    elevation: {
      ...defaults.elevation,
      ...theme.elevation
    },
    layers: {
      ...defaults.layers,
      ...theme.layers
    }
  };
}

export const defaultIconSet: IconSet = {
  render(name) {
    return DEFAULT_ICON_SVG[name];
  }
};

const ICON_BASE = `xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"`;
const FILL_ICON_BASE = `xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="currentColor"`;

const DEFAULT_ICON_SVG: Readonly<Record<IconName, string>> = {
  bold: `<svg ${ICON_BASE}><path d="M5 3h3.4a2.2 2.2 0 0 1 0 4.4H5z"/><path d="M5 7.4h4a2.55 2.55 0 0 1 0 5.1H5z"/></svg>`,
  italic: `<svg ${ICON_BASE}><path d="M8.8 3h3"/><path d="M4.2 13h3"/><path d="M10.2 3 5.8 13"/></svg>`,
  code: `<svg ${ICON_BASE}><path d="m6 5-3 3 3 3"/><path d="m10 5 3 3-3 3"/></svg>`,
  list: `<svg ${ICON_BASE}><path d="M6 4h7"/><path d="M6 8h7"/><path d="M6 12h7"/><path d="M3.2 4h.1"/><path d="M3.2 8h.1"/><path d="M3.2 12h.1"/></svg>`,
  todo: `<svg ${ICON_BASE}><rect x="2.8" y="3" width="10.4" height="10" rx="2"/><path d="m5.2 8.2 1.8 1.8 3.8-4"/></svg>`,
  quote: `<svg ${FILL_ICON_BASE}><path d="M6.2 4.2C4.1 5 3 6.7 3 9.3V12h4.2V7.8H5.1c.1-1 .7-1.8 1.8-2.4z"/><path d="M12.6 4.2C10.5 5 9.4 6.7 9.4 9.3V12h4.2V7.8h-2.1c.1-1 .7-1.8 1.8-2.4z"/></svg>`,
  heading: `<svg ${ICON_BASE}><path d="M3 3v10"/><path d="M11 3v10"/><path d="M3 8h8"/><path d="M13 6v7"/></svg>`,
  link: `<svg ${ICON_BASE}><path d="M6.9 10.5 5.8 11.6a2.5 2.5 0 0 1-3.5-3.5l1.8-1.8a2.5 2.5 0 0 1 3.4-.1"/><path d="M9.1 5.5 10.2 4.4a2.5 2.5 0 1 1 3.5 3.5l-1.8 1.8a2.5 2.5 0 0 1-3.4.1"/><path d="M6 10 10 6"/></svg>`,
  image: `<svg ${ICON_BASE}><rect x="2.5" y="3" width="11" height="10" rx="1.8"/><path d="m4.5 11 2.5-2.5 2 2 1.5-1.5 1.5 2"/><circle cx="5.8" cy="5.8" r=".7"/></svg>`,
  divider: `<svg ${ICON_BASE}><path d="M2.5 8h11"/></svg>`,
  ai: `<svg ${ICON_BASE}><path d="M8 2.6 9 5.7l3.1 1-3.1 1L8 10.8l-1-3.1-3.1-1 3.1-1z"/><path d="M12 10.2 12.5 12l1.8.5-1.8.6-.5 1.7-.6-1.7-1.7-.6 1.7-.5z"/></svg>`,
  more: `<svg ${FILL_ICON_BASE}><circle cx="3.5" cy="8" r="1.2"/><circle cx="8" cy="8" r="1.2"/><circle cx="12.5" cy="8" r="1.2"/></svg>`,
  chevron: `<svg ${ICON_BASE}><path d="m6 4 4 4-4 4"/></svg>`,
  check: `<svg ${ICON_BASE}><path d="m3.2 8.4 3 3 6.6-6.8"/></svg>`,
  close: `<svg ${ICON_BASE}><path d="m4.2 4.2 7.6 7.6"/><path d="m11.8 4.2-7.6 7.6"/></svg>`,
  search: `<svg ${ICON_BASE}><circle cx="7" cy="7" r="3.8"/><path d="m10 10 3 3"/></svg>`,
  save: `<svg ${ICON_BASE}><path d="M3.2 3h8l1.6 1.6V13h-9.6z"/><path d="M5.4 3v4h5.2"/><path d="M5.4 13V9.8h5.2V13"/></svg>`
};
