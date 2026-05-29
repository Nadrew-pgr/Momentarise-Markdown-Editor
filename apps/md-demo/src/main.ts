import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { bracketMatching, indentOnInput } from "@codemirror/language";
import { EditorState, Transaction } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { basicSetup } from "codemirror";
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
        <h1>Source demo</h1>
      </div>
      <div class="topbar-actions" aria-label="Document actions">
        <button class="button secondary" type="button" data-testid="copy-button">Copy</button>
        <button class="button secondary" type="button" data-testid="download-button">Download</button>
        <button class="button primary" type="button" data-testid="memory-save-button">Memory save</button>
      </div>
    </header>

    <section class="workspace" aria-label="Markdown source workspace">
      <div class="editor-region">
        <div class="document-strip" aria-label="Document metadata">
          <span data-testid="document-name">source-mode-fixture.md</span>
          <span data-testid="document-path">fixture://source-mode-fixture.md</span>
          <span class="target-label" data-testid="persistence-target">memory only, not persisted</span>
        </div>
        <div class="editor-host" data-editor-host data-testid="editor-host"></div>
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
        <section class="status-block">
          <p class="label">Source editor</p>
          <p class="status-value">CodeMirror 6</p>
        </section>
        <section class="status-block">
          <p class="label">Baseline</p>
          <ul class="baseline-list">
            <li>Undo / redo</li>
            <li>Multiline editing</li>
            <li>Selection and clipboard</li>
            <li>List and todo continuation</li>
            <li>Bracket and quote pairing</li>
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
const copyButton = queryRequired<HTMLButtonElement>('[data-testid="copy-button"]');
const downloadButton = queryRequired<HTMLButtonElement>('[data-testid="download-button"]');
const memorySaveButton = queryRequired<HTMLButtonElement>('[data-testid="memory-save-button"]');
const saveStateElement = queryRequired<HTMLElement>('[data-testid="save-state"]');
const dirtyStateElement = queryRequired<HTMLElement>('[data-testid="dirty-state"]');
const eventLogElement = queryRequired<HTMLOListElement>('[data-testid="event-log"]');

let memorySnapshot = fixtureMarkdown;
let dirty = false;
let eventCounter = 0;
let lastCopiedMarkdown: string | null = null;

const sourceKeymap = [
  {
    key: "Enter",
    run: continueMarkdownList
  },
  {
    key: "Mod-s",
    preventDefault: true,
    run: () => {
      memorySave("keyboard shortcut");
      return true;
    }
  }
];

const editor = new EditorView({
  parent: editorHost,
  state: EditorState.create({
    doc: fixtureMarkdown,
    extensions: [
      basicSetup,
      markdown(),
      bracketMatching(),
      closeBrackets(),
      indentOnInput(),
      keymap.of([
        ...sourceKeymap,
        ...closeBracketsKeymap,
        indentWithTab,
        ...historyKeymap,
        ...defaultKeymap
      ]),
      EditorView.lineWrapping,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          updateDirtyState();
        }
      }),
      EditorView.theme({
        "&": {
          height: "100%"
        },
        ".cm-scroller": {
          fontFamily: "var(--font-mono)",
          fontSize: "14px",
          lineHeight: "1.6"
        },
        ".cm-content": {
          padding: "24px 28px"
        },
        ".cm-gutters": {
          backgroundColor: "transparent",
          borderRight: "1px solid var(--line)"
        }
      })
    ]
  })
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

logEvent("Loaded built-in fixture in memory-only mode.");

window.__MME_DEMO_VISUAL_CHECK__ = {
  editor,
  getMarkdown,
  getLastCopiedMarkdown() {
    return lastCopiedMarkdown;
  },
  memorySave,
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
  }
};

function continueMarkdownList(view: EditorView): boolean {
  const { state } = view;
  const selection = state.selection.main;
  if (!selection.empty) {
    return false;
  }

  const line = state.doc.lineAt(selection.from);
  const beforeCursor = state.sliceDoc(line.from, selection.from);
  const checkboxInsertion = continueCheckboxItem(beforeCursor);
  const listInsertion = checkboxInsertion ?? continueListItem(beforeCursor);

  if (!listInsertion) {
    return false;
  }

  view.dispatch(
    state.update({
      changes: {
        from: selection.from,
        insert: listInsertion
      },
      selection: {
        anchor: selection.from + listInsertion.length
      },
      annotations: Transaction.userEvent.of("input")
    })
  );
  return true;
}

function continueCheckboxItem(beforeCursor: string): string | null {
  const match = beforeCursor.match(/^(\s*)([-*+])\s+\[(?: |x|X)\]\s+/);
  if (!match) {
    return null;
  }
  const indent = match[1] ?? "";
  const marker = match[2];
  if (!marker) {
    return null;
  }
  return `\n${indent}${marker} [ ] `;
}

function continueListItem(beforeCursor: string): string | null {
  const unordered = beforeCursor.match(/^(\s*)([-*+])\s+/);
  if (unordered) {
    const indent = unordered[1] ?? "";
    const marker = unordered[2];
    if (!marker) {
      return null;
    }
    return `\n${indent}${marker} `;
  }

  const ordered = beforeCursor.match(/^(\s*)(\d+)([.)])\s+/);
  if (ordered) {
    const indent = ordered[1] ?? "";
    const number = ordered[2];
    const marker = ordered[3];
    if (!number || !marker) {
      return null;
    }
    const nextNumber = Number.parseInt(number, 10) + 1;
    return `\n${indent}${nextNumber}${marker} `;
  }

  return null;
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
  anchor.download = "source-mode-fixture.md";
  anchor.click();
  URL.revokeObjectURL(url);
  logEvent("Generated Markdown download. Original fixture was not persisted.");
}

function memorySave(source: "button" | "keyboard shortcut"): void {
  memorySnapshot = getMarkdown();
  updateDirtyState();
  saveStateElement.textContent = "memory saved (not persisted)";
  logEvent(`Captured ${source} save to memory-only target.`);
}

function updateDirtyState(): void {
  dirty = getMarkdown() !== memorySnapshot;
  dirtyStateElement.textContent = dirty ? "dirty" : "clean";
  saveStateElement.textContent = dirty ? "memory only / dirty" : "memory saved (not persisted)";
}

function getMarkdown(): string {
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
      editor: EditorView;
      getLastCopiedMarkdown: () => string | null;
      getMarkdown: () => string;
      memorySave: (source: "button" | "keyboard shortcut") => void;
      setCursorToEnd: () => void;
      setSelection: (anchor: number, head: number) => void;
    };
  }
}
