import { JSDOM } from "jsdom";
import {
  classifyEditorDocumentKind,
  editorModesForDocumentKind,
  isEditorModeAvailableForDocumentKind
} from "../packages/md-editor/dist/index.js";
import {
  createImportedCopyDocument,
  openWritableMarkdownFile
} from "../packages/md-adapter-web/dist/index.js";
import {
  createModeControl,
  defaultMmeStrings
} from "../packages/md-surface/dist/index.js";
import { createSaveEngine, hashMarkdownContent } from "../packages/md-save/dist/index.js";

const sourceText = "plain text\r\nnot markdown # stays literal\r\n- no list promise\r\n";
const normalizedSourceText = "plain text\nnot markdown # stays literal\n- no list promise\n";
const editedSourceText = "plain text\nnot markdown # stays literal\nedited source line\n";
const editedSourceDiskText = "plain text\r\nnot markdown # stays literal\r\nedited source line\r\n";

assertEqual(classifyEditorDocumentKind("README.md"), "markdown", "Markdown filename classification");
assertEqual(classifyEditorDocumentKind("index.html"), "html-artifact", "HTML filename classification");
assertEqual(classifyEditorDocumentKind("notes.txt"), "lightweight-source", "txt filename classification");
assertEqual(classifyEditorDocumentKind("server.log"), "lightweight-source", "log filename classification");
assertEqual(classifyEditorDocumentKind("config.json"), "lightweight-source", "json filename classification");
assertEqual(classifyEditorDocumentKind("config.yaml"), "lightweight-source", "yaml filename classification");
assertEqual(
  classifyEditorDocumentKind("README.md", "text/plain"),
  "markdown",
  "Markdown extension must beat generic text/plain media type."
);
assertEqual(
  classifyEditorDocumentKind("preview.html", "text/plain"),
  "html-artifact",
  "HTML extension must beat generic text/plain media type."
);
assertEqual(
  classifyEditorDocumentKind("photo.png", "text/plain"),
  "unsupported",
  "Unsupported extension must beat generic text/plain media type."
);
assertEqual(classifyEditorDocumentKind("photo.png"), "unsupported", "unsupported binary-ish filename classification");
assertEqual(
  classifyEditorDocumentKind("download", "text/plain"),
  "lightweight-source",
  "text/plain media type classification"
);
assertEqual(
  classifyEditorDocumentKind("download", "application/octet-stream"),
  "unsupported",
  "octet-stream media type classification"
);

const lightweightModes = editorModesForDocumentKind("lightweight-source").map((mode) => mode.id);
assertDeepEqual(lightweightModes, ["source"], "Lightweight source mode availability");
assert(isEditorModeAvailableForDocumentKind("source", "lightweight-source"), "Lightweight source must expose Source mode.");
assert(!isEditorModeAvailableForDocumentKind("rich", "lightweight-source"), "Lightweight source must not expose Rich mode.");
assert(!isEditorModeAvailableForDocumentKind("live-preview", "lightweight-source"), "Lightweight source must not expose Live Preview.");
assert(!isEditorModeAvailableForDocumentKind("preview", "lightweight-source"), "Lightweight source must not expose Preview.");

const modeDom = new JSDOM("<div id=\"host\"></div>");
const modeHost = modeDom.window.document.querySelector("#host");
const modeControl = createModeControl({
  host: modeHost,
  icons: {
    render(name) {
      return `<span data-icon="${name}" aria-hidden="true"></span>`;
    }
  },
  onSwitchMode() {},
  preferences: {
    aiEntryPoints: [],
    toolbarMode: "sticky",
    visibleCommandGroups: []
  },
  session: {
    on() {
      return () => {};
    }
  },
  state: {
    documentKind: "lightweight-source",
    editorMode: "source"
  },
  strings: defaultMmeStrings
});
modeHost.append(modeControl.element);
assert(modeHost.querySelector("[data-testid='source-mode-button']"), "Lightweight mode control must render Source.");
assert(!modeHost.querySelector("[data-testid='rich-mode-button']"), "Lightweight mode control must not render Rich.");
assert(!modeHost.querySelector("[data-testid='live-preview-mode-button']"), "Lightweight mode control must not render Live Preview.");
assert(!modeHost.querySelector("[data-testid='preview-mode-button']"), "Lightweight mode control must not render Preview.");

const importedLog = createImportedCopyDocument({
  content: sourceText,
  fileName: "server.log"
});
assertEqual(importedLog.kind, "lightweight-source", "Imported log must be source-only kind.");
assertEqual(importedLog.content, normalizedSourceText, "Imported log must normalize editor line endings.");
assertEqual(importedLog.target.persistenceTarget, "download-required", "Imported log must remain download-required.");

const importedMarkdown = createImportedCopyDocument({
  content: "# Markdown\n",
  fileName: "note.md"
});
assertEqual(importedMarkdown.kind, "markdown", "Imported Markdown must remain Markdown kind.");

const unsupportedImport = createImportedCopyDocument({
  content: "binary-ish fallback text",
  fileName: "photo.png"
});
assertEqual(unsupportedImport.kind, "unsupported", "Unsupported import must not be mislabeled as Markdown.");
assertEqual(unsupportedImport.mode, "unsupported", "Unsupported import must expose unsupported mode.");
assertEqual(unsupportedImport.target.persistenceTarget, "unsupported", "Unsupported import must not expose a writable/download target.");

const writableHost = createMockPickerHost({
  content: sourceText,
  name: "server.log"
});
const openedLog = await openWritableMarkdownFile(writableHost);
assertEqual(openedLog.kind, "lightweight-source", "Writable log must open as source-only kind.");
assertEqual(openedLog.content, normalizedSourceText, "Writable log must normalize editor line endings.");
assert(
  writableHost.showOpenFilePickerOptions[0]?.types?.[0]?.accept?.["text/plain"]?.includes(".log"),
  "Unified picker must advertise lightweight source extensions."
);

const logEngine = createSaveEngine({
  content: openedLog.content,
  target: openedLog.target
});
const noop = await logEngine.flush({ reason: "manual" });
assertEqual(noop.status, "noop", "Clean lightweight source save must be noop.");
assertEqual(writableHost.readDiskContent(), sourceText, "Clean lightweight source save must not rewrite line endings.");
logEngine.updateContent(editedSourceText);
const saved = await logEngine.flush({ reason: "manual" });
assertEqual(saved.status, "saved", "Edited lightweight source must save to disk.");
assertEqual(writableHost.readDiskContent(), editedSourceDiskText, "Edited lightweight source must preserve CRLF on disk.");
assertEqual(logEngine.getState().currentHash, hashMarkdownContent(editedSourceText), "Save hash must track source-only text.");

function createMockPickerHost({ content, name }) {
  let diskContent = content;
  const handle = {
    kind: "file",
    name,
    async createWritable() {
      let nextContent = "";
      return {
        async close() {
          diskContent = nextContent;
        },
        async write(value) {
          nextContent = String(value);
        }
      };
    },
    async getFile() {
      return {
        name,
        async text() {
          return diskContent;
        }
      };
    }
  };
  return {
    readDiskContent() {
      return diskContent;
    },
    showOpenFilePickerOptions: [],
    async showOpenFilePicker(options) {
      this.showOpenFilePickerOptions.push(options);
      return [handle];
    }
  };
}

function assert(condition, label) {
  if (!condition) {
    throw new Error(label);
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}.`);
  }
}

function assertDeepEqual(actual, expected, label) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`${label}: expected ${expectedJson}, got ${actualJson}.`);
  }
}
