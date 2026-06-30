import type { EditorMode } from "@momentarise/md-core";
import {
  createMarkdownEditorSession,
  type MarkdownEditorSession,
  type MarkdownEditorSessionOptions,
  type SessionChangePayload
} from "@momentarise/md-editor";
import type { SaveState } from "@momentarise/md-save";
import {
  createMomentariseSourceView,
  type MomentariseSourcePreferences
} from "@momentarise/md-source-codemirror";
import {
  applyMmeThemeToElement,
  createDocumentStatus,
  createModeControl,
  createSurfaceDocumentState,
  defaultMmeStrings,
  type MmeStrings,
  type SurfaceDocumentState,
  type SurfacePreferences
} from "@momentarise/md-surface";
import {
  defaultIconSet,
  type IconSet,
  type MmeScheme,
  type MmeTheme
} from "@momentarise/md-theme";
import {
  createElement,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactElement
} from "react";

export interface MarkdownEditorReactBindingContract {
  readonly binding: "react";
  readonly packageName: "@momentarise/md-react";
  readonly thinBinding: true;
}

export interface MarkdownEditorReactOptions extends MarkdownEditorSessionOptions {
  readonly document?: Partial<SurfaceDocumentState>;
  readonly icons?: IconSet;
  readonly scheme?: MmeScheme;
  readonly sourcePreferences?: MomentariseSourcePreferences;
  readonly strings?: MmeStrings;
  readonly theme?: MmeTheme;
}

export interface MarkdownEditorReactState {
  readonly mode: EditorMode;
  readonly saveState: SaveState;
}

export interface UseMarkdownEditorResult {
  readonly containerRef: (element: HTMLElement | null) => void;
  readonly session: MarkdownEditorSession;
  readonly state: MarkdownEditorReactState;
}

export interface MarkdownEditorProps {
  readonly className?: string;
  readonly onChange?: (content: string, payload: SessionChangePayload) => void;
  readonly options: MarkdownEditorReactOptions;
}

interface ReactEditorMount {
  destroy(): void;
}

export const markdownReactBindingPackage: MarkdownEditorReactBindingContract = {
  binding: "react",
  packageName: "@momentarise/md-react",
  thinBinding: true
};

export function useMarkdownEditor(options: MarkdownEditorReactOptions): UseMarkdownEditorResult {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const sessionRef = useRef<MarkdownEditorSession | null>(null);
  if (!sessionRef.current) {
    sessionRef.current = createMarkdownEditorSession(sessionOptions(options));
  }
  const session = sessionRef.current;
  const mountRef = useRef<ReactEditorMount | null>(null);
  const [state, setState] = useState<MarkdownEditorReactState>(() => readSessionState(session));

  useEffect(() => {
    const update = (): void => {
      setState(readSessionState(session));
    };
    const cleanups = [
      session.on("mode", update),
      session.on("save-state", update),
      session.on("change", update)
    ];
    return () => {
      for (const cleanup of cleanups) {
        cleanup();
      }
    };
  }, [session]);

  useEffect(() => {
    return () => {
      mountRef.current?.destroy();
      mountRef.current = null;
      session.destroy();
    };
  }, [session]);

  const containerRef = useCallback((element: HTMLElement | null): void => {
    mountRef.current?.destroy();
    mountRef.current = null;
    if (element) {
      mountRef.current = mountReactEditor(element, session, optionsRef.current);
    }
  }, [session]);

  return {
    containerRef,
    session,
    state
  };
}

export function MarkdownEditor(props: MarkdownEditorProps): ReactElement {
  const { containerRef, session } = useMarkdownEditor(props.options);

  useEffect(() => {
    if (!props.onChange) {
      return undefined;
    }
    return session.on("change", (payload) => {
      props.onChange?.(payload.content, payload);
    });
  }, [props.onChange, session]);

  return createElement("div", {
    className: props.className,
    "data-mme-react-editor": "",
    ref: containerRef
  });
}

function sessionOptions(options: MarkdownEditorReactOptions): MarkdownEditorSessionOptions {
  return {
    ...(options.aiProvider === undefined ? {} : { aiProvider: options.aiProvider }),
    ...(options.autosaveDelayMs === undefined ? {} : { autosaveDelayMs: options.autosaveDelayMs }),
    content: options.content,
    ...(options.dialect === undefined ? {} : { dialect: options.dialect }),
    ...(options.path === undefined ? {} : { path: options.path }),
    ...(options.policyResolver === undefined ? {} : { policyResolver: options.policyResolver }),
    scheduler: options.scheduler,
    target: options.target
  };
}

function readSessionState(session: MarkdownEditorSession): MarkdownEditorReactState {
  return {
    mode: session.getMode(),
    saveState: session.getSaveState()
  };
}

function mountReactEditor(
  element: HTMLElement,
  session: MarkdownEditorSession,
  options: MarkdownEditorReactOptions
): ReactEditorMount {
  const doc = element.ownerDocument;
  const root = doc.createElement("div");
  const modeHost = doc.createElement("div");
  const statusHost = doc.createElement("div");
  const sourceHost = doc.createElement("div");
  const icons = options.icons ?? defaultIconSet;
  const strings = options.strings ?? defaultMmeStrings;
  const preferences: SurfacePreferences = {
    aiEntryPoints: [],
    toolbarMode: "hidden",
    visibleCommandGroups: []
  };
  let destroyed = false;
  let syncingFromSession = false;

  root.className = "mme-react-editor-shell";
  modeHost.dataset.mmeReactMode = "";
  statusHost.dataset.mmeReactStatus = "";
  sourceHost.dataset.mmeReactSource = "";
  applyMmeThemeToElement(root, options.theme, options.scheme);
  root.append(modeHost, statusHost, sourceHost);
  element.replaceChildren(root);

  const sourceView = createMomentariseSourceView({
    doc: session.getContent(),
    parent: sourceHost,
    onChange(content) {
      if (!syncingFromSession) {
        session.setContent(content, "source-view");
      }
    },
    onSave() {
      void session.flush("manual");
      return true;
    },
    ...(options.sourcePreferences === undefined ? {} : { preferences: options.sourcePreferences })
  });

  const modeControl = createModeControl({
    host: modeHost,
    icons,
    preferences,
    session,
    state: {
      documentKind: "markdown",
      editorMode: session.getMode()
    },
    strings,
    onSwitchMode(mode) {
      session.setMode(mode);
    }
  });
  const documentStatus = createDocumentStatus({
    document: reactSurfaceDocumentState(session, options),
    host: statusHost,
    icons,
    preferences,
    saveState: session.getSaveState(),
    session,
    strings,
    onPrimaryAction() {
      void session.flush("manual");
    }
  });

  const updateSurfaces = (): void => {
    modeControl.setState({
      documentKind: "markdown",
      editorMode: session.getMode()
    });
    documentStatus.setState({
      document: reactSurfaceDocumentState(session, options),
      saveState: session.getSaveState()
    });
  };
  const syncSourceFromSession = (content: string): void => {
    if (sourceView.getContent() === content) {
      return;
    }
    syncingFromSession = true;
    sourceView.replaceContent(content);
    syncingFromSession = false;
  };

  const cleanups = [
    session.on("change", (payload) => {
      if (payload.origin !== "source-view") {
        syncSourceFromSession(payload.content);
      }
      updateSurfaces();
    }),
    session.on("mode", updateSurfaces),
    session.on("save-state", updateSurfaces),
    session.on("destroy", () => {
      destroy();
    })
  ];

  const destroy = (): void => {
    if (destroyed) {
      return;
    }
    destroyed = true;
    for (const cleanup of cleanups.splice(0)) {
      cleanup();
    }
    documentStatus.destroy();
    modeControl.destroy();
    sourceView.destroy();
    root.remove();
  };

  updateSurfaces();
  return { destroy };
}

function reactSurfaceDocumentState(
  session: MarkdownEditorSession,
  options: MarkdownEditorReactOptions
): ReturnType<typeof createSurfaceDocumentState> {
  return createSurfaceDocumentState({
    ...(options.document === undefined ? {} : { overrides: options.document }),
    ...(options.path === undefined ? {} : { path: options.path }),
    saveState: session.getSaveState(),
    targetLabel: options.target.targetLabel
  });
}
