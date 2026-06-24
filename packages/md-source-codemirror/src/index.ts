import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown, markdownKeymap } from "@codemirror/lang-markdown";
import { bracketMatching, defaultHighlightStyle, indentOnInput, syntaxHighlighting } from "@codemirror/language";
import { EditorState, Prec, Transaction, type Extension } from "@codemirror/state";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import {
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  type KeyBinding
} from "@codemirror/view";

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
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    history(),
    drawSelection(),
    dropCursor(),
    EditorState.allowMultipleSelections.of(true),
    indentOnInput(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    bracketMatching(),
    closeBrackets(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    markdown({ addKeymap: false }),
    Prec.highest(EditorView.domEventHandlers({
      keydown(event, view) {
        if (event.key !== "Enter") {
          return false;
        }
        const handled = exitEmptyMarkdownMarkup(view);
        if (handled) {
          event.preventDefault();
        }
        return handled;
      }
    })),
    Prec.highest(keymap.of(momentariseSourcePriorityKeymap(options))),
    Prec.low(keymap.of([
      ...markdownKeymap,
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...searchKeymap,
      ...historyKeymap,
      indentWithTab
    ])),
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
    ...momentariseSourcePriorityKeymap(options),
    ...markdownKeymap
  ];
}

function momentariseSourcePriorityKeymap(options: MomentariseSourceExtensionOptions = {}): KeyBinding[] {
  return [
    {
      key: "Mod-s",
      preventDefault: true,
      run: () => options.onSave?.() ?? false
    },
    {
      key: "Enter",
      run: exitEmptyMarkdownMarkup
    }
  ];
}

function exitEmptyMarkdownMarkup(view: EditorView): boolean {
  const { state } = view;
  const selection = state.selection.main;
  if (!selection.empty) {
    return false;
  }

  const line = state.doc.lineAt(selection.from);
  const beforeCursor = state.sliceDoc(line.from, selection.from);
  const afterCursor = state.sliceDoc(selection.from, line.to);
  const isEmptyListItem = /^(\s*)(?:[-*+]|\d+[.)])\s+$/.test(beforeCursor);
  const isEmptyTaskItem = /^(\s*)([-*+])\s+\[(?: |x|X)\]\s*$/.test(beforeCursor);
  if ((!isEmptyListItem && !isEmptyTaskItem) || afterCursor.trim() !== "") {
    return false;
  }

  view.dispatch(
    state.update({
      annotations: Transaction.userEvent.of("input"),
      changes: {
        from: line.from,
        insert: "",
        to: selection.from
      },
      selection: {
        anchor: line.from
      }
    })
  );
  return true;
}
