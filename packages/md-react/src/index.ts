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
  type MomentariseSourcePreferences,
  type MomentariseSourceView
} from "@momentarise/md-source-codemirror";
import type { ReactRichViewHandle, RichSurfaceSupport } from "./rich-view.js";
import {
  anchoredOverlayPlacement,
  applyMmeThemeToElement,
  createDocumentStatus,
  createModeControl,
  createSelectionBubbleToolbar,
  createSurfaceDocumentState,
  defaultMmeStrings,
  type MmeStrings,
  type SurfaceDocumentState,
  type SurfacePreferences,
  type SurfaceSelectionBubbleState
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

/** Surfaces a default `useMarkdownEditor` / `MarkdownEditor` mount provides. */
export type MarkdownEditorReactSurface =
  | "documentStatus"
  | "modeControl"
  | "richView"
  | "selectionBubble"
  | "sourceView";

export type { ReactRichViewHandle } from "./rich-view.js";

export interface MarkdownEditorReactBindingContract {
  readonly binding: "react";
  readonly packageName: "@momentarise/md-react";
  /**
   * MME-0125: what a default mount actually gives you.
   *
   * Published as runtime data rather than left implicit, because the two
   * registry-installed fixtures that verify this binding could otherwise only
   * detect the selection bubble by grepping `dist/index.js` for a factory name —
   * which any minifier or bundler defeats, and which cannot distinguish a mount
   * from a mention in a comment.
   */
  readonly surfaces: readonly MarkdownEditorReactSurface[];
  readonly thinBinding: true;
}

/**
 * Surfaces this binding mounts on the host's behalf.
 *
 * MME-0125: the formatting bubble is on by default, because MME-0089 made it the
 * only formatting surface — with the persistent toolbar off, a binding that
 * mounted neither gave a consumer nothing at all. A host building its own
 * formatting UI turns it off here rather than being left to discover that it has
 * to build one.
 */
export interface MarkdownEditorReactSurfacePreferences {
  /** Default `true`. `false` mounts no bubble at all, rather than a disabled one. */
  readonly selectionBubble?: boolean;
}

export interface MarkdownEditorReactOptions extends MarkdownEditorSessionOptions {
  readonly document?: Partial<SurfaceDocumentState>;
  readonly icons?: IconSet;
  /**
   * Called when the rich view mounts and again with `null` when it unmounts.
   *
   * The handle exposes the live ProseMirror view, so a host can run commands,
   * read the selection, or compose its own surfaces on top of this binding —
   * none of which was possible before, because the view was closure-private.
   */
  readonly onRichViewReady?: (handle: ReactRichViewHandle | null) => void;
  readonly scheme?: MmeScheme;
  readonly sourcePreferences?: MomentariseSourcePreferences;
  readonly strings?: MmeStrings;
  readonly surfacePreferences?: MarkdownEditorReactSurfacePreferences;
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
  surfaces: ["documentStatus", "modeControl", "richView", "selectionBubble", "sourceView"],
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
  const richHost = doc.createElement("div");
  const bubbleHost = doc.createElement("div");
  const icons = options.icons ?? defaultIconSet;
  const strings = options.strings ?? defaultMmeStrings;
  /*
   * MME-0125: `visibleCommandGroups` was `[]`, and every surface command is gated
   * on it — so mounting the bubble without this change would have rendered an
   * empty shell that satisfies "the component is mounted" and gives the writer
   * nothing. `ai` is deliberately absent: this binding ships no AI entry point,
   * and offering one would be an inert control.
   */
  const preferences: SurfacePreferences = {
    aiEntryPoints: [],
    toolbarMode: "hidden",
    visibleCommandGroups: ["blocks", "marks", "lists", "insert"]
  };
  const selectionBubbleEnabled = options.surfacePreferences?.selectionBubble !== false;
  let destroyed = false;
  let syncingFromSession = false;

  root.className = "mme-react-editor-shell";
  modeHost.dataset.mmeReactMode = "";
  statusHost.dataset.mmeReactStatus = "";
  sourceHost.dataset.mmeReactSource = "";
  richHost.dataset.mmeReactRich = "";
  bubbleHost.dataset.mmeReactBubble = "";
  applyMmeThemeToElement(root, options.theme, options.scheme);
  root.append(modeHost, statusHost, sourceHost, richHost);
  element.replaceChildren(root);

  // --- Editing surfaces: source and rich are mounted/unmounted per mode, never both at once. ---
  let sourceView: MomentariseSourceView | null = null;
  let richView: ReactRichViewHandle | null = null;
  let richSupport: RichSurfaceSupport | null = null;
  let linkEditorOpen = false;
  let turnIntoOpen = false;
  // Guards the async rich import: only the newest request may mount, and only if still in rich mode.
  let richMountToken = 0;

  const mountSourceView = (): void => {
    if (sourceView || destroyed) {
      return;
    }
    sourceView = createMomentariseSourceView({
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
  };
  const unmountSourceView = (): void => {
    sourceView?.destroy();
    sourceView = null;
    sourceHost.replaceChildren();
  };
  const unmountRichView = (): void => {
    const hadRichView = richView !== null;
    unmountSelectionBubble();
    richView?.destroy();
    richView = null;
    richSupport = null;
    // Only report a teardown that happened: `applyMode()` runs this in source
    // mode at startup, and `destroy()` runs it again, so an unguarded call
    // handed hosts spurious `null`s before any handle had been delivered.
    if (hadRichView) {
      options.onRichViewReady?.(null);
    }
    richHost.replaceChildren();
  };
  const mountRichView = (): void => {
    if (richView || destroyed) {
      return;
    }
    const token = ++richMountToken;
    // Dynamic import: consumers who never enter rich mode never load prosemirror-view. The rich
    // module only touches the DOM here (client-side), keeping the top-level binding SSR-safe.
    void import("./rich-view.js")
      .then(({ createReactRichView, richSurfaceSupport }) => {
        // The mode may have changed, or the session may have been destroyed (StrictMode remount),
        // while the import was in flight — discard a stale mount.
        if (destroyed || token !== richMountToken || session.getMode() !== "rich") {
          return;
        }
        richSupport = richSurfaceSupport;
        richView = createReactRichView({
          host: richHost,
          doc: session.getContent(),
          onChange(markdown) {
            if (!syncingFromSession) {
              session.setContent(markdown, "rich-view");
            }
          },
          onStateChange() {
            renderBubble();
          }
        });
        // The bubble mounts only once a rich view exists, so it can never be an
        // affordance with nothing behind it.
        mountSelectionBubble();
        renderBubble();
        options.onRichViewReady?.(richView);
      })
      .catch((error: unknown) => {
        // Rich mode needs the optional peers (@momentarise/md-rich-prosemirror + prosemirror-view).
        // If they are not installed the import rejects: surface a clear reason instead of an
        // unhandled rejection, and fall back to source so the editor never shows a blank rich pane.
        if (destroyed || token !== richMountToken) {
          return;
        }
        // eslint-disable-next-line no-console -- one-time diagnostic for a missing optional peer.
        console.error(
          "[@momentarise/md-react] Rich mode is unavailable. Install its optional peers " +
            "'@momentarise/md-rich-prosemirror' and 'prosemirror-view' to enable it. Falling back to source.",
          error
        );
        if (session.getMode() === "rich") {
          session.setMode("source");
        }
      });
  };

  /* ---- MME-0125: the formatting surface -------------------------------- *
   *
   * Everything ProseMirror-shaped stays inside the dynamically imported rich
   * module or behind the handle it returns, so this file keeps the SSR safety
   * and the "no bundle cost until rich mode" property MME-0101 established.
   */
  let selectionBubble: ReturnType<typeof createSelectionBubbleToolbar> | null = null;

  const bubbleState = (): SurfaceSelectionBubbleState => {
    if (!richView || !richSupport) {
      return { visible: false };
    }
    const state = richView.getRichState();
    const visible = richSupport.richSelectionSupportsFormatting(state);
    const blockCommand = richSupport.activeBlockCommand(state);
    return {
      ...(blockCommand === undefined ? {} : { activeBlockCommand: blockCommand }),
      activeIds: richSupport.activeMarkIds(state),
      aiVisible: false,
      linkEditor: { href: richSupport.activeLinkHref(state) ?? "", open: visible && linkEditorOpen },
      turnIntoDisabledCommands: richSupport.unavailableTurnIntoCommands(state),
      turnIntoOpen: visible && turnIntoOpen,
      visible
    };
  };

  const positionBubble = (): void => {
    if (!selectionBubble || !richView || selectionBubble.root.hidden) {
      return;
    }
    const anchor = richSupport?.selectionRect(richView.getEditorView());
    if (!anchor) {
      return;
    }
    const container = richHost.getBoundingClientRect();
    const overlay = selectionBubble.root.getBoundingClientRect();
    /*
     * Clamp to what is on screen, not to the host box. `anchoredOverlayPlacement`
     * defaults `bounds` to `container`, and the rich host is routinely taller
     * than the viewport — clamping to it parks the bubble off-screen. This is the
     * MME-0086 bounds-vs-container distinction; omitting it here would have
     * reproduced that defect in the binding while the demo was immune.
     */
    const view = richHost.ownerDocument.defaultView;
    const viewportWidth = richHost.ownerDocument.documentElement.clientWidth || view?.innerWidth || container.width;
    const viewportHeight = richHost.ownerDocument.documentElement.clientHeight || view?.innerHeight || container.height;
    const bounds = {
      height: Math.max(1, Math.min(container.bottom, viewportHeight) - Math.max(container.top, 0)),
      left: Math.max(container.left, 0),
      top: Math.max(container.top, 0),
      width: Math.max(1, Math.min(container.right, viewportWidth) - Math.max(container.left, 0))
    };
    const placement = anchoredOverlayPlacement({
      align: "center",
      anchor,
      bounds,
      container,
      gap: 8,
      margin: 12,
      overlay: {
        height: overlay.height || selectionBubble.root.offsetHeight,
        width: overlay.width || selectionBubble.root.offsetWidth
      },
      preferred: "above"
    });
    selectionBubble.root.dataset.placement = placement.placement;
    selectionBubble.root.style.setProperty("--selection-bubble-left", `${Math.round(placement.left)}px`);
    selectionBubble.root.style.setProperty("--selection-bubble-top", `${Math.round(placement.top)}px`);
  };

  const renderBubble = (): void => {
    if (!selectionBubble) {
      return;
    }
    const next = bubbleState();
    if (!next.visible) {
      linkEditorOpen = false;
      turnIntoOpen = false;
    }
    selectionBubble.setState(next);
    positionBubble();
  };

  const runBubbleCommand = (commandId: string, commandOptions: Record<string, string> = {}): void => {
    if (!richView || !richSupport) {
      return;
    }
    const result = richSupport.runCommand(richView.getRichState(), commandId, commandOptions);
    if (result) {
      richView.applyRichState(result);
    }
    renderBubble();
  };

  const mountSelectionBubble = (): void => {
    if (selectionBubble || !selectionBubbleEnabled || destroyed) {
      return;
    }
    /*
     * The host is attached at mount time, never at construction.
     *
     * The packaged stylesheet puts the source and rich hosts in the SAME grid
     * area and hides whichever is `:empty` — so a bubble host appended once and
     * left there means the rich host is never empty, never hidden, and (being
     * positioned) paints over the source editor. A default consumer in source
     * mode got a stray border and a transparent div swallowing every click meant
     * for CodeMirror: a worse defect than the missing formatting UI this issue
     * exists to fix, and invisible to every JSDOM test because JSDOM has no
     * layout.
     */
    richHost.style.position = "relative";
    richHost.append(bubbleHost);
    selectionBubble = createSelectionBubbleToolbar({
      host: bubbleHost,
      icons,
      preferences,
      session,
      state: { visible: false },
      strings,
      onAiSelection() {
        // This binding ships no AI entry point; the button is hidden by `aiVisible: false`.
      },
      onLinkCancel() {
        richView?.focus();
      },
      onLinkRemove() {
        const href = richSupport?.activeLinkHref(richView?.getRichState() ?? null);
        if (href) {
          runBubbleCommand("link", { href });
        }
      },
      onLinkSubmit(href) {
        const trimmed = href.trim();
        if (!trimmed) {
          return;
        }
        const existing = richSupport?.activeLinkHref(richView?.getRichState() ?? null);
        if (existing) {
          runBubbleCommand("link", { href: existing });
        }
        runBubbleCommand("link", { href: trimmed });
      },
      onLinkToggle(open) {
        linkEditorOpen = open;
        turnIntoOpen = false;
        renderBubble();
        if (open) {
          bubbleHost.querySelector<HTMLInputElement>('[data-testid="selection-bubble-link-input"]')?.focus();
        }
      },
      onRunToolbarItem(id) {
        runBubbleCommand(id.replace(/^mme:/, ""));
      },
      onTurnInto(richCommandId) {
        runBubbleCommand(richCommandId);
      },
      onTurnIntoToggle(open) {
        turnIntoOpen = open;
        linkEditorOpen = false;
        renderBubble();
      }
    });
  };

  const unmountSelectionBubble = (): void => {
    selectionBubble?.destroy();
    selectionBubble = null;
    linkEditorOpen = false;
    turnIntoOpen = false;
    bubbleHost.replaceChildren();
    bubbleHost.remove();
    richHost.style.removeProperty("position");
  };

  const applyMode = (): void => {
    if (destroyed) {
      return;
    }
    if (session.getMode() === "rich") {
      unmountSourceView();
      mountRichView();
    } else {
      // Any non-rich mode (only source is offered by this binding) shows the source view.
      richMountToken += 1;
      unmountRichView();
      mountSourceView();
    }
  };

  const modeControl = createModeControl({
    host: modeHost,
    icons,
    preferences,
    session,
    // This binding mounts source and rich only; do not offer an inert live-preview control.
    availableModes: ["source", "rich"],
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
  const syncActiveViewFromSession = (content: string, origin: string): void => {
    syncingFromSession = true;
    try {
      if (sourceView && origin !== "source-view" && sourceView.getContent() !== content) {
        sourceView.replaceContent(content);
      }
      if (richView && origin !== "rich-view") {
        richView.setDoc(content);
      }
    } finally {
      syncingFromSession = false;
    }
  };

  const cleanups = [
    session.on("change", (payload) => {
      syncActiveViewFromSession(payload.content, payload.origin);
      updateSurfaces();
    }),
    session.on("mode", () => {
      applyMode();
      updateSurfaces();
    }),
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
    richMountToken += 1;
    for (const cleanup of cleanups.splice(0)) {
      cleanup();
    }
    documentStatus.destroy();
    modeControl.destroy();
    unmountSourceView();
    unmountRichView();
    root.remove();
  };

  applyMode();
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
