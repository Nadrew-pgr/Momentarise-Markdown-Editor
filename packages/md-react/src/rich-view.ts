import type { DocumentDialect } from "@momentarise/md-core";
import {
  canRunRichMarkdownCommand,
  createRichMarkdownState,
  richSelectionSupportsFormatting,
  runRichMarkdownCommand,
  serializeRichMarkdownState,
  type ApplyRichMarkdownCommandOptions,
  type MomentariseRichPreferences,
  type RichCommandId,
  type RichMarkdownState
} from "@momentarise/md-rich-prosemirror";
import type { SurfaceRect } from "@momentarise/md-surface";
import { EditorView } from "prosemirror-view";

// Dynamically imported by @momentarise/md-react only when the session enters rich mode, so
// consumers who never use rich mode do not pay the ProseMirror-view bundle cost, and the module
// graph stays free of DOM globals at import time in SSR (this file is only ever imported client-side
// from an effect). The binding owns the EditorView here (md-rich-prosemirror intentionally exports
// only schema/plugins/serialization); the actual view construction is a host responsibility.

export interface ReactRichViewOptions {
  readonly host: HTMLElement;
  readonly doc: string;
  readonly dialect?: DocumentDialect;
  readonly preferences?: MomentariseRichPreferences;
  readonly onChange: (markdown: string) => void;
  /**
   * Fires after every transaction, whether or not the document changed.
   *
   * MME-0125: the selection bubble is derived from the selection, so it needs a
   * signal that `onChange` cannot give it — moving the caret changes what the
   * formatting surface should show while changing no bytes at all.
   */
  readonly onStateChange?: () => void;
}

export interface ReactRichViewHandle {
  readonly getContent: () => string;
  readonly setDoc: (markdown: string) => void;
  readonly focus: () => void;
  readonly destroy: () => void;
  /**
   * The live ProseMirror view.
   *
   * `md-rich-prosemirror` deliberately exports schema, plugins and serialization
   * but never a view, because view construction is a host responsibility — which
   * left a host that adopts this binding with no way to run a command, read a
   * selection, or add a plugin. This is that escape hatch, and it is what the
   * binding's own formatting surface is built on.
   */
  readonly getEditorView: () => EditorView;
  /** The current rich state, for callers that need to run package commands against it. */
  readonly getRichState: () => RichMarkdownState;
  /** Replaces the state after a package command has produced a new one. */
  readonly applyRichState: (next: RichMarkdownState) => void;
}

export function createReactRichView(options: ReactRichViewOptions): ReactRichViewHandle {
  const dialect: DocumentDialect = options.dialect ?? "momentarise-enhanced";
  let richState: RichMarkdownState = createRichMarkdownState(options.doc, {
    dialect,
    ...(options.preferences ? { preferences: options.preferences } : {})
  });
  let syncingFromSession = false;
  let destroyed = false;

  const view = new EditorView(options.host, {
    state: richState.editorState,
    dispatchTransaction(transaction) {
      if (destroyed) {
        return;
      }
      const nextState = view.state.apply(transaction);
      view.updateState(nextState);
      richState = { ...richState, editorState: nextState };
      if (transaction.docChanged && !syncingFromSession) {
        options.onChange(serializeRichMarkdownState(richState).content);
      }
      options.onStateChange?.();
    }
  });

  return {
    getEditorView() {
      return view;
    },
    getRichState() {
      return richState;
    },
    applyRichState(next) {
      if (destroyed) {
        return;
      }
      richState = next;
      view.updateState(next.editorState);
      options.onChange(serializeRichMarkdownState(richState).content);
      options.onStateChange?.();
    },
    getContent() {
      return serializeRichMarkdownState(richState).content;
    },
    setDoc(markdown) {
      if (destroyed || serializeRichMarkdownState(richState).content === markdown) {
        return;
      }
      syncingFromSession = true;
      try {
        richState = createRichMarkdownState(markdown, {
          dialect,
          schema: richState.schema,
          ...(options.preferences ? { preferences: options.preferences } : {})
        });
        view.updateState(richState.editorState);
      } finally {
        syncingFromSession = false;
      }
    },
    focus() {
      view.focus();
    },
    destroy() {
      if (destroyed) {
        return;
      }
      destroyed = true;
      view.destroy();
    }
  };
}


/* --- MME-0125: the ProseMirror-shaped half of the binding's formatting surface --
 *
 * `@momentarise/md-react`'s entry module must stay importable with no DOM and no
 * ProseMirror (Next.js server-component boundary, and MME-0101's "no bundle cost
 * until rich mode" property). Everything the selection bubble needs that touches
 * the schema, a command, or a view therefore lives here, in the module that is
 * already dynamically imported at the moment rich mode starts.
 *
 * The rules themselves are NOT re-implemented: every function below delegates to
 * `@momentarise/md-rich-prosemirror`, so the binding refuses the same contexts
 * and offers the same conversions as every other host. That is the whole point of
 * MME-0089 having made `richSelectionSupportsFormatting` a package export.
 */

/** The block conversions the bubble offers, in the order `md-surface` renders them. */
const TURN_INTO_COMMANDS: readonly RichCommandId[] = [
  "paragraph",
  "heading1",
  "heading2",
  "heading3",
  "bulletList",
  "orderedList",
  "todo",
  "blockquote",
  "codeBlock"
];

export interface RichSurfaceSupport {
  readonly activeBlockCommand: (state: RichMarkdownState) => string | undefined;
  readonly activeLinkHref: (state: RichMarkdownState | null) => string | null;
  readonly activeMarkIds: (state: RichMarkdownState) => readonly string[];
  readonly richSelectionSupportsFormatting: (state: RichMarkdownState) => boolean;
  readonly runCommand: (
    state: RichMarkdownState,
    commandId: string,
    options: Record<string, string>
  ) => RichMarkdownState | null;
  readonly selectionRect: (view: EditorView) => SurfaceRect | null;
  readonly unavailableTurnIntoCommands: (state: RichMarkdownState) => readonly string[];
}

export const richSurfaceSupport: RichSurfaceSupport = {
  richSelectionSupportsFormatting(state) {
    return richSelectionSupportsFormatting(state);
  },

  activeMarkIds(state) {
    const { selection, doc, schema, storedMarks } = state.editorState;
    const active: string[] = [];
    for (const [markName, commandId] of [
      ["strong", "mme:bold"],
      ["em", "mme:italic"],
      ["code", "mme:inlineCode"],
      ["strike", "mme:strikethrough"]
    ] as const) {
      const mark = schema.marks[markName];
      if (!mark) {
        continue;
      }
      const present = selection.empty
        ? Boolean(mark.isInSet(storedMarks ?? selection.$from.marks()))
        : doc.rangeHasMark(selection.from, selection.to, mark);
      if (present) {
        active.push(commandId);
      }
    }
    return active;
  },

  activeBlockCommand(state) {
    /*
     * Walk outward from the caret. `todo_item` is only ever a child of a list, so
     * reading depth 1 reports every checklist as a bullet list — the defect
     * MME-0089 fixed in the demo, not repeated here.
     */
    const { $from } = state.editorState.selection;
    let node = $from.parent;
    for (let depth = $from.depth; depth >= 1; depth -= 1) {
      const candidate = $from.node(depth);
      if (candidate.type.name === "todo_item") {
        return "todo";
      }
      if (depth === 1) {
        node = candidate;
      }
    }
    switch (node.type.name) {
      case "heading":
        return `heading${(node.attrs.level as number | undefined) ?? 1}`;
      case "bullet_list":
        return "bulletList";
      case "ordered_list":
        return "orderedList";
      case "blockquote":
        return "blockquote";
      case "code_block":
        return "codeBlock";
      case "paragraph":
        return "paragraph";
      default:
        return undefined;
    }
  },

  activeLinkHref(state) {
    if (!state) {
      return null;
    }
    const linkMark = state.editorState.schema.marks.link;
    if (!linkMark) {
      return null;
    }
    const { from, to, $from } = state.editorState.selection;
    if (from === to) {
      const found = linkMark.isInSet($from.marks());
      return typeof found?.attrs.href === "string" ? found.attrs.href : null;
    }
    // Scans the whole range: reading only the first node missed a link starting
    // partway in, and the caller uses this to decide whether to remove first.
    let href: string | null = null;
    state.editorState.doc.nodesBetween(from, to, (node) => {
      if (href !== null) {
        return false;
      }
      const found = linkMark.isInSet(node.marks);
      if (found && typeof found.attrs.href === "string") {
        href = found.attrs.href;
      }
      return true;
    });
    return href;
  },

  unavailableTurnIntoCommands(state) {
    return TURN_INTO_COMMANDS.filter((commandId) => !canRunRichMarkdownCommand(state, commandId));
  },

  runCommand(state, commandId, options) {
    const result = runRichMarkdownCommand(state, commandId as RichCommandId, options as ApplyRichMarkdownCommandOptions);
    return result.handled ? result.state : null;
  },

  selectionRect(view) {
    try {
      const from = view.coordsAtPos(view.state.selection.from);
      const to = view.coordsAtPos(view.state.selection.to);
      const left = Math.min(from.left, to.left);
      const right = Math.max(from.right, to.right);
      const top = Math.min(from.top, to.top);
      const bottom = Math.max(from.bottom, to.bottom);
      return { height: Math.max(1, bottom - top), left, top, width: Math.max(1, right - left) };
    } catch {
      return null;
    }
  }
};
