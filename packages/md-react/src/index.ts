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
  const destroyedRef = useRef(false);
  if (!sessionRef.current) {
    sessionRef.current = createMarkdownEditorSession(sessionOptions(options));
  }
  const session = sessionRef.current;
  const mountRef = useRef<ReactEditorMount | null>(null);
  const containerElementRef = useRef<HTMLElement | null>(null);
  const [state, setState] = useState<MarkdownEditorReactState>(() => readSessionState(session));

  // React StrictMode (React 18/19 dev) double-invokes this effect's setup/cleanup
  // (setup -> cleanup -> setup) synchronously, without re-rendering and without
  // re-invoking `containerRef`. The setup below must therefore be able to detect
  // that a previous cleanup destroyed the session and container mount, and
  // recreate both from refs alone before resubscribing.
  useEffect(() => {
    let liveSession = sessionRef.current;
    if (liveSession === null || destroyedRef.current) {
      liveSession = createMarkdownEditorSession(sessionOptions(optionsRef.current));
      sessionRef.current = liveSession;
      destroyedRef.current = false;
      setState(readSessionState(liveSession));
      if (containerElementRef.current) {
        mountRef.current?.destroy();
        mountRef.current = mountReactEditor(containerElementRef.current, liveSession, optionsRef.current);
      }
    }
    const update = (): void => {
      setState(readSessionState(liveSession));
    };
    const cleanups = [
      liveSession.on("mode", update),
      liveSession.on("save-state", update),
      liveSession.on("change", update)
    ];
    return () => {
      for (const cleanup of cleanups) {
        cleanup();
      }
      mountRef.current?.destroy();
      mountRef.current = null;
      liveSession.destroy();
      destroyedRef.current = true;
    };
    // Deliberately empty: this effect's only reactive reads are refs (stable identities), so it
    // is meant to run exactly once per real mount/unmount, and recreates a live session inline
    // at effect-time if a prior StrictMode-simulated cleanup already destroyed it.
  }, []);

  const containerRef = useCallback((element: HTMLElement | null): void => {
    containerElementRef.current = element;
    mountRef.current?.destroy();
    mountRef.current = null;
    if (element && sessionRef.current && !destroyedRef.current) {
      mountRef.current = mountReactEditor(element, sessionRef.current, optionsRef.current);
    }
  }, []);

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
