import type {
  EditorDocumentKind,
  MarkdownEditorSession,
  SlashItemDefinition,
  ToolbarItemDefinition
} from "@momentarise/md-editor";
import { editorModesForDocumentKind } from "@momentarise/md-editor";
import type {
  FrontmatterBlockModel,
  FrontmatterPropertyType,
  FrontmatterPropertyValue,
  FrontmatterReadOnlyReason
} from "@momentarise/md-format";
import type { SaveState } from "@momentarise/md-save";
import {
  resolveThemeToCssVariables,
  type IconName,
  type IconSet,
  type MmeScheme,
  type MmeTheme
} from "@momentarise/md-theme";

export interface SurfaceContractEntry {
  /** The exported factory a host calls to mount this surface. */
  readonly factory: string;
  readonly id: string;
}

export interface SurfaceContract {
  readonly packageName: "@momentarise/md-surface";
  readonly contract: "framework-free-dom-surface";
  /**
   * Every package-owned surface a host is expected to be able to mount.
   *
   * This list exists because the same defect has now shipped three times: rich
   * mode (MME-0101), the selection bubble (MME-0125) and the Properties panel
   * (MME-0090) were each built against `apps/md-demo` while the React binding —
   * the primary documented integration path — was left without them, so a
   * default consumer got an invisible feature. A build-log note did not catch
   * the second or the third. MME-0126 turns this list into a gate: a surface
   * named here that a default React-binding mount does not reach is a failure,
   * not a follow-up. (The binding's package name is deliberately not written
   * out: this file is scanned for host-framework references.)
   */
  readonly surfaces: readonly SurfaceContractEntry[];
}

export interface SurfaceComponent {
  destroy(): void;
  update(): void;
}

export interface SurfaceViewportMeasurement {
  readonly layoutHeight: number;
  readonly layoutWidth: number;
  readonly visualHeight?: number;
  readonly visualOffsetTop?: number;
  readonly visualScale?: number;
  readonly visualWidth?: number;
}

export interface SurfaceViewportAdapter {
  measure(): SurfaceViewportMeasurement;
  subscribe?(listener: () => void): () => void;
}

export interface SurfaceViewportState {
  readonly keyboardInset: number;
  readonly layoutHeight: number;
  readonly layoutWidth: number;
  readonly mode: "layout" | "visual";
  readonly visualHeight: number;
  readonly visualOffsetTop: number;
  readonly visualWidth: number;
}

export interface CreateSurfaceViewportControllerOptions {
  readonly host: HTMLElement;
  readonly viewport: SurfaceViewportAdapter;
}

export interface SurfacePreferences {
  readonly aiEntryPoints: readonly string[];
  readonly layoutDensity?: "compact" | "comfortable" | "spacious" | string;
  readonly modeControl?: "compact-tabs" | "host-provided" | "single-toggle" | string;
  readonly slashEnabled?: boolean;
  readonly slashGroups?: readonly string[];
  readonly toolbarMode?: "floating" | "hidden" | "inline" | "sticky" | string;
  readonly toolbarStyle?: "compact" | "glass" | "solid" | string;
  readonly visibleCommandGroups?: readonly string[];
}

export interface SurfaceComponentContext {
  readonly host: HTMLElement;
  readonly icons: IconSet;
  readonly preferences: SurfacePreferences;
  readonly session: MarkdownEditorSession;
  readonly strings: MmeStrings;
}

export interface MmeStrings {
  readonly assetUpload: {
    readonly chooseImage: string;
    readonly denied: string;
    readonly documentChanged: string;
    readonly failed: string;
    readonly idle: string;
    readonly inserted: string;
    readonly label: string;
    readonly locationUnavailable: string;
    readonly markdownOnly: string;
    readonly pending: string;
    readonly readFailed: string;
    readonly statusLabel: string;
    readonly unavailable: string;
    readonly uploading: string;
  };
  readonly ai: {
    readonly accept: string;
    readonly actionsLabel: string;
    readonly assistantLabel: string;
    readonly close: string;
    readonly connect: string;
    readonly generate: string;
    readonly inlineLabel: string;
    readonly keyLabel: string;
    readonly keyPlaceholder: string;
    readonly noSession: string;
    readonly promptLabel: string;
    readonly promptPlaceholder: string;
    readonly providerState: string;
    readonly reject: string;
    readonly statusLabel: string;
  };
  readonly blockControls: {
    readonly insertAfter: string;
    readonly label: string;
    readonly language: string;
    readonly meta: string;
  };
  readonly commandPalette: {
    readonly inputLabel: string;
    readonly inputPlaceholder: string;
    readonly label: string;
  };
  readonly diagnostics: {
    readonly debugActions: string;
    readonly eventLog: string;
    readonly label: string;
    readonly roundTrip: string;
  };
  readonly extensions: Readonly<Record<string, string>> & {
    readonly "extensions.unknown": string;
  };
  readonly find: {
    readonly activeMatch: string;
    readonly close: string;
    readonly label: string;
    readonly matchCount: string;
    readonly next: string;
    readonly noMatches: string;
    readonly previous: string;
    readonly queryLabel: string;
    readonly queryPlaceholder: string;
    readonly replace: string;
    readonly replaceAll: string;
    readonly replacementLabel: string;
    readonly replacementPlaceholder: string;
  };
  readonly footnote: {
    readonly inserted: string;
    readonly initialBody: string;
    readonly unavailable: string;
  };
  readonly mode: {
    readonly label: string;
    readonly livePreview: string;
    readonly preview: string;
    readonly read?: string;
    readonly rich: string;
    readonly source: string;
    readonly toggleRich: string;
  };
  /** MME-0090: the frontmatter Properties panel. */
  readonly properties: {
    readonly add: string;
    readonly addItem: string;
    readonly displayHidden: string;
    readonly displaySource: string;
    readonly displayVisible: string;
    readonly editInSource: string;
    readonly hiddenNote: string;
    readonly keyLabel: string;
    readonly label: string;
    readonly reasons: Readonly<Record<FrontmatterReadOnlyReason, string>>;
    readonly remove: string;
    readonly removeItem: string;
    readonly typeLabel: string;
    readonly types: Readonly<Record<FrontmatterPropertyType, string>>;
    readonly valueLabel: string;
  };
  readonly slash: {
    readonly aiSection: string;
    readonly emptyPlaceholder: string;
    readonly groups?: Readonly<Record<string, string>>;
    readonly label: string;
    readonly noResults?: string;
  };
  readonly status: {
    readonly adapter?: string;
    readonly conflictDescription: string;
    readonly conflictDownloadLocal: string;
    readonly conflictReloadExternal: string;
    readonly conflictRetrySave: string;
    readonly conflictTitle: string;
    readonly details?: string;
    readonly dirtyClean: string;
    readonly htmlTarget: string;
    readonly importedTarget: string;
    readonly lastSaved?: string;
    readonly memoryTarget: string;
    readonly path: string;
    readonly primaryExport: string;
    readonly primarySave: string;
    readonly primaryUnavailable: string;
    readonly save: string;
    readonly target: string;
    readonly targetConflict: string;
    readonly targetDisk: string;
    readonly unsupportedTarget: string;
    readonly writable?: string;
  };
  readonly toolbar: {
    readonly ai: string;
    readonly blockquote: string;
    readonly bold: string;
    readonly bulletList: string;
    readonly callout: string;
    readonly codeBlock: string;
    readonly divider: string;
    readonly footnote: string;
    readonly heading1: string;
    readonly heading2: string;
    readonly heading3: string;
    readonly image: string;
    readonly inlineCode: string;
    readonly italic: string;
    readonly label: string;
    readonly link: string;
    /** MME-0089: the selection bubble's link popover. */
    readonly linkApply: string;
    readonly linkCancel: string;
    readonly linkPlaceholder: string;
    readonly linkRemove: string;
    readonly more: string;
    readonly orderedList: string;
    readonly paragraph: string;
    readonly strikethrough: string;
    readonly tableColumnAfter: string;
    readonly tableColumnBefore: string;
    readonly tableColumnDelete: string;
    readonly tableColumnLeft: string;
    readonly tableColumnRight: string;
    readonly tableRowAfter: string;
    readonly tableRowBefore: string;
    readonly tableRowDelete: string;
    readonly tableRowDown: string;
    readonly tableRowUp: string;
    readonly todo: string;
    readonly toggleBlock: string;
    /** MME-0089: the selection bubble's block-conversion dropdown. */
    readonly turnInto: string;
  };
}

export interface SurfaceAiAction {
  readonly entryPoints: readonly string[];
  readonly id: string;
  readonly label: string;
  readonly prompt: string;
}

export type SurfaceAssetUploadStatus = "denied" | "failed" | "idle" | "inserted" | "pending" | "unavailable";

export interface SurfaceAssetUploadState {
  readonly busy?: boolean;
  readonly disabledReason?: string;
  readonly message: string;
  readonly status: SurfaceAssetUploadStatus;
}

export type SurfaceDocumentKind = "html-artifact" | "lightweight-source" | "markdown" | "svg-artifact";
export type SurfaceDocumentMode = "fixture" | "imported-copy" | "unsupported" | "writable-file" | string;
export type SurfaceEditorMode = "live-preview" | "preview" | "rich" | "source";

export interface SurfaceDocumentState {
  readonly adapterKind?: string;
  readonly fileName: string;
  readonly kind: SurfaceDocumentKind;
  readonly mode: SurfaceDocumentMode;
  readonly pathLabel: string;
  readonly writable?: boolean;
}

export interface CreateSurfaceDocumentStateOptions {
  readonly overrides?: Partial<SurfaceDocumentState>;
  readonly path?: string | null;
  readonly saveState: Pick<SaveState, "target">;
  readonly targetLabel: string;
}

export interface SurfaceToolbarState {
  readonly activeIds?: readonly string[];
  readonly disabledIds?: readonly string[];
  readonly disabledReasons?: Readonly<Record<string, string>>;
  readonly editorMode: SurfaceEditorMode;
  readonly hostToolbarItems?: readonly ToolbarItemDefinition[];
  readonly visible: boolean;
}

export interface CreateToolbarOptions extends SurfaceComponentContext {
  readonly onAiToolbar: () => void;
  readonly onRunToolbarItem: (id: string) => void | Promise<void>;
  readonly state: SurfaceToolbarState;
}

/**
 * MME-0089 — the link popover's state.
 *
 * `href` is the destination the selection already carries, so re-opening the
 * popover on an existing link edits it rather than starting blank; an empty
 * string means "no link here yet", which is what hides the Remove action.
 */
export interface SurfaceSelectionBubbleLinkEditorState {
  readonly href: string;
  readonly open: boolean;
}

export interface SurfaceSelectionBubbleState {
  readonly activeIds?: readonly string[];
  /** The block command the selection currently sits in, shown by the turn-into control. */
  readonly activeBlockCommand?: string;
  readonly aiDisabled?: boolean;
  readonly aiVisible?: boolean;
  readonly disabledIds?: readonly string[];
  readonly disabledReasons?: Readonly<Record<string, string>>;
  readonly linkEditor?: SurfaceSelectionBubbleLinkEditorState;
  /**
   * Rich command ids the current selection cannot be converted to.
   *
   * The host computes this with `canRunRichMarkdownCommand`, so the dropdown
   * never offers a conversion that would do nothing. When every entry is
   * unavailable the control itself is disabled: no inert control ships.
   */
  readonly turnIntoDisabledCommands?: readonly string[];
  readonly turnIntoOpen?: boolean;
  readonly visible: boolean;
}

export interface CreateSelectionBubbleToolbarOptions extends SurfaceComponentContext {
  readonly onAiSelection: () => void | Promise<void>;
  /** Asked to close the link popover without changing the document. */
  readonly onLinkCancel?: () => void;
  /** Asked to remove the link mark from the selection. */
  readonly onLinkRemove?: () => void | Promise<void>;
  /** The user submitted a destination; the host writes `[text](href)`. */
  readonly onLinkSubmit: (href: string) => void | Promise<void>;
  /** Asked to open or close the link popover. */
  readonly onLinkToggle?: (open: boolean) => void;
  readonly onRunToolbarItem: (id: string) => void | Promise<void>;
  /** A block conversion was chosen from the turn-into dropdown. */
  readonly onTurnInto: (richCommandId: string) => void | Promise<void>;
  /** Asked to open or close the turn-into dropdown. */
  readonly onTurnIntoToggle?: (open: boolean) => void;
  readonly state: SurfaceSelectionBubbleState;
}

export interface SurfaceSlashState {
  readonly items: readonly SlashItemDefinition[];
  readonly open: boolean;
  readonly query: string;
  readonly selectedIndex: number;
}

export interface CreateSlashMenuOptions extends SurfaceComponentContext {
  readonly aiItems: readonly SurfaceAiAction[];
  readonly onClose: () => void;
  readonly onRunAiAction: (id: string) => void | Promise<void>;
  readonly onRunSlashItem: (id: string) => void | Promise<void>;
  readonly onSelectionChange?: (index: number) => void;
  readonly state: SurfaceSlashState;
}

export interface CreateCommandPaletteOptions extends SurfaceComponentContext {
  readonly actions: readonly SurfaceAiAction[];
  readonly onRunAiAction: (id: string) => void | Promise<void>;
  readonly returnFocusTo?: HTMLElement;
}

export interface SurfaceFindMatch {
  readonly from: number;
  readonly to: number;
}

export interface SurfaceFindReplaceState {
  readonly activeIndex: number;
  readonly matches: readonly SurfaceFindMatch[];
  readonly open: boolean;
  readonly query: string;
  readonly replacement: string;
}

export type SurfaceConflictResolutionAction = "download-local-copy" | "reload-external" | "retry-save";

export interface CreateFindReplaceSurfaceOptions extends SurfaceComponentContext {
  readonly onClose?: () => void;
  readonly onFind: (query: string) => void;
  readonly onFindNext: () => void;
  readonly onFindPrevious: () => void;
  readonly onReplace: (replacement: string) => void;
  readonly onReplaceAll: (replacement: string) => void;
  readonly state: SurfaceFindReplaceState;
}

export interface CreateDocumentStatusOptions extends SurfaceComponentContext {
  readonly document: SurfaceDocumentState;
  readonly onPrimaryAction: () => void | Promise<void>;
  readonly onResolveConflict?: (action: SurfaceConflictResolutionAction) => void | Promise<void>;
  readonly saveState: SaveState;
}

export interface SurfaceAiPendingState {
  readonly policyReason?: string;
  readonly replacement?: string;
  readonly status: "accepted" | "blocked" | "pending" | "rejected" | string;
  readonly title?: string;
}

export type SurfaceAiProviderKind =
  | "disabled-by-policy"
  | "host-managed"
  | "missing"
  | "mock"
  | "personal-byok"
  | string;

export interface SurfaceAiProviderState {
  readonly canSubmit: boolean;
  readonly description: string;
  readonly kind: SurfaceAiProviderKind;
  readonly label: string;
}

export interface SurfaceInlineAiAnchor {
  readonly left: number;
  readonly top: number;
  readonly width?: number;
}

export interface SurfaceInlineAiPromptState {
  readonly anchor: SurfaceInlineAiAnchor | null;
  readonly busy?: boolean;
  readonly open: boolean;
  readonly pending: SurfaceAiPendingState | null;
  readonly prompt: string;
  readonly provider: SurfaceAiProviderState;
  readonly selectedActionIndex: number;
  readonly statusText: string;
}

export interface SurfaceInlineAiPromptSubmitEvent {
  readonly actionId?: string;
  readonly prompt: string;
  readonly providerKind: SurfaceAiProviderKind;
}

export interface SurfaceAiAssistantState {
  readonly hasSession: boolean;
  readonly pending: SurfaceAiPendingState | null;
  readonly statusText: string;
  readonly visible?: boolean;
}

export interface CreateAiAssistantPanelOptions extends SurfaceComponentContext {
  readonly onAccept: () => void | Promise<void>;
  readonly onClose: () => void;
  readonly onReject: () => void | Promise<void>;
  readonly onStartSession: (key: string) => void | Promise<void>;
  readonly state: SurfaceAiAssistantState;
}

export interface CreateInlineAiPromptOptions extends SurfaceComponentContext {
  readonly actions: readonly SurfaceAiAction[];
  readonly onAccept?: () => void | Promise<void>;
  readonly onClose: () => void;
  readonly onReject?: () => void | Promise<void>;
  readonly onSubmit: (event: SurfaceInlineAiPromptSubmitEvent) => void | Promise<void>;
  readonly returnFocusTo?: HTMLElement;
  readonly state: SurfaceInlineAiPromptState;
}

export interface SurfaceModeControlState {
  readonly documentKind: SurfaceDocumentKind;
  readonly editorMode: SurfaceEditorMode;
}

export interface CreateModeControlOptions extends SurfaceComponentContext {
  readonly onSwitchMode: (mode: SurfaceEditorMode) => void;
  readonly state: SurfaceModeControlState;
  /**
   * Restrict the offered modes to a subset of what the document kind supports. A host that only
   * mounts some surfaces (e.g. the React binding, which mounts source and rich) passes the modes
   * it can actually mount so the control never shows an inert button. Order and document-kind
   * availability are still enforced; unknown modes are ignored. Omit to offer every mode the
   * document kind supports (the default).
   */
  readonly availableModes?: readonly SurfaceEditorMode[];
}

export interface CreateDiagnosticsSurfaceOptions extends SurfaceComponentContext {
  readonly open?: boolean;
}

export const surfaceContract: SurfaceContract = {
  contract: "framework-free-dom-surface",
  packageName: "@momentarise/md-surface",
  surfaces: [
    { factory: "createDocumentStatus", id: "documentStatus" },
    { factory: "createModeControl", id: "modeControl" },
    { factory: "createPropertiesPanel", id: "propertiesPanel" },
    { factory: "createSelectionBubbleToolbar", id: "selectionBubble" },
    { factory: "createSlashMenu", id: "slashMenu" },
    { factory: "createToolbar", id: "toolbar" }
  ]
};

export function applyMmeThemeToElement(
  element: HTMLElement,
  theme: MmeTheme = {},
  scheme?: MmeScheme
): void {
  const variables = resolveThemeToCssVariables(theme, scheme);
  for (const [name, value] of Object.entries(variables)) {
    element.style.setProperty(name, value);
  }
}

export function createSurfaceViewportController(
  options: CreateSurfaceViewportControllerOptions
): SurfaceComponent & {
  getState(): SurfaceViewportState;
} {
  const styleProperties = [
    "--mme-visual-viewport-height",
    "--mme-visual-viewport-width",
    "--mme-visual-viewport-offset-top",
    "--mme-keyboard-inset"
  ] as const;
  const dataAttributes = ["data-mme-viewport-mode", "data-mme-keyboard-open"] as const;
  const previousStyles = new Map(styleProperties.map((name) => [name, options.host.style.getPropertyValue(name)]));
  const previousData = new Map(dataAttributes.map((name) => [name, options.host.getAttribute(name)]));
  let destroyed = false;
  let state = resolveSurfaceViewportState(options.viewport.measure());

  const update = (): void => {
    if (destroyed) {
      return;
    }
    state = resolveSurfaceViewportState(options.viewport.measure());
    options.host.style.setProperty("--mme-visual-viewport-height", `${state.visualHeight}px`);
    options.host.style.setProperty("--mme-visual-viewport-width", `${state.visualWidth}px`);
    options.host.style.setProperty("--mme-visual-viewport-offset-top", `${state.visualOffsetTop}px`);
    options.host.style.setProperty("--mme-keyboard-inset", `${state.keyboardInset}px`);
    options.host.dataset.mmeViewportMode = state.mode;
    options.host.dataset.mmeKeyboardOpen = String(state.keyboardInset > 1);
  };

  update();
  const unsubscribe = options.viewport.subscribe?.(update) ?? (() => {});

  return {
    destroy() {
      if (destroyed) {
        return;
      }
      destroyed = true;
      unsubscribe();
      for (const [name, value] of previousStyles) {
        if (value) {
          options.host.style.setProperty(name, value);
        } else {
          options.host.style.removeProperty(name);
        }
      }
      for (const [name, value] of previousData) {
        if (value === null) {
          options.host.removeAttribute(name);
        } else {
          options.host.setAttribute(name, value);
        }
      }
    },
    getState() {
      return state;
    },
    update
  };
}

export function createSurfaceDocumentState(options: CreateSurfaceDocumentStateOptions): SurfaceDocumentState {
  const pathLabel = options.path ?? options.targetLabel;
  const defaults: SurfaceDocumentState = {
    fileName: surfaceFileNameFromPath(pathLabel),
    kind: "markdown",
    mode: surfaceDocumentModeFromSaveTarget(options.saveState.target),
    pathLabel
  };
  return {
    ...defaults,
    ...options.overrides
  };
}

function resolveSurfaceViewportState(measurement: SurfaceViewportMeasurement): SurfaceViewportState {
  const layoutHeight = roundedViewportDimension(measurement.layoutHeight, 0);
  const layoutWidth = roundedViewportDimension(measurement.layoutWidth, 0);
  const hasVisualViewport =
    isFinitePositive(measurement.visualHeight) && isFinitePositive(measurement.visualWidth);
  const visualHeight = hasVisualViewport
    ? roundedViewportDimension(measurement.visualHeight, layoutHeight)
    : layoutHeight;
  const visualWidth = hasVisualViewport
    ? roundedViewportDimension(measurement.visualWidth, layoutWidth)
    : layoutWidth;
  const visualOffsetTop = hasVisualViewport
    ? Math.min(layoutHeight, roundedViewportValue(measurement.visualOffsetTop, 0))
    : 0;
  const visualScale = isFinitePositive(measurement.visualScale)
    ? measurement.visualScale
    : 1;
  const keyboardInset =
    hasVisualViewport && Math.abs(visualScale - 1) < 0.01
      ? Math.max(0, layoutHeight - visualHeight - visualOffsetTop)
      : 0;
  return {
    keyboardInset,
    layoutHeight,
    layoutWidth,
    mode: hasVisualViewport ? "visual" : "layout",
    visualHeight,
    visualOffsetTop,
    visualWidth
  };
}

function roundedViewportDimension(value: number | undefined, fallback: number): number {
  return isFinitePositive(value) ? Math.round(value) : fallback;
}

function roundedViewportValue(value: number | undefined, fallback: number): number {
  return isFiniteNonNegative(value) ? Math.round(value) : fallback;
}

function isFinitePositive(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isFiniteNonNegative(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function surfaceDocumentModeFromSaveTarget(target: SaveState["target"]): SurfaceDocumentState["mode"] {
  if (target === "disk") {
    return "writable-file";
  }
  if (target === "memory-only") {
    return "fixture";
  }
  if (target === "download-required") {
    return "imported-copy";
  }
  return target;
}

export function surfaceFileNameFromPath(pathLabel: string): string {
  return pathLabel.split(/[\\/]/).filter(Boolean).at(-1) ?? "Untitled.md";
}

export const defaultMmeStrings: MmeStrings = {
  assetUpload: {
    chooseImage: "Insert image",
    denied: "Image insertion denied",
    documentChanged: "The document changed before image insertion completed",
    failed: "Image insertion failed",
    idle: "Ready",
    inserted: "Image inserted",
    label: "Image upload",
    locationUnavailable: "The rich editor position cannot be mapped safely to Markdown source",
    markdownOnly: "Image insertion is available for Markdown documents only",
    pending: "Image upload pending",
    readFailed: "The selected image could not be read",
    statusLabel: "Image upload status",
    unavailable: "Image upload unavailable",
    uploading: "Preparing image"
  },
  ai: {
    accept: "Accept",
    actionsLabel: "AI actions",
    assistantLabel: "AI writing assistant",
    close: "Close",
    connect: "Connect",
    generate: "Generate",
    inlineLabel: "Inline AI prompt",
    keyLabel: "Mock session",
    keyPlaceholder: "Memory-only key",
    noSession: "No AI session",
    promptLabel: "Prompt",
    promptPlaceholder: "Ask AI to write or transform Markdown",
    providerState: "Provider state",
    reject: "Reject",
    statusLabel: "AI assistant"
  },
  blockControls: {
    insertAfter: "Add paragraph",
    label: "Block controls",
    language: "Language",
    meta: "Meta"
  },
  commandPalette: {
    inputLabel: "Command",
    inputPlaceholder: "Search commands and AI actions",
    label: "Command palette"
  },
  diagnostics: {
    debugActions: "Debug actions",
    eventLog: "Event log",
    label: "Technical diagnostics",
    roundTrip: "Round-trip"
  },
  extensions: {
    "extensions.hostAddProperties": "Add properties",
    "extensions.hostCalloutCard": "Host callout card",
    "extensions.hostInsertImageAsset": "Insert image asset",
    "extensions.hostTranslateSelection": "Host translate",
    "extensions.language": "Language",
    "extensions.tone": "Tone",
    "extensions.unknown": "Extension"
  },
  find: {
    activeMatch: "Active match",
    close: "Close find",
    label: "Find and replace",
    matchCount: "Matches",
    next: "Next match",
    noMatches: "0 / 0",
    previous: "Previous match",
    queryLabel: "Find",
    queryPlaceholder: "Find in document",
    replace: "Replace",
    replaceAll: "Replace all",
    replacementLabel: "Replace",
    replacementPlaceholder: "Replace with"
  },
  footnote: {
    inserted: "Footnote inserted",
    initialBody: "Footnote",
    unavailable: "Footnote insertion unavailable"
  },
  mode: {
    label: "Editor mode",
    livePreview: "Live Preview",
    preview: "Preview",
    read: "Read",
    rich: "Rich",
    source: "Source",
    toggleRich: "Toggle Rich Mode"
  },
  properties: {
    add: "Add property",
    addItem: "Add item",
    displayHidden: "Hide properties",
    displaySource: "Show as YAML source",
    displayVisible: "Show properties",
    editInSource: "Edit in Source",
    hiddenNote: "Properties are hidden. The YAML block is unchanged.",
    keyLabel: "Property name",
    label: "Properties",
    reasons: {
      "anchor-or-tag": "This value uses a YAML anchor, alias, or tag.",
      "block-scalar": "This value is a multi-line block scalar.",
      "inline-comment": "This value carries a trailing comment.",
      "nested-map": "This value is a nested structure.",
      "unsupported-value": "This value is outside the editable subset."
    },
    remove: "Delete property",
    removeItem: "Remove item",
    typeLabel: "Property type",
    types: {
      checkbox: "Checkbox",
      date: "Date",
      datetime: "Date & time",
      list: "List",
      number: "Number",
      text: "Text"
    },
    valueLabel: "Property value"
  },
  slash: {
    aiSection: "AI writing",
    emptyPlaceholder: "Write, or press '/' for commands",
    groups: {
      ai: "AI",
      blocks: "Blocks",
      insert: "Insert",
      lists: "Lists",
      marks: "Marks"
    },
    label: "Slash commands",
    noResults: "No commands found"
  },
  status: {
    adapter: "Adapter",
    conflictDescription: "External file changed. Local edits were not overwritten.",
    conflictDownloadLocal: "Download local copy",
    conflictReloadExternal: "Reload external",
    conflictRetrySave: "Retry save",
    conflictTitle: "Resolve conflict",
    details: "Details",
    dirtyClean: "clean",
    htmlTarget: "HTML artifact, sandbox preview, download/export required",
    importedTarget: "imported copy, download/export required",
    lastSaved: "Last saved",
    memoryTarget: "fixture, memory only, not persisted",
    path: "Path",
    primaryExport: "Export copy",
    primarySave: "Save",
    primaryUnavailable: "Save unavailable",
    save: "Save",
    target: "Target",
    targetConflict: "conflict, not overwritten",
    targetDisk: "disk, original file writable",
    unsupportedTarget: "unsupported, use import/download",
    writable: "Writable"
  },
  toolbar: {
    ai: "AI",
    blockquote: "Quote",
    bold: "Bold",
    bulletList: "Bullet list",
    callout: "Callout",
    codeBlock: "Code block",
    divider: "Divider",
    footnote: "Footnote",
    heading1: "Heading 1",
    heading2: "Heading 2",
    heading3: "Heading 3",
    image: "Image",
    inlineCode: "Inline code",
    italic: "Italic",
    label: "Rich editing toolbar",
    link: "Link",
    linkApply: "Apply link",
    linkCancel: "Cancel link",
    linkPlaceholder: "Paste or type a link",
    linkRemove: "Remove link",
    more: "More commands",
    orderedList: "Numbered list",
    paragraph: "Paragraph",
    strikethrough: "Strikethrough",
    tableColumnAfter: "Insert column after",
    tableColumnBefore: "Insert column before",
    tableColumnDelete: "Delete column",
    tableColumnLeft: "Move column left",
    tableColumnRight: "Move column right",
    tableRowAfter: "Insert row after",
    tableRowBefore: "Insert row before",
    tableRowDelete: "Delete row",
    tableRowDown: "Move row down",
    tableRowUp: "Move row up",
    todo: "Todo",
    toggleBlock: "Toggle block",
    turnInto: "Turn into"
  }
};

type ListenerCleanup = () => void;

const toolbarCommands: readonly ToolbarCommandDefinition[] = [
  { group: "blocks", icon: "heading", id: "mme:heading1", richCommand: "heading1", testId: "toolbar-command-heading1", title: "heading1" },
  { group: "blocks", icon: "heading", id: "mme:heading2", richCommand: "heading2", testId: "toolbar-command-heading2", title: "heading2" },
  { group: "marks", icon: "bold", id: "mme:bold", richCommand: "bold", testId: "toolbar-command-bold", title: "bold" },
  { group: "marks", icon: "italic", id: "mme:italic", richCommand: "italic", testId: "toolbar-command-italic", title: "italic" },
  { group: "lists", icon: "todo", id: "mme:todo", richCommand: "todo", testId: "toolbar-command-todo", title: "todo" },
  { group: "lists", icon: "list", id: "mme:bulletList", richCommand: "bulletList", testId: "toolbar-command-bulletList", title: "bulletList" },
  { group: "blocks", icon: "quote", id: "mme:blockquote", richCommand: "blockquote", testId: "toolbar-command-blockquote", title: "blockquote" },
  { group: "blocks", icon: "code", id: "mme:codeBlock", richCommand: "codeBlock", testId: "toolbar-command-codeBlock", title: "codeBlock" },
  { group: "insert", icon: "link", id: "mme:link", richCommand: "link", testId: "toolbar-command-link", title: "link" },
  { group: "insert", icon: "divider", id: "mme:divider", richCommand: "divider", testId: "toolbar-command-divider", title: "divider" }
] as const;

const toolbarMoreCommands: readonly ToolbarCommandDefinition[] = [
  { group: "blocks", icon: "heading", id: "mme:paragraph", richCommand: "paragraph", title: "paragraph" },
  { group: "blocks", icon: "heading", id: "mme:heading3", richCommand: "heading3", title: "heading3" },
  { group: "lists", icon: "list", id: "mme:orderedList", richCommand: "orderedList", title: "orderedList" },
  { group: "insert", icon: "quote", id: "mme:callout", richCommand: "callout", title: "callout" },
  { group: "insert", icon: "chevron", id: "mme:toggleBlock", richCommand: "toggleBlock", testId: "toolbar-command-toggleBlock", title: "toggleBlock" },
  { group: "insert", icon: "image", id: "mme:image", richCommand: "image", title: "image" },
  { group: "insert", icon: "link", id: "mme:footnote", richCommand: "footnote", title: "footnote" },
  { group: "insert", icon: "list", id: "mme:tableRowBefore", richCommand: "tableRowBefore", title: "tableRowBefore" },
  { group: "insert", icon: "list", id: "mme:tableRowAfter", richCommand: "tableRowAfter", title: "tableRowAfter" },
  { group: "insert", icon: "list", id: "mme:tableRowDelete", richCommand: "tableRowDelete", title: "tableRowDelete" },
  { group: "insert", icon: "list", id: "mme:tableColumnBefore", richCommand: "tableColumnBefore", title: "tableColumnBefore" },
  { group: "insert", icon: "list", id: "mme:tableColumnAfter", richCommand: "tableColumnAfter", title: "tableColumnAfter" },
  { group: "insert", icon: "list", id: "mme:tableColumnDelete", richCommand: "tableColumnDelete", title: "tableColumnDelete" },
  { group: "insert", icon: "list", id: "mme:tableRowUp", richCommand: "tableRowUp", title: "tableRowUp" },
  { group: "insert", icon: "list", id: "mme:tableRowDown", richCommand: "tableRowDown", title: "tableRowDown" },
  { group: "insert", icon: "list", id: "mme:tableColumnLeft", richCommand: "tableColumnLeft", title: "tableColumnLeft" },
  { group: "insert", icon: "list", id: "mme:tableColumnRight", richCommand: "tableColumnRight", title: "tableColumnRight" },
  { group: "marks", icon: "code", id: "mme:inlineCode", richCommand: "inlineCode", title: "inlineCode" }
] as const;

/*
 * MME-0089 — the bubble is now the formatting surface (benchmark contract 4),
 * so it carries the marks a writer actually reaches for rather than three of
 * them. Link and AI are rendered separately because both open a panel instead of
 * toggling a mark.
 */
const selectionBubbleCommands: readonly ToolbarCommandDefinition[] = [
  { group: "marks", icon: "bold", id: "mme:bold", richCommand: "bold", testId: "selection-bubble-bold", title: "bold" },
  { group: "marks", icon: "italic", id: "mme:italic", richCommand: "italic", testId: "selection-bubble-italic", title: "italic" },
  {
    group: "marks",
    icon: "strikethrough",
    id: "mme:strikethrough",
    richCommand: "strikethrough",
    testId: "selection-bubble-strikethrough",
    title: "strikethrough"
  },
  { group: "marks", icon: "code", id: "mme:inlineCode", richCommand: "inlineCode", testId: "selection-bubble-inline-code", title: "inlineCode" }
] as const;

/**
 * The turn-into dropdown's contents, in the benchmark's order.
 *
 * These are the block conversions Notion and BlockNote offer from a selection.
 * Every id is an existing `RichCommandId`, so the host wires one callback rather
 * than a switch — the dropdown adds no new command surface, only a way to reach
 * commands the slash menu already runs.
 */
const selectionBubbleTurnIntoCommands: readonly {
  readonly icon: IconName;
  readonly richCommand: string;
  readonly title: keyof MmeStrings["toolbar"];
}[] = [
  { icon: "paragraph", richCommand: "paragraph", title: "paragraph" },
  { icon: "heading1", richCommand: "heading1", title: "heading1" },
  { icon: "heading2", richCommand: "heading2", title: "heading2" },
  { icon: "heading3", richCommand: "heading3", title: "heading3" },
  { icon: "list", richCommand: "bulletList", title: "bulletList" },
  { icon: "orderedList", richCommand: "orderedList", title: "orderedList" },
  { icon: "todo", richCommand: "todo", title: "todo" },
  { icon: "quote", richCommand: "blockquote", title: "blockquote" },
  { icon: "code", richCommand: "codeBlock", title: "codeBlock" }
] as const;

interface ToolbarCommandDefinition {
  readonly group: string;
  readonly icon: IconName | null;
  readonly id: string;
  readonly richCommand: string;
  readonly testId?: string;
  readonly title: keyof MmeStrings["toolbar"];
}

export function createToolbar(options: CreateToolbarOptions): SurfaceComponent & {
  readonly root: HTMLElement;
  setState(state: SurfaceToolbarState): void;
  setMoreOpen(open: boolean): void;
} {
  const root = createElement(options.host, "div", "rich-command-toolbar");
  const cleanups: ListenerCleanup[] = [];
  let state = options.state;
  let moreOpen = false;
  /*
   * MME-0119: the More menu lives in the overlay layer, not in `root`. The
   * toolbar carries `backdrop-filter`, which would make it the containing block
   * for the menu's `position: fixed` and displace it by the toolbar's scroll
   * offset. Because the node is outside this component's subtree, the reference
   * is held here so `update()` can replace it and `destroy()` can remove it —
   * neither happens for free once a node is portalled.
   */
  let portalledMenu: HTMLElement | null = null;

  const detachPortalledMenu = (): void => {
    if (!portalledMenu) {
      return;
    }
    portalledMenu.removeEventListener("click", onClick);
    portalledMenu.removeEventListener("keydown", onKeyDown);
    portalledMenu.remove();
    portalledMenu = null;
  };

  options.host.replaceChildren(root);

  const menuItems = (): HTMLButtonElement[] =>
    portalledMenu ? [...portalledMenu.querySelectorAll<HTMLButtonElement>("button:not([disabled])")] : [];

  const setMoreOpen = (open: boolean, options_?: { readonly focus?: boolean }): void => {
    const wasOpen = moreOpen;
    moreOpen = open;
    const button = root.querySelector<HTMLElement>('[data-testid="toolbar-more-button"]');
    const menu = portalledMenu;
    button?.setAttribute("aria-expanded", String(moreOpen));
    if (menu) {
      /*
       * A hidden toolbar must take its menu with it. While the menu was a child
       * of `root` the `[hidden] { display: none !important }` rule did that for
       * free; portalled, it would otherwise float over the editor with no
       * toolbar beneath it after `setState({ visible: false })` or a mode switch.
       */
      menu.hidden = !moreOpen || root.hidden;
      if (moreOpen && !root.hidden && button) {
        positionToolbarMoreMenu(button, menu);
      }
    }
    /*
     * Focus management, which is what actually replaces the DOM adjacency the
     * portal removed. The menu is now last in the document, so Tab no longer
     * reaches it — and inside a list or table the editor consumes Tab entirely.
     * Moving focus in on open and back to the trigger on close is the WAI-ARIA
     * menu-button pattern, and it makes the menu's DOM position irrelevant.
     */
    if (options_?.focus === false) {
      return;
    }
    if (moreOpen && !wasOpen && !root.hidden) {
      menuItems()[0]?.focus();
    } else if (!moreOpen && wasOpen) {
      (button as HTMLElement | null)?.focus();
    }
  };

  const update = (): void => {
    root.hidden = !state.visible || state.editorMode !== "rich" || options.preferences.toolbarMode === "hidden";
    root.dataset.testid = "rich-command-toolbar";
    root.dataset.toolbarMode = options.preferences.toolbarMode ?? "sticky";
    root.dataset.toolbarStyle = options.preferences.toolbarStyle ?? "glass";
    root.dataset.layoutDensity = options.preferences.layoutDensity ?? "comfortable";
    root.setAttribute("aria-label", options.strings.toolbar.label);
    root.setAttribute("role", "toolbar");
    const more = toolbarMore(options, state, moreOpen);
    root.replaceChildren(
      ...toolbarCommands.filter((command) => toolbarCommandVisible(options.preferences, command.group)).map((command, index) => toolbarButton(options, state, command, index === 0)),
      aiToolbarButton(options),
      ...hostToolbarButtons(options, state),
      more.container
    );
    /*
     * Replace rather than append: a portalled node is not cleared by
     * `root.replaceChildren`, so re-rendering would otherwise leak a menu per
     * update. The delegated listeners move with it — the menu is outside `root`
     * now, so a click inside it never reaches the toolbar's own handler.
     */
    detachPortalledMenu();
    portalledMenu = more.menu;
    more.menu.addEventListener("click", onClick);
    more.menu.addEventListener("keydown", onKeyDown);
    const layer = overlayLayer(options.host);
    mirrorHostContext(options.host, layer);
    layer.append(more.menu);
    setMoreOpen(moreOpen, { focus: false });
  };

  const onClick = (event: Event): void => {
    const target = elementTarget(event);
    if (!target) {
      return;
    }
    const aiButton = target.closest<HTMLElement>("[data-reference-ai-toolbar]");
    if (aiButton) {
      options.onAiToolbar();
      return;
    }
    const moreButton = target.closest<HTMLElement>('[data-testid="toolbar-more-button"]');
    if (moreButton) {
      setMoreOpen(moreButton.getAttribute("aria-expanded") !== "true");
      return;
    }
    const extension = target.closest<HTMLElement>("[data-extension-toolbar-item]");
    if (extension?.dataset.extensionToolbarItem) {
      void options.onRunToolbarItem(extension.dataset.extensionToolbarItem);
      return;
    }
    const command = target.closest<HTMLElement>("[data-toolbar-command-id]");
    if (command?.dataset.toolbarCommandId) {
      void options.onRunToolbarItem(command.dataset.toolbarCommandId);
    }
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    /*
     * Keys inside the portalled menu are its own, not the toolbar's. The
     * toolbar's roving walk is horizontal over `visibleButtons(root)`, and the
     * menu is no longer inside `root` — so `findIndex` returned -1 and an
     * ArrowRight in the menu teleported focus into the toolbar behind a
     * screen-filling overlay. A menu is a vertical list; it gets vertical keys,
     * plus the Escape and Tab dismissal a menu button owes its user.
     */
    const inMenu = Boolean(portalledMenu && elementTarget(event) && portalledMenu.contains(elementTarget(event)!));
    if (inMenu || (moreOpen && event.key === "Escape")) {
      if (event.key === "Escape" || event.key === "Tab") {
        event.preventDefault();
        setMoreOpen(false);
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End") {
        const items = menuItems();
        if (items.length === 0) {
          return;
        }
        event.preventDefault();
        const active = options.host.ownerDocument.activeElement;
        const current = Math.max(0, items.findIndex((item) => item === active));
        const next =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? items.length - 1
              : event.key === "ArrowDown"
                ? (current + 1) % items.length
                : (current - 1 + items.length) % items.length;
        items[next]?.focus();
        return;
      }
    }
    if (event.key === "Enter" || event.key === " ") {
      const command = elementTarget(event)?.closest<HTMLButtonElement>("button[data-toolbar-command-id]");
      if (command?.dataset.toolbarCommandId && !command.disabled) {
        event.preventDefault();
        void options.onRunToolbarItem(command.dataset.toolbarCommandId);
      }
      return;
    }
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft" && event.key !== "Home" && event.key !== "End") {
      return;
    }
    const buttons = visibleButtons(root);
    if (buttons.length === 0) {
      return;
    }
    event.preventDefault();
    const active = options.host.ownerDocument.activeElement;
    const current = Math.max(0, buttons.findIndex((button) => button === active));
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? buttons.length - 1
          : event.key === "ArrowRight"
            ? (current + 1) % buttons.length
            : (current - 1 + buttons.length) % buttons.length;
    setRovingTabIndex(buttons, next);
    buttons[next]?.focus();
  };

  root.addEventListener("click", onClick);
  root.addEventListener("keydown", onKeyDown);
  /*
   * Outside-pointer dismissal. Without it the only way to close the menu on a
   * phone is to run a command, because the menu covers its own trigger.
   */
  const onDocumentPointerDown = (event: Event): void => {
    if (!moreOpen) {
      return;
    }
    const target = elementTarget(event);
    if (target && (portalledMenu?.contains(target) || root.contains(target))) {
      return;
    }
    setMoreOpen(false, { focus: false });
  };
  options.host.ownerDocument.addEventListener("pointerdown", onDocumentPointerDown, true);
  cleanups.push(() =>
    options.host.ownerDocument.removeEventListener("pointerdown", onDocumentPointerDown, true)
  );
  cleanups.push(options.session.on("destroy", () => destroy()));
  cleanups.push(() => root.removeEventListener("click", onClick));
  cleanups.push(() => root.removeEventListener("keydown", onKeyDown));
  update();

  const destroy = (): void => {
    for (const cleanup of cleanups.splice(0)) {
      cleanup();
    }
    // The portalled menu is outside `root`, so removing the root does not take
    // it with it.
    detachPortalledMenu();
    root.remove();
  };
  return {
    destroy,
    root,
    setState(nextState: SurfaceToolbarState) {
      state = nextState;
      update();
    },
    setMoreOpen,
    update
  };
}

export function createSlashMenu(options: CreateSlashMenuOptions): SurfaceComponent & {
  readonly root: HTMLElement;
  handleKeyDown(event: KeyboardEvent): boolean;
  setState(state: SurfaceSlashState): void;
} {
  const root = createElement(options.host, "div", "slash-command-menu");
  const query = createElement(options.host, "p", "slash-command-query");
  const items = createElement(options.host, "div", "slash-command-items");
  const cleanups: ListenerCleanup[] = [];
  let state = options.state;
  let selectedIndex = state.selectedIndex;
  root.dataset.testid = "slash-command-menu";
  query.dataset.testid = "slash-command-query";
  items.dataset.slashCommandItems = "";
  items.dataset.testid = "slash-command-items";
  root.append(query, items);
  options.host.replaceChildren(root);

  const visibleSlashItems = (): readonly SlashItemDefinition[] =>
    state.items.filter((item) => slashCommandVisible(options.preferences, item.group));

  const selectableItems = (): readonly (SlashItemDefinition | SurfaceAiAction)[] => [
    ...visibleSlashItems(),
    ...enabledAiItems(options, state, "slash")
  ];

  const runSelected = (): void => {
    const slashCount = visibleSlashItems().length;
    const selected = selectableItems()[selectedIndex];
    if (!selected) {
      return;
    }
    if (selectedIndex < slashCount) {
      void options.onRunSlashItem(selected.id);
    } else {
      void options.onRunAiAction(selected.id);
    }
  };

  const updateSelection = (index: number): void => {
    const count = selectableItems().length;
    selectedIndex = count === 0 ? 0 : (index + count) % count;
    options.onSelectionChange?.(selectedIndex);
    render();
  };

  const handleKeyDown = (event: KeyboardEvent): boolean => {
    if (!state.open || options.preferences.slashEnabled === false) {
      return false;
    }
    const count = selectableItems().length;
    if (event.key === "Escape") {
      event.preventDefault();
      options.onClose();
      return true;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (count > 0) {
        updateSelection(selectedIndex + 1);
      }
      return true;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (count > 0) {
        updateSelection(selectedIndex - 1);
      }
      return true;
    }
    if (event.key === "Home") {
      event.preventDefault();
      if (count > 0) {
        updateSelection(0);
      }
      return true;
    }
    if (event.key === "End") {
      event.preventDefault();
      if (count > 0) {
        updateSelection(count - 1);
      }
      return true;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      runSelected();
      return true;
    }
    return false;
  };

  const onClick = (event: Event): void => {
    const target = elementTarget(event);
    const slashButton = target?.closest<HTMLElement>("[data-slash-command]");
    if (slashButton?.dataset.slashCommand) {
      void options.onRunSlashItem(slashButton.dataset.slashCommand);
      return;
    }
    const aiButton = target?.closest<HTMLElement>("[data-reference-ai-action]");
    if (aiButton?.dataset.referenceAiAction) {
      void options.onRunAiAction(aiButton.dataset.referenceAiAction);
    }
  };

  const render = (): void => {
    const aiItems = enabledAiItems(options, state, "slash");
    const slashItems = visibleSlashItems();
    root.hidden = !state.open || options.preferences.slashEnabled === false;
    root.setAttribute("aria-label", options.strings.slash.label);
    root.setAttribute("role", "listbox");
    root.tabIndex = root.hidden ? -1 : 0;
    query.textContent = `/${state.query}`;
    const children: HTMLElement[] = [];
    let itemIndex = 0;
    for (const [group, groupItems] of groupedSlashItems(slashItems)) {
      children.push(sectionLabel(options, slashGroupLabel(options.strings, group), group));
      for (const item of groupItems) {
        children.push(slashButton(options, item, itemIndex, selectedIndex));
        itemIndex += 1;
      }
    }
    if (aiItems.length > 0) {
      children.push(sectionLabel(options, options.strings.slash.aiSection, "ai"));
    }
    aiItems.forEach((item, index) => {
      children.push(aiSlashButton(options, item, slashItems.length + index, selectedIndex));
    });
    if (children.length === 0) {
      children.push(slashEmptyState(options));
      root.removeAttribute("aria-activedescendant");
    } else {
      const active = children.find((child) => child.getAttribute("aria-selected") === "true");
      if (active?.id) {
        root.setAttribute("aria-activedescendant", active.id);
      } else {
        root.removeAttribute("aria-activedescendant");
      }
    }
    items.replaceChildren(...children);
  };

  root.addEventListener("keydown", handleKeyDown);
  root.addEventListener("click", onClick);
  cleanups.push(options.session.on("destroy", () => destroy()));
  cleanups.push(() => root.removeEventListener("keydown", handleKeyDown));
  cleanups.push(() => root.removeEventListener("click", onClick));
  render();

  const destroy = (): void => {
    for (const cleanup of cleanups.splice(0)) {
      cleanup();
    }
    root.replaceChildren();
    root.hidden = true;
  };
  return {
    destroy,
    handleKeyDown,
    root,
    setState(nextState: SurfaceSlashState) {
      state = nextState;
      selectedIndex = nextState.selectedIndex;
      render();
    },
    update: render
  };
}

export function createSelectionBubbleToolbar(options: CreateSelectionBubbleToolbarOptions): SurfaceComponent & {
  readonly root: HTMLElement;
  setState(state: SurfaceSelectionBubbleState): void;
} {
  const root = options.host.matches('[data-testid="selection-bubble-toolbar"]')
    ? options.host
    : createElement(options.host, "div", "selection-bubble-toolbar");
  const ownsRoot = root !== options.host;
  const cleanups: ListenerCleanup[] = [];
  let state = options.state;
  /**
   * The single tab stop's identity, held across renders.
   *
   * `render()` rebuilds every child, and the host re-renders on every editor
   * transaction. Recomputing the roving stop from scratch each time put it back
   * on the first mark button after any document change, so someone who had
   * arrowed to Link found Tab landing on Turn into. Keeping the id here is what
   * makes `role="toolbar"`'s single-tab-stop promise true over time.
   */
  let rovingTestId: string | null = null;
  if (ownsRoot) {
    options.host.replaceChildren(root);
  }

  const focusableControls = (): HTMLElement[] =>
    [...root.querySelectorAll<HTMLElement>("button, input")].filter(
      (node) => !(node as HTMLButtonElement).disabled && !node.hidden && !node.closest('[role="menu"]')
    );

  /**
   * Re-apply the single tab stop, and restore focus the render just destroyed.
   *
   * `replaceChildren` deletes the element the user is standing on. On the
   * pointer path that is invisible, because `onPointerDown` stops any bubble
   * control from taking focus at all. On the keyboard path it is fatal: press
   * Enter on Bold, and the mark applies once while focus falls to `<body>` — at
   * which point the host's own DOM observer sees an empty document selection and
   * the bubble hides itself. Every bubble action became single-shot, and the
   * persistent toolbar that used to be the fallback is off by default now.
   */
  const restoreFocusAndRoving = (previouslyFocused: string | null): void => {
    const controls = focusableControls();
    if (controls.length === 0) {
      return;
    }
    const rovingIndex = Math.max(
      0,
      controls.findIndex((node) => node.dataset.testid === rovingTestId)
    );
    setRovingTabIndex(controls, rovingIndex);
    rovingTestId = controls[rovingIndex]?.dataset.testid ?? null;
    if (!previouslyFocused) {
      return;
    }
    const replacement =
      root.querySelector<HTMLElement>(`[data-testid="${previouslyFocused}"]`) ?? controls[rovingIndex];
    replacement?.focus();
  };

  const render = (): void => {
    const activeElement = root.ownerDocument.activeElement as HTMLElement | null;
    const focusedTestId =
      activeElement && root.contains(activeElement) ? (activeElement.dataset.testid ?? null) : null;
    root.className = "selection-bubble-toolbar";
    root.dataset.testid = "selection-bubble-toolbar";
    root.dataset.layoutDensity = options.preferences.layoutDensity ?? "comfortable";
    root.hidden = !state.visible;
    root.setAttribute("aria-label", state.linkEditor?.open ? options.strings.toolbar.link : options.strings.toolbar.label);
    root.setAttribute("role", "toolbar");
    /*
     * MME-0089: the link popover REPLACES the button row rather than floating
     * beside it. Notion does the same, and it is the only shape with no second
     * anchoring problem: the bubble already sits within 8px of the selection, so
     * an in-place swap inherits that placement instead of re-deriving it. The
     * bubble carries `backdrop-filter`, which would make it the containing block
     * for a `position: fixed` child — the MME-0119 defect, avoided by not
     * needing a fixed child at all.
     */
    if (state.linkEditor?.open) {
      /*
       * The in-progress value survives the re-render. The host re-renders on
       * scroll, on resize, and on every editor transaction; rebuilding the field
       * from `state.linkEditor.href` — the destination already in the document —
       * discarded whatever the writer had typed. On a phone the on-screen
       * keyboard opening fires a `resize`, so the field was wiped at the exact
       * moment it existed to be typed into.
       */
      const inFlight = root.querySelector<HTMLInputElement>('[data-testid="selection-bubble-link-input"]');
      const draft = root.dataset.mode === "link" && inFlight ? inFlight.value : null;
      const caret = inFlight?.selectionStart ?? null;
      root.dataset.mode = "link";
      root.replaceChildren(selectionBubbleLinkEditor(options, state, draft));
      if (draft !== null && caret !== null) {
        const restored = root.querySelector<HTMLInputElement>('[data-testid="selection-bubble-link-input"]');
        restored?.setSelectionRange(caret, caret);
      }
      restoreFocusAndRoving(focusedTestId);
      return;
    }
    const wasMenuOpen = root.dataset.menuOpen === "true";
    root.dataset.mode = "commands";
    root.dataset.menuOpen = String(Boolean(state.turnIntoOpen));
    const markButtons = selectionBubbleCommands
      .filter((command) => toolbarCommandVisible(options.preferences, command.group))
      .map((command) => selectionBubbleButton(options, state, command));
    const children: HTMLElement[] = [];
    if (toolbarCommandVisible(options.preferences, "blocks")) {
      children.push(selectionBubbleTurnIntoButton(options, state), bubbleSeparator(options));
      if (state.turnIntoOpen) {
        children.push(selectionBubbleTurnIntoMenu(options, state));
      }
    }
    children.push(...markButtons);
    if (markButtons.length > 0) {
      children.push(bubbleSeparator(options));
    }
    if (toolbarCommandVisible(options.preferences, "insert")) {
      children.push(selectionBubbleLinkButton(options, state));
    }
    children.push(selectionBubbleAiButton(options, state));
    root.replaceChildren(...children);
    restoreFocusAndRoving(focusedTestId);
    /*
     * WAI-ARIA menu-button pattern: opening a menu moves focus into it, closing
     * it returns focus to the trigger. Without this the dropdown announced
     * itself as a menu and then left a screen-reader user with focus nowhere —
     * the role promising interaction the widget did not offer.
     */
    if (state.turnIntoOpen && !wasMenuOpen) {
      const items = menuItems();
      (items.find((item) => item.getAttribute("aria-checked") === "true") ?? items[0])?.focus();
    } else if (!state.turnIntoOpen && wasMenuOpen) {
      root.querySelector<HTMLElement>('[data-testid="selection-bubble-turn-into"]')?.focus();
    }
  };

  const menuItems = (): HTMLElement[] => [
    ...root.querySelectorAll<HTMLElement>('[role="menu"] [data-turn-into-command]:not([disabled])')
  ];

  const onClick = (event: Event): void => {
    const target = elementTarget(event);
    if (!target) {
      return;
    }
    const aiButton = target.closest<HTMLElement>("[data-reference-ai-selection]");
    if (aiButton) {
      void options.onAiSelection();
      return;
    }
    const turnIntoEntry = target.closest<HTMLElement>("[data-turn-into-command]");
    if (turnIntoEntry?.dataset.turnIntoCommand) {
      void options.onTurnInto(turnIntoEntry.dataset.turnIntoCommand);
      options.onTurnIntoToggle?.(false);
      return;
    }
    if (target.closest<HTMLElement>('[data-testid="selection-bubble-turn-into"]')) {
      options.onTurnIntoToggle?.(!state.turnIntoOpen);
      return;
    }
    if (target.closest<HTMLElement>('[data-testid="selection-bubble-link-remove"]')) {
      void options.onLinkRemove?.();
      options.onLinkToggle?.(false);
      return;
    }
    if (target.closest<HTMLElement>('[data-testid="selection-bubble-link-cancel"]')) {
      options.onLinkCancel?.();
      options.onLinkToggle?.(false);
      return;
    }
    if (target.closest<HTMLElement>('[data-testid="selection-bubble-link"]')) {
      options.onLinkToggle?.(!state.linkEditor?.open);
      return;
    }
    const command = target.closest<HTMLElement>("[data-toolbar-command-id]");
    if (command?.dataset.toolbarCommandId) {
      void options.onRunToolbarItem(command.dataset.toolbarCommandId);
    }
  };

  /**
   * MME-0089 — the bubble must never take focus from the editor.
   *
   * Found by this issue's browser gate, and invisible to `element.click()`: a
   * real `mousedown` inside the bubble blurs the editing surface, the browser
   * collapses the document selection, ProseMirror syncs that collapse into its
   * state, and the host re-renders — removing the very button the user is
   * pressing before `mouseup` arrives. The gesture then does nothing at all, and
   * the selection the writer made is gone.
   *
   * Cancelling the default on `mousedown` is what Notion and BlockNote do: focus
   * stays in the document, so every action still has a selection to act on. The
   * URL field is the one exception — it has to be focusable to be typed into.
   */
  const onPointerDown = (event: MouseEvent): void => {
    if (elementTarget(event)?.closest("input, textarea")) {
      return;
    }
    event.preventDefault();
  };

  const onSubmit = (event: Event): void => {
    const form = elementTarget(event)?.closest<HTMLFormElement>('[data-testid="selection-bubble-link-editor"]');
    if (!form) {
      return;
    }
    event.preventDefault();
    const input = form.querySelector<HTMLInputElement>('[data-testid="selection-bubble-link-input"]');
    void options.onLinkSubmit(input?.value ?? "");
    options.onLinkToggle?.(false);
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    /*
     * Escape inside a sub-panel closes that panel, not the bubble. Without this
     * the only way back from the link field is to dismiss the whole affordance,
     * which also drops the selection the user was about to link.
     */
    if (event.key === "Escape" && (state.linkEditor?.open || state.turnIntoOpen)) {
      event.preventDefault();
      event.stopPropagation();
      if (state.linkEditor?.open) {
        options.onLinkCancel?.();
        options.onLinkToggle?.(false);
      } else {
        options.onTurnIntoToggle?.(false);
      }
      return;
    }
    /*
     * A vertical menu is walked with Up/Down, not with the toolbar's Left/Right.
     * The menu's items are also excluded from the toolbar walk below: they are
     * DOM children of the bubble, so an unfiltered `visibleButtons(root)` sent
     * ArrowRight sideways through a vertical list and made `End` jump past the
     * open menu to the AI button.
     */
    if (state.turnIntoOpen && elementTarget(event)?.closest('[role="menu"]')) {
      const items = menuItems();
      if (items.length === 0) {
        return;
      }
      const active = root.ownerDocument.activeElement;
      const current = Math.max(0, items.indexOf(active as HTMLElement));
      let next: number | null = null;
      if (event.key === "ArrowDown") {
        next = (current + 1) % items.length;
      } else if (event.key === "ArrowUp") {
        next = (current - 1 + items.length) % items.length;
      } else if (event.key === "Home") {
        next = 0;
      } else if (event.key === "End") {
        next = items.length - 1;
      }
      if (next !== null) {
        event.preventDefault();
        items[next]?.focus();
      }
      return;
    }
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft" && event.key !== "Home" && event.key !== "End") {
      return;
    }
    // Inside the URL field the arrow keys belong to the caret, not to roving focus.
    if (elementTarget(event)?.closest("input, textarea")) {
      return;
    }
    const buttons = focusableControls();
    if (buttons.length === 0) {
      return;
    }
    event.preventDefault();
    const active = options.host.ownerDocument.activeElement;
    const current = Math.max(0, buttons.findIndex((button) => button === active));
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? buttons.length - 1
          : event.key === "ArrowRight"
            ? (current + 1) % buttons.length
            : (current - 1 + buttons.length) % buttons.length;
    setRovingTabIndex(buttons, next);
    rovingTestId = buttons[next]?.dataset.testid ?? rovingTestId;
    buttons[next]?.focus();
  };

  root.addEventListener("click", onClick);
  root.addEventListener("keydown", onKeyDown);
  root.addEventListener("mousedown", onPointerDown);
  root.addEventListener("submit", onSubmit);
  cleanups.push(options.session.on("destroy", () => destroy()));
  cleanups.push(() => root.removeEventListener("click", onClick));
  cleanups.push(() => root.removeEventListener("keydown", onKeyDown));
  cleanups.push(() => root.removeEventListener("mousedown", onPointerDown));
  cleanups.push(() => root.removeEventListener("submit", onSubmit));
  render();

  const destroy = (): void => {
    for (const cleanup of cleanups.splice(0)) {
      cleanup();
    }
    if (ownsRoot) {
      root.remove();
    } else {
      root.replaceChildren();
      root.hidden = true;
    }
  };

  return {
    destroy,
    root,
    setState(nextState: SurfaceSelectionBubbleState) {
      state = nextState;
      render();
    },
    update: render
  };
}

/* --- MME-0086: overlay dismissal + anchored block controls ------------------
 *
 * Benchmark editors share one rule: a transient overlay belongs to the moment
 * that produced it. Notion's selection bubble, BlockNote's side menu, and every
 * slash menu disappear the instant the pointer, the caret, or the mode moves on.
 * MME had four overlays, each with its own ad-hoc closing rules, so a bubble
 * could outlive the click that dismissed the editor.
 *
 * The lifecycle is a package contract rather than host wiring so that a consumer
 * composing these surfaces gets the behaviour instead of re-deriving it.
 */

/** Why an overlay is being asked to close. */
export type SurfaceOverlayDismissReason = "blur" | "escape" | "mode-change" | "outside-pointer";

export interface SurfaceOverlayRegistration {
  /**
   * Whether closing this overlay uses up the Escape press. Defaults to true,
   * which is right for anything the user opened deliberately: a menu, a palette,
   * a bubble. Set false for a *derived* affordance — one the editor shows on its
   * own, from the caret or the pointer. Those still close on Escape, but they
   * must not swallow the key, or the editing surface behind them can never see
   * an Escape at all while they happen to be on screen (MME-0103).
   */
  readonly consumesEscape?: boolean;
  /** Dismiss reasons this overlay responds to. Defaults to all of them. */
  readonly dismissOn?: readonly SurfaceOverlayDismissReason[];
  readonly id: string;
  close(reason: SurfaceOverlayDismissReason): void;
  /** True when the node lives inside this overlay, so it is not "outside". */
  contains(node: Node | null): boolean;
  isOpen(): boolean;
  /**
   * Called after `close` when keyboard focus was inside this overlay. Without it
   * the browser resets focus to `<body>` — no indicator, no document position —
   * which is what pressing Escape inside an overlay would otherwise do.
   */
  returnFocus?(): void;
}

export interface CreateSurfaceOverlayDismissControllerOptions {
  /** Where keyboard focus currently is, used to decide whether to restore it. */
  readonly activeElement?: () => Node | null;
  /**
   * Editing surfaces that count as "still inside the editor" for blur purposes.
   * Focus moving between the editor and an overlay is not a blur.
   */
  readonly editorRoots?: () => readonly (Element | null | undefined)[];
}

export interface SurfaceOverlayDismissController {
  /**
   * True when at least one of these overlays owns the Escape press, so the key
   * must not also reach the editing surface. See `consumesEscape`.
   */
  consumesEscape(overlayIds: readonly string[]): boolean;
  destroy(): void;
  dismiss(reason: SurfaceOverlayDismissReason): readonly string[];
  handleFocusChange(nextFocus: Node | null): readonly string[];
  handlePointerDown(target: Node | null): readonly string[];
  openOverlayIds(): readonly string[];
  register(registration: SurfaceOverlayRegistration): () => void;
}

export interface AttachSurfaceOverlayDismissListenersOptions {
  readonly controller: SurfaceOverlayDismissController;
  /** The document (or subtree root) the overlays live in. */
  readonly scope: Document | HTMLElement;
}

/**
 * `instanceof Node` cannot be used here: this package is DOM-facing but runs in
 * environments (SSR, Node-hosted tests) where no global `Node` constructor exists,
 * and a thrown ReferenceError inside a listener would silently strand the overlay
 * open. Duck-typing on `nodeType` is the portable check.
 */
function eventTargetNode(value: EventTarget | null): Node | null {
  return value && typeof (value as Node).nodeType === "number" ? (value as Node) : null;
}

const allOverlayDismissReasons: readonly SurfaceOverlayDismissReason[] = [
  "blur",
  "escape",
  "mode-change",
  "outside-pointer"
];

export function createSurfaceOverlayDismissController(
  options: CreateSurfaceOverlayDismissControllerOptions = {}
): SurfaceOverlayDismissController {
  const registrations = new Map<string, SurfaceOverlayRegistration>();

  const respondsTo = (registration: SurfaceOverlayRegistration, reason: SurfaceOverlayDismissReason): boolean =>
    (registration.dismissOn ?? allOverlayDismissReasons).includes(reason);

  const closeMatching = (
    reason: SurfaceOverlayDismissReason,
    keepOpen: (registration: SurfaceOverlayRegistration) => boolean
  ): readonly string[] => {
    const closed: string[] = [];
    for (const registration of [...registrations.values()]) {
      if (!registration.isOpen() || !respondsTo(registration, reason) || keepOpen(registration)) {
        continue;
      }
      // Read focus before closing: hiding the overlay is what moves focus to <body>.
      const heldFocus = registration.contains(options.activeElement?.() ?? null);
      registration.close(reason);
      if (heldFocus) {
        registration.returnFocus?.();
      }
      closed.push(registration.id);
    }
    return closed;
  };

  const insideEditor = (node: Node | null): boolean => {
    if (!node) {
      return false;
    }
    for (const root of options.editorRoots?.() ?? []) {
      if (root?.contains(node)) {
        return true;
      }
    }
    return false;
  };

  return {
    consumesEscape(overlayIds) {
      return overlayIds.some((id) => registrations.get(id)?.consumesEscape !== false);
    },
    destroy() {
      registrations.clear();
    },
    dismiss(reason) {
      return closeMatching(reason, () => false);
    },
    handleFocusChange(nextFocus) {
      if (insideEditor(nextFocus)) {
        return [];
      }
      // Reaching into an overlay (a bubble button, the language field) keeps every
      // overlay alive; only focus landing outside all of them is a real blur.
      const focusInsideAnOverlay = [...registrations.values()].some(
        (registration) => registration.isOpen() && registration.contains(nextFocus)
      );
      if (focusInsideAnOverlay) {
        return [];
      }
      return closeMatching("blur", () => false);
    },
    handlePointerDown(target) {
      return closeMatching("outside-pointer", (registration) => registration.contains(target));
    },
    openOverlayIds() {
      return [...registrations.values()].filter((registration) => registration.isOpen()).map((registration) => registration.id);
    },
    register(registration) {
      registrations.set(registration.id, registration);
      return () => {
        registrations.delete(registration.id);
      };
    }
  };
}

export function attachSurfaceOverlayDismissListeners(
  options: AttachSurfaceOverlayDismissListenersOptions
): () => void {
  const onPointerDown = (event: Event): void => {
    options.controller.handlePointerDown(eventTargetNode(event.target));
  };
  const onKeyDown = (event: Event): void => {
    if ((event as KeyboardEvent).key !== "Escape") {
      return;
    }
    const closed = options.controller.dismiss("escape");
    if (options.controller.consumesEscape(closed)) {
      /*
       * One Escape, one meaning (MME-0103).
       *
       * This listener is bound with `capture: true` on the document, so it runs
       * before the editing surface sees the key. Without marking the event as
       * handled, a single press both dismissed the slash menu and entered the
       * editor's block-selection state. `defaultPrevented` is the portable "this
       * event was consumed" signal; Escape has no default action to suppress, so
       * marking it costs nothing when nothing was open — and nothing is marked
       * when nothing was open, so an Escape that closes no overlay still reaches
       * the editor.
       */
      event.preventDefault();
    }
  };
  const onFocusIn = (event: Event): void => {
    options.controller.handleFocusChange(eventTargetNode(event.target));
  };
  const onFocusOut = (event: Event): void => {
    // A null relatedTarget means focus left for nothing at all — still a blur.
    options.controller.handleFocusChange(eventTargetNode((event as FocusEvent).relatedTarget));
  };

  // Capture, so an overlay that stops propagation cannot strand its siblings open.
  options.scope.addEventListener("pointerdown", onPointerDown, true);
  options.scope.addEventListener("keydown", onKeyDown, true);
  options.scope.addEventListener("focusin", onFocusIn, true);
  options.scope.addEventListener("focusout", onFocusOut, true);

  return () => {
    options.scope.removeEventListener("pointerdown", onPointerDown, true);
    options.scope.removeEventListener("keydown", onKeyDown, true);
    options.scope.removeEventListener("focusin", onFocusIn, true);
    options.scope.removeEventListener("focusout", onFocusOut, true);
  };
}

/** A DOM-free rectangle, so placement math stays testable without a browser. */
export interface SurfaceRect {
  readonly height: number;
  readonly left: number;
  readonly top: number;
  readonly width: number;
}

/**
 * The overlay floats in the gap next to its anchor, never over it.
 *
 * Placing it *over* the anchor would put it on top of that block's own text —
 * and, when the anchor is the block the caret is in, on top of the caret. Since
 * MME-0086 removed the surface-level focus ring, the caret is the editing
 * surface's only focus indicator, so covering it is a WCAG 2.4.7 failure. Both
 * `above` and `below` leave the anchor's own content, and therefore the caret,
 * fully visible.
 */
export type AnchoredOverlayPlacementKind = "above" | "below";

export interface AnchoredOverlayPlacementOptions {
  /**
   * How the overlay lines up with the anchor horizontally. `start` and `end`
   * line an edge up with the matching anchor edge; `center` (MME-0089) puts the
   * overlay's midpoint over the anchor's, which is what Notion's and BlockNote's
   * selection bubbles do and what "centered above the selection" means
   * numerically.
   */
  readonly align?: "center" | "end" | "start";
  /** The element the overlay belongs to, in the same coordinate space as `container`. */
  readonly anchor: SurfaceRect;
  /**
   * The region the overlay must stay inside, in the same coordinate space as
   * `container`. Defaults to `container`, but the two differ whenever the
   * positioned ancestor is larger than the scrolling viewport — clamping to the
   * ancestor would then park the overlay over surrounding chrome.
   */
  readonly bounds?: SurfaceRect;
  /** The positioning context the returned offsets are relative to. */
  readonly container: SurfaceRect;
  /** Distance kept between the overlay and its anchor. */
  readonly gap?: number;
  /** Smallest distance kept between the overlay and the bounds edges. */
  readonly margin?: number;
  readonly overlay: { readonly height: number; readonly width: number };
  readonly preferred?: AnchoredOverlayPlacementKind;
}

export interface AnchoredOverlayPlacement {
  /**
   * False when neither side of the anchor has room inside the bounds — a block
   * taller than the scrolling viewport, for instance. The returned offsets are
   * then a best effort that WILL overlap the anchor, so a caller that must not
   * cover its anchor's content should hide the overlay instead of using them.
   */
  readonly fits: boolean;
  readonly left: number;
  readonly placement: AnchoredOverlayPlacementKind;
  readonly top: number;
}

/**
 * Places an overlay against its own anchor rather than a fixed corner of the
 * editor. Returns container-relative offsets, which is what the CSS custom
 * properties consume.
 */
export function anchoredOverlayPlacement(options: AnchoredOverlayPlacementOptions): AnchoredOverlayPlacement {
  const gap = options.gap ?? 8;
  const margin = options.margin ?? 12;
  const bounds = options.bounds ?? options.container;
  const anchorTop = options.anchor.top - options.container.top;
  const anchorLeft = options.anchor.left - options.container.left;
  const boundsTop = bounds.top - options.container.top;
  const boundsLeft = bounds.left - options.container.left;

  const anchorBottom = anchorTop + options.anchor.height;
  const boundsBottom = boundsTop + bounds.height;

  // Staying clear of the anchor is a hard constraint, not a preference: clamping
  // a "below" overlay to the bounds would park it *inside* a block taller than
  // the viewport, back over that block's text and the caret in it.
  const aboveTop = anchorTop - options.overlay.height - gap;
  const belowTop = anchorBottom + gap;
  // "Fits" means fully inside the bounds AND clear of the anchor. Requiring both
  // ends matters when the anchor is scrolled partly out of view: the gap beside
  // it can be off-screen, and an off-screen overlay is not a placement.
  const fitsWithin = (top: number): boolean =>
    top >= boundsTop + margin && top + options.overlay.height <= boundsBottom - margin;
  const fitsAbove = fitsWithin(aboveTop);
  const fitsBelow = fitsWithin(belowTop);

  const preferred = options.preferred ?? "above";
  const placement: AnchoredOverlayPlacementKind =
    preferred === "above" ? (fitsAbove || !fitsBelow ? "above" : "below") : fitsBelow || !fitsAbove ? "below" : "above";
  const fits = placement === "above" ? fitsAbove : fitsBelow;

  const clamp = (value: number, min: number, max: number): number =>
    Math.max(min, Math.min(value, Math.max(min, max)));

  // When the chosen side fits, clamp within that side's free band so the result
  // can never cross into the anchor. When neither side fits there is nothing
  // honest to return — clamp to the bounds and report `fits: false`.
  const top = fits
    ? placement === "above"
      ? clamp(aboveTop, boundsTop + margin, anchorTop - options.overlay.height - gap)
      : clamp(belowTop, anchorBottom + gap, boundsBottom - options.overlay.height - margin)
    : clamp(
        placement === "above" ? aboveTop : belowTop,
        boundsTop + margin,
        boundsBottom - options.overlay.height - margin
      );

  const unclampedLeft =
    options.align === "end"
      ? anchorLeft + options.anchor.width - options.overlay.width
      : options.align === "center"
        ? anchorLeft + (options.anchor.width - options.overlay.width) / 2
        : anchorLeft;

  return {
    fits,
    left: clamp(
      unclampedLeft,
      boundsLeft + margin,
      boundsLeft + bounds.width - options.overlay.width - margin
    ),
    placement,
    top
  };
}

export interface SurfaceRichBlockControlsState {
  /** The selected block's rectangle. `null` hides the surface. */
  readonly anchor: SurfaceRect | null;
  /** The scrolling viewport the surface must stay inside. Defaults to `container`. */
  readonly bounds?: SurfaceRect | null;
  readonly canInsertAfter: boolean;
  /** The positioning context the surface is absolutely placed inside. */
  readonly container: SurfaceRect | null;
  /** Fence info string language, or `null` when the block carries no fence info. */
  readonly language: string | null;
  readonly meta: string | null;
  readonly visible: boolean;
}

export interface CreateRichBlockControlsOptions {
  readonly host: HTMLElement;
  readonly preferences: SurfacePreferences;
  readonly session: MarkdownEditorSession;
  readonly state: SurfaceRichBlockControlsState;
  readonly strings: MmeStrings;
  onChangeLanguage(value: string): void;
  onChangeMeta(value: string): void;
  onInsertAfter(): void;
}

/**
 * The code fence's language/meta editor and the "insert a paragraph after this
 * block" affordance, anchored to the block they act on.
 *
 * Before MME-0086 these lived in a bar pinned to the top of the content area,
 * visually unrelated to the code block being edited. Notion and BlockNote put
 * block controls at the block; so does this.
 */
export function createRichBlockControls(options: CreateRichBlockControlsOptions): SurfaceComponent & {
  readonly root: HTMLElement;
  setState(state: SurfaceRichBlockControlsState): void;
} {
  const root = createElement(options.host, "div", "rich-block-controls");
  root.dataset.testid = "rich-block-controls";
  // A bare div maps to role="generic", which ARIA prohibits authors from naming —
  // `aria-label` on it is ignored by assistive technology. `group` is the honest
  // role: a labelled set of related controls. Deliberately not `toolbar`, which
  // would promise roving-tabindex arrow navigation this surface does not implement.
  root.setAttribute("role", "group");
  root.setAttribute("aria-label", options.strings.blockControls.label);

  const codeGroup = createElement(root, "div", "code-block-controls");
  codeGroup.dataset.testid = "code-block-controls";

  const languageLabel = createElement(codeGroup, "label");
  const languageText = createElement(languageLabel, "span");
  languageText.textContent = options.strings.blockControls.language;
  const languageInput = createElement(languageLabel, "input");
  languageInput.type = "text";
  languageInput.dataset.testid = "code-language-input";
  languageInput.autocomplete = "off";
  languageInput.spellcheck = false;
  languageLabel.append(languageText, languageInput);

  const metaLabel = createElement(codeGroup, "label");
  const metaText = createElement(metaLabel, "span");
  metaText.textContent = options.strings.blockControls.meta;
  const metaInput = createElement(metaLabel, "input");
  metaInput.type = "text";
  metaInput.dataset.testid = "code-meta-input";
  metaInput.autocomplete = "off";
  metaInput.spellcheck = false;
  metaLabel.append(metaText, metaInput);

  codeGroup.append(languageLabel, metaLabel);

  const insertAfterButton = createElement(root, "button", "toolbar-button insert-after-block-button");
  insertAfterButton.type = "button";
  insertAfterButton.dataset.testid = "insert-after-block-button";
  insertAfterButton.textContent = options.strings.blockControls.insertAfter;

  root.append(codeGroup, insertAfterButton);
  options.host.replaceChildren(root);

  let state = options.state;
  const cleanups: ListenerCleanup[] = [];

  const render = (): void => {
    const hasCodeInfo = state.language !== null || state.meta !== null;
    root.hidden = !state.visible || !state.anchor || (!hasCodeInfo && !state.canInsertAfter);
    codeGroup.hidden = !hasCodeInfo;
    insertAfterButton.hidden = !state.canInsertAfter;
    root.dataset.layoutDensity = options.preferences.layoutDensity ?? "comfortable";

    if (root.hidden) {
      root.style.removeProperty("--mme-block-controls-left");
      root.style.removeProperty("--mme-block-controls-top");
      root.removeAttribute("data-placement");
      return;
    }

    // The host owns the values while they are being typed into.
    const active = options.host.ownerDocument.activeElement;
    if (active !== languageInput) {
      languageInput.value = state.language ?? "";
    }
    if (active !== metaInput) {
      metaInput.value = state.meta ?? "";
    }

    if (!state.anchor || !state.container) {
      return;
    }
    // Below and right-aligned: the controls read as belonging to the block above
    // them, and the block they act on — including the caret inside it — stays
    // fully visible. `anchoredOverlayPlacement` flips to `above` when the block
    // sits at the bottom of the viewport.
    const placement = anchoredOverlayPlacement({
      align: "end",
      anchor: state.anchor,
      bounds: state.bounds ?? state.container,
      container: state.container,
      overlay: {
        height: root.offsetHeight || 36,
        width: root.offsetWidth || 260
      },
      preferred: "below"
    });
    // Neither side of the block has room — showing the controls would mean
    // covering the block's own content and the caret in it.
    if (!placement.fits) {
      root.hidden = true;
      root.style.removeProperty("--mme-block-controls-left");
      root.style.removeProperty("--mme-block-controls-top");
      root.removeAttribute("data-placement");
      return;
    }
    root.style.setProperty("--mme-block-controls-left", `${Math.round(placement.left)}px`);
    root.style.setProperty("--mme-block-controls-top", `${Math.round(placement.top)}px`);
    root.dataset.placement = placement.placement;
  };

  const onLanguageInput = (): void => options.onChangeLanguage(languageInput.value);
  const onMetaInput = (): void => options.onChangeMeta(metaInput.value);
  const onInsertAfterClick = (): void => options.onInsertAfter();

  languageInput.addEventListener("input", onLanguageInput);
  metaInput.addEventListener("input", onMetaInput);
  insertAfterButton.addEventListener("click", onInsertAfterClick);
  cleanups.push(() => languageInput.removeEventListener("input", onLanguageInput));
  cleanups.push(() => metaInput.removeEventListener("input", onMetaInput));
  cleanups.push(() => insertAfterButton.removeEventListener("click", onInsertAfterClick));
  cleanups.push(options.session.on("destroy", () => destroy()));

  render();

  const destroy = (): void => {
    for (const cleanup of cleanups.splice(0)) {
      cleanup();
    }
    root.remove();
  };

  return {
    destroy,
    root,
    setState(nextState: SurfaceRichBlockControlsState) {
      state = nextState;
      render();
    },
    update: render
  };
}

export function createCommandPalette(options: CreateCommandPaletteOptions): SurfaceComponent & {
  close(): void;
  open(): boolean;
  readonly root: HTMLElement;
} {
  const root = createElement(options.host, "div", "command-palette");
  const panel = createElement(options.host, "div", "command-palette-panel");
  const label = createElement(options.host, "label");
  const input = createElement(options.host, "input");
  const items = createElement(options.host, "div", "command-palette-items");
  const cleanups: ListenerCleanup[] = [];
  let selectedIndex = 0;
  root.dataset.testid = "command-palette";
  root.hidden = true;
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", options.strings.commandPalette.label);
  input.dataset.testid = "command-palette-input";
  input.autocomplete = "off";
  input.placeholder = options.strings.commandPalette.inputPlaceholder;
  items.dataset.testid = "command-palette-items";
  items.setAttribute("role", "listbox");
  label.append(options.strings.commandPalette.inputLabel, input);
  panel.append(label, items);
  root.append(panel);
  options.host.replaceChildren(root);

  const actions = (): readonly SurfaceAiAction[] => {
    if (!entryPointEnabled(options.preferences, "command-palette")) {
      return [];
    }
    const query = input.value.trim().toLowerCase();
    return options.actions.filter((action) => {
      if (!action.entryPoints.includes("command-palette")) {
        return false;
      }
      if (!query) {
        return true;
      }
      return `${action.id} ${action.label} ${action.prompt}`.toLowerCase().includes(query);
    });
  };

  const renderItems = (): void => {
    const filtered = actions();
    selectedIndex = Math.min(selectedIndex, Math.max(0, filtered.length - 1));
    const buttons = filtered.map((action, index) => paletteButton(options, action, index, selectedIndex));
    items.replaceChildren(...buttons);
    const selected = buttons[selectedIndex];
    if (selected?.id) {
      items.setAttribute("aria-activedescendant", selected.id);
    } else {
      items.removeAttribute("aria-activedescendant");
    }
  };

  const close = (): void => {
    root.hidden = true;
    options.returnFocusTo?.focus();
  };

  const open = (): boolean => {
    if (!entryPointEnabled(options.preferences, "command-palette")) {
      root.hidden = true;
      return false;
    }
    root.hidden = false;
    input.value = "";
    selectedIndex = 0;
    renderItems();
    input.focus();
    return true;
  };

  const runSelected = (): void => {
    const action = actions()[selectedIndex];
    if (!action) {
      return;
    }
    close();
    void options.onRunAiAction(action.id);
  };

  const onInput = (): void => {
    selectedIndex = 0;
    renderItems();
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (root.hidden) {
      return;
    }
    const filtered = actions();
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (filtered.length > 0) {
        selectedIndex = (selectedIndex + 1) % filtered.length;
        renderItems();
      }
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (filtered.length > 0) {
        selectedIndex = (selectedIndex - 1 + filtered.length) % filtered.length;
        renderItems();
      }
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      runSelected();
      return;
    }
    if (event.key === "Tab") {
      trapFocus(root, event);
    }
  };

  const onClick = (event: Event): void => {
    const target = elementTarget(event);
    if (target === root) {
      close();
      return;
    }
    const action = target?.closest<HTMLElement>("[data-reference-ai-action]");
    if (action?.dataset.referenceAiAction) {
      close();
      void options.onRunAiAction(action.dataset.referenceAiAction);
    }
  };

  input.addEventListener("input", onInput);
  root.addEventListener("click", onClick);
  root.addEventListener("keydown", onKeyDown);
  cleanups.push(options.session.on("destroy", () => destroy()));
  cleanups.push(() => input.removeEventListener("input", onInput));
  cleanups.push(() => root.removeEventListener("click", onClick));
  cleanups.push(() => root.removeEventListener("keydown", onKeyDown));
  renderItems();

  const destroy = (): void => {
    for (const cleanup of cleanups.splice(0)) {
      cleanup();
    }
    root.remove();
  };
  return {
    close,
    destroy,
    open,
    root,
    update: renderItems
  };
}

export function createFindReplaceSurface(options: CreateFindReplaceSurfaceOptions): SurfaceComponent & {
  close(): void;
  open(): void;
  readonly root: HTMLElement;
  setState(state: SurfaceFindReplaceState): void;
} {
  const root = createElement(options.host, "div", "find-replace-surface");
  const cleanups: ListenerCleanup[] = [];
  let state = options.state;
  let queryValue = state.query;
  let replacementValue = state.replacement;
  options.host.replaceChildren(root);

  const close = (): void => {
    state = {
      ...state,
      open: false
    };
    render();
    options.onClose?.();
  };

  const open = (): void => {
    state = {
      ...state,
      open: true
    };
    render();
    root.querySelector<HTMLInputElement>('[data-testid="find-query-input"]')?.focus();
  };

  const render = (): void => {
    root.dataset.testid = "find-replace-surface";
    root.hidden = !state.open;
    root.setAttribute("aria-label", options.strings.find.label);
    root.setAttribute("role", "search");
    queryValue = state.query;
    replacementValue = state.replacement;
    const queryLabel = createElement(options.host, "label", "find-replace-field");
    const query = createElement(options.host, "input", "find-query-input");
    const replacementLabel = createElement(options.host, "label", "find-replace-field");
    const replacement = createElement(options.host, "input", "find-replace-input");
    const count = createElement(options.host, "span", "find-match-count");
    const previous = findIconButton(options, "chevron", options.strings.find.previous, "find-previous-button");
    const next = findIconButton(options, "chevron", options.strings.find.next, "find-next-button");
    const replace = findIconButton(options, "check", options.strings.find.replace, "find-replace-button");
    const replaceAll = findIconButton(options, "more", options.strings.find.replaceAll, "find-replace-all-button");
    const closeButton = findIconButton(options, "close", options.strings.find.close, "find-close-button");

    query.dataset.testid = "find-query-input";
    query.type = "search";
    query.autocomplete = "off";
    query.spellcheck = false;
    query.value = queryValue;
    query.placeholder = options.strings.find.queryPlaceholder;
    query.setAttribute("aria-label", options.strings.find.queryLabel);
    replacement.dataset.testid = "find-replacement-input";
    replacement.type = "text";
    replacement.autocomplete = "off";
    replacement.spellcheck = false;
    replacement.value = replacementValue;
    replacement.placeholder = options.strings.find.replacementPlaceholder;
    replacement.setAttribute("aria-label", options.strings.find.replacementLabel);
    count.dataset.testid = "find-match-count";
    count.setAttribute("aria-label", options.strings.find.matchCount);
    count.textContent = findMatchCountLabel(state, options.strings);

    previous.disabled = state.matches.length === 0;
    next.disabled = state.matches.length === 0;
    replace.disabled = state.matches.length === 0;
    replaceAll.disabled = state.matches.length === 0;

    query.addEventListener("input", () => {
      queryValue = query.value;
      options.onFind(queryValue);
    });
    replacement.addEventListener("input", () => {
      replacementValue = replacement.value;
    });
    previous.addEventListener("click", () => options.onFindPrevious());
    next.addEventListener("click", () => options.onFindNext());
    replace.addEventListener("click", () => options.onReplace(replacementValue));
    replaceAll.addEventListener("click", () => options.onReplaceAll(replacementValue));
    closeButton.addEventListener("click", () => close());

    queryLabel.append(options.strings.find.queryLabel, query);
    replacementLabel.append(options.strings.find.replacementLabel, replacement);
    root.replaceChildren(queryLabel, previous, next, count, replacementLabel, replace, replaceAll, closeButton);
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  };

  cleanups.push(options.session.on("destroy", () => destroy()));
  root.addEventListener("keydown", onKeyDown);
  render();

  const destroy = (): void => {
    for (const cleanup of cleanups.splice(0)) {
      cleanup();
    }
    root.removeEventListener("keydown", onKeyDown);
    root.remove();
  };
  return {
    close,
    destroy,
    open,
    root,
    setState(nextState: SurfaceFindReplaceState) {
      state = nextState;
      render();
    },
    update: render
  };
}

export function createDocumentStatus(options: CreateDocumentStatusOptions): SurfaceComponent & {
  readonly root: HTMLElement;
  setState(state: Pick<CreateDocumentStatusOptions, "document" | "saveState">): void;
} {
  const root = createElement(options.host, "div", "document-status-surface");
  const cleanups: ListenerCleanup[] = [];
  let documentState = options.document;
  let saveState = options.saveState;
  options.host.replaceChildren(root);

  const render = (): void => {
    const details = createElement(options.host, "details", "document-status-popover");
    const summary = createElement(options.host, "summary", "editor-status-button");
    const menu = createElement(options.host, "div", "document-status-menu");
    const primary = createElement(options.host, "button", "button primary");
    details.dataset.testid = "document-status-popover";
    summary.dataset.testid = "editor-status-button";
    summary.setAttribute("aria-expanded", String(details.open));
    primary.dataset.testid = "memory-save-button";
    primary.type = "button";
    primary.textContent = primaryActionLabel(saveState, documentState, options.strings);
    primary.disabled = saveState.target === "unsupported";
    const name = createElement(options.host, "span");
    const dirty = createElement(options.host, "span");
    name.dataset.testid = "document-name";
    dirty.dataset.testid = "dirty-state";
    name.textContent = documentState.fileName;
    dirty.textContent = dirtyStateLabel(saveState, options.strings);
    summary.append(name, dirty);
    menu.append(
      statusLine(options, options.strings.status.path, "document-path", documentState.pathLabel),
      statusLine(options, statusString(options.strings, "adapter"), "document-adapter", documentAdapterLabel(saveState, documentState)),
      statusLine(options, statusString(options.strings, "writable"), "document-writable", documentWritableLabel(saveState, documentState)),
      statusLine(options, options.strings.status.target, "persistence-target", documentTargetLabel(saveState, documentState, options.strings)),
      statusLine(options, options.strings.status.save, "save-state", saveState.status),
      statusLine(options, statusString(options.strings, "lastSaved"), "document-last-saved", lastSavedLabel(saveState)),
      statusLine(options, statusString(options.strings, "details"), "save-details", saveDetailsLabel(saveState))
    );
    if (saveState.status === "conflict" && options.onResolveConflict) {
      menu.append(conflictResolution(options));
    }
    details.append(summary, menu);
    root.replaceChildren(details, primary);
    details.addEventListener("toggle", () => {
      summary.setAttribute("aria-expanded", String(details.open));
    });
    primary.addEventListener("click", () => {
      void options.onPrimaryAction();
    });
  };

  cleanups.push(options.session.on("save-state", (nextSaveState) => {
    saveState = nextSaveState;
    render();
  }));
  cleanups.push(options.session.on("destroy", () => destroy()));
  render();

  const destroy = (): void => {
    for (const cleanup of cleanups.splice(0)) {
      cleanup();
    }
    root.remove();
  };
  return {
    destroy,
    root,
    setState(nextState: Pick<CreateDocumentStatusOptions, "document" | "saveState">) {
      documentState = nextState.document;
      saveState = nextState.saveState;
      render();
    },
    update: render
  };
}

/* ---------------------------------------------------------------------------
 * MME-0090 — the frontmatter Properties panel.
 *
 * The panel is presentational on purpose. It never parses or writes YAML: it
 * renders rows the host derived from `@momentarise/md-format` and reports
 * intents back ("property 3 should become 2026-09-01"). The host owns the
 * document, applies the positional splice, and hands back a new state. That is
 * what keeps the byte-preservation guarantee in one place instead of being
 * re-implemented per surface.
 * ------------------------------------------------------------------------- */

export type SurfacePropertiesDisplay = "hidden" | "source" | "visible";

export interface SurfacePropertyRow {
  readonly editable: boolean;
  readonly index: number;
  readonly key: string;
  readonly rawValue: string;
  readonly reason: FrontmatterReadOnlyReason | null;
  readonly type: FrontmatterPropertyType;
  readonly value: FrontmatterPropertyValue;
}

/**
 * A refusal the host wants shown ON the row that caused it. Refusals routed to a
 * page-level notice are invisible in a scrolled panel — measured at 390, where
 * the rows sit a thousand pixels below the notice strip.
 */
export interface SurfacePropertyRefusal {
  readonly index: number;
  readonly message: string;
}

export interface SurfacePropertiesState {
  readonly display: SurfacePropertiesDisplay;
  readonly present: boolean;
  readonly properties: readonly SurfacePropertyRow[];
  readonly refusal?: SurfacePropertyRefusal | null;
  readonly source: string;
}

export interface CreatePropertiesPanelOptions extends SurfaceComponentContext {
  onAddProperty(): void;
  onChangeDisplay(display: SurfacePropertiesDisplay): void;
  onChangeType(event: { readonly index: number; readonly propertyType: FrontmatterPropertyType }): void;
  onChangeValue(event: { readonly index: number; readonly value: FrontmatterPropertyValue }): void;
  onEditInSource(event: { readonly index: number }): void;
  onRemoveProperty(event: { readonly index: number }): void;
  onRenameProperty(event: { readonly index: number; readonly key: string }): void;
  readonly state: SurfacePropertiesState;
}

/**
 * The six benchmark types, in the order Obsidian's own type menu lists them.
 * One definition, consumed by the menu and by the icon lookup.
 */
export const SURFACE_PROPERTY_TYPES: readonly FrontmatterPropertyType[] = [
  "text",
  "list",
  "number",
  "checkbox",
  "date",
  "datetime"
];

const PROPERTY_TYPE_ICONS: Readonly<Record<FrontmatterPropertyType, IconName>> = {
  checkbox: "propertyCheckbox",
  date: "propertyDate",
  datetime: "propertyDatetime",
  list: "list",
  number: "propertyNumber",
  text: "propertyText"
};

const PROPERTY_TYPE_INPUTS: Readonly<Record<Exclude<FrontmatterPropertyType, "list">, string>> = {
  checkbox: "checkbox",
  date: "date",
  datetime: "datetime-local",
  number: "number",
  text: "text"
};

/**
 * Maps the md-format model into rows. `blockRange.from` is always 0, so the raw
 * value can be sliced straight out of `model.raw` — the panel shows the bytes
 * the writer authored, which is the whole point for read-only values.
 */
export function surfacePropertyRowsFromFrontmatter(
  model: FrontmatterBlockModel | null
): readonly SurfacePropertyRow[] {
  if (!model) {
    return [];
  }
  return model.entries.map((entry) => ({
    editable: entry.editable,
    index: entry.index,
    key: entry.key,
    rawValue: model.raw.slice(entry.valueRange.from, entry.valueRange.to).replace(/^ /, ""),
    reason: entry.reason,
    type: entry.type,
    value: entry.value
  }));
}

interface PropertyFocusDescriptor {
  readonly index: number;
  readonly selectionStart: number | null;
  readonly testId: string;
}

export function createPropertiesPanel(options: CreatePropertiesPanelOptions): SurfaceComponent & {
  focusProperty(index: number, field?: "property-key" | "property-value"): void;
  readonly root: HTMLElement;
  setState(state: SurfacePropertiesState): void;
} {
  const root = createElement(options.host, "section", "mme-properties-panel");
  const cleanups: ListenerCleanup[] = [];
  const strings = options.strings.properties;
  let state = options.state;
  let openTypeMenuIndex: number | null = null;
  let pendingTriggerFocusIndex: number | null = null;
  /** Set by the host through `setState` when an edit was refused. */
  let refusal: SurfacePropertyRefusal | null = options.state.refusal ?? null;
  root.dataset.testid = "properties-surface";
  root.setAttribute("aria-label", strings.label);
  options.host.replaceChildren(root);

  const listValue = (row: SurfacePropertyRow): readonly string[] =>
    Array.isArray(row.value) ? (row.value as readonly string[]) : [];

  const typeMenuItems = (): readonly HTMLElement[] => [
    ...root.querySelectorAll<HTMLElement>('[data-testid="property-type-option"]')
  ];

  const focusTypeMenuItem = (index: number): void => {
    const items = typeMenuItems();
    if (items.length === 0) {
      return;
    }
    items[Math.min(Math.max(index, 0), items.length - 1)]?.focus();
  };

  const restoreTriggerFocus = (): void => {
    if (pendingTriggerFocusIndex === null) {
      return;
    }
    const trigger = root.querySelector<HTMLElement>(
      `[data-property-index="${pendingTriggerFocusIndex}"] [data-testid="property-type-button"]`
    );
    pendingTriggerFocusIndex = null;
    trigger?.focus();
  };

  const closeTypeMenu = ({ restoreTriggerFocus: restore }: { readonly restoreTriggerFocus: boolean }): void => {
    if (openTypeMenuIndex === null) {
      return;
    }
    if (restore) {
      pendingTriggerFocusIndex = openTypeMenuIndex;
    }
    openTypeMenuIndex = null;
    render();
    restoreTriggerFocus();
  };

  const displayControl = (
    container: HTMLElement,
    display: SurfacePropertiesDisplay,
    label: string,
    testId: string
  ): void => {
    const button = createElement(options.host, "button", "mme-properties-display-button");
    button.type = "button";
    button.dataset.testid = testId;
    button.textContent = label;
    button.setAttribute("aria-pressed", String(state.display === display));
    button.addEventListener("click", () => options.onChangeDisplay(display));
    container.append(button);
  };

  const renderTypeControl = (row: SurfacePropertyRow, rowElement: HTMLElement): void => {
    const button = createElement(options.host, "button", "mme-property-type-button");
    button.type = "button";
    button.dataset.testid = "property-type-button";
    button.dataset.propertyType = row.type;
    button.disabled = !row.editable;
    button.setAttribute("aria-haspopup", "menu");
    button.setAttribute("aria-expanded", String(openTypeMenuIndex === row.index));
    /*
     * A read-only row has no type as far as this panel is concerned: the value
     * is outside the editable subset, so labelling it "Text" would claim
     * something the engine never determined. It gets the raw-source glyph and
     * the reason it cannot be edited here.
     */
    button.title = row.editable
      ? `${strings.typeLabel}: ${strings.types[row.type]}`
      : (row.reason ? strings.reasons[row.reason] : strings.typeLabel);
    button.setAttribute("aria-label", button.title);
    button.innerHTML = options.icons.render(row.editable ? PROPERTY_TYPE_ICONS[row.type] : "code");
    button.addEventListener("click", () => {
      const opening = openTypeMenuIndex !== row.index;
      openTypeMenuIndex = opening ? row.index : null;
      render();
      // A menu that announces itself as a menu has to behave like one: opening it
      // moves focus into it, so a keyboard user is not left on the trigger with
      // no way in but Tab.
      if (opening) {
        focusTypeMenuItem(0);
      } else {
        pendingTriggerFocusIndex = row.index;
        restoreTriggerFocus();
      }
    });
    rowElement.append(button);
    if (openTypeMenuIndex !== row.index) {
      return;
    }
    const menu = createElement(options.host, "div", "mme-property-type-menu");
    menu.dataset.testid = "property-type-menu";
    menu.setAttribute("role", "menu");
    menu.setAttribute("aria-label", strings.typeLabel);
    for (const propertyType of SURFACE_PROPERTY_TYPES) {
      const option = createElement(options.host, "button", "mme-property-type-option");
      option.type = "button";
      option.dataset.testid = "property-type-option";
      option.dataset.propertyType = propertyType;
      /*
       * `menuitemradio`, not `menuitem`: `aria-checked` is not a supported state
       * on `menuitem`, so no browser maps it and a screen-reader user hears six
       * undifferentiated types with no indication which one the property already
       * is. Value types are mutually exclusive. This is the same defect, and the
       * same fix, as the selection bubble's turn-into menu in this file.
       */
      option.setAttribute("role", "menuitemradio");
      option.setAttribute("aria-checked", String(propertyType === row.type));
      option.tabIndex = -1;
      const glyph = createElement(options.host, "span", "mme-property-type-glyph");
      glyph.innerHTML = options.icons.render(PROPERTY_TYPE_ICONS[propertyType]);
      const label = createElement(options.host, "span");
      label.textContent = strings.types[propertyType];
      option.append(glyph, label);
      option.addEventListener("click", () => {
        closeTypeMenu({ restoreTriggerFocus: true });
        options.onChangeType({ index: row.index, propertyType });
      });
      menu.append(option);
    }
    rowElement.append(menu);
  };

  const renderScalarInput = (row: SurfacePropertyRow, rowElement: HTMLElement): void => {
    const input = createElement(options.host, "input", "mme-property-value");
    const inputType = PROPERTY_TYPE_INPUTS[row.type as Exclude<FrontmatterPropertyType, "list">];
    input.dataset.testid = "property-value";
    input.type = inputType;
    input.setAttribute("aria-label", `${row.key} — ${strings.valueLabel}`);
    if (row.type === "checkbox") {
      input.checked = row.value === true;
    } else {
      input.value = row.value === null ? "" : String(row.value);
    }
    /*
     * `change`, never `input`: the host turns every committed value into a
     * document splice, and committing per keystroke would rewrite the file
     * (and the undo stack) once per character.
     */
    input.addEventListener("change", () => {
      if (row.type === "checkbox") {
        options.onChangeValue({ index: row.index, value: input.checked });
        return;
      }
      if (row.type === "number") {
        options.onChangeValue({ index: row.index, value: input.value === "" ? "" : Number(input.value) });
        return;
      }
      options.onChangeValue({ index: row.index, value: input.value });
    });
    rowElement.append(input);
  };

  const renderChips = (row: SurfacePropertyRow, rowElement: HTMLElement): void => {
    const items = listValue(row);
    const chips = createElement(options.host, "div", "mme-property-chips");
    chips.dataset.testid = "property-chips";
    items.forEach((item, itemIndex) => {
      const chip = createElement(options.host, "span", "mme-property-chip");
      chip.dataset.testid = "property-chip";
      chip.dataset.chipValue = item;
      const text = createElement(options.host, "span");
      text.textContent = item;
      const remove = createElement(options.host, "button", "mme-property-chip-remove");
      remove.type = "button";
      remove.dataset.testid = "property-chip-remove";
      remove.title = strings.removeItem;
      remove.setAttribute("aria-label", `${strings.removeItem}: ${item}`);
      remove.innerHTML = options.icons.render("close");
      remove.addEventListener("click", () => {
        options.onChangeValue({
          index: row.index,
          value: items.filter((_, candidate) => candidate !== itemIndex)
        });
      });
      chip.append(text, remove);
      chips.append(chip);
    });
    const chipInput = createElement(options.host, "input", "mme-property-chip-input");
    chipInput.dataset.testid = "property-chip-input";
    chipInput.type = "text";
    chipInput.placeholder = strings.addItem;
    chipInput.setAttribute("aria-label", `${row.key} — ${strings.addItem}`);
    chipInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") {
        return;
      }
      event.preventDefault();
      const candidate = chipInput.value.trim();
      if (candidate === "") {
        return;
      }
      options.onChangeValue({ index: row.index, value: [...items, candidate] });
      chipInput.value = "";
    });
    chips.append(chipInput);
    rowElement.append(chips);
  };

  const renderReadOnlyValue = (row: SurfacePropertyRow, rowElement: HTMLElement): void => {
    const raw = createElement(options.host, "code", "mme-property-raw-value");
    raw.dataset.testid = "property-raw-value";
    raw.textContent = row.rawValue;
    raw.title = row.reason ? strings.reasons[row.reason] : "";
    const escape = createElement(options.host, "button", "mme-property-edit-in-source");
    escape.type = "button";
    escape.dataset.testid = "property-edit-in-source";
    escape.textContent = strings.editInSource;
    escape.setAttribute("aria-label", `${strings.editInSource}: ${row.key}`);
    escape.addEventListener("click", () => options.onEditInSource({ index: row.index }));
    rowElement.append(raw, escape);
  };

  const renderRow = (row: SurfacePropertyRow, list: HTMLElement): void => {
    const rowElement = createElement(options.host, "div", "mme-property-row");
    rowElement.dataset.testid = "property-row";
    rowElement.dataset.propertyIndex = String(row.index);
    rowElement.dataset.propertyType = row.type;
    rowElement.dataset.propertyEditable = String(row.editable);
    if (row.reason) {
      rowElement.dataset.propertyReason = row.reason;
    }
    rowElement.setAttribute("role", "listitem");
    renderTypeControl(row, rowElement);

    const keyInput = createElement(options.host, "input", "mme-property-key");
    keyInput.dataset.testid = "property-key";
    keyInput.type = "text";
    keyInput.value = row.key;
    keyInput.setAttribute("aria-label", `${row.key} — ${strings.keyLabel}`);
    const rowRefusal = refusal?.index === row.index ? refusal : null;
    if (rowRefusal) {
      keyInput.setAttribute("aria-invalid", "true");
    }
    keyInput.addEventListener("change", () => {
      options.onRenameProperty({ index: row.index, key: keyInput.value });
    });
    rowElement.append(keyInput);

    if (!row.editable) {
      renderReadOnlyValue(row, rowElement);
    } else if (row.type === "list") {
      renderChips(row, rowElement);
    } else {
      renderScalarInput(row, rowElement);
    }

    const remove = createElement(options.host, "button", "mme-property-remove");
    remove.type = "button";
    remove.dataset.testid = "property-remove";
    remove.title = strings.remove;
    remove.setAttribute("aria-label", `${strings.remove}: ${row.key}`);
    remove.innerHTML = options.icons.render("close");
    remove.addEventListener("click", () => options.onRemoveProperty({ index: row.index }));
    rowElement.append(remove);

    /*
     * The reason a value is read-only, and any refusal the host reported, are
     * rendered rather than left in a `title` tooltip: a tooltip does not exist on
     * touch at all, and a refusal routed to the page-level notice strip is off
     * screen whenever the panel is scrolled.
     */
    const caption = rowRefusal?.message ?? (row.editable ? null : row.reason ? strings.reasons[row.reason] : null);
    if (caption) {
      const note = createElement(options.host, "p", "mme-property-reason");
      note.dataset.testid = rowRefusal ? "property-refusal" : "property-reason";
      note.textContent = caption;
      if (rowRefusal) {
        note.setAttribute("role", "alert");
      }
      rowElement.append(note);
    }
    list.append(rowElement);
  };

  const captureFocus = (): PropertyFocusDescriptor | null => {
    const active = root.ownerDocument.activeElement as HTMLElement | null;
    if (!active || !root.contains(active) || !active.dataset.testid) {
      return null;
    }
    const owner = active.closest("[data-property-index]") as HTMLElement | null;
    if (!owner?.dataset.propertyIndex) {
      return null;
    }
    const field = active as HTMLElement & { selectionStart?: number | null };
    return {
      index: Number(owner.dataset.propertyIndex),
      selectionStart: typeof field.selectionStart === "number" ? field.selectionStart : null,
      testId: active.dataset.testid
    };
  };

  const restoreFocus = (descriptor: PropertyFocusDescriptor | null): void => {
    if (!descriptor) {
      return;
    }
    /*
     * Falling back matters most on delete: after removing the LAST property the
     * descriptor's index no longer exists, and returning here dropped focus to
     * `<body>` — which also kills the panel-scoped `⌘;` shortcut until the writer
     * clicks back in. Try the same field on the previous row, then the add
     * control, before giving up.
     */
    const candidates = [
      `[data-property-index="${descriptor.index}"] [data-testid="${descriptor.testId}"]`,
      `[data-property-index="${descriptor.index - 1}"] [data-testid="${descriptor.testId}"]`,
      '[data-testid="properties-add"]'
    ];
    const target = candidates.reduce<HTMLElement | null>(
      (found, selector) => found ?? root.querySelector<HTMLElement>(selector),
      null
    ) as
      | (HTMLElement & { selectionStart?: number | null; setSelectionRange?: (start: number, end: number) => void })
      | null;
    if (!target) {
      return;
    }
    target.focus();
    if (descriptor.selectionStart !== null && typeof target.setSelectionRange === "function") {
      try {
        target.setSelectionRange(descriptor.selectionStart, descriptor.selectionStart);
      } catch {
        // Inputs such as `number` and `date` reject selection ranges; focus is enough.
      }
    }
  };

  const render = (): void => {
    const focus = captureFocus();
    if (!state.present) {
      root.hidden = true;
      root.replaceChildren();
      return;
    }
    root.hidden = false;
    root.dataset.display = state.display;

    const header = createElement(options.host, "div", "mme-properties-header");
    const heading = createElement(options.host, "span", "mme-properties-label");
    heading.textContent = strings.label;
    const controls = createElement(options.host, "div", "mme-properties-controls");
    controls.setAttribute("role", "group");
    controls.setAttribute("aria-label", strings.label);
    displayControl(controls, "visible", strings.displayVisible, "properties-display-visible");
    displayControl(controls, "hidden", strings.displayHidden, "properties-display-hidden");
    displayControl(controls, "source", strings.displaySource, "properties-display-source");
    const add = createElement(options.host, "button", "mme-properties-add");
    add.type = "button";
    add.dataset.testid = "properties-add";
    add.textContent = strings.add;
    /*
     * The handler accepts both `metaKey` and `ctrlKey`, so the hint must not
     * hardcode `⌘` — on Windows and Linux that named a key the writer does not
     * have. The platform is read from the host document, keeping the component
     * free of direct global access.
     */
    const applePlatform = /Mac|iPhone|iPad/.test(root.ownerDocument.defaultView?.navigator?.platform ?? "");
    add.title = `${strings.add} (${applePlatform ? "⌘" : "Ctrl+"};)`;
    add.addEventListener("click", () => options.onAddProperty());
    controls.append(add);
    header.append(heading, controls);

    const children: HTMLElement[] = [header];
    if (state.display === "visible") {
      const list = createElement(options.host, "div", "mme-properties-rows");
      list.dataset.testid = "properties-rows";
      list.setAttribute("role", "list");
      for (const row of state.properties) {
        renderRow(row, list);
      }
      children.push(list);
    } else if (state.display === "source") {
      const source = createElement(options.host, "pre", "mme-properties-source");
      source.dataset.testid = "properties-source";
      source.textContent = state.source;
      children.push(source);
    }
    /*
     * The `hidden` state renders nothing but the header's own restore control:
     * a state whose purpose is to remove chrome cannot itself paint a heading, a
     * rule and a sentence above every note. The header stays because without it
     * the properties would be unreachable.
     */
    root.replaceChildren(...children);
    restoreFocus(focus);
  };

  root.addEventListener("keydown", (event) => {
    if (openTypeMenuIndex !== null) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeTypeMenu({ restoreTriggerFocus: true });
        return;
      }
      const items = typeMenuItems();
      const current = items.indexOf(root.ownerDocument.activeElement as HTMLElement);
      const next =
        event.key === "ArrowDown"
          ? (current + 1 + items.length) % items.length
          : event.key === "ArrowUp"
            ? (current - 1 + items.length) % items.length
            : event.key === "Home"
              ? 0
              : event.key === "End"
                ? items.length - 1
                : null;
      if (next !== null && items.length > 0) {
        event.preventDefault();
        focusTypeMenuItem(next);
        return;
      }
    }
    if (!event.metaKey && !event.ctrlKey) {
      return;
    }
    // Obsidian's own shortcuts: ⌘; adds a property, ⌘⌫ deletes the focused one.
    if (event.key === ";") {
      event.preventDefault();
      options.onAddProperty();
      return;
    }
    if (event.key === "Backspace") {
      const owner = elementTarget(event)?.closest("[data-property-index]") as HTMLElement | null;
      if (!owner?.dataset.propertyIndex) {
        return;
      }
      event.preventDefault();
      options.onRemoveProperty({ index: Number(owner.dataset.propertyIndex) });
    }
  });

  cleanups.push(options.session.on("destroy", () => destroy()));
  render();

  const destroy = (): void => {
    for (const cleanup of cleanups.splice(0)) {
      cleanup();
    }
    root.remove();
  };

  return {
    destroy,
    /**
     * Moves focus to a property's field. The host calls this after an add, so
     * the new property can be named immediately — and so focus stays inside the
     * panel, which is what keeps the `⌘;` shortcut alive for a second use.
     */
    focusProperty(index: number, field: "property-key" | "property-value" = "property-key") {
      const target = root.querySelector<HTMLElement & { select?: () => void }>(
        `[data-property-index="${index}"] [data-testid="${field}"]`
      );
      target?.focus();
      target?.select?.();
    },
    root,
    setState(next: SurfacePropertiesState) {
      state = next;
      refusal = next.refusal ?? null;
      render();
    },
    update: render
  };
}

export function createAiAssistantPanel(options: CreateAiAssistantPanelOptions): SurfaceComponent & {
  readonly root: HTMLElement;
  setState(state: SurfaceAiAssistantState): void;
  show(): void;
} {
  const root = createElement(options.host, "div", "ai-assistant-panel");
  const cleanups: ListenerCleanup[] = [];
  let state = options.state;
  options.host.replaceChildren(root);

  const render = (): void => {
    root.dataset.testid = "editor-ai-assistant-panel";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", options.strings.ai.assistantLabel);
    root.hidden = state.visible === false;
    root.replaceChildren();

    const header = createElement(options.host, "div", "ai-assistant-header");
    const headerText = createElement(options.host, "div");
    const label = createElement(options.host, "p", "label");
    const status = createElement(options.host, "p", "status-value");
    const close = createElement(options.host, "button", "button secondary");
    label.textContent = options.strings.ai.statusLabel;
    status.dataset.testid = "editor-ai-status";
    status.textContent = state.statusText || options.strings.ai.noSession;
    close.dataset.testid = "editor-ai-panel-close";
    close.type = "button";
    close.textContent = options.strings.ai.close;
    close.addEventListener("click", () => options.onClose());
    headerText.append(label, status);
    header.append(headerText, close);

    const sessionRow = createElement(options.host, "div", "editor-ai-session-row");
    const keyLabel = createElement(options.host, "label");
    const input = createElement(options.host, "input");
    const start = createElement(options.host, "button", "button secondary");
    input.dataset.testid = "editor-ai-byok-key-input";
    input.type = "password";
    input.autocomplete = "off";
    input.placeholder = options.strings.ai.keyPlaceholder;
    input.spellcheck = false;
    start.dataset.testid = "editor-ai-start-session-button";
    start.type = "button";
    start.textContent = options.strings.ai.connect;
    start.addEventListener("click", () => {
      const key = input.value.trim();
      input.value = "";
      void options.onStartSession(key);
    });
    keyLabel.append(options.strings.ai.keyLabel, input);
    sessionRow.append(keyLabel, start);

    const preview = createElement(options.host, "div", "ai-suggestion-preview editor-ai-suggestion-preview");
    preview.dataset.testid = "editor-ai-suggestion-preview";
    const pending = state.pending;
    preview.hidden = !pending;
    preview.textContent = pending?.replacement ?? pending?.policyReason ?? "";

    const actions = createElement(options.host, "div", "ai-suggestion-actions");
    const accept = createElement(options.host, "button", "button secondary");
    const reject = createElement(options.host, "button", "button secondary");
    accept.dataset.testid = "editor-ai-accept-button";
    reject.dataset.testid = "editor-ai-reject-button";
    accept.type = "button";
    reject.type = "button";
    accept.textContent = options.strings.ai.accept;
    reject.textContent = options.strings.ai.reject;
    accept.disabled = pending?.status !== "pending";
    reject.disabled = pending?.status !== "pending";
    accept.addEventListener("click", () => {
      void options.onAccept();
    });
    reject.addEventListener("click", () => {
      void options.onReject();
    });
    actions.append(accept, reject);
    root.append(header, sessionRow, preview, actions);
  };

  const show = (): void => {
    root.hidden = false;
  };

  cleanups.push(options.session.on("destroy", () => destroy()));
  render();

  const destroy = (): void => {
    for (const cleanup of cleanups.splice(0)) {
      cleanup();
    }
    root.remove();
  };
  return {
    destroy,
    root,
    setState(nextState: SurfaceAiAssistantState) {
      state = nextState;
      render();
    },
    show,
    update: render
  };
}

export function createInlineAiPrompt(options: CreateInlineAiPromptOptions): SurfaceComponent & {
  close(): void;
  focusPrompt(): void;
  readonly root: HTMLElement;
  setState(state: SurfaceInlineAiPromptState): void;
} {
  const root = createElement(options.host, "div", "inline-ai-prompt");
  const cleanups: ListenerCleanup[] = [];
  let state = options.state;
  let promptValue = state.prompt;
  let selectedActionIndex = state.selectedActionIndex;
  options.host.replaceChildren(root);

  const enabledActions = (): readonly SurfaceAiAction[] => options.actions.filter((action) => action.entryPoints.length > 0);

  const focusPrompt = (): void => {
    const prompt = root.querySelector<HTMLTextAreaElement>('[data-testid="inline-ai-prompt-input"]');
    prompt?.focus();
  };

  const close = (): void => {
    state = {
      ...state,
      open: false
    };
    render(false);
    options.onClose();
    options.returnFocusTo?.focus();
  };

  const setSelectedActionIndex = (index: number, focusAction = false): void => {
    const count = enabledActions().length;
    selectedActionIndex = count === 0 ? 0 : (index + count) % count;
    state = {
      ...state,
      selectedActionIndex
    };
    render(false);
    if (focusAction) {
      root.querySelector<HTMLElement>(`#mme-inline-ai-option-${selectedActionIndex}`)?.focus();
    }
  };

  const submitPrompt = (): void => {
    if (!state.provider.canSubmit || state.busy) {
      return;
    }
    const prompt = promptValue.trim();
    if (!prompt) {
      return;
    }
    void options.onSubmit({
      prompt,
      providerKind: state.provider.kind
    });
  };

  const submitAction = (action: SurfaceAiAction): void => {
    if (!state.provider.canSubmit || state.busy) {
      return;
    }
    void options.onSubmit({
      actionId: action.id,
      prompt: promptValue.trim() || action.prompt,
      providerKind: state.provider.kind
    });
  };

  const handleEscape = (event: KeyboardEvent): boolean => {
    if (event.key !== "Escape") {
      return false;
    }
    event.preventDefault();
    event.stopPropagation();
    close();
    return true;
  };

  const onRootKeyDown = (event: KeyboardEvent): void => {
    if (root.hidden || event.key !== "Escape") {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    close();
  };

  const render = (focus = state.open): void => {
    root.dataset.testid = "inline-ai-prompt";
    root.hidden = !state.open;
    root.setAttribute("aria-label", options.strings.ai.inlineLabel);
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-live", "polite");
    applyInlineAnchor(root, state.anchor);
    root.replaceChildren();

    const header = createElement(options.host, "div", "inline-ai-prompt-header");
    const titleGroup = createElement(options.host, "div");
    const title = createElement(options.host, "p", "label");
    const status = createElement(options.host, "p", "status-value");
    const closeButton = createElement(options.host, "button", "button secondary");
    title.textContent = options.strings.ai.inlineLabel;
    status.dataset.testid = "inline-ai-status";
    status.textContent = state.statusText || state.provider.description;
    closeButton.dataset.testid = "inline-ai-close-button";
    closeButton.type = "button";
    closeButton.textContent = options.strings.ai.close;
    closeButton.addEventListener("click", close);
    titleGroup.append(title, status);
    header.append(titleGroup, closeButton);

    const provider = createElement(options.host, "div", "inline-ai-provider-state");
    const providerLabel = createElement(options.host, "span");
    const providerText = createElement(options.host, "strong");
    const providerDescription = createElement(options.host, "p");
    provider.dataset.testid = "inline-ai-provider-state";
    provider.dataset.providerKind = state.provider.kind;
    providerLabel.textContent = options.strings.ai.providerState;
    providerText.textContent = state.provider.label;
    providerDescription.textContent = state.provider.description;
    provider.append(providerLabel, providerText, providerDescription);

    const promptLabel = createElement(options.host, "label", "inline-ai-prompt-label");
    const prompt = createElement(options.host, "textarea");
    prompt.dataset.testid = "inline-ai-prompt-input";
    prompt.placeholder = options.strings.ai.promptPlaceholder;
    prompt.rows = 3;
    prompt.spellcheck = true;
    prompt.value = promptValue;
    prompt.addEventListener("input", () => {
      promptValue = prompt.value;
    });
    prompt.addEventListener("keydown", (event) => {
      if (handleEscape(event)) {
        return;
      }
      if (event.key === "ArrowDown" && enabledActions().length > 0) {
        event.preventDefault();
        setSelectedActionIndex(selectedActionIndex + 1);
        return;
      }
      if (event.key === "ArrowUp" && enabledActions().length > 0) {
        event.preventDefault();
        setSelectedActionIndex(selectedActionIndex - 1);
        return;
      }
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey || !event.shiftKey)) {
        event.preventDefault();
        submitPrompt();
      }
    });
    promptLabel.append(options.strings.ai.promptLabel, prompt);

    const generate = createElement(options.host, "button", "button primary");
    generate.dataset.testid = "inline-ai-generate-button";
    generate.type = "button";
    generate.textContent = options.strings.ai.generate;
    generate.disabled = !state.provider.canSubmit || Boolean(state.busy);
    generate.addEventListener("click", submitPrompt);

    const actionsLabel = createElement(options.host, "p", "inline-ai-actions-label");
    actionsLabel.textContent = options.strings.ai.actionsLabel;
    const actions = createElement(options.host, "div", "inline-ai-prompt-actions");
    actions.dataset.testid = "inline-ai-actions";
    actions.setAttribute("role", "listbox");
    actions.setAttribute("aria-label", options.strings.ai.actionsLabel);
    const actionButtons = enabledActions().map((action, index) =>
      inlineAiActionButton(options, action, index, selectedActionIndex, {
        onEscape: close,
        onMove(nextIndex) {
          setSelectedActionIndex(nextIndex, true);
        },
        onSubmit() {
          submitAction(action);
        }
      })
    );
    const activeAction = actionButtons[selectedActionIndex];
    if (activeAction?.id) {
      actions.setAttribute("aria-activedescendant", activeAction.id);
    }
    actions.replaceChildren(...actionButtons);

    const preview = createElement(options.host, "div", "ai-suggestion-preview inline-ai-suggestion-preview");
    preview.dataset.testid = "inline-ai-suggestion-preview";
    preview.hidden = !state.pending;
    preview.textContent = state.pending?.replacement ?? state.pending?.policyReason ?? "";

    const suggestionActions = createElement(options.host, "div", "ai-suggestion-actions inline-ai-suggestion-actions");
    const accept = createElement(options.host, "button", "button secondary");
    const reject = createElement(options.host, "button", "button secondary");
    accept.dataset.testid = "inline-ai-accept-button";
    reject.dataset.testid = "inline-ai-reject-button";
    accept.type = "button";
    reject.type = "button";
    accept.textContent = options.strings.ai.accept;
    reject.textContent = options.strings.ai.reject;
    accept.disabled = state.pending?.status !== "pending";
    reject.disabled = state.pending?.status !== "pending";
    accept.addEventListener("click", () => {
      void options.onAccept?.();
    });
    reject.addEventListener("click", () => {
      void options.onReject?.();
    });
    suggestionActions.append(accept, reject);

    root.append(header, provider, promptLabel, generate, preview, suggestionActions, actionsLabel, actions);
    if (focus && state.open) {
      focusPrompt();
    }
  };

  root.addEventListener("keydown", onRootKeyDown);
  cleanups.push(options.session.on("destroy", () => destroy()));
  cleanups.push(() => root.removeEventListener("keydown", onRootKeyDown));
  render();

  const destroy = (): void => {
    for (const cleanup of cleanups.splice(0)) {
      cleanup();
    }
    root.remove();
  };
  return {
    close,
    destroy,
    focusPrompt,
    root,
    setState(nextState: SurfaceInlineAiPromptState) {
      state = nextState;
      promptValue = nextState.prompt;
      selectedActionIndex = nextState.selectedActionIndex;
      render(nextState.open);
    },
    update: render
  };
}

export function createModeControl(options: CreateModeControlOptions): SurfaceComponent & {
  readonly root: HTMLElement;
  setState(state: SurfaceModeControlState): void;
} {
  const root = createElement(options.host, "div", "mode-switch mode-control");
  const cleanups: ListenerCleanup[] = [];
  let state = options.state;
  options.host.replaceChildren(root);

  const render = (): void => {
    root.dataset.testid = "mode-control";
    root.dataset.modeControl = options.preferences.modeControl ?? "compact-tabs";
    root.setAttribute("aria-label", options.strings.mode.label);
    root.setAttribute("role", "group");
    if (options.preferences.modeControl === "host-provided") {
      root.hidden = true;
      root.replaceChildren();
      return;
    }
    root.hidden = false;
    if (options.preferences.modeControl === "single-toggle") {
      root.replaceChildren(modeCycleButton(options, state));
      return;
    }
    root.replaceChildren(...offeredModes(options, state).map((mode) => modeButton(options, state, mode)));
  };

  const onClick = (event: Event): void => {
    const target = elementTarget(event);
    const button = target?.closest<HTMLElement>("[data-editor-mode]");
    const mode = button?.dataset.editorMode as SurfaceEditorMode | undefined;
    if (mode) {
      options.onSwitchMode(mode);
    }
    const cycle = target?.closest<HTMLElement>("[data-editor-mode-cycle]");
    const nextMode = cycle?.dataset.editorModeCycle as SurfaceEditorMode | undefined;
    if (nextMode) {
      options.onSwitchMode(nextMode);
    }
  };
  root.addEventListener("click", onClick);
  cleanups.push(options.session.on("destroy", () => destroy()));
  cleanups.push(() => root.removeEventListener("click", onClick));
  render();

  const destroy = (): void => {
    for (const cleanup of cleanups.splice(0)) {
      cleanup();
    }
    root.remove();
  };
  return {
    destroy,
    root,
    setState(nextState: SurfaceModeControlState) {
      state = nextState;
      render();
    },
    update: render
  };
}

export function createDiagnosticsSurface(options: CreateDiagnosticsSurfaceOptions): SurfaceComponent & {
  readonly root: HTMLElement;
} {
  const root = createElement(options.host, "details", "debug-inspector inspector");
  const summary = createElement(options.host, "summary", "debug-inspector-toggle");
  const body = createElement(options.host, "aside", "debug-inspector-body");
  const cleanups: ListenerCleanup[] = [];
  root.dataset.testid = "debug-inspector";
  summary.dataset.testid = "debug-inspector-toggle";
  summary.textContent = options.strings.diagnostics.label;
  body.setAttribute("aria-label", options.strings.diagnostics.label);
  root.open = options.open ?? false;
  root.append(summary, body);
  options.host.replaceChildren(root);
  cleanups.push(options.session.on("destroy", () => destroy()));
  const destroy = (): void => {
    for (const cleanup of cleanups.splice(0)) {
      cleanup();
    }
    root.remove();
  };
  return {
    destroy,
    root,
    update() {
      summary.textContent = options.strings.diagnostics.label;
    }
  };
}

export function primaryActionLabel(
  state: SaveState,
  document: SurfaceDocumentState,
  strings: MmeStrings = defaultMmeStrings
): string {
  if (document.mode === "imported-copy" || state.target === "download-required") {
    return strings.status.primaryExport;
  }
  if (document.mode === "unsupported" || state.target === "unsupported") {
    return strings.status.primaryUnavailable;
  }
  return strings.status.primarySave;
}

export function dirtyStateLabel(state: SaveState, strings: MmeStrings = defaultMmeStrings): string {
  return state.status === "saved" ? strings.status.dirtyClean : state.status;
}

export function documentTargetLabel(
  state: SaveState,
  document: SurfaceDocumentState,
  strings: MmeStrings = defaultMmeStrings
): string {
  if (state.target === "conflict") {
    return strings.status.targetConflict;
  }
  if (document.kind === "html-artifact") {
    return strings.status.htmlTarget;
  }
  if (document.mode === "writable-file" || state.target === "disk") {
    return strings.status.targetDisk;
  }
  if (document.mode === "imported-copy" || state.target === "download-required") {
    return strings.status.importedTarget;
  }
  if (document.mode === "unsupported" || state.target === "unsupported") {
    return strings.status.unsupportedTarget;
  }
  if (state.target === "memory-only") {
    return strings.status.memoryTarget;
  }
  return state.target;
}

function documentAdapterLabel(state: SaveState, document: SurfaceDocumentState): string {
  if (document.adapterKind) {
    return document.adapterKind;
  }
  if (document.kind === "html-artifact") {
    return "html-artifact";
  }
  if (document.mode === "writable-file" || state.target === "disk") {
    return "browser-file-system";
  }
  if (document.mode === "imported-copy" || state.target === "download-required") {
    return "download-export";
  }
  if (document.mode === "unsupported" || state.target === "unsupported") {
    return "unsupported";
  }
  if (state.target === "memory-only") {
    return "memory";
  }
  return state.target;
}

function documentWritableLabel(state: SaveState, document: SurfaceDocumentState): string {
  if (document.writable !== undefined) {
    return document.writable ? "yes" : "no";
  }
  return document.mode === "writable-file" || state.target === "disk" ? "yes" : "no";
}

function lastSavedLabel(state: SaveState): string {
  return state.lastSavedAt ? state.lastSavedAt.toISOString() : "never";
}

function saveDetailsLabel(state: SaveState): string {
  const parts = state.target === "conflict" || state.status === "conflict"
    ? [`current ${shortStatusHash(state.currentHash)}`]
    : [`${state.target} / ${state.status}`, `current ${shortStatusHash(state.currentHash)}`];
  if (state.lastSavedHash) {
    parts.push(`saved ${shortStatusHash(state.lastSavedHash)}`);
  }
  if (state.externalHash) {
    parts.push(`external ${shortStatusHash(state.externalHash)}`);
  }
  if (state.errorMessage) {
    parts.push(state.errorMessage);
  }
  return parts.join(" | ");
}

function shortStatusHash(hash: string): string {
  return hash.length > 16 ? hash.slice(0, 16) : hash;
}

function commandActive(state: Pick<SurfaceToolbarState, "activeIds"> | Pick<SurfaceSelectionBubbleState, "activeIds">, id: string): boolean {
  return state.activeIds?.includes(id) ?? false;
}

function commandDisabled(state: Pick<SurfaceToolbarState, "disabledIds"> | Pick<SurfaceSelectionBubbleState, "disabledIds">, id: string): boolean {
  return state.disabledIds?.includes(id) ?? false;
}

function toolbarCommandVisible(preferences: SurfacePreferences, group: string): boolean {
  return commandGroupVisible(preferences.visibleCommandGroups, group);
}

function slashCommandVisible(preferences: SurfacePreferences, group: string): boolean {
  return commandGroupVisible(preferences.visibleCommandGroups, group) && commandGroupVisible(preferences.slashGroups, group);
}

function commandGroupVisible(groups: readonly string[] | undefined, group: string): boolean {
  if (!groups) {
    return true;
  }
  return groups.includes(normalizeCommandGroup(group));
}

function normalizeCommandGroup(group: string): string {
  if (group === "block") {
    return "blocks";
  }
  if (group === "inline") {
    return "marks";
  }
  return group;
}

function toolbarButton(options: CreateToolbarOptions, state: SurfaceToolbarState, command: ToolbarCommandDefinition, roving: boolean): HTMLButtonElement {
  const button = createElement(options.host, "button", "toolbar-button");
  const disabled = commandDisabled(state, command.id);
  const label = options.strings.toolbar[command.title];
  button.type = "button";
  button.disabled = disabled;
  button.dataset.richCommand = command.richCommand;
  button.dataset.toolbarGroup = command.group;
  button.dataset.toolbarCommandId = command.id;
  if (command.testId) {
    button.dataset.testid = command.testId;
  }
  button.setAttribute("aria-label", label);
  button.setAttribute("aria-pressed", String(commandActive(state, command.id)));
  button.title = disabled ? state.disabledReasons?.[command.id] ?? label : label;
  // The single tab stop is assigned by `restoreFocusAndRoving`, which survives
  // re-renders; hardcoding it here produced two tab stops in one toolbar.
  button.tabIndex = -1;
  if (command.icon) {
    button.innerHTML = toolbarIcon(options, command.icon);
  }
  return button;
}

function aiToolbarButton(options: CreateToolbarOptions): HTMLButtonElement {
  const button = createElement(options.host, "button", "toolbar-button toolbar-ai-button");
  button.type = "button";
  button.dataset.referenceAiToolbar = "";
  button.dataset.testid = "toolbar-ai-button";
  button.setAttribute("aria-label", options.strings.toolbar.ai);
  button.title = options.strings.toolbar.ai;
  button.tabIndex = -1;
  button.hidden = !entryPointEnabled(options.preferences, "toolbar");
  button.innerHTML = toolbarIcon(options, "ai");
  return button;
}

function hostToolbarButtons(options: CreateToolbarOptions, state: SurfaceToolbarState): HTMLButtonElement[] {
  return (state.hostToolbarItems ?? [])
    .filter((item) => !item.id.startsWith("mme:"))
    .filter((item) => toolbarCommandVisible(options.preferences, item.group))
    .map((item) => {
      const button = createElement(options.host, "button", "toolbar-button toolbar-extension-button");
      const label = extensionLabel(options.strings, item.labelKey);
      const disabled = commandDisabled(state, item.id);
      button.type = "button";
      button.disabled = disabled;
      button.dataset.extensionToolbarItem = item.id;
      button.dataset.toolbarGroup = item.group;
      button.dataset.testid = `toolbar-extension-${item.id}`;
      button.setAttribute("aria-label", label);
      button.setAttribute("aria-pressed", String(commandActive(state, item.id)));
      button.title = label;
      if (disabled) {
        button.title = state.disabledReasons?.[item.id] ?? label;
      }
      button.tabIndex = -1;
      button.innerHTML = toolbarIcon(options, toolbarIconName(item.icon));
      return button;
    });
}

function selectionBubbleButton(
  options: CreateSelectionBubbleToolbarOptions,
  state: SurfaceSelectionBubbleState,
  command: ToolbarCommandDefinition
): HTMLButtonElement {
  const button = createElement(options.host, "button", "toolbar-button");
  const label = options.strings.toolbar[command.title];
  const disabled = commandDisabled(state, command.id);
  button.type = "button";
  button.disabled = disabled;
  button.dataset.richBubbleCommand = command.richCommand;
  button.dataset.toolbarCommandId = command.id;
  button.dataset.toolbarGroup = command.group;
  if (command.testId) {
    button.dataset.testid = command.testId;
  }
  button.setAttribute("aria-label", label);
  button.setAttribute("aria-pressed", String(commandActive(state, command.id)));
  button.title = disabled ? state.disabledReasons?.[command.id] ?? label : label;
  // The single tab stop is assigned by `restoreFocusAndRoving`, which survives
  // re-renders; hardcoding it here produced two tab stops in one toolbar.
  button.tabIndex = -1;
  if (command.icon) {
    button.innerHTML = toolbarIcon(options, command.icon);
  }
  return button;
}

/**
 * A visual and semantic group boundary inside the bubble.
 *
 * `role="separator"` rather than a styled `<span>`: the bubble is a `role=
 * "toolbar"`, and a screen reader reading a run of eleven undifferentiated
 * buttons is the accessibility equivalent of the wall of icons this issue is
 * replacing.
 */
function bubbleSeparator(options: CreateSelectionBubbleToolbarOptions): HTMLElement {
  const separator = createElement(options.host, "span", "selection-bubble-separator");
  separator.setAttribute("role", "separator");
  separator.setAttribute("aria-orientation", "vertical");
  return separator;
}

function selectionBubbleTurnIntoButton(
  options: CreateSelectionBubbleToolbarOptions,
  state: SurfaceSelectionBubbleState
): HTMLButtonElement {
  const button = createElement(options.host, "button", "toolbar-button selection-bubble-turn-into");
  const activeLabel = selectionBubbleTurnIntoCommands.find(
    (entry) => entry.richCommand === state.activeBlockCommand
  );
  const label = options.strings.toolbar.turnInto;
  const blockLabel = activeLabel ? options.strings.toolbar[activeLabel.title] : null;
  const available = selectionBubbleTurnIntoCommands.filter(
    (entry) => !(state.turnIntoDisabledCommands ?? []).includes(entry.richCommand)
  );
  const unavailable = available.length === 0;
  /*
   * WCAG 2.5.3 Label in Name: the accessible name must CONTAIN the visible
   * caption, or a speech-input user saying "click Heading 2" — the words they
   * can see — activates nothing. Visible text first, so the block type is also
   * the first thing a screen reader says; without this the current block type
   * was reported to assistive technology nowhere in the feature.
   */
  const accessibleName = blockLabel ? `${blockLabel} — ${label}` : label;
  button.type = "button";
  button.disabled = unavailable;
  button.dataset.testid = "selection-bubble-turn-into";
  button.dataset.toolbarGroup = "blocks";
  button.setAttribute("aria-expanded", String(Boolean(state.turnIntoOpen)));
  button.setAttribute("aria-haspopup", "menu");
  button.setAttribute("aria-label", accessibleName);
  // A disabled control that says nothing reads as broken rather than as honest.
  button.title = unavailable ? (state.disabledReasons?.["mme:turnInto"] ?? accessibleName) : accessibleName;
  button.tabIndex = -1;
  /*
   * The current block type is shown as text next to the chevron — Notion and
   * BlockNote both do this, and it is the only part of the bubble that reports
   * state rather than offering an action.
   */
  button.innerHTML = toolbarIcon(options, activeLabel?.icon ?? "heading");
  const caption = createElement(options.host, "span", "selection-bubble-turn-into-label");
  caption.textContent = activeLabel ? options.strings.toolbar[activeLabel.title] : label;
  button.append(caption);
  /*
   * The icon carries the meaning at coarse-pointer widths, where the CSS hides
   * the caption: seven controls at the 44px touch floor leave no room for an
   * 80px label, and a label squeezed to "P.." is worse than none.
   */
  button.insertAdjacentHTML("beforeend", toolbarIcon(options, "chevron"));
  return button;
}

function selectionBubbleTurnIntoMenu(
  options: CreateSelectionBubbleToolbarOptions,
  state: SurfaceSelectionBubbleState
): HTMLElement {
  const menu = createElement(options.host, "div", "selection-bubble-turn-into-menu");
  menu.dataset.testid = "selection-bubble-turn-into-menu";
  menu.setAttribute("role", "menu");
  menu.setAttribute("aria-orientation", "vertical");
  menu.setAttribute("aria-label", options.strings.toolbar.turnInto);
  menu.append(
    ...selectionBubbleTurnIntoCommands.map((entry) => {
      const item = createElement(options.host, "button", "toolbar-menu-item");
      const label = options.strings.toolbar[entry.title];
      item.type = "button";
      item.disabled = (state.turnIntoDisabledCommands ?? []).includes(entry.richCommand);
      item.dataset.testid = `selection-bubble-turn-into-${entry.richCommand}`;
      item.dataset.turnIntoCommand = entry.richCommand;
      item.setAttribute("aria-label", label);
      /*
       * `aria-checked` is not a supported state on `menuitem`, so browsers never
       * mapped it: a screen reader read nine undifferentiated entries with no
       * indication which one the block already was, and the only surviving cue
       * was a background colour. Block types are mutually exclusive, which makes
       * `menuitemradio` the correct role.
       */
      item.setAttribute("role", "menuitemradio");
      item.setAttribute("aria-checked", String(entry.richCommand === state.activeBlockCommand));
      item.tabIndex = -1;
      item.innerHTML = toolbarIcon(options, entry.icon);
      const caption = createElement(options.host, "span", "toolbar-menu-item-label");
      caption.textContent = label;
      item.append(caption);
      return item;
    })
  );
  return menu;
}

function selectionBubbleLinkButton(
  options: CreateSelectionBubbleToolbarOptions,
  state: SurfaceSelectionBubbleState
): HTMLButtonElement {
  const button = createElement(options.host, "button", "toolbar-button selection-bubble-link");
  const label = options.strings.toolbar.link;
  button.type = "button";
  button.dataset.testid = "selection-bubble-link";
  button.dataset.toolbarGroup = "insert";
  /*
   * No `aria-expanded`: the popover replaces the button row, so this control is
   * removed from the DOM the instant it expands and the attribute could never be
   * observed as `true`. `aria-haspopup` alone tells the truth.
   */
  button.setAttribute("aria-haspopup", "true");
  button.setAttribute("aria-label", label);
  button.setAttribute("aria-pressed", String(Boolean(state.linkEditor?.href)));
  button.title = label;
  button.tabIndex = -1;
  button.innerHTML = toolbarIcon(options, "link");
  return button;
}

/**
 * The link popover.
 *
 * A `<form>` rather than an input plus a click handler, so Enter submits and
 * Escape is handled by the bubble's own key handler — both are keyboard
 * expectations the issue names, and both come free from the element.
 */
function selectionBubbleLinkEditor(
  options: CreateSelectionBubbleToolbarOptions,
  state: SurfaceSelectionBubbleState,
  draft: string | null = null
): HTMLElement {
  const form = createElement(options.host, "form", "selection-bubble-link-editor");
  form.dataset.testid = "selection-bubble-link-editor";
  form.setAttribute("aria-label", options.strings.toolbar.link);
  /*
   * `role="group"`, not `role="dialog"`. A dialog promises a focus trap and a
   * modal contract this popover does not have and should not have — it lives
   * inside a `role="toolbar"` and Tab must keep working. `noValidate` matters
   * just as much: `type="url"` refused `./notes.md`, `#section`, and
   * `example.com`, which are the destinations a Markdown writer actually types.
   */
  form.setAttribute("role", "group");
  form.noValidate = true;

  const input = createElement(options.host, "input", "selection-bubble-link-input");
  input.dataset.testid = "selection-bubble-link-input";
  input.type = "text";
  input.inputMode = "url";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.value = draft ?? state.linkEditor?.href ?? "";
  input.placeholder = options.strings.toolbar.linkPlaceholder;
  input.setAttribute("aria-label", options.strings.toolbar.linkPlaceholder);

  const apply = createElement(options.host, "button", "toolbar-button selection-bubble-link-apply");
  apply.type = "submit";
  apply.dataset.testid = "selection-bubble-link-apply";
  apply.setAttribute("aria-label", options.strings.toolbar.linkApply);
  apply.title = options.strings.toolbar.linkApply;
  apply.innerHTML = toolbarIcon(options, "check");

  form.append(input, apply);

  if (state.linkEditor?.href) {
    const remove = createElement(options.host, "button", "toolbar-button selection-bubble-link-remove");
    remove.type = "button";
    remove.dataset.testid = "selection-bubble-link-remove";
    remove.setAttribute("aria-label", options.strings.toolbar.linkRemove);
    remove.title = options.strings.toolbar.linkRemove;
    remove.innerHTML = toolbarIcon(options, "close");
    form.append(remove);
  } else {
    const cancel = createElement(options.host, "button", "toolbar-button selection-bubble-link-cancel");
    cancel.type = "button";
    cancel.dataset.testid = "selection-bubble-link-cancel";
    cancel.setAttribute("aria-label", options.strings.toolbar.linkCancel);
    cancel.title = options.strings.toolbar.linkCancel;
    cancel.innerHTML = toolbarIcon(options, "close");
    form.append(cancel);
  }
  return form;
}

function selectionBubbleAiButton(options: CreateSelectionBubbleToolbarOptions, state: SurfaceSelectionBubbleState): HTMLButtonElement {
  const button = createElement(options.host, "button", "toolbar-button selected-text-ai-bubble-action");
  button.type = "button";
  button.dataset.referenceAiSelection = "";
  button.dataset.testid = "selected-text-ai-bubble-action";
  button.hidden = state.aiVisible === false || !entryPointEnabled(options.preferences, "selection");
  button.disabled = state.aiDisabled ?? false;
  button.setAttribute("aria-label", options.strings.toolbar.ai);
  button.title = options.strings.toolbar.ai;
  button.tabIndex = -1;
  button.innerHTML = toolbarIcon(options, "ai");
  return button;
}

/**
 * MME-0119 — the overlay layer.
 *
 * `position: fixed` resolves against the viewport only while no ancestor
 * establishes a containing block for fixed descendants. `transform`, `filter`,
 * `backdrop-filter`, `perspective`, `will-change` and `contain` all do — and
 * MME-0102 gave `.rich-command-toolbar` a `backdrop-filter` for its glass
 * treatment. A menu rendered inside that toolbar therefore had its correctly
 * computed viewport coordinates re-resolved against the toolbar, displacing it by
 * the toolbar's scroll offset until it left the screen entirely.
 *
 * **The contract: any surface overlay that positions against the viewport is
 * rendered here, never inside the element that triggers it.** The layer is a
 * direct child of `<body>` and must never itself carry a containing-block
 * property. Compensating for a scroll offset instead is forbidden: it treats the
 * symptom and breaks again in the next scroll container.
 *
 * `tests/overlay-containing-block.test.mjs` enforces this on every push.
 */
function overlayLayer(host: HTMLElement): HTMLElement {
  const ownerDocument = host.ownerDocument;
  const existing = ownerDocument.querySelector<HTMLElement>("[data-mme-overlay-layer]");
  if (existing) {
    return existing;
  }
  const layer = ownerDocument.createElement("div");
  layer.className = "mme-overlay-layer";
  layer.dataset.mmeOverlayLayer = "";
  ownerDocument.body.append(layer);
  return layer;
}

/**
 * The second thing a portal breaks, after positioning: inheritance.
 *
 * The layer is a sibling of the app shell, so an overlay inside it inherits
 * nothing the host set on that shell. Two of those matter and both are silent:
 *
 *  - `--mme-visual-viewport-height`, which `.toolbar-more-menu`'s `max-height`
 *    reads. Falling back to `100dvh` means the menu is sized to the whole screen
 *    while a software keyboard covers the bottom half — the same class of defect
 *    MME-0119 fixed, reappearing on the vertical axis, and invisible to a
 *    headless gate because there is no keyboard in the run.
 *  - `--mme-density`, which sizes menu items. Frozen at 1, the menu stops
 *    matching the toolbar it belongs to at compact or spacious density.
 *
 * The theme data attributes come along for the same reason: nothing styles them
 * today, but the first `[data-layout-density] .toolbar-menu-item` rule anyone
 * writes would otherwise silently miss the portalled menu.
 */
const INHERITED_OVERLAY_PROPERTIES = [
  "--mme-density",
  "--mme-visual-viewport-height",
  "--mme-visual-viewport-width",
  "--mme-keyboard-inset"
];

function mirrorHostContext(host: HTMLElement, layer: HTMLElement): void {
  const view = host.ownerDocument.defaultView;
  if (!view) {
    return;
  }
  const shell = host.closest<HTMLElement>("[data-testid=\"reference-editor-shell\"]") ?? host;
  const computed = view.getComputedStyle(shell);
  for (const property of INHERITED_OVERLAY_PROPERTIES) {
    const value = computed.getPropertyValue(property).trim();
    if (value) {
      layer.style.setProperty(property, value);
    }
  }
  for (const attribute of ["layoutDensity", "toolbarStyle"] as const) {
    const value = shell.dataset[attribute];
    if (value) {
      layer.dataset[attribute] = value;
    }
  }
}

function toolbarMore(
  options: CreateToolbarOptions,
  state: SurfaceToolbarState,
  open: boolean
): { container: HTMLDivElement; menu: HTMLDivElement } {
  const container = createElement(options.host, "div", "toolbar-more");
  const button = createElement(options.host, "button", "toolbar-button");
  const menu = createElement(options.host, "div", "toolbar-more-menu");
  button.type = "button";
  button.dataset.testid = "toolbar-more-button";
  button.setAttribute("aria-label", options.strings.toolbar.more);
  button.setAttribute("aria-expanded", String(open));
  button.title = options.strings.toolbar.more;
  button.tabIndex = -1;
  button.innerHTML = toolbarIcon(options, "more");
  menu.dataset.testid = "toolbar-more-menu";
  menu.hidden = !open;
  menu.append(
    ...toolbarMoreCommands.filter((command) => toolbarCommandVisible(options.preferences, command.group)).map((command) => {
      const item = createElement(options.host, "button", "toolbar-menu-item");
      const disabled = commandDisabled(state, command.id);
      item.type = "button";
      /*
       * `role="menu"` may only own menuitem-family roles. Plain buttons drop
       * NVDA and JAWS out of menu mode and lose the "n of 14" position
       * announcement. `menuitemcheckbox` rather than `menuitem` because these
       * entries toggle, and `aria-pressed` is not valid on a menuitem.
       */
      item.setAttribute("role", "menuitemcheckbox");
      item.disabled = disabled;
      item.dataset.richCommand = command.richCommand;
      item.dataset.toolbarCommandId = command.id;
      item.setAttribute("aria-checked", String(commandActive(state, command.id)));
      if (command.testId) {
        item.dataset.testid = command.testId;
      }
      if (disabled) {
        item.title = state.disabledReasons?.[command.id] ?? options.strings.toolbar[command.title];
      }
      item.innerHTML = `${command.icon ? toolbarIcon(options, command.icon) : ""}<span>${escapeText(options.strings.toolbar[command.title])}</span>`;
      return item;
    })
  );
  /*
   * The menu is deliberately NOT appended to `container`: it is portalled into
   * the overlay layer by the caller.
   *
   * `aria-controls` records the relationship for the accessibility tree, but it
   * is NOT a substitute for DOM adjacency — only JAWS offers a command to follow
   * it. What actually replaces the adjacency the portal removed is the focus
   * management in `setMoreOpen`: focus moves into the menu on open and returns
   * to this button on close.
   */
  menu.id = menu.id || `mme-toolbar-more-menu-${moreMenuSequence += 1}`;
  button.setAttribute("aria-controls", menu.id);
  button.setAttribute("aria-haspopup", "menu");
  menu.setAttribute("role", "menu");
  menu.setAttribute("aria-label", options.strings.toolbar.more);
  container.append(button);
  return { container, menu };
}

let moreMenuSequence = 0;

function positionToolbarMoreMenu(button: HTMLElement, menu: HTMLElement): void {
  const rect = button.getBoundingClientRect();
  const viewport = button.ownerDocument.defaultView;
  const viewportWidth = viewport?.innerWidth ?? rect.right;
  const viewportHeight = viewport?.innerHeight ?? rect.bottom;
  const menuWidth = menu.offsetWidth || 184;
  const menuHeight = menu.offsetHeight || 280;
  const left = Math.max(8, Math.min(rect.right - menuWidth, viewportWidth - menuWidth - 8));
  const below = rect.bottom + 6;
  const above = rect.top - menuHeight - 6;
  const top = below + menuHeight <= viewportHeight - 8
    ? below
    : Math.max(8, Math.min(above, viewportHeight - menuHeight - 8));
  menu.style.position = "fixed";
  menu.style.inset = "auto";
  menu.style.left = `${Math.round(left)}px`;
  menu.style.top = `${Math.round(top)}px`;
}

function findIconButton(
  options: Pick<SurfaceComponentContext, "host" | "icons">,
  icon: IconName,
  label: string,
  testId: string
): HTMLButtonElement {
  const button = createElement(options.host, "button", "toolbar-button find-replace-button");
  button.dataset.testid = testId;
  button.type = "button";
  button.setAttribute("aria-label", label);
  button.title = label;
  button.innerHTML = toolbarIcon(options, icon);
  return button;
}

function findMatchCountLabel(state: SurfaceFindReplaceState, strings: MmeStrings): string {
  if (state.matches.length === 0) {
    return strings.find.noMatches;
  }
  const active = Math.max(0, Math.min(state.activeIndex, state.matches.length - 1)) + 1;
  return `${active} / ${state.matches.length}`;
}

function slashButton(
  options: CreateSlashMenuOptions,
  item: SlashItemDefinition,
  index: number,
  selectedIndex: number
): HTMLButtonElement {
  const button = createElement(options.host, "button", "slash-command-item");
  const icon = createElement(options.host, "span", "slash-command-icon");
  const copy = createElement(options.host, "span", "slash-command-copy");
  button.type = "button";
  button.id = `mme-slash-option-${index}`;
  button.dataset.selected = String(index === selectedIndex);
  button.dataset.slashCommand = item.id;
  button.dataset.testid = `slash-command-item-${item.id}`;
  button.setAttribute("role", "option");
  button.setAttribute("aria-selected", String(index === selectedIndex));
  const label = createElement(options.host, "strong");
  const aliases = createElement(options.host, "span");
  icon.innerHTML = toolbarIcon(options, slashIconName(item.id, item.group));
  label.textContent = extensionLabel(options.strings, item.labelKey);
  aliases.textContent = item.aliases.slice(0, 3).join(", ");
  copy.append(label, aliases);
  button.append(icon, copy);
  return button;
}

function aiSlashButton(
  options: CreateSlashMenuOptions,
  item: SurfaceAiAction,
  index: number,
  selectedIndex: number
): HTMLButtonElement {
  const button = createElement(options.host, "button", "slash-command-item slash-command-item-ai");
  const icon = createElement(options.host, "span", "slash-command-icon");
  const copy = createElement(options.host, "span", "slash-command-copy");
  button.type = "button";
  button.id = `mme-slash-option-${index}`;
  button.dataset.selected = String(index === selectedIndex);
  button.dataset.referenceAiAction = item.id;
  button.dataset.testid = `slash-ai-action-${item.id}`;
  button.setAttribute("role", "option");
  button.setAttribute("aria-selected", String(index === selectedIndex));
  const label = createElement(options.host, "strong");
  const prompt = createElement(options.host, "span");
  icon.innerHTML = toolbarIcon(options, "ai");
  label.textContent = item.label;
  prompt.textContent = item.prompt;
  copy.append(label, prompt);
  button.append(icon, copy);
  return button;
}

function sectionLabel(options: SurfaceComponentContext, label: string, group: string): HTMLElement {
  const item = createElement(options.host, "p", "slash-command-section");
  item.setAttribute("role", "presentation");
  item.dataset.testid = `slash-section-${normalizeCommandGroup(group)}`;
  item.textContent = label;
  return item;
}

function slashEmptyState(options: CreateSlashMenuOptions): HTMLElement {
  const item = createElement(options.host, "p", "slash-command-empty");
  item.dataset.testid = "slash-empty-state";
  item.setAttribute("role", "presentation");
  item.textContent = options.strings.slash.noResults ?? defaultMmeStrings.slash.noResults ?? options.strings.slash.emptyPlaceholder;
  return item;
}

function groupedSlashItems(items: readonly SlashItemDefinition[]): readonly (readonly [string, readonly SlashItemDefinition[]])[] {
  const groups = new Map<string, SlashItemDefinition[]>();
  for (const item of items) {
    const group = normalizeCommandGroup(item.group);
    const groupItems = groups.get(group) ?? [];
    groupItems.push(item);
    groups.set(group, groupItems);
  }
  return [...groups.entries()];
}

function slashGroupLabel(strings: MmeStrings, group: string): string {
  return strings.slash.groups?.[normalizeCommandGroup(group)] ?? defaultMmeStrings.slash.groups?.[normalizeCommandGroup(group)] ?? group;
}

function paletteButton(
  options: CreateCommandPaletteOptions,
  action: SurfaceAiAction,
  index: number,
  selectedIndex: number
): HTMLButtonElement {
  const button = createElement(options.host, "button", "ai-command-item");
  const icon = createElement(options.host, "span", "ai-command-icon");
  const copy = createElement(options.host, "span", "ai-command-copy");
  button.type = "button";
  button.id = `mme-command-palette-option-${index}`;
  button.dataset.referenceAiAction = action.id;
  button.dataset.selected = String(index === selectedIndex);
  button.dataset.testid = `command-palette-ai-action-${action.id}`;
  button.setAttribute("role", "option");
  button.setAttribute("aria-selected", String(index === selectedIndex));
  const label = createElement(options.host, "strong");
  const entryPoints = createElement(options.host, "span");
  icon.innerHTML = toolbarIcon(options, "ai");
  label.textContent = action.label;
  entryPoints.textContent = action.entryPoints.join(", ");
  copy.append(label, entryPoints);
  button.append(icon, copy);
  return button;
}

function inlineAiActionButton(
  options: CreateInlineAiPromptOptions,
  action: SurfaceAiAction,
  index: number,
  selectedIndex: number,
  handlers: {
    readonly onEscape: () => void;
    readonly onMove: (index: number) => void;
    readonly onSubmit: () => void;
  }
): HTMLButtonElement {
  const button = createElement(options.host, "button", "inline-ai-action-row");
  button.type = "button";
  button.id = `mme-inline-ai-option-${index}`;
  button.dataset.referenceAiAction = action.id;
  button.dataset.selected = String(index === selectedIndex);
  button.dataset.testid = `inline-ai-action-${action.id}`;
  button.setAttribute("role", "option");
  button.setAttribute("aria-selected", String(index === selectedIndex));
  const label = createElement(options.host, "strong");
  const prompt = createElement(options.host, "span");
  label.textContent = action.label;
  prompt.textContent = action.prompt;
  button.append(label, prompt);
  button.addEventListener("click", handlers.onSubmit);
  button.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      handlers.onEscape();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      handlers.onMove(index + 1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      handlers.onMove(index - 1);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handlers.onSubmit();
    }
  });
  return button;
}

function modeButton(options: CreateModeControlOptions, state: SurfaceModeControlState, mode: SurfaceEditorMode): HTMLButtonElement {
  const button = createElement(
    options.host,
    "button",
    mode === "source"
      ? "mode-button mode-switch-label"
      : mode === "rich"
        ? "mode-button mode-switch-label"
        : "mode-button preview-mode-pill"
  );
  button.type = "button";
  button.dataset.editorMode = mode;
  button.dataset.testid =
    mode === "source"
      ? "source-mode-button"
      : mode === "rich"
        ? "rich-mode-button"
        : mode === "live-preview"
          ? "live-preview-mode-button"
          : "preview-mode-button";
  button.setAttribute("aria-pressed", String(state.editorMode === mode));
  if (mode === "source") {
    button.setAttribute("aria-label", options.strings.mode.source);
    button.textContent = options.strings.mode.source;
  } else if (mode === "rich") {
    button.textContent = options.strings.mode.rich;
  } else if (mode === "live-preview") {
    button.textContent = options.strings.mode.livePreview;
  } else {
    const readLabel = options.strings.mode.read ?? options.strings.mode.preview;
    button.textContent = state.documentKind === "markdown" ? readLabel : options.strings.mode.preview;
  }
  if (mode === "rich" || mode === "live-preview") {
    button.disabled = state.documentKind !== "markdown";
    button.hidden = state.documentKind !== "markdown";
  }
  if (mode === "preview") {
    button.disabled = state.documentKind !== "html-artifact" && state.documentKind !== "svg-artifact";
    button.hidden = false;
  }
  return button;
}

function offeredModes(options: CreateModeControlOptions, state: SurfaceModeControlState): readonly SurfaceEditorMode[] {
  const supported = surfaceModesForDocumentKind(state.documentKind);
  if (!options.availableModes) {
    return supported;
  }
  const allowed = new Set(options.availableModes);
  const filtered = supported.filter((mode) => allowed.has(mode));
  // Never render an empty control: fall back to the full set if the restriction excludes everything.
  return filtered.length > 0 ? filtered : supported;
}

function modeCycleButton(options: CreateModeControlOptions, state: SurfaceModeControlState): HTMLButtonElement {
  const modes = offeredModes(options, state);
  const currentIndex = Math.max(0, modes.indexOf(state.editorMode));
  const current = modes[currentIndex] ?? modes[0] ?? "source";
  const next = modes[(currentIndex + 1) % Math.max(1, modes.length)] ?? current;
  const button = createElement(options.host, "button", "mode-button mode-cycle-button");
  button.type = "button";
  button.dataset.editorModeCycle = next;
  button.dataset.testid = "mode-cycle-button";
  button.setAttribute("aria-label", `${options.strings.mode.label}: ${modeLabel(options.strings, current)}`);
  button.textContent = modeLabel(options.strings, current);
  return button;
}

function modeLabel(strings: MmeStrings, mode: SurfaceEditorMode): string {
  if (mode === "source") {
    return strings.mode.source;
  }
  if (mode === "rich") {
    return strings.mode.rich;
  }
  if (mode === "live-preview") {
    return strings.mode.livePreview;
  }
  return strings.mode.preview;
}

function surfaceModesForDocumentKind(documentKind: SurfaceDocumentKind): readonly SurfaceEditorMode[] {
  return editorModesForDocumentKind(documentKind as EditorDocumentKind).map((definition) => definition.id as SurfaceEditorMode);
}

function statusString(strings: MmeStrings, key: "adapter" | "details" | "lastSaved" | "writable"): string {
  return strings.status[key] ?? defaultMmeStrings.status[key] ?? key;
}

function statusLine(options: SurfaceComponentContext, label: string, testId: string, value: string): HTMLParagraphElement {
  const row = createElement(options.host, "p");
  const labelElement = createElement(options.host, "span");
  const valueElement = createElement(options.host, "strong");
  labelElement.textContent = label;
  valueElement.dataset.testid = testId;
  valueElement.textContent = value;
  row.append(labelElement, valueElement);
  return row;
}

function conflictResolution(options: CreateDocumentStatusOptions): HTMLDivElement {
  const group = createElement(options.host, "div", "document-conflict-resolution");
  const title = createElement(options.host, "strong");
  const description = createElement(options.host, "p");
  const actions = createElement(options.host, "div", "document-conflict-actions");
  title.dataset.testid = "conflict-resolution-title";
  title.textContent = options.strings.status.conflictTitle;
  description.textContent = options.strings.status.conflictDescription;
  actions.append(
    conflictActionButton(options, "reload-external", options.strings.status.conflictReloadExternal),
    conflictActionButton(options, "download-local-copy", options.strings.status.conflictDownloadLocal),
    conflictActionButton(options, "retry-save", options.strings.status.conflictRetrySave)
  );
  group.append(title, description, actions);
  return group;
}

function conflictActionButton(
  options: CreateDocumentStatusOptions,
  action: SurfaceConflictResolutionAction,
  label: string
): HTMLButtonElement {
  const button = createElement(options.host, "button", "button secondary document-conflict-action");
  button.type = "button";
  button.dataset.conflictAction = action;
  button.dataset.testid = `conflict-action-${action}`;
  button.textContent = label;
  button.addEventListener("click", () => {
    void options.onResolveConflict?.(action);
  });
  return button;
}

function applyInlineAnchor(root: HTMLElement, anchor: SurfaceInlineAiAnchor | null): void {
  if (!anchor) {
    root.style.removeProperty("--inline-ai-left");
    root.style.removeProperty("--inline-ai-top");
    root.style.removeProperty("--inline-ai-width");
    return;
  }
  root.style.setProperty("--inline-ai-left", `${Math.round(anchor.left)}px`);
  root.style.setProperty("--inline-ai-top", `${Math.round(anchor.top)}px`);
  if (anchor.width !== undefined) {
    root.style.setProperty("--inline-ai-width", `${Math.round(anchor.width)}px`);
  } else {
    root.style.removeProperty("--inline-ai-width");
  }
}

function enabledAiItems(
  options: Pick<CreateSlashMenuOptions, "aiItems" | "preferences">,
  state: SurfaceSlashState,
  entryPoint: string
): readonly SurfaceAiAction[] {
  if (!entryPointEnabled(options.preferences, entryPoint)) {
    return [];
  }
  const query = state.query.trim().toLowerCase();
  return options.aiItems.filter((item) => {
    if (!item.entryPoints.includes(entryPoint)) {
      return false;
    }
    if (!query) {
      return true;
    }
    return `${item.id} ${item.label} ${item.prompt}`.toLowerCase().includes(query);
  });
}

function entryPointEnabled(preferences: SurfacePreferences, entryPoint: string): boolean {
  const aiVisible = preferences.visibleCommandGroups?.includes("ai") ?? true;
  return aiVisible && preferences.aiEntryPoints.includes(entryPoint);
}

function toolbarIcon(options: Pick<SurfaceComponentContext, "icons">, name: IconName): string {
  // IconSet.render is a trusted SVG/HTML boundary documented by @momentarise/md-theme.
  return `<span class="toolbar-icon" aria-hidden="true">${options.icons.render(name)}</span>`;
}

function slashIconName(id: string, group: string): IconName {
  if (id.toLowerCase().includes("heading") || id.toLowerCase().includes("paragraph")) {
    return "heading";
  }
  if (id.toLowerCase().includes("todo")) {
    return "todo";
  }
  if (id.toLowerCase().includes("code")) {
    return "code";
  }
  if (id.toLowerCase().includes("quote") || id.toLowerCase().includes("callout")) {
    return "quote";
  }
  if (id.toLowerCase().includes("image")) {
    return "image";
  }
  if (id.toLowerCase().includes("divider") || id.toLowerCase().includes("rule")) {
    return "divider";
  }
  if (group === "lists") {
    return "list";
  }
  if (group === "insert") {
    return "link";
  }
  return "more";
}

function toolbarIconName(icon: string): IconName {
  const known = new Set<IconName>([
    "ai",
    "bold",
    "check",
    "chevron",
    "close",
    "code",
    "divider",
    "heading",
    "image",
    "italic",
    "link",
    "list",
    "more",
    "quote",
    "save",
    "search",
    "todo"
  ]);
  return known.has(icon as IconName) ? (icon as IconName) : "more";
}

function extensionLabel(strings: MmeStrings, labelKey: string): string {
  const commandKey = labelKey.startsWith("commands.") ? labelKey.slice("commands.".length) : "";
  if (commandKey && commandKey in strings.toolbar) {
    return strings.toolbar[commandKey as keyof MmeStrings["toolbar"]];
  }
  return strings.extensions[labelKey] ?? strings.extensions["extensions.unknown"];
}

function createElement<K extends keyof HTMLElementTagNameMap>(
  host: HTMLElement,
  tag: K,
  className?: string
): HTMLElementTagNameMap[K] {
  const element = host.ownerDocument.createElement(tag);
  if (className) {
    element.className = className;
  }
  return element;
}

function elementTarget(event: Event): HTMLElement | null {
  const target = event.target;
  if (!target || typeof (target as Element).closest !== "function") {
    return null;
  }
  return target as HTMLElement;
}

function visibleButtons(root: HTMLElement): HTMLButtonElement[] {
  return [...root.querySelectorAll<HTMLButtonElement>("button")].filter((button) => !button.hidden && !button.disabled);
}

function setRovingTabIndex(buttons: readonly HTMLElement[], activeIndex: number): void {
  buttons.forEach((button, index) => {
    button.tabIndex = index === activeIndex ? 0 : -1;
  });
}

function trapFocus(root: HTMLElement, event: KeyboardEvent): void {
  const focusable = visibleButtons(root).filter((button) => button.tabIndex >= 0 || button.getAttribute("role") === "option");
  const inputs = [...root.querySelectorAll<HTMLInputElement>("input")].filter((input) => !input.hidden && !input.disabled);
  const ordered: HTMLElement[] = [...inputs, ...focusable];
  if (ordered.length === 0) {
    return;
  }
  const current = root.ownerDocument.activeElement;
  const index = ordered.findIndex((element) => element === current);
  if (index < 0) {
    return;
  }
  event.preventDefault();
  const next = event.shiftKey ? (index - 1 + ordered.length) % ordered.length : (index + 1) % ordered.length;
  ordered[next]?.focus();
}

function escapeText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
