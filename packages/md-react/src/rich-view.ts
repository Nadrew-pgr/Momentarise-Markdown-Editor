import type { DocumentDialect } from "@momentarise/md-core";
import {
  createRichMarkdownState,
  serializeRichMarkdownState,
  type MomentariseRichPreferences,
  type RichMarkdownState
} from "@momentarise/md-rich-prosemirror";
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
}

export interface ReactRichViewHandle {
  readonly getContent: () => string;
  readonly setDoc: (markdown: string) => void;
  readonly focus: () => void;
  readonly destroy: () => void;
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
    }
  });

  return {
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
