import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { bracketMatching, indentOnInput } from "@codemirror/language";
import { Transaction, type Extension } from "@codemirror/state";
import { EditorView, keymap, type KeyBinding } from "@codemirror/view";
import { basicSetup } from "codemirror";

export interface MomentariseSourceCodeMirrorContract {
  readonly packageName: "@momentarise/md-source-codemirror";
  readonly sourceMode: "codemirror6";
}

export interface MomentariseSourceExtensionOptions {
  readonly onSave?: () => boolean;
  readonly includeDefaultTheme?: boolean;
}

export const momentariseSourcePackage: MomentariseSourceCodeMirrorContract = {
  packageName: "@momentarise/md-source-codemirror",
  sourceMode: "codemirror6"
};

export function createMomentariseSourceExtensions(options: MomentariseSourceExtensionOptions = {}): Extension[] {
  const extensions: Extension[] = [
    basicSetup,
    markdown(),
    bracketMatching(),
    closeBrackets(),
    indentOnInput(),
    keymap.of([
      ...momentariseSourceKeymap(options),
      ...closeBracketsKeymap,
      indentWithTab,
      ...historyKeymap,
      ...defaultKeymap
    ]),
    EditorView.lineWrapping
  ];

  if (options.includeDefaultTheme !== false) {
    extensions.push(
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
    );
  }

  return extensions;
}

export function momentariseSourceKeymap(options: MomentariseSourceExtensionOptions = {}): KeyBinding[] {
  return [
    {
      key: "Enter",
      run: continueMarkdownList
    },
    {
      key: "Mod-s",
      preventDefault: true,
      run: () => options.onSave?.() ?? false
    }
  ];
}

function continueMarkdownList(view: EditorView): boolean {
  const { state } = view;
  const selection = state.selection.main;
  if (!selection.empty) {
    return false;
  }

  const line = state.doc.lineAt(selection.from);
  const beforeCursor = state.sliceDoc(line.from, selection.from);
  const afterCursor = state.sliceDoc(selection.from, line.to);
  if (exitEmptyCheckboxItem(beforeCursor, afterCursor) || exitEmptyMarkdownListItem(beforeCursor, afterCursor)) {
    view.dispatch(
      state.update({
        changes: {
          from: line.from,
          insert: "",
          to: selection.from
        },
        selection: {
          anchor: line.from
        },
        annotations: Transaction.userEvent.of("input")
      })
    );
    return true;
  }

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

function exitEmptyCheckboxItem(beforeCursor: string, afterCursor: string): boolean {
  return /^(\s*)([-*+])\s+\[(?: |x|X)\]\s*$/.test(beforeCursor) && afterCursor.trim() === "";
}

function exitEmptyMarkdownListItem(beforeCursor: string, afterCursor: string): boolean {
  return /^(\s*)(?:[-*+]|\d+[.)])\s+$/.test(beforeCursor) && afterCursor.trim() === "";
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
