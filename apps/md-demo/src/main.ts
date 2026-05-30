import { EditorState } from "@codemirror/state";
import { EditorView as CodeMirrorEditorView } from "@codemirror/view";
import {
  createMarkdownAstFormatter,
  roundTripMarkdown,
  type FixtureRoundTripResult,
  type FrontmatterRecord,
  type ParseResult
} from "@momentarise/md-format";
import {
  createMemorySaveTarget,
  createSaveEngine,
  persistenceTargetLabel,
  type SaveEngine,
  type SaveFlushReason,
  type SaveState,
  type SaveTarget
} from "@momentarise/md-save";
import {
  canUseFileSystemAccess,
  createImportedCopyDocument,
  createWritableFileSaveTarget,
  detectMarkdownLineEnding,
  normalizeMarkdownLineEndings,
  openWritableMarkdownFile,
  type WebFileHandleLike,
  type WebOpenedMarkdownFile,
  type WebOpenedMarkdownMode
} from "@momentarise/md-adapter-web";
import {
  createRichMarkdownState,
  serializeRichMarkdownState,
  type RichMarkdownState
} from "@momentarise/md-rich-prosemirror";
import { createMomentariseSourceExtensions } from "@momentarise/md-source-codemirror";
import { TextSelection } from "prosemirror-state";
import { EditorView as ProseMirrorEditorView } from "prosemirror-view";
import "./styles.css";

const fixtureMarkdown = `---
title: Source Mode Fixture
mode: demo
---

# Momentarise source mode

This built-in fixture is memory-only and not written to disk.

- Write Markdown
- Continue lists
- [ ] Continue todos

\`\`\`ts
const canonical = "Markdown";
\`\`\`
`;

const app = queryRequired<HTMLDivElement>("#app");

app.innerHTML = `
  <main class="shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">Momentarise Markdown Editor</p>
        <h1>Markdown editor demo</h1>
      </div>
      <div class="topbar-actions" aria-label="Document actions">
        <button class="button secondary" type="button" data-testid="open-local-file-button">Open .md</button>
        <button class="button secondary" type="button" data-testid="import-copy-button">Import copy</button>
        <input class="file-input" type="file" accept=".md,.markdown,.mdown,.txt,text/markdown,text/plain" data-testid="import-copy-input" />
        <button class="button secondary" type="button" data-testid="copy-button">Copy</button>
        <button class="button secondary" type="button" data-testid="download-button">Download</button>
        <button class="button secondary" type="button" data-testid="simulate-conflict-button">Simulate conflict</button>
        <button class="button primary" type="button" data-testid="memory-save-button">Save</button>
      </div>
    </header>

    <section class="workspace" aria-label="Markdown source workspace">
      <div class="editor-region">
        <div class="document-strip" aria-label="Document metadata">
          <span data-testid="document-name">source-mode-fixture.md</span>
          <span data-testid="document-path">fixture://source-mode-fixture.md</span>
          <span class="target-label" data-testid="persistence-target">memory only, not persisted</span>
        </div>
        <div class="mode-switch" role="group" aria-label="Editor mode">
          <button class="mode-button" type="button" data-testid="source-mode-button">Source</button>
          <button class="mode-button" type="button" data-testid="rich-mode-button">Rich</button>
        </div>
        <div class="editor-host" data-editor-host data-testid="editor-host"></div>
        <div class="rich-editor-host" data-testid="rich-editor-host" hidden></div>
      </div>

      <aside class="inspector" aria-label="Document status">
        <section class="status-block">
          <p class="label">Persistence</p>
          <p class="status-value" data-testid="save-state">memory saved (not persisted)</p>
        </section>
        <section class="status-block">
          <p class="label">Dirty state</p>
          <p class="status-value" data-testid="dirty-state">clean</p>
        </section>
        <section class="status-block properties-panel" data-testid="properties-panel">
          <div class="properties-header">
            <p class="label">Properties</p>
            <div class="properties-controls" role="group" aria-label="Properties display mode">
              <button class="property-mode" type="button" data-testid="properties-mode-visible">List</button>
              <button class="property-mode" type="button" data-testid="properties-mode-hidden">Hide</button>
              <button class="property-mode" type="button" data-testid="properties-mode-source">YAML</button>
            </div>
          </div>
          <dl class="frontmatter-list" data-testid="frontmatter-list" aria-live="polite"></dl>
          <pre class="frontmatter-source" data-testid="frontmatter-source" hidden></pre>
          <p class="properties-hidden-state" data-testid="properties-hidden-state" hidden>
            Properties hidden. Raw YAML remains visible in source mode.
          </p>
        </section>
        <section class="status-block">
          <p class="label">Save Engine</p>
          <div class="status-lines" data-testid="save-engine-status">
            <p><span>Mode</span><strong data-testid="document-mode">fixture</strong></p>
            <p><span>Target</span><strong data-testid="save-engine-target">memory-only</strong></p>
            <p><span>Status</span><strong data-testid="save-engine-state">memory saved</strong></p>
            <p><span>Current</span><strong data-testid="save-engine-current-hash">pending</strong></p>
            <p><span>Last saved</span><strong data-testid="save-engine-last-saved-hash">pending</strong></p>
            <p><span>External</span><strong data-testid="save-engine-external-hash">none</strong></p>
            <p><span>Last action</span><strong data-testid="save-engine-last-action">loaded fixture</strong></p>
          </div>
        </section>
        <section class="status-block">
          <p class="label">Editor surface</p>
          <p class="status-value" data-testid="editor-surface-state">CodeMirror source mode</p>
        </section>
        <section class="status-block">
          <p class="label">Round-trip</p>
          <div class="status-lines" data-testid="roundtrip-status">
            <p><span data-testid="roundtrip-source-label">Source</span><strong data-testid="roundtrip-fixture">source-mode-fixture.md</strong></p>
            <p><span>Mode</span><strong data-testid="roundtrip-mode">strict</strong></p>
            <p><span>Parser</span><strong data-testid="parser-status">pending</strong></p>
            <p><span>Serializer</span><strong data-testid="serializer-status">pending</strong></p>
          </div>
        </section>
        <section class="status-block">
          <p class="label">Diagnostics</p>
          <ol class="diagnostics-list" data-testid="roundtrip-diagnostics" aria-live="polite"></ol>
        </section>
        <section class="status-block">
          <p class="label">Baseline</p>
          <ul class="baseline-list">
            <li>Undo / redo</li>
            <li>Multiline editing</li>
            <li>Selection and clipboard</li>
            <li>List continuation and exit</li>
            <li>Checkbox continuation and exit</li>
            <li>Indentation</li>
            <li>Bracket and quote pairing</li>
            <li>Code fence editing</li>
          </ul>
        </section>
        <section class="status-block">
          <p class="label">Event log</p>
          <ol class="event-log" data-testid="event-log" aria-live="polite"></ol>
        </section>
      </aside>
    </section>
  </main>
`;

const editorHost = queryRequired<HTMLDivElement>("[data-editor-host]");
const richEditorHost = queryRequired<HTMLDivElement>('[data-testid="rich-editor-host"]');
const sourceModeButton = queryRequired<HTMLButtonElement>('[data-testid="source-mode-button"]');
const richModeButton = queryRequired<HTMLButtonElement>('[data-testid="rich-mode-button"]');
const openLocalFileButton = queryRequired<HTMLButtonElement>('[data-testid="open-local-file-button"]');
const importCopyButton = queryRequired<HTMLButtonElement>('[data-testid="import-copy-button"]');
const importCopyInput = queryRequired<HTMLInputElement>('[data-testid="import-copy-input"]');
const copyButton = queryRequired<HTMLButtonElement>('[data-testid="copy-button"]');
const downloadButton = queryRequired<HTMLButtonElement>('[data-testid="download-button"]');
const memorySaveButton = queryRequired<HTMLButtonElement>('[data-testid="memory-save-button"]');
const simulateConflictButton = queryRequired<HTMLButtonElement>('[data-testid="simulate-conflict-button"]');
const documentNameElement = queryRequired<HTMLElement>('[data-testid="document-name"]');
const documentPathElement = queryRequired<HTMLElement>('[data-testid="document-path"]');
const saveStateElement = queryRequired<HTMLElement>('[data-testid="save-state"]');
const dirtyStateElement = queryRequired<HTMLElement>('[data-testid="dirty-state"]');
const persistenceTargetElement = queryRequired<HTMLElement>('[data-testid="persistence-target"]');
const documentModeElement = queryRequired<HTMLElement>('[data-testid="document-mode"]');
const saveEngineTargetElement = queryRequired<HTMLElement>('[data-testid="save-engine-target"]');
const saveEngineStateElement = queryRequired<HTMLElement>('[data-testid="save-engine-state"]');
const saveEngineCurrentHashElement = queryRequired<HTMLElement>('[data-testid="save-engine-current-hash"]');
const saveEngineLastSavedHashElement = queryRequired<HTMLElement>('[data-testid="save-engine-last-saved-hash"]');
const saveEngineExternalHashElement = queryRequired<HTMLElement>('[data-testid="save-engine-external-hash"]');
const saveEngineLastActionElement = queryRequired<HTMLElement>('[data-testid="save-engine-last-action"]');
const eventLogElement = queryRequired<HTMLOListElement>('[data-testid="event-log"]');
const roundTripSourceLabelElement = queryRequired<HTMLElement>('[data-testid="roundtrip-source-label"]');
const roundTripFixtureElement = queryRequired<HTMLElement>('[data-testid="roundtrip-fixture"]');
const parserStatusElement = queryRequired<HTMLElement>('[data-testid="parser-status"]');
const serializerStatusElement = queryRequired<HTMLElement>('[data-testid="serializer-status"]');
const roundTripModeElement = queryRequired<HTMLElement>('[data-testid="roundtrip-mode"]');
const frontmatterElement = queryRequired<HTMLElement>('[data-testid="frontmatter-list"]');
const frontmatterSourceElement = queryRequired<HTMLPreElement>('[data-testid="frontmatter-source"]');
const propertiesHiddenElement = queryRequired<HTMLElement>('[data-testid="properties-hidden-state"]');
const propertiesModeVisibleButton = queryRequired<HTMLButtonElement>('[data-testid="properties-mode-visible"]');
const propertiesModeHiddenButton = queryRequired<HTMLButtonElement>('[data-testid="properties-mode-hidden"]');
const propertiesModeSourceButton = queryRequired<HTMLButtonElement>('[data-testid="properties-mode-source"]');
const diagnosticsElement = queryRequired<HTMLOListElement>('[data-testid="roundtrip-diagnostics"]');
const editorSurfaceStateElement = queryRequired<HTMLElement>('[data-testid="editor-surface-state"]');

let eventCounter = 0;
let lastCopiedMarkdown: string | null = null;
const markdownAstFormatter = createMarkdownAstFormatter();
type DemoDocumentMode = "fixture" | WebOpenedMarkdownMode;
type DemoEditorMode = "source" | "rich";
type PropertiesDisplayMode = "visible" | "hidden" | "source";

interface ActiveDemoDocument {
  readonly fileName: string;
  readonly mode: DemoDocumentMode;
  readonly pathLabel: string;
  readonly readDiskContent?: () => string;
  readonly simulateExternalChange?: (content: string) => void;
}

const fixtureSaveTarget = createMemorySaveTarget({
  initialContent: fixtureMarkdown,
  targetLabel: "fixture://source-mode-fixture.md"
});
let saveTarget: SaveTarget = fixtureSaveTarget;
let saveEngine: SaveEngine = createSaveEngine({
  autosaveDelayMs: 1000,
  content: fixtureMarkdown,
  target: saveTarget
});
let activeDocument: ActiveDemoDocument = {
  fileName: "source-mode-fixture.md",
  mode: "fixture",
  pathLabel: "fixture://source-mode-fixture.md",
  readDiskContent: fixtureSaveTarget.readContent,
  simulateExternalChange: fixtureSaveTarget.simulateExternalChange
};
let lastSaveAction = "loaded fixture";
let editorMode: DemoEditorMode = "source";
let propertiesDisplayMode: PropertiesDisplayMode = "visible";
let autosaveTimer: number | undefined;
let richState: RichMarkdownState = createRichMarkdownState(fixtureMarkdown, {
  dialect: "momentarise-enhanced"
});
let richEditor: ProseMirrorEditorView | null = null;
let richBaselineMarkdown = fixtureMarkdown;
let richChanged = false;

const editor = new CodeMirrorEditorView({
  parent: editorHost,
  state: EditorState.create({
    doc: fixtureMarkdown,
    extensions: [
      ...createMomentariseSourceExtensions({
        onSave: () => {
          memorySave("keyboard shortcut");
          return true;
        }
      }),
      CodeMirrorEditorView.updateListener.of((update) => {
        if (update.docChanged && editorMode === "source") {
          saveEngine.updateContent(getMarkdown());
          renderSaveState();
          scheduleAutosave();
          updateRoundTripStatus();
        }
      }),
    ]
  })
});

renderEditorMode();

sourceModeButton.addEventListener("click", () => {
  switchEditorMode("source");
});

richModeButton.addEventListener("click", () => {
  switchEditorMode("rich");
});

openLocalFileButton.addEventListener("click", () => {
  void openLocalMarkdownFile();
});

importCopyButton.addEventListener("click", () => {
  importCopyInput.click();
});

importCopyInput.addEventListener("change", () => {
  const [file] = Array.from(importCopyInput.files ?? []);
  importCopyInput.value = "";
  if (file) {
    void importMarkdownCopy(file);
  }
});

copyButton.addEventListener("click", () => {
  void copyMarkdown();
});

downloadButton.addEventListener("click", () => {
  downloadMarkdown();
});

memorySaveButton.addEventListener("click", () => {
  memorySave("button");
});

simulateConflictButton.addEventListener("click", () => {
  simulateExternalConflict();
});

propertiesModeVisibleButton.addEventListener("click", () => {
  setPropertiesDisplayMode("visible");
});

propertiesModeHiddenButton.addEventListener("click", () => {
  setPropertiesDisplayMode("hidden");
});

propertiesModeSourceButton.addEventListener("click", () => {
  setPropertiesDisplayMode("source");
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden" && saveEngine.shouldBlockClose()) {
    void flushSave("tab-switch");
  }
});

window.addEventListener("beforeunload", (event) => {
  if (!saveEngine.shouldBlockClose()) {
    return;
  }
  event.preventDefault();
  event.returnValue = "";
});

logEvent("Loaded built-in fixture in memory-only mode.");
renderSaveState();
updateRoundTripStatus();

window.__MME_DEMO_VISUAL_CHECK__ = {
  editor,
  getMarkdown,
  getEditorMode() {
    return editorMode;
  },
  getRichText() {
    return richEditor?.state.doc.textContent ?? "";
  },
  getLastCopiedMarkdown() {
    return lastCopiedMarkdown;
  },
  getActiveDocument() {
    return {
      fileName: activeDocument.fileName,
      mode: activeDocument.mode,
      pathLabel: activeDocument.pathLabel
    };
  },
  getSaveState() {
    return saveEngine.getState();
  },
  getPropertiesState() {
    return {
      hiddenText: propertiesHiddenElement.textContent ?? "",
      listText: frontmatterElement.textContent ?? "",
      mode: propertiesDisplayMode,
      rawSource: frontmatterSourceElement.textContent ?? "",
      sourceHidden: frontmatterSourceElement.hidden
    };
  },
  getTestDiskContent() {
    return activeDocument.readDiskContent?.() ?? null;
  },
  forceStatusRefresh() {
    updateRoundTripStatus();
    renderSaveState();
  },
  getSelectionRange() {
    const selection = editor.state.selection.main;
    return {
      anchor: selection.anchor,
      from: selection.from,
      head: selection.head,
      to: selection.to
    };
  },
  flushSave(reason: SaveFlushReason) {
    return flushSave(reason);
  },
  loadImportedCopyForTest(fileName: string, content: string) {
    loadOpenedMarkdownFile(createImportedCopyDocument({ content, fileName }), {
      sourceLabel: "test imported copy"
    });
  },
  showUnsupportedLocalFileStateForTest() {
    showUnsupportedLocalFileState();
  },
  loadWritableMarkdownFileForTest(fileName: string, content: string) {
    const testHandle = createTestWritableFileHandle(fileName, content);
    const lineEnding = detectMarkdownLineEnding(content);
    loadOpenedMarkdownFile(
      {
        content: normalizeMarkdownLineEndings(content),
        fileName,
        mode: "writable-file",
        pathLabel: `disk://${fileName}`,
        target: createWritableFileSaveTarget({
          handle: testHandle.handle,
          lineEnding,
          targetLabel: `disk://${fileName}`
        })
      },
      {
        readDiskContent: testHandle.readDiskContent,
        simulateExternalChange: testHandle.simulateExternalChange,
        sourceLabel: "test writable local file"
      }
    );
  },
  memorySave,
  simulateExternalConflict,
  setCursorAfterText(text: string) {
    const offset = getMarkdown().indexOf(text);
    if (offset < 0) {
      throw new Error(`Cannot set cursor after missing text: ${text}`);
    }
    editor.focus();
    editor.dispatch({
      selection: {
        anchor: offset + text.length
      }
    });
  },
  setCursorToEnd() {
    editor.focus();
    editor.dispatch({
      selection: {
        anchor: editor.state.doc.length
      }
    });
  },
  setSelection(anchor: number, head: number) {
    editor.focus();
    editor.dispatch({
      selection: {
        anchor,
        head
      }
    });
  },
  setRichSelectionAfterText(text: string) {
    setRichSelectionAfterText(text);
  },
  switchEditorMode(mode: DemoEditorMode) {
    switchEditorMode(mode);
  }
};

async function openLocalMarkdownFile(): Promise<void> {
  if (!canUseFileSystemAccess()) {
    showUnsupportedLocalFileState();
    return;
  }

  try {
    const opened = await openWritableMarkdownFile();
    loadOpenedMarkdownFile(opened, {
      sourceLabel: "local writable file"
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      lastSaveAction = "open cancelled";
      logEvent("Open local file cancelled.");
    } else {
      lastSaveAction = `open failed: ${errorMessage(error)}`;
      logEvent(`Open local file failed: ${errorMessage(error)}`);
    }
    renderSaveState();
  }
}

function showUnsupportedLocalFileState(): void {
  clearAutosaveTimer();
  const content = getMarkdown();
  const unsupportedTarget: SaveTarget = {
    persistenceTarget: "unsupported",
    targetLabel: "unsupported://local-file-access"
  };
  activeDocument = {
    fileName: activeDocument.fileName,
    mode: "unsupported",
    pathLabel: "unsupported://local-file-access"
  };
  saveTarget = unsupportedTarget;
  saveEngine = createSaveEngine({
    autosaveDelayMs: 1000,
    content,
    target: saveTarget
  });
  lastSaveAction = "File System Access unavailable; use Import copy and Download";
  logEvent("File System Access API unavailable. Import copy keeps the original file untouched.");
  renderSaveState();
  updateRoundTripStatus();
}

async function importMarkdownCopy(file: File): Promise<void> {
  const content = await file.text();
  loadOpenedMarkdownFile(createImportedCopyDocument({ content, fileName: file.name }), {
    sourceLabel: "fallback import"
  });
}

function loadOpenedMarkdownFile(
  opened: WebOpenedMarkdownFile,
  options: {
    readonly readDiskContent?: () => string;
    readonly simulateExternalChange?: (content: string) => void;
    readonly sourceLabel?: string;
  } = {}
): void {
  clearAutosaveTimer();
  let nextDocument: ActiveDemoDocument = {
    fileName: opened.fileName,
    mode: opened.mode,
    pathLabel: opened.pathLabel
  };
  if (options.readDiskContent) {
    nextDocument = {
      ...nextDocument,
      readDiskContent: options.readDiskContent
    };
  }
  if (options.simulateExternalChange) {
    nextDocument = {
      ...nextDocument,
      simulateExternalChange: options.simulateExternalChange
    };
  }
  activeDocument = nextDocument;
  saveTarget = opened.target;
  saveEngine = createSaveEngine({
    autosaveDelayMs: 1000,
    content: opened.content,
    target: saveTarget
  });
  lastCopiedMarkdown = null;
  lastSaveAction = `opened ${documentModeLabel(opened.mode)} document`;
  replaceEditorDocument(opened.content);
  if (editorMode === "rich") {
    mountRichEditor(opened.content);
  }
  logEvent(`Opened ${opened.fileName} as ${documentModeLabel(opened.mode)} via ${options.sourceLabel ?? "document loader"}.`);
  renderSaveState();
  updateRoundTripStatus();
}

function replaceEditorDocument(content: string): void {
  editor.dispatch({
    changes: {
      from: 0,
      insert: content,
      to: editor.state.doc.length
    },
    selection: {
      anchor: 0
    }
  });
}

function switchEditorMode(mode: DemoEditorMode): void {
  if (editorMode === mode) {
    return;
  }

  if (mode === "rich") {
    mountRichEditor(editor.state.doc.toString());
    editorMode = "rich";
    logEvent("Switched to ProseMirror rich mode.");
  } else {
    if (richChanged) {
      syncRichMarkdownToSource("mode switch");
    } else {
      replaceEditorDocument(richBaselineMarkdown);
    }
    editorMode = "source";
    editor.focus();
    logEvent("Switched to CodeMirror source mode.");
  }

  renderEditorMode();
  renderSaveState();
  updateRoundTripStatus();
}

function renderEditorMode(): void {
  editorHost.hidden = editorMode !== "source";
  richEditorHost.hidden = editorMode !== "rich";
  sourceModeButton.setAttribute("aria-pressed", String(editorMode === "source"));
  richModeButton.setAttribute("aria-pressed", String(editorMode === "rich"));
  editorSurfaceStateElement.textContent = editorMode === "rich" ? "ProseMirror rich mode" : "CodeMirror source mode";
}

function mountRichEditor(markdown: string): void {
  richEditor?.destroy();
  richEditorHost.replaceChildren();
  richState = createRichMarkdownState(markdown, {
    dialect: "momentarise-enhanced"
  });
  richBaselineMarkdown = markdown;
  richChanged = false;
  richEditor = new ProseMirrorEditorView(richEditorHost, {
    state: richState.editorState,
    dispatchTransaction(transaction) {
      if (!richEditor) {
        return;
      }
      const editorState = richEditor.state.apply(transaction);
      richEditor.updateState(editorState);
      richState = {
        ...richState,
        editorState
      };
      if (transaction.docChanged) {
        richChanged = true;
        syncRichMarkdownToSource("rich edit");
      }
    }
  });
}

function syncRichMarkdownToSource(source: "rich edit" | "mode switch"): void {
  const markdown = serializeRichMarkdownState(richState).content;
  replaceEditorDocument(markdown);
  saveEngine.updateContent(markdown);
  renderSaveState();
  scheduleAutosave();
  updateRoundTripStatus();
  if (source === "mode switch") {
    logEvent("Serialized rich mode back to Markdown source.");
  }
}

function setRichSelectionAfterText(text: string): void {
  if (!richEditor) {
    throw new Error("Rich editor is not mounted.");
  }
  let position: number | null = null;
  richEditor.state.doc.descendants((node, offset) => {
    if (!node.isText || typeof node.text !== "string") {
      return true;
    }
    const index = node.text.indexOf(text);
    if (index < 0) {
      return true;
    }
    position = offset + index + text.length;
    return false;
  });
  if (position === null) {
    throw new Error(`Cannot set rich selection after missing text: ${text}`);
  }
  richEditor.focus();
  richEditor.dispatch(richEditor.state.tr.setSelection(TextSelection.create(richEditor.state.doc, position)));
}

async function copyMarkdown(): Promise<void> {
  const markdownText = getMarkdown();
  lastCopiedMarkdown = markdownText;
  try {
    await navigator.clipboard.writeText(markdownText);
    logEvent("Copied current Markdown to clipboard.");
  } catch {
    logEvent("Prepared current Markdown for copy; browser clipboard unavailable.");
  }
}

function downloadMarkdown(): void {
  const blob = new Blob([getMarkdown()], {
    type: "text/markdown;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = activeDocument.fileName;
  anchor.click();
  URL.revokeObjectURL(url);
  lastSaveAction = "download/export generated; original target unchanged";
  logEvent("Generated Markdown download/export. Original target was unchanged.");
  renderSaveState();
}

function memorySave(source: "button" | "keyboard shortcut"): void {
  const state = saveEngine.getState();
  if (state.target === "download-required" || activeDocument.mode === "imported-copy") {
    downloadMarkdown();
    return;
  }
  if (state.target === "unsupported" || activeDocument.mode === "unsupported") {
    lastSaveAction = `${source} cannot save unsupported local-file access; use Download or Import copy`;
    logEvent("Save unavailable for unsupported local-file access. Use Download or Import copy.");
    renderSaveState();
    return;
  }
  void flushSave("manual", source);
}

async function flushSave(reason: SaveFlushReason, source?: "button" | "keyboard shortcut"): Promise<void> {
  clearAutosaveTimer();
  let result: Awaited<ReturnType<SaveEngine["flush"]>>;
  try {
    result = await saveEngine.flush({
      reason
    });
  } catch (error) {
    lastSaveAction = `${source ?? reason} flush failed unexpectedly`;
    logEvent(`Save failed unexpectedly: ${errorMessage(error)}`);
    renderSaveState();
    return;
  }
  if (result.status === "saved") {
    lastSaveAction = `${source ?? reason} flush wrote ${saveFlushTargetLabel(result.state)}`;
    logEvent(`Flushed ${source ?? reason} save to ${saveFlushTargetLabel(result.state)}.`);
  } else if (result.status === "noop") {
    lastSaveAction = `${source ?? reason} flush found no dirty changes`;
    logEvent(`Save Engine ${source ?? reason} flush found no dirty changes.`);
  } else if (result.status === "dirty") {
    lastSaveAction = `${source ?? reason} flush wrote an older revision; latest content remains dirty`;
    logEvent(`Save incomplete: ${result.message}`);
  } else if (result.status === "blocked") {
    lastSaveAction = `${source ?? reason} flush blocked`;
    logEvent(`Save blocked: ${result.message}`);
  } else if (result.status === "conflict") {
    lastSaveAction = `conflict blocked overwrite; external ${shortHash(result.state.externalHash ?? result.state.currentHash)} preserved`;
    logEvent("Conflict detected; Save Engine blocked overwrite.");
  } else if (result.status === "error") {
    lastSaveAction = `${source ?? reason} flush errored`;
    logEvent(`Save error: ${result.message}`);
  }
  renderSaveState();
}

function scheduleAutosave(): void {
  clearAutosaveTimer();
  autosaveTimer = window.setTimeout(() => {
    autosaveTimer = undefined;
    if (saveEngine.shouldAutosave()) {
      void flushSave("autosave");
    }
  }, saveEngine.autosaveDelayMs);
}

function clearAutosaveTimer(): void {
  if (autosaveTimer === undefined) {
    return;
  }
  window.clearTimeout(autosaveTimer);
  autosaveTimer = undefined;
}

function simulateExternalConflict(): void {
  if (!activeDocument.simulateExternalChange) {
    lastSaveAction = `external conflict simulation unavailable for ${documentModeLabel(activeDocument.mode)}`;
    logEvent(`External conflict simulation is unavailable for ${documentModeLabel(activeDocument.mode)}.`);
    renderSaveState();
    return;
  }

  const externalBase = activeDocument.readDiskContent?.() ?? getMarkdown();
  activeDocument.simulateExternalChange(`${externalBase}\n<!-- simulated external edit -->\n`);
  lastSaveAction = "external target changed; next save must detect conflict";
  logEvent("Simulated external target change; the next dirty save must report conflict.");
  renderSaveState();
}

function renderSaveState(): void {
  const state = saveEngine.getState();
  const label = persistenceTargetLabel(state);
  documentNameElement.textContent = activeDocument.fileName;
  documentPathElement.textContent = activeDocument.pathLabel;
  documentModeElement.textContent = documentModeLabel(activeDocument.mode);
  saveStateElement.textContent = label;
  dirtyStateElement.textContent = dirtyStateLabel(state);
  persistenceTargetElement.textContent = documentTargetLabel(state);
  saveEngineTargetElement.textContent = state.target;
  saveEngineStateElement.textContent = saveEngineStatusLabel(state);
  saveEngineCurrentHashElement.textContent = shortHash(state.currentHash);
  saveEngineLastSavedHashElement.textContent = state.lastSavedHash ? shortHash(state.lastSavedHash) : "none";
  saveEngineExternalHashElement.textContent = state.externalHash ? shortHash(state.externalHash) : "none";
  saveEngineLastActionElement.textContent = lastSaveAction;
  memorySaveButton.textContent = primaryActionLabel(state);
  memorySaveButton.disabled = state.target === "unsupported";
}

function primaryActionLabel(state: SaveState): string {
  if (activeDocument.mode === "imported-copy" || state.target === "download-required") {
    return "Download";
  }
  if (activeDocument.mode === "unsupported" || state.target === "unsupported") {
    return "Save unavailable";
  }
  return "Save";
}

function dirtyStateLabel(state: SaveState): string {
  if (state.status === "saved") {
    return "clean";
  }
  return state.status;
}

function documentTargetLabel(state: SaveState): string {
  if (state.target === "conflict") {
    return "conflict, not overwritten";
  }
  if (activeDocument.mode === "writable-file" || state.target === "disk") {
    return "disk, original file writable";
  }
  if (activeDocument.mode === "imported-copy" || state.target === "download-required") {
    return "imported copy, download/export required";
  }
  if (activeDocument.mode === "unsupported" || state.target === "unsupported") {
    return "unsupported, use import/download";
  }
  if (state.target === "memory-only") {
    return "fixture, memory only, not persisted";
  }
  return persistenceTargetLabel(state);
}

function saveEngineStatusLabel(state: SaveState): string {
  if (state.status === "saved" && state.target === "memory-only") {
    return "memory saved";
  }
  if (state.status === "saved" && state.target === "disk") {
    return "disk saved";
  }
  if (state.target === "download-required") {
    return state.status === "dirty" ? "dirty, download required" : "download required";
  }
  if (state.target === "unsupported") {
    return "unsupported";
  }
  return state.status;
}

function saveFlushTargetLabel(state: SaveState): string {
  if (state.target === "disk") {
    return "disk target";
  }
  if (state.target === "memory-only") {
    return "memory-only target";
  }
  if (state.target === "download-required") {
    return "download/export target";
  }
  return `${state.target} target`;
}

function documentModeLabel(mode: DemoDocumentMode): string {
  if (mode === "fixture") {
    return "fixture";
  }
  if (mode === "writable-file") {
    return "writable local file";
  }
  if (mode === "imported-copy") {
    return "imported copy";
  }
  return "unsupported local file";
}

function createTestWritableFileHandle(
  fileName: string,
  content: string
): {
  readonly handle: WebFileHandleLike;
  readonly readDiskContent: () => string;
  readonly simulateExternalChange: (nextContent: string) => void;
} {
  let diskContent = content;
  const handle: WebFileHandleLike = {
    kind: "file",
    name: fileName,
    async createWritable() {
      let nextContent = "";
      return {
        async close() {
          diskContent = nextContent;
        },
        async write(value) {
          nextContent = value;
        }
      };
    },
    async getFile() {
      return {
        name: fileName,
        async text() {
          return diskContent;
        }
      };
    }
  };
  return {
    handle,
    readDiskContent() {
      return diskContent;
    },
    simulateExternalChange(nextContent: string) {
      diskContent = nextContent;
    }
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}

function shortHash(hash: string): string {
  return hash.replace(/^fnv1a64:/, "").slice(0, 8);
}

function updateRoundTripStatus(): void {
  const parseResult = markdownAstFormatter.parse(getMarkdown(), {
    dialect: "momentarise-enhanced"
  });
  const result = roundTripMarkdown(getMarkdown(), {
    formatter: markdownAstFormatter,
    fixtureId: activeDocument.fileName,
    mode: "strict"
  });
  roundTripSourceLabelElement.textContent = roundTripSourceLabel(activeDocument.mode);
  roundTripFixtureElement.textContent = activeDocument.fileName;
  roundTripModeElement.textContent = result.mode;
  parserStatusElement.textContent = parserStatusLabel(result);
  serializerStatusElement.textContent = serializerStatusLabel(result);
  renderPropertiesPanel(parseResult);
  renderDiagnostics(result);
}

function roundTripSourceLabel(mode: DemoDocumentMode): string {
  if (mode === "fixture") {
    return "Fixture";
  }
  if (mode === "writable-file") {
    return "Writable file";
  }
  if (mode === "imported-copy") {
    return "Imported copy";
  }
  return "Unsupported";
}

function parserStatusLabel(result: FixtureRoundTripResult): string {
  return result.status === "pass" ? "pass (remark AST)" : "fail";
}

function serializerStatusLabel(result: FixtureRoundTripResult): string {
  return result.status === "pass" ? "pass (source preserved)" : "fail";
}

function setPropertiesDisplayMode(mode: PropertiesDisplayMode): void {
  propertiesDisplayMode = mode;
  renderPropertiesPanel(
    markdownAstFormatter.parse(getMarkdown(), {
      dialect: "momentarise-enhanced"
    })
  );
  logEvent(`Properties panel switched to ${mode} mode.`);
}

function renderPropertiesPanel(parseResult: ParseResult): void {
  propertiesModeVisibleButton.setAttribute("aria-pressed", String(propertiesDisplayMode === "visible"));
  propertiesModeHiddenButton.setAttribute("aria-pressed", String(propertiesDisplayMode === "hidden"));
  propertiesModeSourceButton.setAttribute("aria-pressed", String(propertiesDisplayMode === "source"));

  frontmatterElement.hidden = propertiesDisplayMode !== "visible";
  frontmatterSourceElement.hidden = propertiesDisplayMode !== "source";
  propertiesHiddenElement.hidden = propertiesDisplayMode !== "hidden";

  renderFrontmatterList(parseResult);
  frontmatterSourceElement.textContent = extractFrontmatterSource(getMarkdown());
}

function renderFrontmatterList(parseResult: ParseResult): void {
  const frontmatter = parseResult.document.frontmatter;
  if (!frontmatter || Object.keys(frontmatter).length === 0) {
    frontmatterElement.replaceChildren(emptyValue("none"));
    return;
  }

  const entries = Object.entries(frontmatter);
  const visibleEntries = entries.slice(0, 6);
  const overflowCount = entries.length - visibleEntries.length;
  frontmatterElement.replaceChildren(
    ...visibleEntries.flatMap(([key, value]) => frontmatterRow(key, value)),
    ...(overflowCount > 0 ? [propertiesOverflowNote(overflowCount)] : [])
  );
}

function renderDiagnostics(result: FixtureRoundTripResult): void {
  diagnosticsElement.replaceChildren(
    ...result.diagnostics.slice(0, 4).map((diagnostic) => {
      const item = document.createElement("li");
      item.textContent = `${diagnostic.severity}: ${diagnostic.code}`;
      return item;
    })
  );
}

function frontmatterRow(key: string, value: FrontmatterRecord[string]): readonly HTMLElement[] {
  const term = document.createElement("dt");
  term.textContent = key;
  const description = document.createElement("dd");
  description.textContent = formatFrontmatterValue(value);
  return [term, description];
}

function emptyValue(value: string): HTMLElement {
  const item = document.createElement("dd");
  item.textContent = value;
  return item;
}

function propertiesOverflowNote(count: number): HTMLElement {
  const item = document.createElement("dd");
  item.className = "properties-overflow-note";
  item.dataset.testid = "properties-overflow-note";
  item.textContent = `+${count} more fields; switch to YAML for the full frontmatter.`;
  return item;
}

function formatFrontmatterValue(value: FrontmatterRecord[string]): string {
  if (Array.isArray(value)) {
    return value.map((item) => formatFrontmatterValue(item)).join(", ");
  }
  if (value && typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

function extractFrontmatterSource(markdownText: string): string {
  const match = markdownText.match(/^---\r?\n[\s\S]*?\r?\n---(?=\r?\n|$)/);
  return match ? match[0] : "No YAML frontmatter in source.";
}

function getMarkdown(): string {
  if (editorMode === "rich") {
    return serializeRichMarkdownState(richState).content;
  }
  return editor.state.doc.toString();
}

function logEvent(message: string): void {
  eventCounter += 1;
  const item = document.createElement("li");
  item.textContent = `${eventCounter}. ${message}`;
  eventLogElement.prepend(item);
}

function queryRequired<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return element;
}

declare global {
  interface Window {
    __MME_DEMO_VISUAL_CHECK__: {
      editor: CodeMirrorEditorView;
      flushSave: (reason: SaveFlushReason) => Promise<void>;
      forceStatusRefresh: () => void;
      getActiveDocument: () => {
        readonly fileName: string;
        readonly mode: DemoDocumentMode;
        readonly pathLabel: string;
      };
      getEditorMode: () => DemoEditorMode;
      getLastCopiedMarkdown: () => string | null;
      getMarkdown: () => string;
      getPropertiesState: () => {
        readonly hiddenText: string;
        readonly listText: string;
        readonly mode: PropertiesDisplayMode;
        readonly rawSource: string;
        readonly sourceHidden: boolean;
      };
      getSaveState: () => SaveState;
      getRichText: () => string;
      getSelectionRange: () => {
        readonly anchor: number;
        readonly from: number;
        readonly head: number;
        readonly to: number;
      };
      getTestDiskContent: () => string | null;
      loadImportedCopyForTest: (fileName: string, content: string) => void;
      loadWritableMarkdownFileForTest: (fileName: string, content: string) => void;
      memorySave: (source: "button" | "keyboard shortcut") => void;
      showUnsupportedLocalFileStateForTest: () => void;
      simulateExternalConflict: () => void;
      setCursorAfterText: (text: string) => void;
      setCursorToEnd: () => void;
      setRichSelectionAfterText: (text: string) => void;
      setSelection: (anchor: number, head: number) => void;
      switchEditorMode: (mode: DemoEditorMode) => void;
    };
  }
}
