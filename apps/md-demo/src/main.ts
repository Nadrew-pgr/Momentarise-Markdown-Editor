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
  createDownloadRequiredSaveTarget,
  createMemorySaveTarget,
  persistenceTargetLabel,
  type SaveFlushReason,
  type SaveState,
  type SaveTarget
} from "@momentarise/md-save";
import type { FoldState } from "@momentarise/md-core";
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
  createSandboxedHtmlPreview,
  isHtmlFileName,
  sandboxAllowsScripts,
  type SandboxedHtmlPreviewDescriptor
} from "@momentarise/md-preview-html";
import {
  createMockAiProvider,
  type AiWritingAction,
  type AiWritingSuggestion,
  type MockAiProvider
} from "@momentarise/md-ai";
import { createDefaultPolicyResolver } from "@momentarise/md-policy";
import { createMarkdownEditorSession, type MarkdownEditorSession } from "@momentarise/md-editor";
import {
  canInsertParagraphAfterCurrentBlock,
  createRichMarkdownState,
  filterRichMarkdownCommands,
  getCurrentCodeBlockInfo,
  getRichFoldVisibility,
  getRichHeadingFoldItems,
  insertParagraphAfterCurrentBlock,
  reconfigureRichPlugins,
  richCommandRegistry,
  runRichMarkdownCommand,
  serializeRichMarkdownState,
  setCurrentCodeBlockInfo,
  toggleRichHeadingFold,
  toggleCurrentTodoItem,
  type ApplyRichMarkdownCommandOptions,
  type RichFoldVisibility,
  type RichHeadingFoldItem,
  type RichCommandId,
  type RichMarkdownCommand,
  type RichMarkdownState,
  type MomentariseRichPreferences
} from "@momentarise/md-rich-prosemirror";
import {
  createMomentariseSourceCompartments,
  createMomentariseSourceExtensions,
  createMomentariseSourceReconfigureEffects,
  type MomentariseSourcePreferences
} from "@momentarise/md-source-codemirror";
import {
  defaultIconSet,
  resolveThemeToCssVariables,
  type IconName,
  type MmeScheme,
  type MmeTheme
} from "@momentarise/md-theme";
import { Plugin, PluginKey, TextSelection, type EditorState as ProseMirrorEditorState } from "prosemirror-state";
import { Decoration, DecorationSet, EditorView as ProseMirrorEditorView } from "prosemirror-view";
import {
  REFERENCE_AI_ACTIONS,
  referenceAiActionsForEntryPoint,
  resolveReferenceEditorPreferences,
  type ReferenceAiAction,
  type ReferenceAiActionId,
  type ReferenceEditorPreferenceInput,
  type ReferenceEditorPreferences
} from "./reference-surface.js";
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
let referenceSurfacePreferences: ReferenceEditorPreferences = resolveReferenceEditorPreferences();
const sourcePreferenceCompartments = createMomentariseSourceCompartments();

function toolbarIcon(name: IconName): string {
  return `<span class="toolbar-icon" aria-hidden="true">${defaultIconSet.render(name)}</span>`;
}

app.innerHTML = `
  <main class="shell reference-editor-shell" data-testid="reference-editor-shell">
    <header class="topbar reference-topbar">
      <div class="brand-lockup">
        <p class="eyebrow">Momentarise Markdown Editor</p>
        <h1>Markdown editor demo</h1>
      </div>
      <div class="topbar-actions editor-command-surface" data-testid="editor-command-surface" aria-label="Editor commands">
        <div class="command-group open-action-group" data-testid="open-action-group" aria-label="Open and export">
          <button class="button secondary open-file-button" type="button" data-testid="open-file-button">Open file</button>
          <button class="button secondary legacy-action" type="button" data-testid="open-local-file-button" tabindex="-1">Open .md</button>
          <button class="button secondary legacy-action" type="button" data-testid="open-html-file-button" tabindex="-1">Open .html</button>
          <button class="button secondary legacy-action" type="button" data-testid="import-copy-button" tabindex="-1">Import copy</button>
          <button class="button secondary utility-action compact-action" type="button" data-testid="copy-button" tabindex="-1">Copy</button>
          <button class="button secondary utility-action compact-action" type="button" data-testid="download-button" tabindex="-1">Download</button>
        </div>
        <input class="file-input" type="file" accept=".md,.markdown,.mdown,.txt,text/markdown,text/plain" data-testid="open-file-input" />
        <input class="file-input" type="file" accept=".md,.markdown,.mdown,.txt,text/markdown,text/plain" data-testid="import-copy-input" />
        <input class="file-input" type="file" accept=".html,.htm,text/html" data-testid="html-file-input" />
        <div class="mode-switch mode-control" role="group" aria-label="Editor mode">
          <button class="mode-button mode-switch-track" type="button" data-testid="source-mode-button" aria-label="Toggle Rich Mode" role="switch"><span aria-hidden="true"></span></button>
          <button class="mode-button mode-switch-label" type="button" data-testid="rich-mode-button">Rich Mode</button>
          <button class="mode-button preview-mode-pill" type="button" data-testid="preview-mode-button">Preview</button>
        </div>
        <details class="ai-command-surface" data-testid="ai-command-surface">
          <summary class="button secondary editor-ai-button" data-testid="editor-ai-button">AI</summary>
          <div class="floating-ai-menu" data-testid="editor-ai-menu" aria-label="AI writing actions">
            ${REFERENCE_AI_ACTIONS.map(
              (action: ReferenceAiAction) => `
                <button
                  class="ai-command-item"
                  type="button"
                  data-reference-ai-action="${action.id}"
                  data-testid="ai-action-${action.id}"
                >
                  <strong>${action.label}</strong>
                  <span>${action.entryPoints.slice(0, 3).join(", ")}</span>
                </button>`
            ).join("")}
          </div>
        </details>
        <button class="button secondary selected-text-ai-action utility-action" type="button" data-testid="selected-text-ai-action" tabindex="-1">Ask AI</button>
        <button class="button secondary command-palette-button utility-action" type="button" data-testid="command-palette-button" tabindex="-1">Cmd K</button>
        <details class="document-status-popover" data-testid="document-status-popover">
          <summary class="editor-status-button" data-testid="editor-status-button">
            <span data-testid="document-name">source-mode-fixture.md</span>
            <span data-testid="dirty-state">clean</span>
          </summary>
          <div class="document-status-menu">
            <p><span>Path</span><strong data-testid="document-path">fixture://source-mode-fixture.md</strong></p>
            <p><span>Target</span><strong class="target-label" data-testid="persistence-target">memory only, not persisted</strong></p>
            <p><span>Save</span><strong data-testid="save-state">memory saved (not persisted)</strong></p>
          </div>
        </details>
        <button class="button primary" type="button" data-testid="memory-save-button">Save</button>
      </div>
    </header>
    <p class="editor-notice" data-testid="editor-notice" role="status" hidden></p>

    <section class="workspace" aria-label="Markdown workspace">
      <div class="editor-region">
        <div class="ai-assistant-panel" data-testid="editor-ai-assistant-panel" role="dialog" aria-label="AI writing assistant" hidden>
          <div class="ai-assistant-header">
            <div>
              <p class="label">AI assistant</p>
              <p class="status-value" data-testid="editor-ai-status">No AI session</p>
            </div>
            <button class="button secondary" type="button" data-testid="editor-ai-panel-close">Close</button>
          </div>
          <div class="editor-ai-session-row">
            <label>
              Private session
              <input
                type="password"
                data-testid="editor-ai-byok-key-input"
                autocomplete="off"
                placeholder="Memory-only key"
                spellcheck="false"
              />
            </label>
            <button class="button secondary" type="button" data-testid="editor-ai-start-session-button">Connect</button>
          </div>
          <div class="ai-suggestion-preview editor-ai-suggestion-preview" data-testid="editor-ai-suggestion-preview" hidden></div>
          <div class="ai-suggestion-actions">
            <button class="button secondary" type="button" data-testid="editor-ai-accept-button" disabled>Accept</button>
            <button class="button secondary" type="button" data-testid="editor-ai-reject-button" disabled>Reject</button>
          </div>
        </div>
        <div class="command-palette" data-testid="command-palette" hidden>
          <div class="command-palette-panel">
            <label>
              Command
              <input type="text" data-testid="command-palette-input" autocomplete="off" placeholder="Search commands and AI actions" />
            </label>
            <div class="command-palette-items" data-testid="command-palette-items">
              ${REFERENCE_AI_ACTIONS.map(
                (action: ReferenceAiAction) => `
                  <button
                    class="ai-command-item"
                    type="button"
                    data-reference-ai-action="${action.id}"
                    data-testid="command-palette-ai-action-${action.id}"
                  >
                    <strong>${action.label}</strong>
                    <span>${action.entryPoints.join(", ")}</span>
                  </button>`
              ).join("")}
            </div>
          </div>
        </div>
        <div class="rich-command-toolbar" data-testid="rich-command-toolbar" aria-label="Rich editing toolbar" hidden>
          <button class="toolbar-button" type="button" data-rich-command="heading1" data-testid="toolbar-command-heading1">${toolbarIcon("heading")}<span>H1</span></button>
          <button class="toolbar-button" type="button" data-rich-command="heading2" data-testid="toolbar-command-heading2">${toolbarIcon("heading")}<span>H2</span></button>
          <button class="toolbar-button" type="button" data-rich-command="bold" data-testid="toolbar-command-bold" aria-label="Bold" title="Bold">${toolbarIcon("bold")}</button>
          <button class="toolbar-button" type="button" data-rich-command="italic" data-testid="toolbar-command-italic" aria-label="Italic" title="Italic">${toolbarIcon("italic")}</button>
          <button class="toolbar-button" type="button" data-rich-command="todo" data-testid="toolbar-command-todo">${toolbarIcon("todo")}<span>Todo</span></button>
          <button class="toolbar-button" type="button" data-rich-command="bulletList" data-testid="toolbar-command-bulletList">${toolbarIcon("list")}<span>List</span></button>
          <button class="toolbar-button" type="button" data-rich-command="blockquote" data-testid="toolbar-command-blockquote">${toolbarIcon("quote")}<span>Quote</span></button>
          <button class="toolbar-button" type="button" data-rich-command="codeBlock" data-testid="toolbar-command-codeBlock">${toolbarIcon("code")}<span>Code block</span></button>
          <button class="toolbar-button" type="button" data-rich-command="link" data-testid="toolbar-command-link">${toolbarIcon("link")}<span>Link</span></button>
          <button class="toolbar-button" type="button" data-rich-command="divider" data-testid="toolbar-command-divider">${toolbarIcon("divider")}<span>Divider</span></button>
          <button class="toolbar-button toolbar-ai-button" type="button" data-reference-ai-toolbar data-testid="toolbar-ai-button">${toolbarIcon("ai")}<span>AI</span></button>
          <div class="toolbar-more">
            <button class="toolbar-button" type="button" data-testid="toolbar-more-button" aria-expanded="false">${toolbarIcon("more")}<span>More</span></button>
            <div class="toolbar-more-menu" data-testid="toolbar-more-menu" hidden>
              <button class="toolbar-menu-item" type="button" data-rich-command="paragraph">${toolbarIcon("heading")}<span>Paragraph</span></button>
              <button class="toolbar-menu-item" type="button" data-rich-command="heading3">${toolbarIcon("heading")}<span>H3</span></button>
              <button class="toolbar-menu-item" type="button" data-rich-command="orderedList">${toolbarIcon("list")}<span>Numbered list</span></button>
              <button class="toolbar-menu-item" type="button" data-rich-command="callout">${toolbarIcon("quote")}<span>Callout</span></button>
              <button class="toolbar-menu-item" type="button" data-rich-command="toggleBlock" data-testid="toolbar-command-toggleBlock">${toolbarIcon("chevron")}<span>Toggle block</span></button>
              <button class="toolbar-menu-item" type="button" data-rich-command="image">${toolbarIcon("image")}<span>Image</span></button>
              <button class="toolbar-menu-item" type="button" data-rich-command="inlineCode">${toolbarIcon("code")}<span>Inline code</span></button>
            </div>
          </div>
        </div>
        <div class="rich-block-controls" data-testid="rich-block-controls" aria-label="Rich block controls" hidden>
          <div class="code-block-controls" data-testid="code-block-controls" hidden>
            <label>
              Language
              <input type="text" data-testid="code-language-input" autocomplete="off" spellcheck="false" />
            </label>
            <label>
              Meta
              <input type="text" data-testid="code-meta-input" autocomplete="off" spellcheck="false" />
            </label>
          </div>
          <button class="toolbar-button" type="button" data-testid="insert-after-block-button">Add paragraph</button>
        </div>
        <div class="slash-command-menu" data-testid="slash-command-menu" hidden>
          <p class="slash-command-query" data-testid="slash-command-query">/</p>
          <div class="slash-command-items" data-slash-command-items></div>
        </div>
        <div class="editor-host" data-editor-host data-testid="editor-host"></div>
        <div class="rich-editor-host" data-testid="rich-editor-host" hidden></div>
        <div class="html-preview-host" data-testid="html-preview-host" hidden>
          <div class="html-preview-banner" data-testid="html-preview-banner">
            HTML artifact preview · sandboxed · scripts disabled
          </div>
          <iframe
            class="html-preview-frame"
            data-testid="html-preview-frame"
            referrerpolicy="no-referrer"
            sandbox="allow-same-origin"
            title="Sandboxed HTML preview"
          ></iframe>
        </div>
      </div>

      <details class="debug-inspector inspector" data-testid="debug-inspector">
        <summary class="debug-inspector-toggle" data-testid="debug-inspector-toggle">Technical diagnostics</summary>
        <aside class="debug-inspector-body" aria-label="Document status">
        <section class="status-block debug-actions">
          <p class="label">Debug actions</p>
          <button class="button secondary" type="button" data-testid="simulate-conflict-button">Simulate conflict</button>
          <details class="surface-settings-panel" data-testid="surface-settings-panel">
            <summary class="button secondary">Surface settings contract</summary>
            <div class="surface-settings-menu">
              <p><span>Toolbar</span><strong data-testid="surface-toolbar-pref">${referenceSurfacePreferences.toolbarMode}, ${referenceSurfacePreferences.toolbarStyle}</strong></p>
              <p><span>AI entry points</span><strong data-testid="surface-ai-entry-points-pref">${referenceSurfacePreferences.aiEntryPoints.join(", ")}</strong></p>
              <p><span>Status disclosure</span><strong data-testid="surface-status-disclosure-pref">${referenceSurfacePreferences.technicalStatusDisclosure}</strong></p>
              <p><span>Layout</span><strong data-testid="surface-layout-pref">${referenceSurfacePreferences.layoutDensity}, ${referenceSurfacePreferences.readableLineWidth}px</strong></p>
              <p><span>Keymap</span><strong data-testid="surface-keymap-pref">${referenceSurfacePreferences.keymapProfile}</strong></p>
            </div>
          </details>
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
        <section class="status-block ai-writing-panel" data-testid="ai-writing-panel">
          <p class="label">AI writing</p>
          <div class="ai-writing-controls">
            <label>
              BYOK session
              <input
                type="password"
                data-testid="ai-byok-key-input"
                autocomplete="off"
                placeholder="Session key, memory only"
                spellcheck="false"
              />
            </label>
            <button class="button secondary" type="button" data-testid="ai-start-session-button">Start</button>
            <label>
              Action
              <select data-testid="ai-action-select">
                <option value="improve">Improve</option>
                <option value="rewrite">Rewrite</option>
                <option value="complete">Complete</option>
                <option value="summarize">Summarize</option>
                <option value="generate-title">Title</option>
                <option value="insert-block">Insert block</option>
              </select>
            </label>
            <label>
              Prompt
              <textarea data-testid="ai-prompt-input" rows="3" placeholder="Optional instruction"></textarea>
            </label>
            <button class="button primary" type="button" data-testid="ai-generate-button">Generate</button>
          </div>
          <p class="ai-policy-note" data-testid="ai-policy-note">Policy checked before content leaves the editor.</p>
          <div class="ai-suggestion-preview" data-testid="ai-suggestion-preview" hidden></div>
          <div class="ai-suggestion-actions">
            <button class="button secondary" type="button" data-testid="ai-accept-button" disabled>Accept</button>
            <button class="button secondary" type="button" data-testid="ai-reject-button" disabled>Reject</button>
          </div>
          <p class="status-value" data-testid="ai-status">No AI session</p>
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
        <section class="status-block html-preview-status-block" data-testid="html-preview-status-block" hidden>
          <p class="label">HTML Preview</p>
          <p class="status-value" data-testid="html-preview-status">HTML artifact preview unavailable</p>
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
      </details>
    </section>
  </main>
`;

const editorHost = queryRequired<HTMLDivElement>("[data-editor-host]");
const editorRegion = queryRequired<HTMLDivElement>(".editor-region");
const richEditorHost = queryRequired<HTMLDivElement>('[data-testid="rich-editor-host"]');
const htmlPreviewHost = queryRequired<HTMLDivElement>('[data-testid="html-preview-host"]');
const htmlPreviewBanner = queryRequired<HTMLDivElement>('[data-testid="html-preview-banner"]');
const htmlPreviewFrame = queryRequired<HTMLIFrameElement>('[data-testid="html-preview-frame"]');
const sourceModeButton = queryRequired<HTMLButtonElement>('[data-testid="source-mode-button"]');
const richModeButton = queryRequired<HTMLButtonElement>('[data-testid="rich-mode-button"]');
const previewModeButton = queryRequired<HTMLButtonElement>('[data-testid="preview-mode-button"]');
const richCommandToolbar = queryRequired<HTMLDivElement>('[data-testid="rich-command-toolbar"]');
const toolbarAiButton = queryRequired<HTMLButtonElement>('[data-testid="toolbar-ai-button"]');
const toolbarMoreButton = queryRequired<HTMLButtonElement>('[data-testid="toolbar-more-button"]');
const toolbarMoreMenu = queryRequired<HTMLDivElement>('[data-testid="toolbar-more-menu"]');
const richBlockControls = queryRequired<HTMLDivElement>('[data-testid="rich-block-controls"]');
const codeBlockControls = queryRequired<HTMLDivElement>('[data-testid="code-block-controls"]');
const codeLanguageInput = queryRequired<HTMLInputElement>('[data-testid="code-language-input"]');
const codeMetaInput = queryRequired<HTMLInputElement>('[data-testid="code-meta-input"]');
const insertAfterBlockButton = queryRequired<HTMLButtonElement>('[data-testid="insert-after-block-button"]');
const slashCommandMenu = queryRequired<HTMLDivElement>('[data-testid="slash-command-menu"]');
const slashCommandQueryElement = queryRequired<HTMLElement>('[data-testid="slash-command-query"]');
const slashCommandItemsElement = queryRequired<HTMLDivElement>("[data-slash-command-items]");
const openFileButton = queryRequired<HTMLButtonElement>('[data-testid="open-file-button"]');
const openFileInput = queryRequired<HTMLInputElement>('[data-testid="open-file-input"]');
const openLocalFileButton = queryRequired<HTMLButtonElement>('[data-testid="open-local-file-button"]');
const openHtmlFileButton = queryRequired<HTMLButtonElement>('[data-testid="open-html-file-button"]');
const importCopyButton = queryRequired<HTMLButtonElement>('[data-testid="import-copy-button"]');
const importCopyInput = queryRequired<HTMLInputElement>('[data-testid="import-copy-input"]');
const htmlFileInput = queryRequired<HTMLInputElement>('[data-testid="html-file-input"]');
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
const aiByokKeyInput = queryRequired<HTMLInputElement>('[data-testid="ai-byok-key-input"]');
const aiStartSessionButton = queryRequired<HTMLButtonElement>('[data-testid="ai-start-session-button"]');
const aiActionSelect = queryRequired<HTMLSelectElement>('[data-testid="ai-action-select"]');
const aiPromptInput = queryRequired<HTMLTextAreaElement>('[data-testid="ai-prompt-input"]');
const aiGenerateButton = queryRequired<HTMLButtonElement>('[data-testid="ai-generate-button"]');
const aiAcceptButton = queryRequired<HTMLButtonElement>('[data-testid="ai-accept-button"]');
const aiRejectButton = queryRequired<HTMLButtonElement>('[data-testid="ai-reject-button"]');
const aiPolicyNoteElement = queryRequired<HTMLElement>('[data-testid="ai-policy-note"]');
const aiSuggestionPreview = queryRequired<HTMLDivElement>('[data-testid="ai-suggestion-preview"]');
const aiStatusElement = queryRequired<HTMLElement>('[data-testid="ai-status"]');
const diagnosticsElement = queryRequired<HTMLOListElement>('[data-testid="roundtrip-diagnostics"]');
const editorSurfaceStateElement = queryRequired<HTMLElement>('[data-testid="editor-surface-state"]');
const htmlPreviewStatusBlock = queryRequired<HTMLElement>('[data-testid="html-preview-status-block"]');
const htmlPreviewStatusElement = queryRequired<HTMLElement>('[data-testid="html-preview-status"]');
const aiCommandSurface = queryRequired<HTMLDetailsElement>('[data-testid="ai-command-surface"]');
const selectedTextAiAction = queryRequired<HTMLButtonElement>('[data-testid="selected-text-ai-action"]');
const commandPaletteButton = queryRequired<HTMLButtonElement>('[data-testid="command-palette-button"]');
const commandPalette = queryRequired<HTMLDivElement>('[data-testid="command-palette"]');
const commandPaletteInput = queryRequired<HTMLInputElement>('[data-testid="command-palette-input"]');
const commandPaletteItems = queryRequired<HTMLDivElement>('[data-testid="command-palette-items"]');
const editorAiAssistantPanel = queryRequired<HTMLDivElement>('[data-testid="editor-ai-assistant-panel"]');
const editorAiByokKeyInput = queryRequired<HTMLInputElement>('[data-testid="editor-ai-byok-key-input"]');
const editorAiStartSessionButton = queryRequired<HTMLButtonElement>('[data-testid="editor-ai-start-session-button"]');
const editorAiPanelCloseButton = queryRequired<HTMLButtonElement>('[data-testid="editor-ai-panel-close"]');
const editorAiStatusElement = queryRequired<HTMLElement>('[data-testid="editor-ai-status"]');
const editorAiSuggestionPreview = queryRequired<HTMLDivElement>('[data-testid="editor-ai-suggestion-preview"]');
const editorAiAcceptButton = queryRequired<HTMLButtonElement>('[data-testid="editor-ai-accept-button"]');
const editorAiRejectButton = queryRequired<HTMLButtonElement>('[data-testid="editor-ai-reject-button"]');
const documentStatusPopover = queryRequired<HTMLDetailsElement>('[data-testid="document-status-popover"]');
const surfaceSettingsPanel = queryRequired<HTMLDetailsElement>('[data-testid="surface-settings-panel"]');
const debugInspector = queryRequired<HTMLDetailsElement>('[data-testid="debug-inspector"]');
const editorNotice = queryRequired<HTMLElement>('[data-testid="editor-notice"]');
const surfaceToolbarPrefElement = queryRequired<HTMLElement>('[data-testid="surface-toolbar-pref"]');
const surfaceAiEntryPointsPrefElement = queryRequired<HTMLElement>('[data-testid="surface-ai-entry-points-pref"]');
const surfaceStatusDisclosurePrefElement = queryRequired<HTMLElement>('[data-testid="surface-status-disclosure-pref"]');
const surfaceLayoutPrefElement = queryRequired<HTMLElement>('[data-testid="surface-layout-pref"]');
const surfaceKeymapPrefElement = queryRequired<HTMLElement>('[data-testid="surface-keymap-pref"]');

let eventCounter = 0;
let lastCopiedMarkdown: string | null = null;
const markdownAstFormatter = createMarkdownAstFormatter();
type DemoDocumentMode = "fixture" | WebOpenedMarkdownMode;
type DemoDocumentKind = "markdown" | "html-artifact";
type DemoEditorMode = "source" | "rich" | "preview";
type PropertiesDisplayMode = "visible" | "hidden" | "source";

interface SlashCommandState {
  readonly from: number;
  readonly items: readonly RichMarkdownCommand[];
  readonly open: boolean;
  readonly query: string;
  readonly to: number;
}

interface ActiveDemoDocument {
  readonly fileName: string;
  readonly kind: DemoDocumentKind;
  readonly mode: DemoDocumentMode;
  readonly pathLabel: string;
  readonly readDiskContent?: () => string;
  readonly simulateExternalChange?: (content: string) => void;
}

interface RestorableDemoDocument {
  readonly content: string;
  readonly editorMode: DemoEditorMode;
  readonly fileName: string;
  readonly kind: DemoDocumentKind;
  readonly version: 1;
}

const fixtureSaveTarget = createMemorySaveTarget({
  initialContent: fixtureMarkdown,
  targetLabel: "fixture://source-mode-fixture.md"
});
const lastDemoDocumentStorageKey = "momentarise-md-demo:last-document:v1";
const demoAiPolicyResolver = createDefaultPolicyResolver();
let demoAiProvider: MockAiProvider = createMockAiProvider();
let session: MarkdownEditorSession = createDemoSession(fixtureMarkdown, fixtureSaveTarget, "fixture://source-mode-fixture.md");
let activeDocument: ActiveDemoDocument = {
  fileName: "source-mode-fixture.md",
  kind: "markdown",
  mode: "fixture",
  pathLabel: "fixture://source-mode-fixture.md",
  readDiskContent: fixtureSaveTarget.readContent,
  simulateExternalChange: fixtureSaveTarget.simulateExternalChange
};
let lastSaveAction = "loaded fixture";
let editorMode: DemoEditorMode = "source";
let propertiesDisplayMode: PropertiesDisplayMode = "visible";
let richState: RichMarkdownState = createRichMarkdownState(fixtureMarkdown, {
  dialect: "momentarise-enhanced"
});
let richEditor: ProseMirrorEditorView | null = null;
let foldStates: readonly FoldState[] = [];
let htmlPreviewDescriptor: SandboxedHtmlPreviewDescriptor | null = null;
let richBaselineMarkdown = fixtureMarkdown;
let richChanged = false;
let slashCommandState: SlashCommandState = {
  from: 0,
  items: [],
  open: false,
  query: "",
  to: 0
};
let slashCommandSelectedIndex = 0;
const richFoldingPluginKey = new PluginKey<DecorationSet>("momentarise-demo-rich-folding");
let aiSessionStarted = false;
let commandPaletteSelectedIndex = 0;

function saveFromKeyboardShortcut(): boolean {
  memorySave("keyboard shortcut");
  return true;
}

function createDemoSession(content: string, target: SaveTarget, path: string | null): MarkdownEditorSession {
  return createMarkdownEditorSession({
    aiProvider: demoAiProvider,
    autosaveDelayMs: 1000,
    content,
    path,
    policyResolver: demoAiPolicyResolver,
    scheduler: {
      schedule(callback, delayMs) {
        const id = window.setTimeout(() => {
          void callback();
        }, delayMs);
        return () => window.clearTimeout(id);
      }
    },
    target
  });
}

function replaceDemoSession(content: string, target: SaveTarget, path: string | null): void {
  session.destroy();
  session = createDemoSession(content, target, path);
  aiSessionStarted = false;
}

const editor = new CodeMirrorEditorView({
  parent: editorHost,
  state: EditorState.create({
    doc: fixtureMarkdown,
    extensions: [
      ...createMomentariseSourceExtensions({
        compartments: sourcePreferenceCompartments,
        onSave: saveFromKeyboardShortcut,
        preferences: sourcePreferencesFromReferenceSurface()
      }),
      CodeMirrorEditorView.updateListener.of((update) => {
        if (update.docChanged && editorMode === "source") {
          session.setContent(editor.state.doc.toString(), "source-view");
          persistRestorableDocument();
          renderSaveState();
          updateRoundTripStatus();
          if (activeDocument.kind === "html-artifact") {
            renderHtmlPreview();
          }
        }
        if (update.selectionSet && editorMode === "source") {
          renderReferenceSurfaceState();
        }
      }),
    ]
  })
});

if (!restoreLastDemoDocument()) {
  renderEditorMode();
}

sourceModeButton.addEventListener("click", () => {
  if (activeDocument.kind === "markdown") {
    toggleRichMode();
    return;
  }
  switchEditorMode("source");
});

richModeButton.addEventListener("click", () => {
  toggleRichMode();
});

previewModeButton.addEventListener("click", () => {
  switchEditorMode("preview");
});

richCommandToolbar.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }
  if (target.closest<HTMLElement>("[data-reference-ai-toolbar]")) {
    if (!isAiEntryPointEnabled("toolbar")) {
      return;
    }
    openAiCommandSurface();
    return;
  }
  const commandElement = target.closest<HTMLElement>("[data-rich-command]");
  if (!commandElement) {
    return;
  }
  runRichCommand(commandElement.dataset.richCommand as RichCommandId);
});

toolbarMoreButton.addEventListener("click", () => {
  const expanded = toolbarMoreButton.getAttribute("aria-expanded") === "true";
  setToolbarMoreOpen(!expanded);
});

codeLanguageInput.addEventListener("input", () => {
  updateCurrentCodeBlockInfoFromControls();
});

codeMetaInput.addEventListener("input", () => {
  updateCurrentCodeBlockInfoFromControls();
});

insertAfterBlockButton.addEventListener("click", () => {
  insertParagraphAfterCurrentRichBlock();
});

slashCommandItemsElement.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }
  const aiCommandElement = target.closest<HTMLElement>("[data-reference-ai-action]");
  if (aiCommandElement) {
    closeSlashMenu();
    void runEditorNativeAiCommand(aiCommandElement.dataset.referenceAiAction as ReferenceAiActionId);
    return;
  }
  const commandElement = target.closest<HTMLElement>("[data-slash-command]");
  if (!commandElement) {
    return;
  }
  runRichCommand(commandElement.dataset.slashCommand as RichCommandId);
});

openFileButton.addEventListener("click", () => {
  void openLocalFile();
});

openFileInput.addEventListener("change", () => {
  const [file] = Array.from(openFileInput.files ?? []);
  openFileInput.value = "";
  if (!file) {
    return;
  }
  if (isHtmlFileName(file.name)) {
    setEditorNotice("HTML artifacts use the separate HTML reader; primary Open file is for writable Markdown files.");
    logEvent("HTML artifact was not opened through primary Open file; use the HTML reader instead.");
    return;
  }
  void importMarkdownCopy(file);
});

openLocalFileButton.addEventListener("click", () => {
  void openLocalMarkdownFile();
});

openHtmlFileButton.addEventListener("click", () => {
  htmlFileInput.click();
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

htmlFileInput.addEventListener("change", () => {
  const [file] = Array.from(htmlFileInput.files ?? []);
  htmlFileInput.value = "";
  if (file) {
    void importHtmlArtifact(file);
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

aiStartSessionButton.addEventListener("click", () => {
  startAiSession();
});

aiGenerateButton.addEventListener("click", () => {
  void generateAiSuggestion();
});

aiAcceptButton.addEventListener("click", () => {
  acceptPendingAiSuggestion();
});

aiRejectButton.addEventListener("click", () => {
  rejectPendingAiSuggestion();
});

aiCommandSurface.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }
  const actionElement = target.closest<HTMLElement>("[data-reference-ai-action]");
  if (!actionElement) {
    return;
  }
  event.preventDefault();
  aiCommandSurface.open = false;
  void runEditorNativeAiCommand(actionElement.dataset.referenceAiAction as ReferenceAiActionId);
});

selectedTextAiAction.addEventListener("click", () => {
  if (!isAiEntryPointEnabled("selection")) {
    return;
  }
  void runEditorNativeAiCommand("rewrite");
});

commandPaletteButton.addEventListener("click", () => {
  if (!isAiEntryPointEnabled("command-palette")) {
    return;
  }
  setCommandPaletteOpen(true);
});

commandPalette.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }
  if (target === commandPalette) {
    setCommandPaletteOpen(false);
    return;
  }
  const actionElement = target.closest<HTMLElement>("[data-reference-ai-action]");
  if (!actionElement) {
    return;
  }
  setCommandPaletteOpen(false);
  void runEditorNativeAiCommand(actionElement.dataset.referenceAiAction as ReferenceAiActionId);
});

commandPaletteInput.addEventListener("input", () => {
  commandPaletteSelectedIndex = 0;
  renderCommandPaletteItems();
});

commandPaletteInput.addEventListener("keydown", (event) => {
  if (handleCommandPaletteKeyboard(event)) {
    event.preventDefault();
  }
});

editorAiStartSessionButton.addEventListener("click", () => {
  startAiSessionFromKey(editorAiByokKeyInput.value.trim());
});

editorAiPanelCloseButton.addEventListener("click", () => {
  editorAiAssistantPanel.hidden = true;
});

editorAiAcceptButton.addEventListener("click", () => {
  acceptPendingAiSuggestion();
});

editorAiRejectButton.addEventListener("click", () => {
  rejectPendingAiSuggestion();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden" && sessionShouldBlockClose()) {
    void flushSave("tab-switch");
  }
});

document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    if (!isAiEntryPointEnabled("command-palette")) {
      return;
    }
    event.preventDefault();
    setCommandPaletteOpen(true);
    return;
  }
  if (event.key === "Escape" && !commandPalette.hidden) {
    event.preventDefault();
    setCommandPaletteOpen(false);
  }
});

window.addEventListener("beforeunload", (event) => {
  if (!sessionShouldBlockClose()) {
    return;
  }
  event.preventDefault();
  event.returnValue = "";
});

logEvent("Loaded built-in fixture in memory-only mode.");
renderAiWritingState();
renderSaveState();
updateRoundTripStatus();

window.__MME_DEMO_VISUAL_CHECK__ = {
  editor,
  applyHostThemeForTest,
  getMarkdown,
  getEditorMode() {
    return editorMode;
  },
  getRichText() {
    return richEditor?.state.doc.textContent ?? "";
  },
  getSlashMenuState() {
    return {
      aiItems: matchingReferenceAiSlashActions(slashCommandState.query).slice(0, 4).map((item) => item.id),
      items: slashCommandState.items.map((item) => item.id),
      open: slashCommandState.open,
      query: slashCommandState.query,
      selectedAiId:
        slashCommandSelectedIndex >= slashCommandState.items.length
          ? matchingReferenceAiSlashActions(slashCommandState.query).slice(0, 4)[slashCommandSelectedIndex - slashCommandState.items.length]?.id ?? null
          : null,
      selectedId: slashCommandState.items[slashCommandSelectedIndex]?.id ?? null,
      selectedIndex: slashCommandSelectedIndex
    };
  },
  getToolbarState() {
    return {
      commands: richCommandRegistry.map((command) => command.id),
      moreOpen: !toolbarMoreMenu.hidden,
      visible: !richCommandToolbar.hidden
    };
  },
  getRichUxState() {
    return {
      blockControlsVisible: !richBlockControls.hidden,
      codeControlsVisible: !codeBlockControls.hidden,
      codeLanguage: codeLanguageInput.value,
      codeMeta: codeMetaInput.value,
      markdown: getMarkdown()
    };
  },
  getFoldState() {
    const visibility = getRichFoldVisibility(richState, foldStates);
    return {
      ...visibility,
      folds: foldStates,
      items: getRichHeadingFoldItems(richState, foldStates)
    };
  },
  getLastCopiedMarkdown() {
    return lastCopiedMarkdown;
  },
  getActiveDocument() {
    return {
      fileName: activeDocument.fileName,
      kind: activeDocument.kind,
      mode: activeDocument.mode,
      pathLabel: activeDocument.pathLabel
    };
  },
  getHtmlPreviewState() {
    return {
      available: activeDocument.kind === "html-artifact",
      bannerText: htmlPreviewBanner.textContent ?? "",
      fileName: htmlPreviewDescriptor?.fileName ?? null,
      frameSandbox: htmlPreviewFrame.getAttribute("sandbox"),
      frameSrcdocLength: htmlPreviewFrame.getAttribute("srcdoc")?.length ?? 0,
      sandbox: htmlPreviewDescriptor?.sandbox ?? null,
      scriptsEnabled: htmlPreviewDescriptor?.scriptsEnabled ?? false,
      statusText: htmlPreviewStatusElement.textContent ?? "",
      warnings: htmlPreviewDescriptor?.warnings.map((warning) => warning.code) ?? []
    };
  },
  getAiWritingState() {
    return getAiWritingState();
  },
  getReferenceSurfaceState() {
    return getReferenceSurfaceState();
  },
  setReferenceSurfacePreferencesForTest(preferences: ReferenceEditorPreferenceInput) {
    setReferenceSurfacePreferences(preferences);
  },
  getSaveState() {
    return session.getSaveState();
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
  loadHtmlArtifactForTest(fileName: string, content: string) {
    loadHtmlArtifact(fileName, content, "test HTML artifact");
  },
  loadAiPolicyDeniedDocumentForTest() {
    loadOpenedMarkdownFile(createImportedCopyDocument({ content: "# Secret\n\nDo not send.\n", fileName: ".env" }), {
      sourceLabel: "AI policy denied fixture"
    });
  },
  startMockAiSessionForTest() {
    aiByokKeyInput.value = "sk-test-visual-redacted";
    startAiSession();
  },
  generateAiSuggestionForTest(action: AiWritingAction = "improve", prompt = "Make it clearer.") {
    aiActionSelect.value = action;
    aiPromptInput.value = prompt;
    return generateAiSuggestion();
  },
  acceptAiSuggestionForTest() {
    acceptPendingAiSuggestion();
  },
  showUnsupportedLocalFileStateForTest() {
    showUnsupportedLocalFileState();
  },
  showRealFileOpenUnavailableForTest() {
    showRealFileOpenUnavailable();
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
  openSlashMenuForTest(query: string) {
    openSlashMenuForTest(query);
  },
  runRichCommand(commandId: RichCommandId, options?: ApplyRichMarkdownCommandOptions) {
    runRichCommand(commandId, options);
  },
  insertParagraphAfterCurrentRichBlock() {
    insertParagraphAfterCurrentRichBlock();
  },
  toggleCurrentRichTodo() {
    toggleCurrentRichTodo();
  },
  toggleRichFoldForText(text: string) {
    toggleRichFoldForText(text);
  },
  switchEditorMode(mode: DemoEditorMode) {
    switchEditorMode(mode);
  }
};

async function openLocalFile(): Promise<void> {
  if (!canUseFileSystemAccess()) {
    showRealFileOpenUnavailable();
    return;
  }

  const fileAccessHost = window as unknown as {
    showOpenFilePicker?: (options?: {
      readonly excludeAcceptAllOption?: boolean;
      readonly multiple?: boolean;
      readonly types?: readonly {
        readonly accept: Readonly<Record<string, readonly string[]>>;
        readonly description: string;
      }[];
    }) => Promise<readonly WebFileHandleLike[]>;
  };

  try {
    const [handle] =
      (await fileAccessHost.showOpenFilePicker?.({
        excludeAcceptAllOption: true,
        multiple: false,
        types: [
          {
            accept: {
              "text/markdown": [".md", ".markdown", ".mdown"],
              "text/plain": [".md", ".markdown", ".mdown", ".txt"]
            },
            description: "Writable Markdown or text files"
          }
        ]
      })) ?? [];
    if (!handle) {
      throw new Error("No file handle was selected.");
    }

    const file = await handle.getFile();
    const fileName = file.name || handle.name;
    const rawContent = await file.text();
    if (isHtmlFileName(fileName)) {
      lastSaveAction = "HTML artifacts use the separate HTML reader";
      setEditorNotice("HTML artifacts use the separate HTML reader; primary Open file is for writable Markdown files.");
      logEvent("HTML artifact was not opened through primary Open file; use the HTML reader instead.");
      renderSaveState();
      return;
    }

    const lineEnding = detectMarkdownLineEnding(rawContent);
    const content = normalizeMarkdownLineEndings(rawContent);
    loadOpenedMarkdownFile(
      {
        content,
        fileName,
        mode: "writable-file",
        pathLabel: `disk://${fileName}`,
        target: createWritableFileSaveTarget({
          handle,
          lineEnding,
          targetLabel: `disk://${fileName}`
        })
      },
      {
        sourceLabel: "local file picker"
      }
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      lastSaveAction = "open cancelled";
      clearEditorNotice();
      logEvent("Open file cancelled.");
    } else {
      lastSaveAction = `open failed: ${errorMessage(error)}`;
      setEditorNotice(`Open failed: ${errorMessage(error)}`);
      logEvent(`Open file failed: ${errorMessage(error)}`);
    }
    renderSaveState();
  }
}

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
  const content = getMarkdown();
  const unsupportedTarget: SaveTarget = {
    persistenceTarget: "unsupported",
    targetLabel: "unsupported://local-file-access"
  };
  activeDocument = {
    fileName: activeDocument.fileName,
    kind: "markdown",
    mode: "unsupported",
    pathLabel: "unsupported://local-file-access"
  };
  htmlPreviewDescriptor = null;
  if (editorMode === "preview") {
    editorMode = "source";
  }
  replaceDemoSession(content, unsupportedTarget, activeDocument.pathLabel);
  lastSaveAction = "real local file open unavailable in this browser";
  setEditorNotice(realFileOpenUnavailableMessage());
  logEvent("Real local file open is unavailable in this browser; no original file handle was granted.");
  renderEditorMode();
  renderSaveState();
  updateRoundTripStatus();
}

function showRealFileOpenUnavailable(): void {
  lastSaveAction = "real local file open unavailable in this browser";
  setEditorNotice(realFileOpenUnavailableMessage());
  logEvent("Real local file open is unavailable in this browser; the current document was left unchanged.");
  renderSaveState();
}

async function importMarkdownCopy(file: File): Promise<void> {
  const content = await file.text();
  loadOpenedMarkdownFile(createImportedCopyDocument({ content, fileName: file.name }), {
    sourceLabel: "fallback import"
  });
}

async function importHtmlArtifact(file: File): Promise<void> {
  const content = await file.text();
  if (!isHtmlFileName(file.name)) {
    logEvent(`Opened ${file.name} through the HTML artifact reader based on explicit user selection.`);
  }
  loadHtmlArtifact(file.name, content, "HTML file reader");
}

function loadHtmlArtifact(fileName: string, content: string, sourceLabel: string): void {
  const targetLabel = `html-artifact://${fileName}`;
  activeDocument = {
    fileName,
    kind: "html-artifact",
    mode: "imported-copy",
    pathLabel: targetLabel
  };
  const target = createDownloadRequiredSaveTarget({
    initialContent: content,
    targetLabel
  });
  replaceDemoSession(content, target, targetLabel);
  foldStates = [];
  lastCopiedMarkdown = null;
  lastSaveAction = "opened HTML artifact preview; original file is not overwritten";
  clearEditorNotice();
  replaceEditorDocument(content);
  destroyRichEditor();
  editorMode = "source";
  htmlPreviewDescriptor = createSandboxedHtmlPreview({
    fileName,
    html: content
  });
  renderHtmlPreview();
  logEvent(`Opened ${fileName} as HTML artifact via ${sourceLabel}; preview is sandboxed and scripts are disabled.`);
  renderEditorMode();
  renderSaveState();
  updateRoundTripStatus();
  persistRestorableDocument();
}

function loadOpenedMarkdownFile(
  opened: WebOpenedMarkdownFile,
  options: {
    readonly readDiskContent?: () => string;
    readonly simulateExternalChange?: (content: string) => void;
    readonly sourceLabel?: string;
  } = {}
): void {
  let nextDocument: ActiveDemoDocument = {
    fileName: opened.fileName,
    kind: "markdown",
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
  replaceDemoSession(opened.content, opened.target, opened.pathLabel);
  foldStates = [];
  htmlPreviewDescriptor = null;
  lastCopiedMarkdown = null;
  lastSaveAction = `opened ${documentModeLabel(opened.mode)} document`;
  clearEditorNotice();
  replaceEditorDocument(opened.content);
  if (editorMode === "preview") {
    editorMode = "source";
  }
  if (editorMode === "rich") {
    mountRichEditor(opened.content);
  }
  logEvent(`Opened ${opened.fileName} as ${documentModeLabel(opened.mode)} via ${options.sourceLabel ?? "document loader"}.`);
  renderEditorMode();
  renderSaveState();
  updateRoundTripStatus();
  persistRestorableDocument();
}

function destroyRichEditor(): void {
  richEditor?.destroy();
  richEditor = null;
  richEditorHost.replaceChildren();
  richChanged = false;
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
  if (mode === "rich" && activeDocument.kind !== "markdown") {
    logEvent("Rich mode is unavailable for HTML artifacts; use Source or Preview.");
    renderEditorMode();
    return;
  }
  if (mode === "preview" && activeDocument.kind !== "html-artifact") {
    logEvent("Preview mode is only available for HTML artifacts in this V0 slice.");
    renderEditorMode();
    return;
  }

  if (mode === "rich") {
    mountRichEditor(editor.state.doc.toString());
    editorMode = "rich";
    logEvent("Switched to ProseMirror rich mode.");
  } else if (mode === "preview") {
    if (richChanged) {
      syncRichMarkdownToSource("mode switch");
    }
    renderHtmlPreview();
    editorMode = "preview";
    logEvent("Switched to sandboxed HTML preview mode.");
  } else {
    if (richChanged) {
      syncRichMarkdownToSource("mode switch");
    } else if (editorMode === "rich") {
      replaceEditorDocument(richBaselineMarkdown);
    }
    editorMode = "source";
    editor.focus();
    logEvent("Switched to CodeMirror source mode.");
  }

  renderEditorMode();
  renderSaveState();
  updateRoundTripStatus();
  persistRestorableDocument();
  void flushSave("mode-switch");
}

function renderEditorMode(): void {
  app.dataset.documentKind = activeDocument.kind;
  app.dataset.editorMode = editorMode;
  editorHost.hidden = editorMode !== "source";
  richEditorHost.hidden = editorMode !== "rich";
  htmlPreviewHost.hidden = editorMode !== "preview";
  richCommandToolbar.hidden = editorMode !== "rich";
  richBlockControls.hidden = editorMode !== "rich";
  sourceModeButton.setAttribute("aria-pressed", String(editorMode === "source"));
  sourceModeButton.setAttribute("aria-checked", String(editorMode === "rich"));
  richModeButton.setAttribute("aria-pressed", String(editorMode === "rich"));
  previewModeButton.setAttribute("aria-pressed", String(editorMode === "preview"));
  richModeButton.disabled = activeDocument.kind !== "markdown";
  richModeButton.hidden = activeDocument.kind !== "markdown";
  previewModeButton.disabled = activeDocument.kind !== "html-artifact";
  previewModeButton.hidden = activeDocument.kind !== "html-artifact";
  htmlPreviewStatusBlock.hidden = activeDocument.kind !== "html-artifact";
  if (editorMode === "preview") {
    editorSurfaceStateElement.textContent = "Sandboxed HTML preview";
  } else {
    editorSurfaceStateElement.textContent = editorMode === "rich" ? "ProseMirror rich mode" : "CodeMirror source mode";
  }
  if (editorMode !== "rich") {
    closeSlashMenu();
    setToolbarMoreOpen(false);
    renderRichBlockControls();
  }
  if (editorMode === "preview") {
    renderHtmlPreview();
  }
  renderRichFoldingUi();
  renderReferenceSurfaceState();
}

function toggleRichMode(): void {
  if (activeDocument.kind !== "markdown") {
    return;
  }
  switchEditorMode(editorMode === "rich" ? "source" : "rich");
}

function renderHtmlPreview(): void {
  if (activeDocument.kind !== "html-artifact") {
    htmlPreviewFrame.removeAttribute("srcdoc");
    htmlPreviewFrame.setAttribute("sandbox", "");
    htmlPreviewBanner.textContent = "HTML artifact preview unavailable";
    htmlPreviewStatusElement.textContent = "HTML artifact preview unavailable";
    return;
  }

  htmlPreviewDescriptor = createSandboxedHtmlPreview({
    fileName: activeDocument.fileName,
    html: editor.state.doc.toString()
  });
  htmlPreviewFrame.setAttribute("sandbox", htmlPreviewDescriptor.sandbox);
  htmlPreviewFrame.srcdoc = htmlPreviewDescriptor.srcdoc;
  htmlPreviewBanner.textContent = `${activeDocument.fileName} · HTML artifact preview · sandboxed · scripts disabled`;
  htmlPreviewStatusElement.textContent = htmlPreviewStatusLabel(htmlPreviewDescriptor);
}

function startAiSession(): void {
  startAiSessionFromKey(aiByokKeyInput.value.trim());
}

function startAiSessionFromKey(apiKey: string): void {
  if (!apiKey) {
    aiStatusElement.textContent = "Enter a BYOK session key to start mock AI.";
    editorAiStatusElement.textContent = "Paste a memory-only key to connect a private AI session.";
    editorAiAssistantPanel.hidden = false;
    return;
  }

  session.startAiSession(apiKey);
  aiSessionStarted = true;
  aiByokKeyInput.value = "";
  editorAiByokKeyInput.value = "";
  logEvent("AI writing session started with mock provider. BYOK key was kept memory-only.");
  renderAiWritingState();
}

async function generateAiSuggestion(): Promise<void> {
  if (!aiSessionStarted) {
    aiStatusElement.textContent = "Start a memory-only BYOK session first.";
    editorAiStatusElement.textContent = "Connect a private AI session first.";
    editorAiAssistantPanel.hidden = false;
    return;
  }
  if (activeDocument.kind !== "markdown") {
    aiStatusElement.textContent = "AI writing is available for Markdown documents only in this demo.";
    return;
  }
  if (richChanged) {
    syncRichMarkdownToSource("mode switch");
  }

  const markdown = getMarkdown();
  const action = aiActionSelect.value as AiWritingAction;
  const prompt = aiPromptInput.value.trim();
  aiStatusElement.textContent = "Checking policy...";
  const suggestion = await session.requestAiSuggestion({
    action,
    ...(prompt ? { prompt } : {}),
    ...selectionForAiRequest(markdown)
  });

  if (suggestion.status === "blocked") {
    logEvent("AI writing blocked by Document Access Policy before provider call.");
  } else {
    logEvent(`AI ${action} suggestion generated by mock provider; review before applying.`);
  }
  renderAiWritingState();
}

function acceptPendingAiSuggestion(): void {
  const pendingAiSuggestion = session.getPendingSuggestion();
  if (!pendingAiSuggestion || pendingAiSuggestion.status !== "pending") {
    return;
  }

  const acceptedContent = session.acceptPendingSuggestion();
  if (acceptedContent) {
    applyMarkdownFromAi(acceptedContent);
    logEvent("Accepted AI suggestion and applied it to the Markdown document.");
  } else {
    logEvent("AI suggestion could not be accepted because the document changed.");
  }
  renderAiWritingState();
}

function rejectPendingAiSuggestion(): void {
  const pendingAiSuggestion = session.getPendingSuggestion();
  if (!pendingAiSuggestion || pendingAiSuggestion.status !== "pending") {
    return;
  }

  session.rejectPendingSuggestion();
  logEvent("Rejected AI suggestion; Markdown document was unchanged.");
  renderAiWritingState();
}

function applyMarkdownFromAi(content: string): void {
  replaceEditorDocument(content);
  persistRestorableDocument();
  renderSaveState();
  updateRoundTripStatus();
  if (editorMode === "rich") {
    mountRichEditor(content);
  }
}

function renderAiWritingState(): void {
  const pendingAiSuggestion = session.getPendingSuggestion();
  aiGenerateButton.disabled = !aiSessionStarted;
  aiAcceptButton.disabled = pendingAiSuggestion?.status !== "pending";
  aiRejectButton.disabled = pendingAiSuggestion?.status !== "pending";
  editorAiAcceptButton.disabled = pendingAiSuggestion?.status !== "pending";
  editorAiRejectButton.disabled = pendingAiSuggestion?.status !== "pending";
  renderReferenceSurfaceState();
  aiPolicyNoteElement.textContent = pendingAiSuggestion?.policyDecision
    ? `Policy ${pendingAiSuggestion.policyDecision.allowed ? "allowed" : "blocked"}: ${pendingAiSuggestion.policyDecision.reason ?? "no reason"}`
    : "Policy checked before content leaves the editor.";

  if (!pendingAiSuggestion) {
    aiSuggestionPreview.hidden = true;
    aiSuggestionPreview.textContent = "";
    aiStatusElement.textContent = aiSessionStarted ? "Mock AI session ready" : "No AI session";
    editorAiSuggestionPreview.hidden = true;
    editorAiSuggestionPreview.textContent = "";
    editorAiStatusElement.textContent = aiSessionStarted ? "Private AI session ready" : "No AI session";
    return;
  }

  if (pendingAiSuggestion.status === "blocked") {
    aiSuggestionPreview.hidden = false;
    aiSuggestionPreview.textContent = pendingAiSuggestion.policyDecision?.reason ?? "Policy blocked AI writing.";
    aiStatusElement.textContent = "AI blocked by policy before provider call";
    editorAiAssistantPanel.hidden = false;
    editorAiSuggestionPreview.hidden = false;
    editorAiSuggestionPreview.textContent = pendingAiSuggestion.policyDecision?.reason ?? "Policy blocked AI writing.";
    editorAiStatusElement.textContent = "AI blocked by policy before provider call";
    return;
  }

  aiSuggestionPreview.hidden = false;
  aiSuggestionPreview.textContent = pendingAiSuggestion.replacement;
  aiStatusElement.textContent = `Suggestion ${pendingAiSuggestion.status}: ${pendingAiSuggestion.title}`;
  editorAiAssistantPanel.hidden = false;
  editorAiSuggestionPreview.hidden = false;
  editorAiSuggestionPreview.textContent = pendingAiSuggestion.replacement;
  editorAiStatusElement.textContent = `Suggestion ${pendingAiSuggestion.status}: ${pendingAiSuggestion.title}`;
  renderReferenceSurfaceState();
}

function selectionForAiRequest(markdown: string): { readonly selection?: { readonly from: number; readonly to: number } } {
  if (editorMode === "rich") {
    const richRange = richSelectionMarkdownRange(markdown);
    return richRange ? { selection: richRange } : {};
  }

  if (editorMode !== "source") {
    return {};
  }

  const selection = editor.state.selection.main;
  if (selection.empty) {
    return {};
  }
  return {
    selection: {
      from: Math.max(0, Math.min(selection.from, markdown.length)),
      to: Math.max(0, Math.min(selection.to, markdown.length))
    }
  };
}

function richSelectionMarkdownRange(markdown: string): { readonly from: number; readonly to: number } | null {
  if (!richEditor || richEditor.state.selection.empty) {
    return null;
  }
  const selectedText = richEditor.state.doc.textBetween(
    richEditor.state.selection.from,
    richEditor.state.selection.to,
    "\n",
    "\n"
  );
  if (!selectedText.trim()) {
    return null;
  }
  const from = markdown.indexOf(selectedText);
  if (from < 0) {
    return null;
  }
  const repeatedAt = markdown.indexOf(selectedText, from + selectedText.length);
  if (repeatedAt >= 0) {
    return null;
  }
  return {
    from,
    to: from + selectedText.length
  };
}

function getAiWritingState(): {
  readonly hasSession: boolean;
  readonly keyInputValue: string;
  readonly pendingStatus: string | null;
  readonly policyText: string;
  readonly providerRequestCount: number;
  readonly statusText: string;
  readonly suggestionText: string;
} {
  const pendingAiSuggestion = session.getPendingSuggestion();
  return {
    hasSession: aiSessionStarted,
    keyInputValue: aiByokKeyInput.value,
    pendingStatus: pendingAiSuggestion?.status ?? null,
    policyText: aiPolicyNoteElement.textContent ?? "",
    providerRequestCount: demoAiProvider.requests.length,
    statusText: aiStatusElement.textContent ?? "",
    suggestionText: aiSuggestionPreview.textContent ?? ""
  };
}

function renderReferenceSurfaceState(): void {
  applyReferencePreferenceCssVariables();
  const aiGroupVisible = referenceSurfacePreferences.visibleCommandGroups.includes("ai");
  const toolbarAiVisible = aiGroupVisible && isAiEntryPointEnabled("toolbar");
  const selectionAiVisible = aiGroupVisible && isAiEntryPointEnabled("selection");
  const commandPaletteVisible = aiGroupVisible && isAiEntryPointEnabled("command-palette");
  selectedTextAiAction.disabled = activeDocument.kind !== "markdown" || !hasAiEligibleSelection();
  aiCommandSurface.dataset.session = aiSessionStarted ? "ready" : "missing";
  aiCommandSurface.dataset.documentKind = activeDocument.kind;
  documentStatusPopover.dataset.target = session.getSaveState().target;
  surfaceSettingsPanel.dataset.toolbarStyle = referenceSurfacePreferences.toolbarStyle;
  debugInspector.dataset.status = debugInspector.open ? "open" : "closed";
  app.dataset.toolbarMode = referenceSurfacePreferences.toolbarMode;
  app.dataset.toolbarStyle = referenceSurfacePreferences.toolbarStyle;
  app.dataset.statusDisclosure = referenceSurfacePreferences.technicalStatusDisclosure;
  richCommandToolbar.hidden = editorMode !== "rich" || referenceSurfacePreferences.toolbarMode === "hidden";
  aiCommandSurface.hidden = !toolbarAiVisible;
  toolbarAiButton.hidden = !toolbarAiVisible || editorMode !== "rich";
  selectedTextAiAction.hidden = !selectionAiVisible;
  commandPaletteButton.hidden = !commandPaletteVisible;
  surfaceToolbarPrefElement.textContent = `${referenceSurfacePreferences.toolbarMode}, ${referenceSurfacePreferences.toolbarStyle}`;
  surfaceAiEntryPointsPrefElement.textContent = referenceSurfacePreferences.aiEntryPoints.join(", ");
  surfaceStatusDisclosurePrefElement.textContent = referenceSurfacePreferences.technicalStatusDisclosure;
  surfaceLayoutPrefElement.textContent = `${referenceSurfacePreferences.layoutDensity}, ${referenceSurfacePreferences.readableLineWidth}px`;
  surfaceKeymapPrefElement.textContent = referenceSurfacePreferences.keymapDelegateToHost
    ? `${referenceSurfacePreferences.keymapProfile}, delegated`
    : referenceSurfacePreferences.keymapProfile;
}

function applyReferenceSurfacePreferences(): void {
  applyReferencePreferenceCssVariables();
  editor.dispatch({
    effects: createMomentariseSourceReconfigureEffects(
      sourcePreferenceCompartments,
      sourcePreferencesFromReferenceSurface(),
      {
        onSave: saveFromKeyboardShortcut
      }
    )
  });
  if (!richEditor) {
    return;
  }
  const currentRichState = currentRichStateFromEditor();
  if (!currentRichState) {
    return;
  }
  richState = withDemoRichPlugins(reconfigureRichPlugins(currentRichState, richPreferencesFromReferenceSurface()));
  richEditor.updateState(richState.editorState);
  renderRichBlockControls();
  renderRichFoldingUi(false);
}

function applyReferencePreferenceCssVariables(): void {
  app.style.setProperty("--mme-density", referenceDensityScale(referenceSurfacePreferences.layoutDensity));
  app.style.setProperty("--mme-font-scale", String(referenceSurfacePreferences.editorFontScale));
  app.style.setProperty("--mme-active-content-measure", `${referenceSurfacePreferences.readableLineWidth}px`);
  app.dataset.layoutDensity = referenceSurfacePreferences.layoutDensity;
  app.dataset.keymapProfile = referenceSurfacePreferences.keymapProfile;
  app.dataset.keymapDelegateToHost = String(referenceSurfacePreferences.keymapDelegateToHost);
}

function sourcePreferencesFromReferenceSurface(): MomentariseSourcePreferences {
  return {
    density: referenceSurfacePreferences.layoutDensity,
    fontScale: referenceSurfacePreferences.editorFontScale,
    keymapDelegateToHost: referenceSurfacePreferences.keymapDelegateToHost,
    keymapProfile: referenceSurfacePreferences.keymapProfile,
    readableLineWidth: referenceSurfacePreferences.readableLineWidth
  };
}

function richPreferencesFromReferenceSurface(): MomentariseRichPreferences {
  return {
    keymapDelegateToHost: referenceSurfacePreferences.keymapDelegateToHost,
    keymapProfile: referenceSurfacePreferences.keymapProfile
  };
}

function referenceDensityScale(density: ReferenceEditorPreferences["layoutDensity"]): string {
  switch (density) {
    case "compact":
      return "0.86";
    case "spacious":
      return "1.14";
    case "comfortable":
      return "1";
  }
}

function isAiEntryPointEnabled(entryPoint: ReferenceEditorPreferences["aiEntryPoints"][number]): boolean {
  return referenceSurfacePreferences.aiEntryPoints.includes(entryPoint);
}

function hasAiEligibleSelection(): boolean {
  if (activeDocument.kind !== "markdown") {
    return false;
  }
  if (editorMode === "source") {
    return !editor.state.selection.main.empty;
  }
  if (editorMode === "rich" && richEditor) {
    return Boolean(richSelectionMarkdownRange(getMarkdown()));
  }
  return false;
}

function getReferenceSurfaceState(): {
  readonly aiEntryPoints: readonly string[];
  readonly aiMenuOpen: boolean;
  readonly assistantPanelVisible: boolean;
  readonly commandPaletteOpen: boolean;
  readonly debugInspectorVisible: boolean;
  readonly documentStatusOpen: boolean;
  readonly editorFontScale: number;
  readonly hasEditorNativeAi: boolean;
  readonly hasSelectionForAi: boolean;
  readonly keymapDelegateToHost: boolean;
  readonly keymapProfile: string;
  readonly layoutDensity: string;
  readonly modeControl: string;
  readonly optionalStats: boolean;
  readonly readableLineWidth: number;
  readonly settingsOpen: boolean;
  readonly statusDisclosure: string;
  readonly toolbarMode: string;
  readonly toolbarStyle: string;
  readonly visibleCommandGroups: readonly string[];
} {
  return {
    aiEntryPoints: referenceSurfacePreferences.aiEntryPoints,
    aiMenuOpen: aiCommandSurface.open,
    assistantPanelVisible: !editorAiAssistantPanel.hidden,
    commandPaletteOpen: !commandPalette.hidden,
    debugInspectorVisible: debugInspector.open,
    documentStatusOpen: documentStatusPopover.open,
    editorFontScale: referenceSurfacePreferences.editorFontScale,
    hasEditorNativeAi: Boolean(aiCommandSurface && selectedTextAiAction),
    hasSelectionForAi: hasAiEligibleSelection(),
    keymapDelegateToHost: referenceSurfacePreferences.keymapDelegateToHost,
    keymapProfile: referenceSurfacePreferences.keymapProfile,
    layoutDensity: referenceSurfacePreferences.layoutDensity,
    modeControl: referenceSurfacePreferences.modeControl,
    optionalStats: referenceSurfacePreferences.optionalStats,
    readableLineWidth: referenceSurfacePreferences.readableLineWidth,
    settingsOpen: surfaceSettingsPanel.open,
    statusDisclosure: referenceSurfacePreferences.technicalStatusDisclosure,
    toolbarMode: referenceSurfacePreferences.toolbarMode,
    toolbarStyle: referenceSurfacePreferences.toolbarStyle,
    visibleCommandGroups: referenceSurfacePreferences.visibleCommandGroups
  };
}

function mountRichEditor(markdown: string): void {
  richEditor?.destroy();
  richEditorHost.replaceChildren();
  const baseRichState = createRichMarkdownState(markdown, {
    dialect: "momentarise-enhanced",
    preferences: richPreferencesFromReferenceSurface()
  });
  richState = withDemoRichPlugins(baseRichState);
  richBaselineMarkdown = markdown;
  richChanged = false;
  richEditor = new ProseMirrorEditorView(richEditorHost, {
    state: richState.editorState,
    handleKeyDown(_view, event) {
      return handleSlashMenuKeyboard(event);
    },
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
      updateSlashMenuFromRichState();
      renderRichBlockControls();
      renderRichFoldingUi(false);
      renderReferenceSurfaceState();
    }
  });
  updateSlashMenuFromRichState();
  renderRichBlockControls();
  renderRichFoldingUi(false);
}

function withDemoRichPlugins(state: RichMarkdownState): RichMarkdownState {
  return {
    ...state,
    editorState: state.editorState.reconfigure({
      plugins: [...state.editorState.plugins, createRichFoldingPlugin()]
    })
  };
}

function syncRichMarkdownToSource(source: "rich edit" | "mode switch"): void {
  const markdown = serializeRichMarkdownState(richState).content;
  replaceEditorDocument(markdown);
  session.setContent(markdown, "rich-view");
  persistRestorableDocument();
  renderSaveState();
  updateRoundTripStatus();
  if (source === "mode switch") {
    logEvent("Serialized rich mode back to Markdown source.");
  }
}

function persistRestorableDocument(): void {
  if (activeDocument.mode === "fixture") {
    return;
  }
  const snapshot: RestorableDemoDocument = {
    content: getMarkdown(),
    editorMode,
    fileName: activeDocument.fileName,
    kind: activeDocument.kind,
    version: 1
  };
  try {
    window.localStorage.setItem(lastDemoDocumentStorageKey, JSON.stringify(snapshot));
  } catch {
    // Best-effort demo convenience; Save Engine remains the source of persistence truth.
  }
}

function restoreLastDemoDocument(): boolean {
  let snapshot: RestorableDemoDocument | null = null;
  try {
    const raw = window.localStorage.getItem(lastDemoDocumentStorageKey);
    snapshot = raw ? parseRestorableDemoDocument(raw) : null;
  } catch {
    return false;
  }
  if (!snapshot) {
    return false;
  }

  if (snapshot.kind === "html-artifact") {
    loadHtmlArtifact(snapshot.fileName, snapshot.content, "browser reload restore");
    if (snapshot.editorMode === "preview") {
      switchEditorMode("preview");
    }
    return true;
  }

  loadOpenedMarkdownFile(
    createImportedCopyDocument({
      content: snapshot.content,
      fileName: snapshot.fileName
    }),
    {
      sourceLabel: "browser reload restore"
    }
  );
  if (snapshot.editorMode === "rich") {
    switchEditorMode("rich");
  }
  lastSaveAction = "restored browser draft; reopen the original file for writable autosave";
  setEditorNotice("Restored a browser draft copy. Reopen the original file with Open file to enable writable disk save and autosave.");
  renderSaveState();
  return true;
}

function parseRestorableDemoDocument(raw: string): RestorableDemoDocument | null {
  const parsed = JSON.parse(raw) as Partial<RestorableDemoDocument>;
  if (
    parsed.version !== 1 ||
    typeof parsed.content !== "string" ||
    typeof parsed.fileName !== "string" ||
    (parsed.kind !== "markdown" && parsed.kind !== "html-artifact") ||
    (parsed.editorMode !== "source" && parsed.editorMode !== "rich" && parsed.editorMode !== "preview")
  ) {
    return null;
  }
  if (parsed.kind === "html-artifact" && parsed.editorMode === "rich") {
    return {
      content: parsed.content,
      editorMode: "source",
      fileName: parsed.fileName,
      kind: parsed.kind,
      version: 1
    };
  }
  if (parsed.kind === "markdown" && parsed.editorMode === "preview") {
    return {
      content: parsed.content,
      editorMode: "source",
      fileName: parsed.fileName,
      kind: parsed.kind,
      version: 1
    };
  }
  return parsed as RestorableDemoDocument;
}

function currentRichStateFromEditor(): RichMarkdownState | null {
  if (!richEditor) {
    return null;
  }
  return {
    ...richState,
    editorState: richEditor.state
  };
}

function applyPackageRichState(nextState: RichMarkdownState, eventMessage?: string, focusEditor = true): void {
  if (!richEditor) {
    return;
  }
  richState = nextState;
  richEditor.updateState(nextState.editorState);
  richChanged = true;
  renderRichBlockControls();
  renderRichFoldingUi();
  syncRichMarkdownToSource("rich edit");
  if (focusEditor) {
    richEditor.focus();
  }
  if (eventMessage) {
    logEvent(eventMessage);
  }
}

function renderRichBlockControls(): void {
  const currentRichState = currentRichStateFromEditor();
  richBlockControls.hidden = editorMode !== "rich" || !currentRichState;
  if (richBlockControls.hidden || !currentRichState) {
    codeBlockControls.hidden = true;
    return;
  }

  const codeInfo = getCurrentCodeBlockInfo(currentRichState);
  const canInsertAfter = canInsertParagraphAfterCurrentBlock(currentRichState);
  richBlockControls.hidden = !codeInfo && !canInsertAfter;
  if (richBlockControls.hidden) {
    codeBlockControls.hidden = true;
    insertAfterBlockButton.hidden = true;
    return;
  }
  codeBlockControls.hidden = !codeInfo;
  insertAfterBlockButton.hidden = !canInsertAfter;
  if (!codeInfo) {
    return;
  }
  if (document.activeElement !== codeLanguageInput) {
    codeLanguageInput.value = codeInfo.language ?? "";
  }
  if (document.activeElement !== codeMetaInput) {
    codeMetaInput.value = codeInfo.meta ?? "";
  }
}

function renderRichFoldingUi(refreshDecorations = true): void {
  const currentRichState = currentRichStateFromEditor();
  if (editorMode !== "rich" || !richEditor || !currentRichState) {
    return;
  }

  if (refreshDecorations) {
    richEditor.dispatch(richEditor.state.tr.setMeta(richFoldingPluginKey, true));
  }
}

function createRichFoldingPlugin(): Plugin {
  return new Plugin({
    key: richFoldingPluginKey,
    props: {
      decorations(state) {
        return richFoldingPluginKey.getState(state) ?? DecorationSet.empty;
      }
    },
    state: {
      apply(transaction, previous, _oldState, nextState) {
        if (transaction.docChanged || transaction.getMeta(richFoldingPluginKey)) {
          return createRichFoldingDecorations(nextState);
        }
        return previous.map(transaction.mapping, transaction.doc);
      },
      init(_config, state) {
        return createRichFoldingDecorations(state);
      }
    }
  });
}

function createRichFoldingDecorations(editorState: ProseMirrorEditorState): DecorationSet {
  const stateWithCurrentDoc: RichMarkdownState = {
    ...richState,
    editorState
  };
  const visibility = getRichFoldVisibility(stateWithCurrentDoc, foldStates);
  const decorations: Decoration[] = [];

  for (const block of visibility.blocks) {
    const classes = [
      block.hidden ? "rich-fold-hidden" : "",
      block.type === "heading" ? "rich-fold-heading" : ""
    ]
      .filter(Boolean)
      .join(" ");
    if (classes) {
      const attributes: Record<string, string> = {
        class: classes
      };
      if (block.hidden) {
        attributes["aria-hidden"] = "true";
      }
      if (block.type === "heading") {
        attributes["data-rich-folded"] = String(block.folded);
      }
      decorations.push(
        Decoration.node(block.position, block.to, attributes)
      );
    }

    if (block.type === "heading") {
      decorations.push(
        Decoration.widget(block.position + 1, () => createRichFoldToggleButton(block), {
          key: `fold-toggle:${block.nodeId}:${block.folded}`,
          side: -1
        })
      );
    }
  }

  return DecorationSet.create(editorState.doc, decorations);
}

function createRichFoldToggleButton(block: { readonly folded: boolean; readonly headingLevel: number | null; readonly nodeId: string; readonly text: string }): HTMLElement {
  const button = document.createElement("button");
  button.className = "rich-fold-toggle";
  button.contentEditable = "false";
  button.dataset.foldNodeId = block.nodeId;
  button.setAttribute("aria-expanded", String(!block.folded));
  button.setAttribute("aria-label", `${block.folded ? "Expand" : "Collapse"} ${block.text || `H${block.headingLevel ?? 1}`}`);
  button.title = block.folded ? "Expand section" : "Collapse section";
  button.type = "button";
  button.addEventListener("mousedown", (event) => {
    event.preventDefault();
  });
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleRichFoldByNodeId(block.nodeId);
  });
  return button;
}

function toggleRichFoldByNodeId(nodeId: string): void {
  const currentRichState = currentRichStateFromEditor();
  if (!currentRichState) {
    return;
  }
  const item = getRichHeadingFoldItems(currentRichState, foldStates).find((candidate) => candidate.nodeId === nodeId);
  foldStates = toggleRichHeadingFold(foldStates, nodeId);
  renderRichFoldingUi();
  logEvent(`${item?.folded ? "Expanded" : "Collapsed"} rich heading section: ${item?.text ?? nodeId}.`);
}

function toggleRichFoldForText(text: string): void {
  const currentRichState = currentRichStateFromEditor();
  if (!currentRichState) {
    throw new Error("Rich editor is not mounted.");
  }
  const item = getRichHeadingFoldItems(currentRichState, foldStates).find((candidate) => candidate.text === text);
  if (!item) {
    throw new Error(`Cannot find foldable heading: ${text}`);
  }
  toggleRichFoldByNodeId(item.nodeId);
}

function updateCurrentCodeBlockInfoFromControls(): void {
  const currentRichState = currentRichStateFromEditor();
  if (!currentRichState || !getCurrentCodeBlockInfo(currentRichState)) {
    return;
  }
  applyPackageRichState(
    setCurrentCodeBlockInfo(currentRichState, {
      language: codeLanguageInput.value,
      meta: codeMetaInput.value
    }),
    undefined,
    false
  );
}

function insertParagraphAfterCurrentRichBlock(): void {
  const currentRichState = currentRichStateFromEditor();
  if (!currentRichState) {
    return;
  }
  applyPackageRichState(
    insertParagraphAfterCurrentBlock(currentRichState),
    "Inserted paragraph after the current rich block."
  );
}

function toggleCurrentRichTodo(): void {
  const currentRichState = currentRichStateFromEditor();
  if (!currentRichState) {
    return;
  }
  applyPackageRichState(toggleCurrentTodoItem(currentRichState), "Toggled current rich todo.");
}

function runRichCommand(commandId: RichCommandId, options: ApplyRichMarkdownCommandOptions = {}): void {
  if (!richEditor) {
    return;
  }
  if (editorMode !== "rich") {
    switchEditorMode("rich");
  }
  const commandState = richStateForCommand();
  const result = runRichMarkdownCommand(commandState, commandId, optionsForCommand(commandId, options));
  if (!result.handled) {
    closeSlashMenu();
    logEvent(`Rich command unavailable: ${commandLabel(commandId)}.`);
    return;
  }
  richState = result.state;
  richEditor.updateState(result.state.editorState);
  richChanged = true;
  closeSlashMenu();
  setToolbarMoreOpen(false);
  renderRichBlockControls();
  syncRichMarkdownToSource("rich edit");
  richEditor.focus();
  logEvent(`Ran rich command: ${commandLabel(commandId)}.`);
}

function optionsForCommand(
  commandId: RichCommandId,
  options: ApplyRichMarkdownCommandOptions
): ApplyRichMarkdownCommandOptions {
  if (commandId === "image" && !options.src) {
    return {
      ...options,
      alt: options.alt ?? "Image",
      src: "image.png"
    };
  }
  if (commandId === "link" && !options.href) {
    return {
      ...options,
      href: "https://example.invalid"
    };
  }
  return options;
}

function commandLabel(commandId: RichCommandId): string {
  return richCommandRegistry.find((command) => command.id === commandId)?.label ?? commandId;
}

function updateSlashMenuFromRichState(): void {
  const nextState = detectSlashCommandState();
  const previousQuery = slashCommandState.query;
  slashCommandState = nextState;
  if (!slashCommandState.open || slashCommandState.query !== previousQuery) {
    slashCommandSelectedIndex = 0;
  } else {
    const selectableCount = slashCommandState.items.length + matchingReferenceAiSlashActions(slashCommandState.query).slice(0, 4).length;
    slashCommandSelectedIndex = Math.min(slashCommandSelectedIndex, Math.max(0, selectableCount - 1));
  }
  renderSlashMenu();
}

function detectSlashCommandState(): SlashCommandState {
  if (!richEditor || editorMode !== "rich" || !richEditor.state.selection.empty) {
    return closedSlashCommandState();
  }
  const selection = richEditor.state.selection;
  const textBefore = selection.$from.parent.textBetween(0, selection.$from.parentOffset, "\n", "\n");
  const match = textBefore.match(/\/([A-Za-z0-9_-]*)$/);
  if (!match) {
    return closedSlashCommandState();
  }
  const query = match[1] ?? "";
  const from = selection.from - query.length - 1;
  const items = filterRichMarkdownCommands(query).slice(0, 8);
  const aiItems = matchingReferenceAiSlashActions(query);
  return {
    from,
    items,
    open: items.length > 0 || aiItems.length > 0,
    query,
    to: selection.from
  };
}

function closedSlashCommandState(): SlashCommandState {
  return {
    from: 0,
    items: [],
    open: false,
    query: "",
    to: 0
  };
}

function renderSlashMenu(): void {
  slashCommandMenu.hidden = !slashCommandState.open;
  slashCommandQueryElement.textContent = `/${slashCommandState.query}`;
  const aiItems = matchingReferenceAiSlashActions(slashCommandState.query).slice(0, 4);
  slashCommandItemsElement.replaceChildren(
    ...slashCommandState.items.map((command, index) => {
      const button = document.createElement("button");
      button.className = "slash-command-item";
      button.dataset.selected = String(index === slashCommandSelectedIndex);
      button.dataset.slashCommand = command.id;
      button.dataset.testid = `slash-command-item-${command.id}`;
      button.type = "button";
      const label = document.createElement("strong");
      label.textContent = command.label;
      const aliases = document.createElement("span");
      aliases.textContent = command.aliases.slice(0, 3).join(", ");
      button.append(label, aliases);
      return button;
    }),
    ...(aiItems.length > 0 ? [slashCommandSectionLabel("AI writing")] : []),
    ...aiItems.map((action) => {
      const selectedIndex = slashCommandState.items.length + aiItems.indexOf(action);
      const button = document.createElement("button");
      button.className = "slash-command-item slash-command-item-ai";
      button.dataset.selected = String(selectedIndex === slashCommandSelectedIndex);
      button.dataset.referenceAiAction = action.id;
      button.dataset.testid = `slash-ai-action-${action.id}`;
      button.type = "button";
      const label = document.createElement("strong");
      label.textContent = action.label;
      const aliases = document.createElement("span");
      aliases.textContent = action.prompt;
      button.append(label, aliases);
      return button;
    })
  );
  positionSlashMenu();
}

function closeSlashMenu(): void {
  slashCommandState = closedSlashCommandState();
  slashCommandSelectedIndex = 0;
  renderSlashMenu();
}

function positionSlashMenu(): void {
  if (!richEditor || !slashCommandState.open) {
    slashCommandMenu.style.removeProperty("--slash-menu-left");
    slashCommandMenu.style.removeProperty("--slash-menu-top");
    return;
  }
  const regionRect = editorRegion.getBoundingClientRect();
  const menuWidth = Math.min(320, Math.max(220, regionRect.width - 24));
  let caretRect: { readonly bottom: number; readonly left: number };
  try {
    caretRect = richEditor.coordsAtPos(richEditor.state.selection.from);
  } catch {
    const editorRect = richEditorHost.getBoundingClientRect();
    caretRect = {
      bottom: editorRect.top + 36,
      left: editorRect.left + 24
    };
  }
  const left = Math.min(Math.max(caretRect.left - regionRect.left, 12), Math.max(12, regionRect.width - menuWidth - 12));
  const top = Math.max(caretRect.bottom - regionRect.top + 8, 12);
  slashCommandMenu.style.setProperty("--slash-menu-left", `${Math.round(left)}px`);
  slashCommandMenu.style.setProperty("--slash-menu-top", `${Math.round(top)}px`);
}

function richStateForCommand(): RichMarkdownState {
  if (!richEditor || !slashCommandState.open) {
    return {
      ...richState,
      editorState: richEditor?.state ?? richState.editorState
    };
  }
  const editorState = richEditor.state.apply(richEditor.state.tr.delete(slashCommandState.from, slashCommandState.to));
  return {
    ...richState,
    editorState
  };
}

function openSlashMenuForTest(query: string): void {
  const items = filterRichMarkdownCommands(query).slice(0, 8);
  slashCommandState = {
    from: 0,
    items,
    open: items.length > 0 || matchingReferenceAiSlashActions(query).length > 0,
    query,
    to: 0
  };
  slashCommandSelectedIndex = 0;
  renderSlashMenu();
}

function setToolbarMoreOpen(open: boolean): void {
  toolbarMoreButton.setAttribute("aria-expanded", String(open));
  toolbarMoreMenu.hidden = !open;
}

function handleSlashMenuKeyboard(event: KeyboardEvent): boolean {
  if (!slashCommandState.open) {
    return false;
  }
  const aiItems = matchingReferenceAiSlashActions(slashCommandState.query).slice(0, 4);
  const selectableCount = slashCommandState.items.length + aiItems.length;
  if (event.key === "Escape") {
    event.preventDefault();
    closeSlashMenu();
    return true;
  }
  if (event.key === "ArrowDown") {
    event.preventDefault();
    if (selectableCount === 0) {
      return true;
    }
    slashCommandSelectedIndex = (slashCommandSelectedIndex + 1) % selectableCount;
    renderSlashMenu();
    return true;
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    if (selectableCount === 0) {
      return true;
    }
    slashCommandSelectedIndex = (slashCommandSelectedIndex - 1 + selectableCount) % selectableCount;
    renderSlashMenu();
    return true;
  }
  if (event.key === "Enter") {
    event.preventDefault();
    const command =
      slashCommandSelectedIndex < slashCommandState.items.length ? slashCommandState.items[slashCommandSelectedIndex] : null;
    if (command) {
      runRichCommand(command.id);
    } else {
      const aiAction = aiItems[slashCommandSelectedIndex - slashCommandState.items.length];
      if (aiAction) {
        closeSlashMenu();
        void runEditorNativeAiCommand(aiAction.id);
      }
    }
    return true;
  }
  return false;
}

function matchingReferenceAiSlashActions(query: string): readonly ReferenceAiAction[] {
  const normalizedQuery = query.trim().toLowerCase();
  return referenceAiActionsForEntryPoint(referenceSurfacePreferences, "slash").filter((action: ReferenceAiAction) => {
    if (!normalizedQuery) {
      return true;
    }
    return `${action.id} ${action.label} ${action.prompt}`.toLowerCase().includes(normalizedQuery);
  });
}

function slashCommandSectionLabel(label: string): HTMLElement {
  const item = document.createElement("p");
  item.className = "slash-command-section";
  item.textContent = label;
  return item;
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
    type: `${activeDocument.kind === "html-artifact" ? "text/html" : "text/markdown"};charset=utf-8`
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = activeDocument.fileName;
  anchor.click();
  URL.revokeObjectURL(url);
  lastSaveAction = "download/export generated; original target unchanged";
  logEvent(
    activeDocument.kind === "html-artifact"
      ? "Generated HTML artifact download/export. Original target was unchanged."
      : "Generated Markdown download/export. Original target was unchanged."
  );
  renderSaveState();
}

function memorySave(source: "button" | "keyboard shortcut"): void {
  const state = session.getSaveState();
  if (state.target === "download-required" || activeDocument.mode === "imported-copy") {
    downloadMarkdown();
    return;
  }
  if (state.target === "unsupported" || activeDocument.mode === "unsupported") {
    lastSaveAction = `${source} cannot save without a writable file handle`;
    setEditorNotice(realFileOpenUnavailableMessage());
    logEvent("Save unavailable: this browser did not provide a writable local file handle.");
    renderSaveState();
    return;
  }
  void flushSave("manual", source);
}

async function flushSave(reason: SaveFlushReason, source?: "button" | "keyboard shortcut"): Promise<void> {
  let result: Awaited<ReturnType<MarkdownEditorSession["flush"]>>;
  try {
    result = await session.flush(reason);
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

function sessionShouldBlockClose(): boolean {
  const state = session.getSaveState();
  if (state.status === "dirty" || state.status === "saving" || state.status === "conflict") {
    return true;
  }
  return state.status === "error" && state.currentHash !== state.lastSavedHash;
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
  const state = session.getSaveState();
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
  renderReferenceSurfaceState();
}

function primaryActionLabel(state: SaveState): string {
  if (activeDocument.mode === "imported-copy" || state.target === "download-required") {
    return "Export copy";
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
  if (activeDocument.kind === "html-artifact") {
    return "HTML artifact, sandbox preview, download/export required";
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

function htmlPreviewStatusLabel(descriptor: SandboxedHtmlPreviewDescriptor): string {
  const scriptStatus = sandboxAllowsScripts(descriptor.sandbox) ? "scripts allowed" : "scripts disabled";
  return `HTML artifact preview, sandboxed, ${scriptStatus}`;
}

function openAiCommandSurface(): void {
  if (!isAiEntryPointEnabled("toolbar")) {
    return;
  }
  aiCommandSurface.open = true;
  renderReferenceSurfaceState();
}

function setCommandPaletteOpen(open: boolean): void {
  if (open && !isAiEntryPointEnabled("command-palette")) {
    return;
  }
  commandPalette.hidden = !open;
  if (open) {
    commandPaletteInput.value = "";
    renderCommandPaletteItems();
    commandPaletteInput.focus();
  }
  renderReferenceSurfaceState();
}

function renderCommandPaletteItems(): void {
  const actions = commandPaletteActions();
  commandPaletteSelectedIndex = Math.min(commandPaletteSelectedIndex, Math.max(0, actions.length - 1));
  commandPaletteItems.replaceChildren(
    ...actions.map((action, index) => {
      const button = document.createElement("button");
      button.className = "ai-command-item";
      button.dataset.referenceAiAction = action.id;
      button.dataset.selected = String(index === commandPaletteSelectedIndex);
      button.dataset.testid = `command-palette-ai-action-${action.id}`;
      button.type = "button";
      const label = document.createElement("strong");
      label.textContent = action.label;
      const entryPoints = document.createElement("span");
      entryPoints.textContent = action.entryPoints.join(", ");
      button.append(label, entryPoints);
      return button;
    })
  );
}

function commandPaletteActions(): readonly ReferenceAiAction[] {
  const query = commandPaletteInput.value.trim().toLowerCase();
  return referenceAiActionsForEntryPoint(referenceSurfacePreferences, "command-palette").filter((action: ReferenceAiAction) => {
    if (!query) {
      return true;
    }
    return `${action.id} ${action.label} ${action.prompt}`.toLowerCase().includes(query);
  });
}

function handleCommandPaletteKeyboard(event: KeyboardEvent): boolean {
  if (commandPalette.hidden) {
    return false;
  }
  const actions = commandPaletteActions();
  if (event.key === "Escape") {
    setCommandPaletteOpen(false);
    return true;
  }
  if (event.key === "ArrowDown") {
    if (actions.length > 0) {
      commandPaletteSelectedIndex = (commandPaletteSelectedIndex + 1) % actions.length;
      renderCommandPaletteItems();
    }
    return true;
  }
  if (event.key === "ArrowUp") {
    if (actions.length > 0) {
      commandPaletteSelectedIndex = (commandPaletteSelectedIndex - 1 + actions.length) % actions.length;
      renderCommandPaletteItems();
    }
    return true;
  }
  if (event.key === "Enter") {
    const action = actions[commandPaletteSelectedIndex];
    if (action) {
      setCommandPaletteOpen(false);
      void runEditorNativeAiCommand(action.id);
    }
    return true;
  }
  return false;
}

function setReferenceSurfacePreferences(preferences: ReferenceEditorPreferenceInput): void {
  referenceSurfacePreferences = resolveReferenceEditorPreferences(preferences);
  applyReferenceSurfacePreferences();
  renderReferenceSurfaceState();
}

async function runEditorNativeAiCommand(actionId: ReferenceAiActionId): Promise<void> {
  const action = REFERENCE_AI_ACTIONS.find((candidate: ReferenceAiAction) => candidate.id === actionId);
  if (!action) {
    return;
  }
  editorAiAssistantPanel.hidden = false;
  if (activeDocument.kind !== "markdown") {
    aiStatusElement.textContent = "AI writing is available for Markdown documents only in this demo.";
    editorAiStatusElement.textContent = "AI writing is available for Markdown documents only in this demo.";
    logEvent(`AI action unavailable for ${activeDocument.fileName}: ${action.label}.`);
    renderReferenceSurfaceState();
    return;
  }
  if (!aiSessionStarted) {
    aiStatusElement.textContent = `${action.label}: start a memory-only BYOK session first.`;
    editorAiStatusElement.textContent = `${action.label}: connect a private AI session first.`;
    logEvent(`Queued editor-native AI action without session: ${action.label}.`);
    renderReferenceSurfaceState();
    return;
  }

  aiActionSelect.value = action.demoAction;
  aiPromptInput.value = action.prompt;
  editorAiStatusElement.textContent = `Running ${action.label}...`;
  await generateAiSuggestion();
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
  if (activeDocument.kind === "html-artifact") {
    renderHtmlArtifactStatus();
    return;
  }
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

function renderHtmlArtifactStatus(): void {
  const descriptor = htmlPreviewDescriptor ?? createSandboxedHtmlPreview({
    fileName: activeDocument.fileName,
    html: getMarkdown()
  });
  roundTripSourceLabelElement.textContent = "HTML artifact";
  roundTripFixtureElement.textContent = activeDocument.fileName;
  roundTripModeElement.textContent = "sandbox preview";
  parserStatusElement.textContent = "not run for HTML artifact";
  serializerStatusElement.textContent = "not run for HTML artifact";
  renderHtmlArtifactProperties();
  diagnosticsElement.replaceChildren(
    ...descriptor.warnings.slice(0, 4).map((warning) => {
      const item = document.createElement("li");
      item.textContent = `${warning.severity}: ${warning.code}`;
      return item;
    })
  );
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
  if (activeDocument.kind === "html-artifact") {
    renderHtmlArtifactProperties();
    logEvent(`Properties panel switched to ${mode} mode.`);
    return;
  }
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

function renderHtmlArtifactProperties(): void {
  propertiesModeVisibleButton.setAttribute("aria-pressed", String(propertiesDisplayMode === "visible"));
  propertiesModeHiddenButton.setAttribute("aria-pressed", String(propertiesDisplayMode === "hidden"));
  propertiesModeSourceButton.setAttribute("aria-pressed", String(propertiesDisplayMode === "source"));

  frontmatterElement.hidden = propertiesDisplayMode !== "visible";
  frontmatterSourceElement.hidden = propertiesDisplayMode !== "source";
  propertiesHiddenElement.hidden = propertiesDisplayMode !== "hidden";
  frontmatterElement.replaceChildren(emptyValue("HTML artifact; no Markdown frontmatter."));
  frontmatterSourceElement.textContent = "HTML artifact source has no YAML frontmatter.";
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
  return session.getContent();
}

function logEvent(message: string): void {
  eventCounter += 1;
  const item = document.createElement("li");
  item.textContent = `${eventCounter}. ${message}`;
  eventLogElement.prepend(item);
}

function realFileOpenUnavailableMessage(): string {
  return "Real local file open is unavailable in this browser. Use Chrome or Edge with File System Access for disk save.";
}

function setEditorNotice(message: string): void {
  editorNotice.hidden = false;
  editorNotice.textContent = message;
}

function clearEditorNotice(): void {
  editorNotice.hidden = true;
  editorNotice.textContent = "";
}

function applyHostThemeForTest(theme: MmeTheme, scheme: MmeScheme = "dark"): void {
  document.documentElement.dataset.mmeScheme = scheme;
  const variables = resolveThemeToCssVariables(theme, scheme);
  for (const [property, value] of Object.entries(variables)) {
    document.documentElement.style.setProperty(property, value);
  }
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
      applyHostThemeForTest: (theme: MmeTheme, scheme?: MmeScheme) => void;
      flushSave: (reason: SaveFlushReason) => Promise<void>;
      forceStatusRefresh: () => void;
      getActiveDocument: () => {
        readonly fileName: string;
        readonly kind: DemoDocumentKind;
        readonly mode: DemoDocumentMode;
        readonly pathLabel: string;
      };
      getEditorMode: () => DemoEditorMode;
      getLastCopiedMarkdown: () => string | null;
      getMarkdown: () => string;
      getSlashMenuState: () => {
        readonly aiItems: readonly ReferenceAiActionId[];
        readonly items: readonly RichCommandId[];
        readonly open: boolean;
        readonly query: string;
        readonly selectedAiId: ReferenceAiActionId | null;
        readonly selectedId: RichCommandId | null;
        readonly selectedIndex: number;
      };
      getToolbarState: () => {
        readonly commands: readonly RichCommandId[];
        readonly moreOpen: boolean;
        readonly visible: boolean;
      };
      getRichUxState: () => {
        readonly blockControlsVisible: boolean;
        readonly codeControlsVisible: boolean;
        readonly codeLanguage: string;
        readonly codeMeta: string;
        readonly markdown: string;
      };
      getFoldState: () => RichFoldVisibility & {
        readonly folds: readonly FoldState[];
        readonly items: readonly RichHeadingFoldItem[];
      };
      getHtmlPreviewState: () => {
        readonly available: boolean;
        readonly bannerText: string;
        readonly fileName: string | null;
        readonly frameSandbox: string | null;
        readonly frameSrcdocLength: number;
        readonly sandbox: string | null;
        readonly scriptsEnabled: boolean;
        readonly statusText: string;
        readonly warnings: readonly string[];
      };
      getAiWritingState: () => {
        readonly hasSession: boolean;
        readonly keyInputValue: string;
        readonly pendingStatus: string | null;
        readonly policyText: string;
        readonly providerRequestCount: number;
        readonly statusText: string;
        readonly suggestionText: string;
      };
      getPropertiesState: () => {
        readonly hiddenText: string;
        readonly listText: string;
        readonly mode: PropertiesDisplayMode;
        readonly rawSource: string;
        readonly sourceHidden: boolean;
      };
      getReferenceSurfaceState: () => {
        readonly aiEntryPoints: readonly string[];
        readonly aiMenuOpen: boolean;
        readonly assistantPanelVisible: boolean;
        readonly commandPaletteOpen: boolean;
        readonly debugInspectorVisible: boolean;
        readonly documentStatusOpen: boolean;
        readonly editorFontScale: number;
        readonly hasEditorNativeAi: boolean;
        readonly hasSelectionForAi: boolean;
        readonly keymapDelegateToHost: boolean;
        readonly keymapProfile: string;
        readonly layoutDensity: string;
        readonly modeControl: string;
        readonly optionalStats: boolean;
        readonly readableLineWidth: number;
        readonly settingsOpen: boolean;
        readonly statusDisclosure: string;
        readonly toolbarMode: string;
        readonly toolbarStyle: string;
        readonly visibleCommandGroups: readonly string[];
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
      acceptAiSuggestionForTest: () => void;
      generateAiSuggestionForTest: (action?: AiWritingAction, prompt?: string) => Promise<void>;
      loadAiPolicyDeniedDocumentForTest: () => void;
      loadHtmlArtifactForTest: (fileName: string, content: string) => void;
      loadImportedCopyForTest: (fileName: string, content: string) => void;
      loadWritableMarkdownFileForTest: (fileName: string, content: string) => void;
      memorySave: (source: "button" | "keyboard shortcut") => void;
      insertParagraphAfterCurrentRichBlock: () => void;
      openSlashMenuForTest: (query: string) => void;
      runRichCommand: (commandId: RichCommandId, options?: ApplyRichMarkdownCommandOptions) => void;
      showRealFileOpenUnavailableForTest: () => void;
      showUnsupportedLocalFileStateForTest: () => void;
      simulateExternalConflict: () => void;
      setCursorAfterText: (text: string) => void;
      setCursorToEnd: () => void;
      setReferenceSurfacePreferencesForTest: (preferences: ReferenceEditorPreferenceInput) => void;
      setRichSelectionAfterText: (text: string) => void;
      setSelection: (anchor: number, head: number) => void;
      startMockAiSessionForTest: () => void;
      switchEditorMode: (mode: DemoEditorMode) => void;
      toggleCurrentRichTodo: () => void;
      toggleRichFoldForText: (text: string) => void;
    };
    __MME_HTML_PREVIEW_SCRIPT_RAN__?: boolean;
  }
}
