export type MmeScheme = "light" | "dark";

export interface ThemeContract {
  readonly packageName: "@momentarise/md-theme";
  readonly contract: "theme";
}

/**
 * A 12-step color ramp, Radix step semantics:
 * 1-2 backgrounds, 3-5 interactive surfaces, 6-8 borders, 9-10 solid, 11-12 text.
 *
 * The ramps are the rebrand surface: swap these 12 values and every semantic
 * token, and therefore every surface, follows (MME-0102).
 */
export type MmeColorRamp = readonly [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string
];

export interface MmeRampTokens {
  readonly neutral: MmeColorRamp;
  readonly accent: MmeColorRamp;
}

export interface MmeColorTokens {
  readonly bg: string;
  readonly surface: string;
  readonly surfaceRaised: string;
  readonly surfaceMuted: string;
  readonly surfaceHover: string;
  readonly surfaceActive: string;
  readonly codeBg: string;
  readonly border: string;
  readonly borderSubtle: string;
  readonly borderStrong: string;
  readonly text: string;
  readonly textMuted: string;
  readonly textSubtle: string;
  readonly textDisabled: string;
  readonly accent: string;
  readonly accentHover: string;
  readonly accentText: string;
  readonly accentSoft: string;
  readonly accentSofter: string;
  readonly accentContrast: string;
  readonly danger: string;
  readonly warning: string;
  readonly selection: string;
  readonly focusRing: string;
}

export interface MmeTypographyTokens {
  readonly fontFamilyUi: string;
  readonly fontFamilyContent: string;
  readonly fontFamilyMono: string;
  readonly fontSizeContent: string;
  readonly fontSizeUi: string;
  readonly fontSizeUiSm: string;
  readonly fontSizeUiXs: string;
  readonly fontSizeCode: string;
  readonly lineHeightContent: string;
  readonly lineHeightUi: string;
  /** Legacy alias for `fontSizeUi`, kept so pre-MME-0102 hosts keep working. */
  readonly fontSizeBase: string;
  readonly fontScale: string;
  /** Legacy alias for `lineHeightContent`. */
  readonly lineHeight: string;
}

export interface MmeShapeTokens {
  readonly radiusXs: string;
  readonly radiusSm: string;
  readonly radiusMd: string;
  readonly radiusLg: string;
  readonly radiusXl: string;
  readonly radiusFull: string;
}

/** The spacing ladder: 2 4 6 8 12 16 20 24 32 40 48 64 80. */
export interface MmeSpacingTokens {
  readonly space2xs: string;
  readonly spaceXs: string;
  readonly spaceSm: string;
  readonly spaceMd: string;
  readonly spaceLg: string;
  readonly spaceXl: string;
  readonly space2xl: string;
  readonly space3xl: string;
  readonly space4xl: string;
  readonly space5xl: string;
  readonly space6xl: string;
  readonly space7xl: string;
  readonly space8xl: string;
  readonly density: string;
  readonly touchTargetSize: string;
}

export interface MmeElevationTokens {
  readonly elevation1: string;
  readonly elevation2: string;
  readonly elevation3: string;
  /** Legacy alias for `elevation1`. */
  readonly shadowSm: string;
  /** Legacy alias for `elevation2`. */
  readonly shadowMd: string;
}

export interface MmeMotionTokens {
  readonly fast: string;
  readonly base: string;
  readonly slow: string;
  readonly ease: string;
}

export interface MmeLayerTokens {
  readonly zToolbar: string;
  readonly zMenu: string;
  readonly zOverlay: string;
}

export interface ResolvedMmeTheme {
  readonly ramps: MmeRampTokens;
  readonly colors: MmeColorTokens;
  readonly typography: MmeTypographyTokens;
  readonly shape: MmeShapeTokens;
  readonly spacing: MmeSpacingTokens;
  readonly elevation: MmeElevationTokens;
  readonly motion: MmeMotionTokens;
  readonly layers: MmeLayerTokens;
}

export interface MmeTheme {
  readonly ramps?: Partial<MmeRampTokens>;
  readonly colors?: Partial<MmeColorTokens>;
  readonly typography?: Partial<MmeTypographyTokens>;
  readonly shape?: Partial<MmeShapeTokens>;
  readonly spacing?: Partial<MmeSpacingTokens>;
  readonly elevation?: Partial<MmeElevationTokens>;
  readonly motion?: Partial<MmeMotionTokens>;
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
  /**
   * Returns trusted icon markup, intended for controlled SVG/icon factories only.
   * Hosts must not pass user-authored or remote HTML because surface packages may insert this with `innerHTML`.
   */
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
] as const;

export type MmeTokenVariable = (typeof MME_TOKEN_VARIABLES)[number];

/**
 * Which ramp step each semantic color role reads. Light and dark differ on
 * purpose: elevation runs in opposite directions, so a raised surface is a
 * *lighter* step in dark and white-on-tinted in light (MME-0102).
 */
const NEUTRAL_ROLE_STEPS: Readonly<Record<MmeScheme, Readonly<Record<string, number>>>> = {
  dark: {
    bg: 1,
    surface: 2,
    surfaceRaised: 4,
    surfaceMuted: 3,
    surfaceHover: 5,
    surfaceActive: 6,
    codeBg: 3,
    border: 6,
    borderSubtle: 6,
    borderStrong: 7,
    text: 12,
    textDisabled: 10,
    textMuted: 11,
    textSubtle: 9
  },
  light: {
    bg: 1,
    surface: 2,
    surfaceRaised: 2,
    surfaceMuted: 3,
    surfaceHover: 3,
    surfaceActive: 4,
    codeBg: 4,
    border: 6,
    borderSubtle: 6,
    borderStrong: 7,
    text: 12,
    textDisabled: 10,
    textMuted: 11,
    textSubtle: 10
  }
};

/** Accent roles read the same steps in both schemes. */
const ACCENT_ROLE_STEPS: Readonly<Record<string, number>> = {
  accent: 9,
  accentHover: 10,
  accentText: 11,
  accentSoft: 3,
  accentSofter: 2
};

/** Which accent step the focus ring reads, per scheme. */
const FOCUS_RING_STEP: Readonly<Record<MmeScheme, number>> = { dark: 11, light: 9 };

/** Selection is an accent wash; the alpha differs per scheme. */
const SELECTION_MIX: Readonly<Record<MmeScheme, number>> = { dark: 35, light: 16 };

/** Colors that are deliberately not ramp steps: fixed pairs and translucent overlays. */
const FIXED_COLORS: Readonly<Record<MmeScheme, Readonly<Record<string, string>>>> = {
  dark: {
    accentContrast: "#ffffff",
    danger: "#fb7185",
    warning: "#f2b86b"
  },
  light: {
    accentContrast: "#ffffff",
    danger: "#c62a30",
    warning: "#8a4b08"
  }
};

const DEFAULT_RAMPS: Readonly<Record<MmeScheme, MmeRampTokens>> = {
  dark: {
    accent: [
      "#0b1220",
      "#0e1729",
      "#12213c",
      "#15294f",
      "#1a3260",
      "#1f3d75",
      "#264b93",
      "#2d5cba",
      "#2563eb",
      "#1d4ed8",
      "#8ab4ff",
      "#d5e4ff"
    ],
    neutral: [
      "#0a0a0a",
      "#121318",
      "#16181e",
      "#1a1c22",
      "#22252e",
      "#2b2f38",
      "#3b4250",
      "#4d5567",
      "#5f6a7e",
      "#7a8598",
      "#a6adbb",
      "#f5f6f8"
    ]
  },
  light: {
    accent: [
      "#f5f9ff",
      "#ebf3ff",
      "#dbe9ff",
      "#c9dcff",
      "#b3cdfb",
      "#97b9f4",
      "#729fe9",
      "#4a80d8",
      "#0057c2",
      "#0047a3",
      "#0052b8",
      "#10284f"
    ],
    neutral: [
      "#fbfcff",
      "#ffffff",
      "#f4f6fa",
      "#eef2f7",
      "#e6ebf2",
      "#dfe4ec",
      "#c8d0dc",
      "#aab4c4",
      "#8f9aab",
      "#78849a",
      "#4b5563",
      "#111827"
    ]
  }
};

const DEFAULT_ELEVATION: Readonly<Record<MmeScheme, MmeElevationTokens>> = {
  dark: {
    elevation1: "0 1px 2px rgba(0, 0, 0, 0.4)",
    elevation2: "inset 0 0 0 1px #3b4250, 0 4px 12px rgba(0, 0, 0, 0.5)",
    elevation3: "inset 0 0 0 1px #3b4250, 0 8px 24px rgba(0, 0, 0, 0.55), 0 20px 48px rgba(0, 0, 0, 0.45)",
    shadowMd: "inset 0 0 0 1px #3b4250, 0 4px 12px rgba(0, 0, 0, 0.5)",
    shadowSm: "0 1px 2px rgba(0, 0, 0, 0.4)"
  },
  light: {
    elevation1: "0 1px 2px rgba(0, 0, 0, 0.05)",
    elevation2: "0 0 0 1px rgba(0, 0, 0, 0.05), 0 4px 12px rgba(0, 0, 0, 0.09)",
    elevation3:
      "0 0 0 1px rgba(0, 0, 0, 0.05), 0 8px 24px rgba(0, 0, 0, 0.12), 0 20px 48px rgba(0, 0, 0, 0.09)",
    shadowMd: "0 0 0 1px rgba(0, 0, 0, 0.05), 0 4px 12px rgba(0, 0, 0, 0.09)",
    shadowSm: "0 1px 2px rgba(0, 0, 0, 0.05)"
  }
};

const SHARED_TYPOGRAPHY: MmeTypographyTokens = {
  fontFamilyContent: "var(--mme-font-family-ui)",
  fontFamilyMono: 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
  fontFamilyUi: '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, "Segoe UI", Roboto, ui-sans-serif, sans-serif',
  fontScale: "1",
  fontSizeBase: "var(--mme-font-size-ui)",
  fontSizeCode: "14px",
  fontSizeContent: "16px",
  fontSizeUi: "13px",
  fontSizeUiSm: "12px",
  fontSizeUiXs: "11px",
  lineHeight: "var(--mme-line-height-content)",
  lineHeightContent: "1.65",
  lineHeightUi: "1.45"
};

const SHARED_SHAPE: MmeShapeTokens = {
  radiusFull: "999px",
  radiusLg: "10px",
  radiusMd: "8px",
  radiusSm: "6px",
  radiusXl: "12px",
  radiusXs: "4px"
};

const SHARED_SPACING: MmeSpacingTokens = {
  density: "1",
  space2xl: "20px",
  space2xs: "2px",
  space3xl: "24px",
  space4xl: "32px",
  space5xl: "40px",
  space6xl: "48px",
  space7xl: "64px",
  space8xl: "80px",
  spaceLg: "12px",
  spaceMd: "8px",
  spaceSm: "6px",
  spaceXl: "16px",
  spaceXs: "4px",
  touchTargetSize: "44px"
};

const SHARED_MOTION: MmeMotionTokens = {
  base: "150ms",
  ease: "cubic-bezier(0.2, 0, 0, 1)",
  fast: "100ms",
  slow: "200ms"
};

const SHARED_LAYERS: MmeLayerTokens = {
  zMenu: "45",
  zOverlay: "70",
  zToolbar: "20"
};

/**
 * Derives every semantic color from the ramps. This is the mechanism behind
 * "a rebrand is a ramp swap": override `ramps` and the whole palette follows.
 */
export function deriveColorsFromRamps(ramps: MmeRampTokens, scheme: MmeScheme): MmeColorTokens {
  const neutralSteps = NEUTRAL_ROLE_STEPS[scheme];
  const step = (ramp: MmeColorRamp, index: number): string => ramp[index - 1] as string;
  return {
    accent: step(ramps.accent, ACCENT_ROLE_STEPS.accent as number),
    accentContrast: FIXED_COLORS[scheme].accentContrast as string,
    accentHover: step(ramps.accent, ACCENT_ROLE_STEPS.accentHover as number),
    accentSoft: step(ramps.accent, ACCENT_ROLE_STEPS.accentSoft as number),
    accentSofter: step(ramps.accent, ACCENT_ROLE_STEPS.accentSofter as number),
    accentText: step(ramps.accent, ACCENT_ROLE_STEPS.accentText as number),
    bg: step(ramps.neutral, neutralSteps.bg as number),
    border: step(ramps.neutral, neutralSteps.border as number),
    borderStrong: step(ramps.neutral, neutralSteps.borderStrong as number),
    borderSubtle: step(ramps.neutral, neutralSteps.borderSubtle as number),
    codeBg: step(ramps.neutral, neutralSteps.codeBg as number),
    danger: FIXED_COLORS[scheme].danger as string,
    focusRing: step(ramps.accent, FOCUS_RING_STEP[scheme]),
    selection: `color-mix(in srgb, ${step(ramps.accent, ACCENT_ROLE_STEPS.accent as number)} ${SELECTION_MIX[scheme]}%, transparent)`,
    surface: step(ramps.neutral, neutralSteps.surface as number),
    surfaceActive: step(ramps.neutral, neutralSteps.surfaceActive as number),
    surfaceHover: step(ramps.neutral, neutralSteps.surfaceHover as number),
    surfaceMuted: step(ramps.neutral, neutralSteps.surfaceMuted as number),
    surfaceRaised: step(ramps.neutral, neutralSteps.surfaceRaised as number),
    text: step(ramps.neutral, neutralSteps.text as number),
    textMuted: step(ramps.neutral, neutralSteps.textMuted as number),
    textDisabled: step(ramps.neutral, neutralSteps.textDisabled as number),
    textSubtle: step(ramps.neutral, neutralSteps.textSubtle as number),
    warning: FIXED_COLORS[scheme].warning as string
  };
}

export const DEFAULT_MME_THEME: Readonly<Record<MmeScheme, ResolvedMmeTheme>> = {
  dark: {
    colors: deriveColorsFromRamps(DEFAULT_RAMPS.dark, "dark"),
    elevation: DEFAULT_ELEVATION.dark,
    layers: SHARED_LAYERS,
    motion: SHARED_MOTION,
    ramps: DEFAULT_RAMPS.dark,
    shape: SHARED_SHAPE,
    spacing: SHARED_SPACING,
    typography: SHARED_TYPOGRAPHY
  },
  light: {
    colors: deriveColorsFromRamps(DEFAULT_RAMPS.light, "light"),
    elevation: DEFAULT_ELEVATION.light,
    layers: SHARED_LAYERS,
    motion: SHARED_MOTION,
    ramps: DEFAULT_RAMPS.light,
    shape: SHARED_SHAPE,
    spacing: SHARED_SPACING,
    typography: SHARED_TYPOGRAPHY
  }
};

export function resolveThemeToCssVariables(
  theme: MmeTheme = {},
  scheme: MmeScheme = DEFAULT_MME_SCHEME
): Readonly<Record<MmeTokenVariable, string>> {
  const resolved = resolveTheme(theme, scheme);
  return {
    "--mme-accent-1": resolved.ramps.accent[0],
    "--mme-accent-10": resolved.ramps.accent[9],
    "--mme-accent-11": resolved.ramps.accent[10],
    "--mme-accent-12": resolved.ramps.accent[11],
    "--mme-accent-2": resolved.ramps.accent[1],
    "--mme-accent-3": resolved.ramps.accent[2],
    "--mme-accent-4": resolved.ramps.accent[3],
    "--mme-accent-5": resolved.ramps.accent[4],
    "--mme-accent-6": resolved.ramps.accent[5],
    "--mme-accent-7": resolved.ramps.accent[6],
    "--mme-accent-8": resolved.ramps.accent[7],
    "--mme-accent-9": resolved.ramps.accent[8],
    "--mme-color-accent": resolved.colors.accent,
    "--mme-color-accent-contrast": resolved.colors.accentContrast,
    "--mme-color-accent-hover": resolved.colors.accentHover,
    "--mme-color-accent-soft": resolved.colors.accentSoft,
    "--mme-color-accent-softer": resolved.colors.accentSofter,
    "--mme-color-accent-text": resolved.colors.accentText,
    "--mme-color-bg": resolved.colors.bg,
    "--mme-color-border": resolved.colors.border,
    "--mme-color-border-strong": resolved.colors.borderStrong,
    "--mme-color-border-subtle": resolved.colors.borderSubtle,
    "--mme-color-code-bg": resolved.colors.codeBg,
    "--mme-color-danger": resolved.colors.danger,
    "--mme-color-focus-ring": resolved.colors.focusRing,
    "--mme-color-selection": resolved.colors.selection,
    "--mme-color-surface": resolved.colors.surface,
    "--mme-color-surface-active": resolved.colors.surfaceActive,
    "--mme-color-surface-hover": resolved.colors.surfaceHover,
    "--mme-color-surface-muted": resolved.colors.surfaceMuted,
    "--mme-color-surface-raised": resolved.colors.surfaceRaised,
    "--mme-color-text": resolved.colors.text,
    "--mme-color-text-muted": resolved.colors.textMuted,
    "--mme-color-text-disabled": resolved.colors.textDisabled,
    "--mme-color-text-subtle": resolved.colors.textSubtle,
    "--mme-color-warning": resolved.colors.warning,
    "--mme-density": resolved.spacing.density,
    "--mme-elevation-1": resolved.elevation.elevation1,
    "--mme-elevation-2": resolved.elevation.elevation2,
    "--mme-elevation-3": resolved.elevation.elevation3,
    "--mme-font-family-content": resolved.typography.fontFamilyContent,
    "--mme-font-family-mono": resolved.typography.fontFamilyMono,
    "--mme-font-family-ui": resolved.typography.fontFamilyUi,
    "--mme-font-scale": resolved.typography.fontScale,
    "--mme-font-size-base": resolved.typography.fontSizeBase,
    "--mme-font-size-code": resolved.typography.fontSizeCode,
    "--mme-font-size-content": resolved.typography.fontSizeContent,
    "--mme-font-size-ui": resolved.typography.fontSizeUi,
    "--mme-font-size-ui-sm": resolved.typography.fontSizeUiSm,
    "--mme-font-size-ui-xs": resolved.typography.fontSizeUiXs,
    "--mme-line-height": resolved.typography.lineHeight,
    "--mme-line-height-content": resolved.typography.lineHeightContent,
    "--mme-line-height-ui": resolved.typography.lineHeightUi,
    "--mme-motion-base": resolved.motion.base,
    "--mme-motion-ease": resolved.motion.ease,
    "--mme-motion-fast": resolved.motion.fast,
    "--mme-motion-slow": resolved.motion.slow,
    "--mme-neutral-1": resolved.ramps.neutral[0],
    "--mme-neutral-10": resolved.ramps.neutral[9],
    "--mme-neutral-11": resolved.ramps.neutral[10],
    "--mme-neutral-12": resolved.ramps.neutral[11],
    "--mme-neutral-2": resolved.ramps.neutral[1],
    "--mme-neutral-3": resolved.ramps.neutral[2],
    "--mme-neutral-4": resolved.ramps.neutral[3],
    "--mme-neutral-5": resolved.ramps.neutral[4],
    "--mme-neutral-6": resolved.ramps.neutral[5],
    "--mme-neutral-7": resolved.ramps.neutral[6],
    "--mme-neutral-8": resolved.ramps.neutral[7],
    "--mme-neutral-9": resolved.ramps.neutral[8],
    "--mme-radius-full": resolved.shape.radiusFull,
    "--mme-radius-lg": resolved.shape.radiusLg,
    "--mme-radius-md": resolved.shape.radiusMd,
    "--mme-radius-sm": resolved.shape.radiusSm,
    "--mme-radius-xl": resolved.shape.radiusXl,
    "--mme-radius-xs": resolved.shape.radiusXs,
    "--mme-shadow-md": resolved.elevation.shadowMd,
    "--mme-shadow-sm": resolved.elevation.shadowSm,
    "--mme-space-2xl": resolved.spacing.space2xl,
    "--mme-space-2xs": resolved.spacing.space2xs,
    "--mme-space-3xl": resolved.spacing.space3xl,
    "--mme-space-4xl": resolved.spacing.space4xl,
    "--mme-space-5xl": resolved.spacing.space5xl,
    "--mme-space-6xl": resolved.spacing.space6xl,
    "--mme-space-7xl": resolved.spacing.space7xl,
    "--mme-space-8xl": resolved.spacing.space8xl,
    "--mme-space-lg": resolved.spacing.spaceLg,
    "--mme-space-md": resolved.spacing.spaceMd,
    "--mme-space-sm": resolved.spacing.spaceSm,
    "--mme-space-xl": resolved.spacing.spaceXl,
    "--mme-space-xs": resolved.spacing.spaceXs,
    "--mme-touch-target-size": resolved.spacing.touchTargetSize,
    "--mme-z-menu": resolved.layers.zMenu,
    "--mme-z-overlay": resolved.layers.zOverlay,
    "--mme-z-toolbar": resolved.layers.zToolbar
  };
}

export function resolveTheme(theme: MmeTheme = {}, scheme: MmeScheme = DEFAULT_MME_SCHEME): ResolvedMmeTheme {
  const defaults = DEFAULT_MME_THEME[scheme];
  const ramps: MmeRampTokens = {
    accent: theme.ramps?.accent ?? defaults.ramps.accent,
    neutral: theme.ramps?.neutral ?? defaults.ramps.neutral
  };
  // Semantic colors follow the ramps, then explicit color overrides win.
  const derivedColors = deriveColorsFromRamps(ramps, scheme);
  return {
    colors: {
      ...derivedColors,
      ...theme.colors
    },
    elevation: {
      ...defaults.elevation,
      ...theme.elevation
    },
    layers: {
      ...defaults.layers,
      ...theme.layers
    },
    motion: {
      ...defaults.motion,
      ...theme.motion
    },
    ramps,
    shape: {
      ...defaults.shape,
      ...theme.shape
    },
    spacing: {
      ...defaults.spacing,
      ...theme.spacing
    },
    typography: {
      ...defaults.typography,
      ...theme.typography
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
