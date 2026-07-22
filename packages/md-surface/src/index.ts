import type {
  EditorDocumentKind,
  MarkdownEditorSession,
  SlashItemDefinition,
  ToolbarItemDefinition
} from "@momentarise/md-editor";
import { editorModesForDocumentKind } from "@momentarise/md-editor";
import type { SaveState } from "@momentarise/md-save";
import {
  resolveThemeToCssVariables,
  type IconName,
  type IconSet,
  type MmeScheme,
  type MmeTheme
} from "@momentarise/md-theme";

export interface SurfaceContract {
  readonly packageName: "@momentarise/md-surface";
  readonly contract: "framework-free-dom-surface";
}

export interface SurfaceComponent {
  destroy(): void;
  update(): void;
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
    readonly more: string;
    readonly orderedList: string;
    readonly paragraph: string;
    readonly tableRowAfter: string;
    readonly tableRowBefore: string;
    readonly tableRowDelete: string;
    readonly todo: string;
    readonly toggleBlock: string;
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

export interface SurfaceSelectionBubbleState {
  readonly activeIds?: readonly string[];
  readonly aiDisabled?: boolean;
  readonly aiVisible?: boolean;
  readonly disabledIds?: readonly string[];
  readonly disabledReasons?: Readonly<Record<string, string>>;
  readonly visible: boolean;
}

export interface CreateSelectionBubbleToolbarOptions extends SurfaceComponentContext {
  readonly onAiSelection: () => void | Promise<void>;
  readonly onRunToolbarItem: (id: string) => void | Promise<void>;
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
}

export interface CreateDiagnosticsSurfaceOptions extends SurfaceComponentContext {
  readonly open?: boolean;
}

export const surfaceContract: SurfaceContract = {
  contract: "framework-free-dom-surface",
  packageName: "@momentarise/md-surface"
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
  slash: {
    aiSection: "AI writing",
    emptyPlaceholder: "Type / for commands",
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
    heading3: "H3",
    image: "Image",
    inlineCode: "Inline code",
    italic: "Italic",
    label: "Rich editing toolbar",
    link: "Link",
    more: "More commands",
    orderedList: "Numbered list",
    paragraph: "Paragraph",
    tableRowAfter: "Insert row after",
    tableRowBefore: "Insert row before",
    tableRowDelete: "Delete row",
    todo: "Todo",
    toggleBlock: "Toggle block"
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
  { group: "marks", icon: "code", id: "mme:inlineCode", richCommand: "inlineCode", title: "inlineCode" }
] as const;

const selectionBubbleCommands: readonly ToolbarCommandDefinition[] = [
  { group: "marks", icon: "bold", id: "mme:bold", richCommand: "bold", testId: "selection-bubble-bold", title: "bold" },
  { group: "marks", icon: "italic", id: "mme:italic", richCommand: "italic", testId: "selection-bubble-italic", title: "italic" },
  { group: "marks", icon: "code", id: "mme:inlineCode", richCommand: "inlineCode", testId: "selection-bubble-inline-code", title: "inlineCode" }
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
  options.host.replaceChildren(root);

  const setMoreOpen = (open: boolean): void => {
    moreOpen = open;
    const button = root.querySelector<HTMLElement>('[data-testid="toolbar-more-button"]');
    const menu = root.querySelector<HTMLElement>('[data-testid="toolbar-more-menu"]');
    button?.setAttribute("aria-expanded", String(moreOpen));
    if (menu) {
      menu.hidden = !moreOpen;
      if (moreOpen && button) {
        positionToolbarMoreMenu(button, menu);
      }
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
    root.replaceChildren(
      ...toolbarCommands.filter((command) => toolbarCommandVisible(options.preferences, command.group)).map((command, index) => toolbarButton(options, state, command, index === 0)),
      aiToolbarButton(options),
      ...hostToolbarButtons(options, state),
      toolbarMore(options, state, moreOpen)
    );
    setMoreOpen(moreOpen);
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
  cleanups.push(options.session.on("destroy", () => destroy()));
  cleanups.push(() => root.removeEventListener("click", onClick));
  cleanups.push(() => root.removeEventListener("keydown", onKeyDown));
  update();

  const destroy = (): void => {
    for (const cleanup of cleanups.splice(0)) {
      cleanup();
    }
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
  if (ownsRoot) {
    options.host.replaceChildren(root);
  }

  const render = (): void => {
    root.className = "selection-bubble-toolbar";
    root.dataset.testid = "selection-bubble-toolbar";
    root.dataset.layoutDensity = options.preferences.layoutDensity ?? "comfortable";
    root.hidden = !state.visible;
    root.setAttribute("aria-label", options.strings.toolbar.label);
    root.setAttribute("role", "toolbar");
    root.replaceChildren(
      ...selectionBubbleCommands
        .filter((command) => toolbarCommandVisible(options.preferences, command.group))
        .map((command, index) => selectionBubbleButton(options, state, command, index === 0)),
      selectionBubbleAiButton(options, state)
    );
  };

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
    const command = target.closest<HTMLElement>("[data-toolbar-command-id]");
    if (command?.dataset.toolbarCommandId) {
      void options.onRunToolbarItem(command.dataset.toolbarCommandId);
    }
  };

  const onKeyDown = (event: KeyboardEvent): void => {
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
  cleanups.push(options.session.on("destroy", () => destroy()));
  cleanups.push(() => root.removeEventListener("click", onClick));
  cleanups.push(() => root.removeEventListener("keydown", onKeyDown));
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
    root.replaceChildren(...surfaceModesForDocumentKind(state.documentKind).map((mode) => modeButton(options, state, mode)));
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
  button.tabIndex = roving ? 0 : -1;
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
  command: ToolbarCommandDefinition,
  roving: boolean
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
  button.tabIndex = roving ? 0 : -1;
  if (command.icon) {
    button.innerHTML = toolbarIcon(options, command.icon);
  }
  return button;
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

function toolbarMore(options: CreateToolbarOptions, state: SurfaceToolbarState, open: boolean): HTMLDivElement {
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
      item.disabled = disabled;
      item.dataset.richCommand = command.richCommand;
      item.dataset.toolbarCommandId = command.id;
      item.setAttribute("aria-pressed", String(commandActive(state, command.id)));
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
  container.append(button, menu);
  return container;
}

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

function modeCycleButton(options: CreateModeControlOptions, state: SurfaceModeControlState): HTMLButtonElement {
  const modes = surfaceModesForDocumentKind(state.documentKind);
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

function setRovingTabIndex(buttons: readonly HTMLButtonElement[], activeIndex: number): void {
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
