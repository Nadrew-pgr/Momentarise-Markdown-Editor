import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown, markdownKeymap } from "@codemirror/lang-markdown";
import { bracketMatching, HighlightStyle, indentOnInput, syntaxHighlighting } from "@codemirror/language";
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
import { tags } from "@lezer/highlight";

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
    syntaxHighlighting(momentariseMarkdownHighlightStyle, { fallback: true }),
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
          fontFamily: "var(--mme-font-family-mono)",
          fontSize: "calc(var(--mme-font-size-base) * var(--mme-font-scale))",
          lineHeight: "var(--mme-line-height)"
        },
        ".cm-content": {
          padding:
            "calc(var(--mme-space-6) * var(--mme-density)) calc(var(--mme-space-6) * var(--mme-density))"
        },
        ".cm-gutters": {
          backgroundColor: "transparent",
          borderRight: "1px solid var(--mme-color-border)"
        },
        ".cm-activeLine, .cm-activeLineGutter": {
          backgroundColor: "var(--mme-color-surface)"
        },
        ".cm-cursor, .cm-dropCursor": {
          borderLeftColor: "var(--mme-color-text)"
        },
        ".cm-selectionBackground, &.cm-focused .cm-selectionBackground, .cm-content ::selection": {
          backgroundColor: "var(--mme-color-selection) !important"
        }
      })
    );
  }

  return extensions;
}

const momentariseMarkdownHighlightStyle = HighlightStyle.define([
  {
    tag: [tags.heading1, tags.heading2, tags.heading3, tags.heading4, tags.heading5, tags.heading6],
    color: "var(--mme-color-text)",
    fontWeight: "650"
  },
  {
    tag: tags.heading,
    color: "var(--mme-color-text)"
  },
  {
    tag: [tags.emphasis, tags.strong],
    color: "var(--mme-color-text)"
  },
  {
    tag: [tags.link, tags.url],
    color: "var(--mme-color-accent)",
    textDecoration: "underline",
    textUnderlineOffset: "2px"
  },
  {
    tag: [tags.monospace, tags.escape],
    color: "var(--mme-color-accent)"
  },
  {
    tag: [tags.quote, tags.list, tags.contentSeparator, tags.meta, tags.punctuation],
    color: "var(--mme-color-text-muted)"
  },
  {
    tag: [tags.keyword, tags.atom, tags.bool, tags.number],
    color: "var(--mme-color-accent)"
  },
  {
    tag: [tags.string, tags.attributeValue],
    color: "var(--mme-color-text)"
  },
  {
    tag: tags.invalid,
    color: "var(--mme-color-danger)"
  }
]);

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
