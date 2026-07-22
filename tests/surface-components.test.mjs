import { readFileSync } from "node:fs";
import { createMemorySaveTarget } from "../packages/md-save/dist/index.js";
import { createMarkdownEditorSession } from "../packages/md-editor/dist/index.js";

const surface = await import("../packages/md-surface/dist/index.js");
const { JSDOM } = await import("jsdom");

const {
  createAiAssistantPanel,
  createCommandPalette,
  createDocumentStatus,
  createInlineAiPrompt,
  createModeControl,
  createSelectionBubbleToolbar,
  createSlashMenu,
  createToolbar,
  defaultMmeStrings
} = surface;

for (const exportName of [
  "createToolbar",
  "createSlashMenu",
  "createCommandPalette",
  "createDocumentStatus",
  "createAiAssistantPanel",
  "createInlineAiPrompt",
  "createModeControl",
  "createSelectionBubbleToolbar",
  "createDiagnosticsSurface",
  "defaultMmeStrings"
]) {
  assert(exportName in surface, `@momentarise/md-surface must export ${exportName}.`);
}

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
assert(packageJson.scripts["test:surface"] === "npm run build && node tests/surface-components.test.mjs", "Missing test:surface script.");
assert(packageJson.scripts.test.includes("test:surface"), "Root npm test must include surface component checks.");

const packageManifest = JSON.parse(readFileSync("packages/md-surface/package.json", "utf8"));
assert(packageManifest.name === "@momentarise/md-surface", "md-surface package manifest must use the public package name.");
assert(packageManifest.sideEffects === false, "md-surface must be tree-shakeable and have no import-time DOM side effects.");

const source = readFileSync("packages/md-surface/src/index.ts", "utf8");
for (const forbidden of ["document.querySelector", "window.", "localStorage", "sessionStorage", "react", "@theia/", "vscode"]) {
  assert(!source.includes(forbidden), `md-surface must not use forbidden host/global dependency: ${forbidden}`);
}

const dom = new JSDOM("<!doctype html><html><body></body></html>");
const document = dom.window.document;
const session = createMarkdownEditorSession({
  content: "# Surface\n",
  scheduler: createManualScheduler(),
  target: createMemorySaveTarget({
    initialContent: "# Surface\n"
  })
});
session.extensions.registerToolbarItem({
  group: "insert",
  icon: "more",
  id: "host:callout-card",
  labelKey: "extensions.hostCalloutCard",
  run() {
    return { handled: true };
  }
});
session.extensions.registerToolbarItem({
  group: "insert",
  icon: "more",
  id: "vendor:diagram",
  labelKey: "extensions.vendorDiagram",
  run() {
    return { handled: true };
  }
});
session.extensions.registerSlashItem({
  aliases: ["card", "callout-card"],
  group: "insert",
  id: "host:callout-card",
  labelKey: "extensions.hostCalloutCard",
  run() {
    return { handled: true };
  }
});

const baseContext = {
  host: document.createElement("div"),
  icons: {
    render(name) {
      return `<span data-icon="${name}" aria-hidden="true"></span>`;
    }
  },
  preferences: {
    aiEntryPoints: ["slash", "toolbar", "selection", "command-palette"],
    layoutDensity: "comfortable",
    modeControl: "compact-tabs",
    slashEnabled: true,
    slashGroups: ["blocks", "lists", "insert", "ai"],
    toolbarMode: "sticky",
    toolbarStyle: "glass",
    visibleCommandGroups: ["blocks", "marks", "lists", "insert", "ai", "status"]
  },
  session,
  strings: {
    ...defaultMmeStrings,
    toolbar: {
      ...defaultMmeStrings.toolbar,
      bold: "Gras test"
    },
    extensions: {
      ...defaultMmeStrings.extensions,
      "extensions.hostCalloutCard": "Carte appel hote",
      "extensions.vendorDiagram": "Diagramme fournisseur"
    }
  }
};

const toolbarHost = document.createElement("div");
const toolbarActions = [];
const toolbar = createToolbar({
  ...baseContext,
  host: toolbarHost,
  onAiToolbar() {
    toolbarActions.push("ai");
  },
  onRunToolbarItem(id) {
    toolbarActions.push(id);
  },
  state: {
    activeIds: ["mme:bold"],
    disabledIds: ["mme:link"],
    editorMode: "rich",
    hostToolbarItems: session.extensions.getToolbarItems(),
    visible: true
  }
});
toolbar.update();
assert(toolbarHost.querySelector('[role="toolbar"]'), "Toolbar must render role=toolbar.");
const boldButton = query(toolbarHost, '[data-testid="toolbar-command-bold"]');
assert(boldButton.getAttribute("aria-label") === "Gras test", "Toolbar labels must come from injected strings.");
assert(boldButton.title === "Gras test", "Toolbar title must come from injected strings.");
assert(boldButton.getAttribute("aria-pressed") === "true", "Toolbar active ids must render active pressed state.");
assert(query(toolbarHost, '[data-testid="toolbar-command-link"]').disabled, "Toolbar disabled ids must render disabled buttons.");
const hostToolbarButton = query(toolbarHost, '[data-testid="toolbar-extension-host:callout-card"]');
assert(hostToolbarButton.getAttribute("aria-label") === "Carte appel hote", "Host toolbar labels must come from injected extension strings.");
assert(hostToolbarButton.title === "Carte appel hote", "Host toolbar titles must come from injected extension strings.");
assert(query(toolbarHost, '[data-testid="toolbar-extension-vendor:diagram"]'), "Toolbar must render non-host namespace registry items supplied by the host state.");
assert(toolbarHost.querySelectorAll('[data-testid="toolbar-command-heading1"]').length === 1, "Toolbar must not duplicate built-in registry items as extension buttons.");
boldButton.click();
assert(toolbarActions.includes("mme:bold"), "Toolbar command click must dispatch through the supplied handler.");
const firstToolbarButton = query(toolbarHost, '[role="toolbar"] button');
firstToolbarButton.dispatchEvent(new dom.window.KeyboardEvent("keydown", { bubbles: true, key: "ArrowRight" }));
assert(
  toolbarHost.querySelectorAll('[role="toolbar"] button')[1]?.getAttribute("tabindex") === "0",
  "Toolbar must support arrow-key roving tabindex."
);
toolbar.setState({
  activeIds: [],
  disabledIds: [],
  editorMode: "rich",
  hostToolbarItems: session.extensions.getToolbarItems(),
  visible: true
});
assert(query(toolbarHost, '[data-testid="toolbar-command-bold"]').getAttribute("aria-pressed") === "false", "Toolbar active state must update.");
toolbar.setMoreOpen(true);
const toolbarMoreMenu = query(toolbarHost, '[data-testid="toolbar-more-menu"]');
assert(!toolbarMoreMenu.hidden, "Toolbar More menu must open.");
assert(toolbarMoreMenu.style.position === "fixed", "Toolbar More menu must escape horizontally scrolling toolbar clipping.");
assert(toolbarMoreMenu.style.left && toolbarMoreMenu.style.top, "Toolbar More menu must receive viewport coordinates.");
assert(query(toolbarHost, '[data-toolbar-command-id="mme:tableRowBefore"]').textContent === "Insert row before", "Toolbar More menu must expose insert-row-before.");
assert(query(toolbarHost, '[data-toolbar-command-id="mme:tableRowAfter"]').textContent === "Insert row after", "Toolbar More menu must expose insert-row-after.");
assert(query(toolbarHost, '[data-toolbar-command-id="mme:tableRowDelete"]').textContent === "Delete row", "Toolbar More menu must expose delete-row.");
Object.defineProperty(toolbarMoreMenu, "offsetHeight", { configurable: true, value: 240 });
query(toolbarHost, '[data-testid="toolbar-more-button"]').getBoundingClientRect = () => ({
  bottom: 760,
  height: 32,
  left: 700,
  right: 732,
  top: 728,
  width: 32,
  x: 700,
  y: 728,
  toJSON() { return this; }
});
toolbar.setMoreOpen(true);
assert(Number.parseFloat(toolbarMoreMenu.style.top) < 728, "Toolbar More menu must flip above a bottom-edge trigger.");

const groupedToolbarHost = document.createElement("div");
const groupedToolbar = createToolbar({
  ...baseContext,
  host: groupedToolbarHost,
  onAiToolbar() {
    throw new Error("Filtered toolbar AI action must not run.");
  },
  onRunToolbarItem() {
    throw new Error("Filtered toolbar command must not run.");
  },
  preferences: {
    ...baseContext.preferences,
    visibleCommandGroups: ["marks"]
  },
  state: {
    editorMode: "rich",
    hostToolbarItems: session.extensions.getToolbarItems(),
    visible: true
  }
});
assert(query(groupedToolbarHost, '[data-testid="toolbar-command-bold"]'), "Toolbar group preferences must keep visible mark commands.");
assert(!groupedToolbarHost.querySelector('[data-testid="toolbar-command-heading1"]'), "Toolbar group preferences must hide non-visible groups.");

const paletteHost = document.createElement("div");
const paletteRuns = [];
const opener = document.createElement("button");
document.body.append(opener);
const palette = createCommandPalette({
  ...baseContext,
  actions: [
    {
      entryPoints: ["command-palette"],
      id: "continue",
      label: "Continue",
      prompt: "Continue section"
    },
    {
      entryPoints: ["command-palette"],
      id: "summarize",
      label: "Summarize",
      prompt: "Summarize document"
    }
  ],
  host: paletteHost,
  onRunAiAction(id) {
    paletteRuns.push(id);
  },
  returnFocusTo: opener
});
assert(palette.open(), "Command palette must open when command-palette AI entry point is enabled.");
assert(query(paletteHost, '[role="dialog"]').getAttribute("aria-modal") === "true", "Palette must render as a modal dialog.");
const paletteList = query(paletteHost, '[role="listbox"]');
assert(paletteList.getAttribute("aria-activedescendant"), "Palette listbox must expose aria-activedescendant.");
query(paletteHost, "[data-testid='command-palette-input']").dispatchEvent(
  new dom.window.KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown" })
);
query(paletteHost, "[data-testid='command-palette-input']").dispatchEvent(
  new dom.window.KeyboardEvent("keydown", { bubbles: true, key: "Enter" })
);
assert(paletteRuns[0] === "summarize", "Palette keyboard navigation must execute the active item.");
assert(query(paletteHost, "[data-testid='command-palette']").hidden, "Palette must close after executing an action.");

const gatedPaletteHost = document.createElement("div");
const gatedPalette = createCommandPalette({
  ...baseContext,
  actions: [{ entryPoints: ["command-palette"], id: "continue", label: "Continue", prompt: "Continue section" }],
  host: gatedPaletteHost,
  preferences: { ...baseContext.preferences, aiEntryPoints: ["toolbar"] },
  onRunAiAction() {
    throw new Error("Disabled command-palette entry point must not run.");
  }
});
assert(!gatedPalette.open(), "Command palette must respect AI entry-point preferences.");

const slashHost = document.createElement("div");
const slashRuns = [];
const slash = createSlashMenu({
  ...baseContext,
  aiItems: [{ entryPoints: ["slash"], id: "continue", label: "Continue", prompt: "Continue section" }],
  host: slashHost,
  onClose() {
    slashRuns.push("closed");
  },
  onRunAiAction(id) {
    slashRuns.push(id);
  },
  onRunSlashItem(id) {
    slashRuns.push(id);
  },
  preferences: {
    ...baseContext.preferences,
    visibleCommandGroups: ["insert", "ai"]
  },
  state: {
    items: session.extensions.searchSlashItems("card"),
    open: true,
    query: "card",
    selectedIndex: 0
  }
});
slash.update();
assert(query(slashHost, '[role="listbox"]').getAttribute("aria-label") === defaultMmeStrings.slash.label, "Slash menu must render a labelled listbox.");
assert(query(slashHost, "[data-testid='slash-command-menu']").getAttribute("aria-activedescendant"), "Slash menu must expose aria-activedescendant on the listbox owner.");
assert(
  query(slashHost, '[data-testid="slash-command-item-host:callout-card"] strong').textContent === "Carte appel hote",
  "Slash host labels must come from injected extension strings."
);
query(slashHost, '[data-testid="slash-command-menu"]').dispatchEvent(
  new dom.window.KeyboardEvent("keydown", { bubbles: true, key: "Enter" })
);
assert(slashRuns[0] === "host:callout-card", "Slash Enter must run the selected slash command.");
slash.setState({
  items: [
    {
      aliases: ["heading", "h1"],
      group: "blocks",
      id: "mme:heading1",
      labelKey: "commands.heading1",
      run() {
        return { handled: true };
      }
    },
    {
      aliases: ["card"],
      group: "insert",
      id: "host:callout-card",
      labelKey: "extensions.hostCalloutCard",
      run() {
        return { handled: true };
      }
    }
  ],
  open: true,
  query: "card",
  selectedIndex: 0
});
assert(query(slashHost, "[data-testid='slash-section-insert']").textContent === "Insert", "Slash menu must render grouped section labels from strings.");
assert(!slashHost.querySelector("[data-testid='slash-command-item-mme:heading1']"), "Slash menu must respect visible command group preferences.");
query(slashHost, '[data-testid="slash-command-menu"]').dispatchEvent(
  new dom.window.KeyboardEvent("keydown", { bubbles: true, key: "End" })
);
assert(slashHost.querySelector("[data-selected='true']"), "Slash End key must keep a selected command.");
slash.setState({
  items: [],
  open: true,
  query: "missing",
  selectedIndex: 0
});
assert(query(slashHost, "[data-testid='slash-empty-state']").textContent.includes("No commands"), "Slash menu must render an empty state.");

const disabledSlashHost = document.createElement("div");
const disabledSlash = createSlashMenu({
  ...baseContext,
  aiItems: [],
  host: disabledSlashHost,
  onClose() {},
  onRunAiAction() {
    throw new Error("Disabled slash AI must not run.");
  },
  onRunSlashItem() {
    throw new Error("Disabled slash command must not run.");
  },
  preferences: {
    ...baseContext.preferences,
    slashEnabled: false
  },
  state: {
    items: session.extensions.getSlashItems(),
    open: true,
    query: "",
    selectedIndex: 0
  }
});
assert(query(disabledSlashHost, "[data-testid='slash-command-menu']").hidden, "Slash menu must respect slash.enabled preferences.");

const statusHost = document.createElement("div");
const statusSession = createMarkdownEditorSession({
  content: "# Status\n",
  scheduler: createManualScheduler(),
  target: createMemorySaveTarget({
    initialContent: "# Status\n"
  })
});
const status = createDocumentStatus({
  ...baseContext,
  document: {
    adapterKind: "memory",
    fileName: "note.md",
    kind: "markdown",
    mode: "fixture",
    pathLabel: "fixture://note.md",
    writable: false
  },
  host: statusHost,
  onPrimaryAction() {
    toolbarActions.push("save");
  },
  saveState: statusSession.getSaveState(),
  session: statusSession
});
status.update();
assert(query(statusHost, "[data-testid='document-name']").textContent === "note.md", "Status popover must render the current document name.");
assert(query(statusHost, "[data-testid='memory-save-button']").textContent === defaultMmeStrings.status.primarySave, "Primary status action must use strings.");
assert(query(statusHost, "[data-testid='document-status-popover'] summary").getAttribute("aria-expanded") === "false", "Status popover must expose disclosure aria state.");
assert(query(statusHost, "[data-testid='document-adapter']").textContent === "memory", "Status details must expose the adapter kind.");
assert(query(statusHost, "[data-testid='document-writable']").textContent === "no", "Status details must expose writability.");
assert(query(statusHost, "[data-testid='document-last-saved']").textContent !== "never", "Status details must expose the last saved timestamp.");
assert(query(statusHost, "[data-testid='save-details']").textContent.includes("memory-only"), "Status details must expose save target details.");
statusSession.setContent("# Status\n\nDirty edit.\n", "source-view");
assert(query(statusHost, "[data-testid='dirty-state']").textContent === "dirty", "Status popover must update from save-state event payload.");

const conflictTarget = createMemorySaveTarget({
  initialContent: "# Conflict\n",
  targetLabel: "disk://conflict.md"
});
const conflictSession = createMarkdownEditorSession({
  content: "# Conflict\n",
  scheduler: createManualScheduler(),
  target: conflictTarget
});
conflictSession.setContent("# Conflict\n\nLocal edit.\n", "source-view");
conflictTarget.simulateExternalChange("# Conflict\n\nExternal edit.\n");
await conflictSession.flush("manual");
const conflictActions = [];
const conflictNoResolverHost = document.createElement("div");
createDocumentStatus({
  ...baseContext,
  document: {
    adapterKind: "browser-file-system",
    fileName: "conflict.md",
    kind: "markdown",
    mode: "writable-file",
    pathLabel: "disk://conflict.md",
    writable: true
  },
  host: conflictNoResolverHost,
  onPrimaryAction() {
    conflictActions.push("primary");
  },
  saveState: conflictSession.getSaveState(),
  session: conflictSession
});
assert(
  !conflictNoResolverHost.querySelector("[data-testid='conflict-action-reload-external']"),
  "Conflict actions must not render when the host does not provide a resolver."
);
const conflictHost = document.createElement("div");
createDocumentStatus({
  ...baseContext,
  document: {
    adapterKind: "browser-file-system",
    fileName: "conflict.md",
    kind: "markdown",
    mode: "writable-file",
    pathLabel: "disk://conflict.md",
    writable: true
  },
  host: conflictHost,
  onPrimaryAction() {
    conflictActions.push("primary");
  },
  onResolveConflict(action) {
    conflictActions.push(action);
  },
  saveState: conflictSession.getSaveState(),
  session: conflictSession
});
assert(
  query(conflictHost, "[data-testid='conflict-resolution-title']").textContent === defaultMmeStrings.status.conflictTitle,
  "Conflict status menu must render a resolution section."
);
query(conflictHost, "[data-testid='conflict-action-reload-external']").click();
assert(conflictActions[0] === "reload-external", "Conflict reload action must dispatch through the status surface.");
query(conflictHost, "[data-testid='conflict-action-download-local-copy']").click();
query(conflictHost, "[data-testid='conflict-action-retry-save']").click();
assert(
  conflictActions.join(",") === "reload-external,download-local-copy,retry-save",
  "All explicit conflict actions must dispatch in a stable order."
);
assert(
  !conflictHost.querySelector("[data-testid='conflict-action-dismiss']"),
  "Conflict status must not expose a vague dismiss action."
);

const aiHost = document.createElement("div");
const aiEvents = [];
const aiPanel = createAiAssistantPanel({
  ...baseContext,
  host: aiHost,
  onAccept() {
    aiEvents.push("accept");
  },
  onClose() {
    aiEvents.push("close");
  },
  onReject() {
    aiEvents.push("reject");
  },
  onStartSession(key) {
    aiEvents.push(`session:${key}`);
  },
  state: {
    hasSession: false,
    pending: null,
    statusText: "No AI session"
  }
});
aiPanel.update();
assert(query(aiHost, "[data-testid='editor-ai-assistant-panel']").getAttribute("role") === "dialog", "AI assistant must render as a dialog.");
query(aiHost, "[data-testid='editor-ai-byok-key-input']").value = "demo-key";
query(aiHost, "[data-testid='editor-ai-start-session-button']").click();
assert(aiEvents.includes("session:demo-key"), "AI panel must expose session-start events without persisting the key.");

const inlineAiHost = document.createElement("div");
const inlineReturnFocus = document.createElement("button");
document.body.append(inlineAiHost, inlineReturnFocus);
const inlineEvents = [];
const inlineAiPrompt = createInlineAiPrompt({
  ...baseContext,
  actions: [
    {
      entryPoints: ["slash", "toolbar", "command-palette"],
      id: "continue",
      label: "Continue writing",
      prompt: "Continue this Markdown section."
    },
    {
      entryPoints: ["slash", "toolbar"],
      id: "draft",
      label: "Draft section",
      prompt: "Draft a useful Markdown section."
    }
  ],
  host: inlineAiHost,
  onClose() {
    inlineEvents.push(["close"]);
  },
  onSubmit(event) {
    inlineEvents.push(["submit", event.actionId ?? null, event.prompt]);
  },
  returnFocusTo: inlineReturnFocus,
  state: {
    anchor: {
      left: 24,
      top: 72,
      width: 420
    },
    open: true,
    pending: null,
    prompt: "",
    provider: {
      kind: "mock",
      label: "Mock/offline demo provider",
      description: "Runs locally for demo proof.",
      canSubmit: true
    },
    selectedActionIndex: 0,
    statusText: "Mock/offline demo ready"
  }
});
inlineAiPrompt.update();
const inlineRoot = query(inlineAiHost, "[data-testid='inline-ai-prompt']");
assert(inlineRoot.getAttribute("role") === "dialog", "Inline AI prompt must render as a dialog.");
assert(document.activeElement === query(inlineAiHost, "[data-testid='inline-ai-prompt-input']"), "Inline AI prompt input must be focused by default.");
assert(query(inlineAiHost, "[data-testid='inline-ai-provider-state']").textContent.includes("Mock/offline"), "Inline AI prompt must show explicit provider state.");
assert(query(inlineAiHost, "[data-testid='inline-ai-action-continue']").getAttribute("role") === "option", "Inline AI action rows must be keyboard addressable options.");
const inlinePromptInput = query(inlineAiHost, "[data-testid='inline-ai-prompt-input']");
inlinePromptInput.value = "Write the next concrete paragraph.";
inlinePromptInput.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
inlinePromptInput.dispatchEvent(
  new dom.window.KeyboardEvent("keydown", { bubbles: true, key: "Enter", metaKey: true })
);
assert(
  inlineEvents.some(([event, actionId, prompt]) => event === "submit" && actionId === null && prompt === "Write the next concrete paragraph."),
  "Cmd-Enter from the prompt must submit arbitrary user text."
);
query(inlineAiHost, "[data-testid='inline-ai-prompt-input']").dispatchEvent(
  new dom.window.KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown" })
);
assert(query(inlineAiHost, "[data-testid='inline-ai-action-draft']").getAttribute("data-selected") === "true", "ArrowDown must rove inline AI action selection.");
const inlineDraftAction = query(inlineAiHost, "[data-testid='inline-ai-action-draft']");
inlineDraftAction.focus();
inlineDraftAction.dispatchEvent(
  new dom.window.KeyboardEvent("keydown", { bubbles: true, key: "ArrowUp" })
);
assert(document.activeElement === query(inlineAiHost, "[data-testid='inline-ai-action-continue']"), "Arrow navigation between inline AI actions must preserve focus.");
query(inlineAiHost, "[data-testid='inline-ai-action-draft']").dispatchEvent(
  new dom.window.KeyboardEvent("keydown", { bubbles: true, key: "Enter" })
);
assert(inlineEvents.some(([event, actionId]) => event === "submit" && actionId === "draft"), "Enter on an action row must submit that AI action.");
inlineAiPrompt.setState({
  anchor: {
    left: 24,
    top: 72,
    width: 420
  },
  open: true,
  pending: null,
  prompt: "",
  provider: {
    kind: "missing",
    label: "Missing provider",
    description: "Configure a host-managed provider before sending document content.",
    canSubmit: false
  },
  selectedActionIndex: 0,
  statusText: "Missing provider"
});
assert(query(inlineAiHost, "[data-testid='inline-ai-generate-button']").disabled, "Missing provider state must disable prompt submission.");
query(inlineAiHost, "[data-testid='inline-ai-generate-button']").focus();
query(inlineAiHost, "[data-testid='inline-ai-generate-button']").dispatchEvent(
  new dom.window.KeyboardEvent("keydown", { bubbles: true, key: "Escape" })
);
assert(query(inlineAiHost, "[data-testid='inline-ai-prompt']").hidden, "Escape must close inline AI prompt.");
assert(document.activeElement === inlineReturnFocus, "Escape must return focus to the configured editor target.");

const bubbleHost = document.createElement("div");
const bubbleRuns = [];
const bubble = createSelectionBubbleToolbar({
  ...baseContext,
  host: bubbleHost,
  onAiSelection() {
    bubbleRuns.push("ai");
  },
  onRunToolbarItem(id) {
    bubbleRuns.push(id);
  },
  state: {
    activeIds: ["mme:bold"],
    aiDisabled: true,
    aiVisible: true,
    disabledIds: ["mme:inlineCode"],
    visible: true
  }
});
assert(query(bubbleHost, "[data-testid='selection-bubble-toolbar']").getAttribute("role") === "toolbar", "Selection bubble toolbar must be reusable surface chrome.");
assert(query(bubbleHost, "[data-testid='selection-bubble-bold']").getAttribute("aria-pressed") === "true", "Selection bubble must show active mark state.");
assert(query(bubbleHost, "[data-testid='selection-bubble-inline-code']").disabled, "Selection bubble must show disabled command state.");
assert(query(bubbleHost, "[data-testid='selected-text-ai-bubble-action']").disabled, "Selection bubble AI action must respect disabled state.");
query(bubbleHost, "[data-testid='selection-bubble-bold']").click();
assert(bubbleRuns.includes("mme:bold"), "Selection bubble command click must dispatch through surface handler.");

const modeHost = document.createElement("div");
const modeEvents = [];
const modeControl = createModeControl({
  ...baseContext,
  host: modeHost,
  onSwitchMode(mode) {
    modeEvents.push(mode);
  },
  state: {
    documentKind: "markdown",
    editorMode: "source"
  }
});
modeControl.update();
assert(query(modeHost, "[data-testid='source-mode-button']").textContent === "Source", "Mode control must expose Source as a visible mode.");
assert(query(modeHost, "[data-testid='source-mode-button']").getAttribute("role") !== "switch", "Mode control must not expose binary switch semantics for three Markdown modes.");
query(modeHost, "[data-testid='rich-mode-button']").click();
assert(modeEvents[0] === "rich", "Mode control must emit rich-mode switch events.");
modeControl.setState({
  documentKind: "html-artifact",
  editorMode: "source"
});
assert(query(modeHost, "[data-testid='preview-mode-button']"), "HTML mode control must expose Preview.");
assert(!modeHost.querySelector("[data-testid='rich-mode-button']"), "HTML mode control must not expose Rich.");
modeControl.setState({
  documentKind: "svg-artifact",
  editorMode: "source"
});
assert(query(modeHost, "[data-testid='source-mode-button']"), "SVG mode control must expose Source.");
assert(query(modeHost, "[data-testid='preview-mode-button']"), "SVG mode control must expose Preview.");
assert(!modeHost.querySelector("[data-testid='rich-mode-button']"), "SVG mode control must not expose Rich.");
assert(!modeHost.querySelector("[data-testid='live-preview-mode-button']"), "SVG mode control must not expose Live Preview.");

const singleModeHost = document.createElement("div");
const singleModeEvents = [];
const singleModeControl = createModeControl({
  ...baseContext,
  host: singleModeHost,
  onSwitchMode(mode) {
    singleModeEvents.push(mode);
  },
  preferences: {
    ...baseContext.preferences,
    modeControl: "single-toggle"
  },
  state: {
    documentKind: "markdown",
    editorMode: "source"
  }
});
query(singleModeHost, "[data-testid='mode-cycle-button']").click();
assert(singleModeEvents[0] === "rich", "Single-toggle mode control must cycle through document-kind modes.");

const hostModeHost = document.createElement("div");
const hostModeControl = createModeControl({
  ...baseContext,
  host: hostModeHost,
  onSwitchMode() {
    throw new Error("Host-provided mode control must not emit builtin events.");
  },
  preferences: {
    ...baseContext.preferences,
    modeControl: "host-provided"
  },
  state: {
    documentKind: "markdown",
    editorMode: "source"
  }
});
assert(query(hostModeHost, "[data-testid='mode-control']").hidden, "Host-provided mode control preference must hide builtin control.");

toolbar.destroy();
groupedToolbar.destroy();
palette.destroy();
gatedPalette.destroy();
slash.destroy();
disabledSlash.destroy();
status.destroy();
aiPanel.destroy();
inlineAiPrompt.destroy();
bubble.destroy();
modeControl.destroy();
singleModeControl.destroy();
hostModeControl.destroy();
session.destroy();

function query(root, selector) {
  const element = root.querySelector(selector);
  if (!element) {
    throw new Error(`Missing element: ${selector}`);
  }
  return element;
}

function createManualScheduler() {
  const queued = new Set();
  return {
    flush() {
      for (const callback of [...queued]) {
        queued.delete(callback);
        void callback();
      }
    },
    schedule(callback) {
      queued.add(callback);
      return () => {
        queued.delete(callback);
      };
    }
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
