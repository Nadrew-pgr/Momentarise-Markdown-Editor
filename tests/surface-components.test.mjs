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
    toolbarMode: "sticky",
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
      "extensions.hostCalloutCard": "Carte appel hote"
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
const hostToolbarButton = query(toolbarHost, '[data-testid="toolbar-extension-host:callout-card"]');
assert(hostToolbarButton.getAttribute("aria-label") === "Carte appel hote", "Host toolbar labels must come from injected extension strings.");
assert(hostToolbarButton.title === "Carte appel hote", "Host toolbar titles must come from injected extension strings.");
boldButton.click();
assert(toolbarActions.includes("mme:bold"), "Toolbar command click must dispatch through the supplied handler.");
const firstToolbarButton = query(toolbarHost, '[role="toolbar"] button');
firstToolbarButton.dispatchEvent(new dom.window.KeyboardEvent("keydown", { bubbles: true, key: "ArrowRight" }));
assert(
  toolbarHost.querySelectorAll('[role="toolbar"] button')[1]?.getAttribute("tabindex") === "0",
  "Toolbar must support arrow-key roving tabindex."
);

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
  state: {
    items: session.extensions.searchSlashItems("card"),
    open: true,
    query: "card",
    selectedIndex: 0
  }
});
slash.update();
assert(query(slashHost, '[role="listbox"]').getAttribute("aria-label") === defaultMmeStrings.slash.label, "Slash menu must render a labelled listbox.");
assert(
  query(slashHost, '[data-testid="slash-command-item-host:callout-card"] strong').textContent === "Carte appel hote",
  "Slash host labels must come from injected extension strings."
);
query(slashHost, '[data-testid="slash-command-menu"]').dispatchEvent(
  new dom.window.KeyboardEvent("keydown", { bubbles: true, key: "Enter" })
);
assert(slashRuns[0] === "host:callout-card", "Slash Enter must run the selected slash command.");

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
    fileName: "note.md",
    kind: "markdown",
    mode: "fixture",
    pathLabel: "fixture://note.md"
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
    fileName: "conflict.md",
    kind: "markdown",
    mode: "writable-file",
    pathLabel: "disk://conflict.md"
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
    fileName: "conflict.md",
    kind: "markdown",
    mode: "writable-file",
    pathLabel: "disk://conflict.md"
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

toolbar.destroy();
palette.destroy();
gatedPalette.destroy();
slash.destroy();
status.destroy();
aiPanel.destroy();
inlineAiPrompt.destroy();
modeControl.destroy();
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
