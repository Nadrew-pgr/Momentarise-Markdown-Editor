import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import {
  classifyEditorDocumentKind,
  editorModesForDocumentKind,
  isEditorModeAvailableForDocumentKind,
  isSvgArtifactFileName
} from "../packages/md-editor/dist/index.js";
import {
  createImportedCopyDocument,
  openWritableMarkdownFile,
  saveMarkdownAsFile
} from "../packages/md-adapter-web/dist/index.js";
import {
  createSandboxedSvgPreview,
  isSvgFileName,
  sandboxAllowsScripts
} from "../packages/md-preview-html/dist/index.js";
import {
  createModeControl,
  defaultMmeStrings
} from "../packages/md-surface/dist/index.js";
import { createSaveEngine, hashMarkdownContent } from "../packages/md-save/dist/index.js";

const hostileSvg = `<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)">
  <script>alert("x")</script>
  <style>@import url("https://evil.example/theme.css"); circle { fill: red; }</style>
  <foreignObject><iframe src="https://evil.example"></iframe></foreignObject>
  <image href="https://evil.example/logo.png" />
  <a href="javascript:alert(1)"><text>Bad link</text></a>
  <circle cx="24" cy="24" r="20" style="fill:url(https://evil.example/pattern.svg)" />
</svg>`;

const safeSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
  <title>Momentarise mark</title>
  <circle cx="24" cy="24" r="20" fill="#2563eb" />
</svg>\r\n`;
const bypassSvg = `<svg xmlns="http://www.w3.org/2000/svg" ONLOAD="alert(1)">
  <a HREF="JaVa
ScRiPt:alert(1)" SRCDOC="<script>alert(1)</script>"><text>Mixed case</text></a>
  <rect STYLE="fill:url(HTTPS://evil.example/pattern.svg)" width="20" height="20" />
  <use xlink:href="https://evil.example/sprite.svg#icon" />
  <circle data-url="data:image/svg+xml;base64,PHNjcmlwdD4=" cx="12" cy="12" r="8" />
</svg>`;
const normalizedSafeSvg = safeSvg.replace(/\r\n?/g, "\n");
const editedSafeSvg = normalizedSafeSvg.replace("</svg>\n", "  <path d=\"M12 24h24\" stroke=\"white\" />\n</svg>\n");
const editedDiskSvg = editedSafeSvg.replace(/\n/g, "\r\n");
const demoSource = readFileSync("apps/md-demo/src/main.ts", "utf8");
const importExportDocs = readFileSync("docs/public/concepts/import-export.md", "utf8");
const previewPackageDocs = readFileSync("docs/public/packages/md-preview-html.md", "utf8");
globalThis.DOMParser = new JSDOM("").window.DOMParser;

assertEqual(classifyEditorDocumentKind("mark.svg"), "svg-artifact", "SVG filename classification");
assertEqual(
  classifyEditorDocumentKind("download", "image/svg+xml"),
  "svg-artifact",
  "SVG media type classification"
);
assertEqual(
  classifyEditorDocumentKind("mark.svg", "text/plain"),
  "svg-artifact",
  "SVG extension must beat generic text/plain media type."
);
assert(isSvgArtifactFileName("mark.svg"), "Core SVG filename helper must be exported through editor.");

const svgModes = editorModesForDocumentKind("svg-artifact").map((mode) => mode.id);
assertDeepEqual(svgModes, ["source", "preview"], "SVG mode availability");
assert(isEditorModeAvailableForDocumentKind("source", "svg-artifact"), "SVG must expose Source mode.");
assert(isEditorModeAvailableForDocumentKind("preview", "svg-artifact"), "SVG must expose Preview mode.");
assert(!isEditorModeAvailableForDocumentKind("rich", "svg-artifact"), "SVG must not expose Rich mode.");
assert(!isEditorModeAvailableForDocumentKind("live-preview", "svg-artifact"), "SVG must not expose Live Preview.");

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
    documentKind: "svg-artifact",
    editorMode: "source"
  },
  strings: defaultMmeStrings
});
modeHost.append(modeControl.element);
assert(modeHost.querySelector("[data-testid='source-mode-button']"), "SVG mode control must render Source.");
assert(modeHost.querySelector("[data-testid='preview-mode-button']"), "SVG mode control must render Preview.");
assert(!modeHost.querySelector("[data-testid='rich-mode-button']"), "SVG mode control must not render Rich.");
assert(!modeHost.querySelector("[data-testid='live-preview-mode-button']"), "SVG mode control must not render Live Preview.");

const preview = createSandboxedSvgPreview({
  fileName: "hostile.svg",
  sandboxTokens: ["allow-scripts", "allow-same-origin"],
  svg: hostileSvg
});
assertEqual(preview.kind, "svg-artifact-preview", "SVG preview descriptor kind");
assertEqual(preview.scriptsEnabled, false, "SVG preview must never enable scripts.");
assert(!sandboxAllowsScripts(preview.sandbox), "SVG preview sandbox must strip allow-scripts.");
assert(preview.sanitizedSvg.includes("<svg"), "SVG preview must expose sanitized SVG.");
assert(!/<script\b/i.test(preview.srcdoc), "Sanitized preview must remove script tags.");
assert(!/\son[a-z0-9:-]+\s*=/i.test(preview.srcdoc), "Sanitized preview must remove event handlers.");
assert(!/javascript:/i.test(preview.srcdoc), "Sanitized preview must remove javascript URLs.");
assert(!/<foreignObject\b/i.test(preview.srcdoc), "Sanitized preview must remove foreignObject.");
assert(!/<image\b/i.test(preview.srcdoc), "Sanitized preview must remove image references.");
assert(!/https?:\/\/(?!www\.w3\.org\/2000\/svg)/i.test(preview.srcdoc), "Sanitized preview must remove external network references.");
assert(!/@import/i.test(preview.srcdoc), "Sanitized preview must remove CSS imports.");
assert(!/\sstyle\s*=/i.test(preview.srcdoc), "Sanitized preview must remove inline style attributes.");
assert(preview.warnings.some((warning) => warning.code === "svg-preview-sanitized"), "Sanitizer must report source changes.");
assert(isSvgFileName("hostile.svg"), "Preview package must expose SVG filename helper.");

const bypassPreview = createSandboxedSvgPreview({
  fileName: "bypass.svg",
  svg: bypassSvg
});
for (const unsafePattern of [
  /javascript:/i,
  /data:/i,
  /https?:\/\/(?!www\.w3\.org\/2000\/svg)/i,
  /\son[a-z0-9:-]+\s*=/i,
  /\sstyle\s*=/i,
  /\ssrcdoc\s*=/i,
  /<use\b/i,
  /<script\b/i
]) {
  assert(!unsafePattern.test(bypassPreview.srcdoc), `Sanitized preview must remove bypass pattern ${unsafePattern}.`);
}

const hostileCorpus = [
  `<svg><base href="https://evil.example/"><text>base</text></svg>`,
  `<svg><animate attributeName="href" values="javascript:alert(1)" /></svg>`,
  `<svg><set attributeName="onload" to="alert(1)" /></svg>`,
  `<svg><feImage href="https://evil.example/filter.svg" /></svg>`,
  `<svg><script href="https://evil.example/script.js" /></svg>`,
  `<svg><text onclick="alert(1)">click</text></svg>`,
  `<svg><g transform="url(https://evil.example/t.svg)"><circle r="2" /></g></svg>`,
  `<svg><a href="//evil.example/path"><text>network</text></a></svg>`
];
for (const [index, sample] of hostileCorpus.entries()) {
  const corpusPreview = createSandboxedSvgPreview({
    fileName: `hostile-${index}.svg`,
    svg: sample
  });
  assert(!/<(?:base|animate|set|feImage|script)\b/i.test(corpusPreview.srcdoc), `Hostile SVG corpus ${index} must remove active elements.`);
  assert(!/https?:\/\/(?!www\.w3\.org\/2000\/svg)|\/\/evil\.example|javascript:|data:/i.test(corpusPreview.srcdoc), `Hostile SVG corpus ${index} must remove active/external URL values.`);
  assert(!/\son[a-z0-9:-]+\s*=/i.test(corpusPreview.srcdoc), `Hostile SVG corpus ${index} must remove event handlers.`);
}

const safePreview = createSandboxedSvgPreview({
  fileName: "safe.svg",
  svg: safeSvg
});
assert(safePreview.sanitizedSvg.includes("<circle"), "Safe SVG drawing elements must survive DOM sanitization.");

const importedSvg = createImportedCopyDocument({
  content: safeSvg,
  fileName: "mark.svg"
});
assertEqual(importedSvg.kind, "svg-artifact", "Imported SVG must be SVG artifact kind.");
assertEqual(importedSvg.content, normalizedSafeSvg, "Imported SVG must normalize editor line endings.");
assertEqual(importedSvg.target.persistenceTarget, "download-required", "Imported SVG must remain download-required.");

const importedPng = createImportedCopyDocument({
  content: "<svg></svg>",
  fileName: "image.png"
});
assertEqual(importedPng.kind, "unsupported", "Unsupported visual imports must not become SVG.");

const writableHost = createMockPickerHost({
  content: safeSvg,
  name: "mark.svg",
  type: "image/svg+xml"
});
const openedSvg = await openWritableMarkdownFile(writableHost);
assertEqual(openedSvg.kind, "svg-artifact", "Writable SVG must open as SVG artifact kind.");
assertEqual(openedSvg.content, normalizedSafeSvg, "Writable SVG must normalize editor line endings.");
assert(
  writableHost.showOpenFilePickerOptions[0]?.types?.[0]?.accept?.["image/svg+xml"]?.includes(".svg"),
  "Unified picker must advertise SVG files."
);

const svgEngine = createSaveEngine({
  content: openedSvg.content,
  target: openedSvg.target
});
const noop = await svgEngine.flush({ reason: "manual" });
assertEqual(noop.status, "noop", "Clean SVG save must be noop.");
assertEqual(writableHost.readDiskContent(), safeSvg, "Clean SVG save must not rewrite line endings.");
svgEngine.updateContent(editedSafeSvg);
const saved = await svgEngine.flush({ reason: "manual" });
assertEqual(saved.status, "saved", "Edited SVG source must save to disk.");
assertEqual(writableHost.readDiskContent(), editedDiskSvg, "Edited SVG source must preserve CRLF on disk.");
assertEqual(svgEngine.getState().currentHash, hashMarkdownContent(editedSafeSvg), "Save hash must track SVG source.");

const saveAsHost = createMockSaveHost({ name: "diagram" });
const savedAsSvg = await saveMarkdownAsFile({
  content: normalizedSafeSvg,
  fileName: "diagram",
  host: saveAsHost,
  kind: "svg-artifact"
});
assertEqual(savedAsSvg.fileName, "diagram.svg", "SVG Save As must preserve a .svg extension.");
assertEqual(savedAsSvg.kind, "svg-artifact", "SVG Save As must preserve SVG artifact kind.");
assertEqual(saveAsHost.savedContent(), normalizedSafeSvg, "SVG Save As must write the source, not sanitized preview.");

for (const snippet of [
  "createSandboxedSvgPreview",
  "isPreviewArtifactKind",
  '"image/svg+xml": [".svg"]',
  "Sanitized SVG preview",
  "Switched to sanitized SVG preview mode.",
  "renderSvgArtifactStatus",
  "renderSvgArtifactProperties",
  "SVG source is preserved as source text; the preview is sanitized and derived.",
  "SVG source download/export. Sanitized preview was not written."
]) {
  assert(demoSource.includes(snippet), `Demo SVG routing must include: ${snippet}`);
}

for (const [sourceName, source, snippets] of [
  [
    "import/export docs",
    importExportDocs,
    ["Standalone SVG Preview", "svg", "Source and Preview", "Save and Save As write the original SVG source text"]
  ],
  [
    "preview package docs",
    previewPackageDocs,
    ["HTML And SVG Artifact Preview", "createSandboxedSvgPreview", "conservative sanitized derived artifact"]
  ]
]) {
  for (const snippet of snippets) {
    assert(source.includes(snippet), `${sourceName} must document SVG behavior: ${snippet}`);
  }
}

function createMockPickerHost({ content, name, type }) {
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
        type,
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

function createMockSaveHost({ name }) {
  let diskContent = "";
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
        type: "image/svg+xml",
        async text() {
          return diskContent;
        }
      };
    }
  };
  return {
    savedContent() {
      return diskContent;
    },
    async showSaveFilePicker() {
      return handle;
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
