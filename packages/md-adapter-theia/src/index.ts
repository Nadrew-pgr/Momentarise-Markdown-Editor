import type { BaseWidget } from "@theia/core/lib/browser/widgets/widget.js";
import type { OpenHandler } from "@theia/core/lib/browser/opener-service.js";
import type { WidgetOpenerOptions } from "@theia/core/lib/browser/widget-open-handler.js";
import { BinaryBuffer } from "@theia/core/lib/common/buffer.js";
import type { PreferenceService } from "@theia/core/lib/common/preferences/preference-service.js";
import type { EditorMode } from "@momentarise/md-core";
import {
  createMarkdownEditorSession,
  type MarkdownEditorSession,
  type MarkdownEditorSessionOptions,
  type PreferenceValue
} from "@momentarise/md-editor";
import {
  hashMarkdownContent,
  type SaveTarget,
  type SaveTargetWriteRequest,
  type SaveTargetWriteResult
} from "@momentarise/md-save";
import {
  createMomentariseSourceView,
  type MomentariseSourceView
} from "@momentarise/md-source-codemirror";
import {
  applyMmeThemeToElement,
  createDocumentStatus,
  createFindReplaceSurface,
  createModeControl,
  createSurfaceDocumentState,
  defaultMmeStrings,
  type SurfaceComponent,
  type SurfaceFindMatch,
  type SurfaceFindReplaceState,
  type SurfacePreferences
} from "@momentarise/md-surface";
import { defaultIconSet } from "@momentarise/md-theme";

export interface TheiaMarkdownAdapterContract {
  readonly host: "theia";
  readonly packageName: "@momentarise/md-adapter-theia";
  readonly shellAdapter: true;
}

export interface TheiaMarkdownDocument {
  readonly content: string;
  readonly fileName: string;
  readonly resource: TheiaResourceLike;
  readonly target: SaveTarget;
}

export interface TheiaMarkdownEditorMountOptions {
  readonly container: HTMLElement;
  readonly contextKey?: TheiaContextKeyLike<boolean>;
  readonly document: TheiaMarkdownDocument;
  readonly preferences?: Readonly<Record<string, PreferenceValue>>;
  readonly preferenceService?: TheiaPreferenceServiceLike;
  readonly sessionOptions?: Partial<Omit<MarkdownEditorSessionOptions, "content" | "target">>;
  readonly onDirtyStateChanged?: (dirty: boolean) => void;
}

export interface TheiaMarkdownEditorMount {
  readonly session: MarkdownEditorSession;
  destroy(): void;
  focus(): void;
  openFind(query?: string): void;
  save(): Promise<void>;
}

export interface TheiaFileSaveTargetOptions {
  readonly fileService: TheiaFileServiceLike;
  readonly resource: TheiaResourceLike;
  readonly targetLabel?: string;
}

export interface TheiaFileReadResultLike {
  readonly value: {
    toString(): string;
  };
}

export interface TheiaFileServiceLike {
  readFile(resource: TheiaResourceLike): Promise<TheiaFileReadResultLike>;
  writeFile(resource: TheiaResourceLike, content: BinaryBuffer): Promise<unknown>;
}

export interface TheiaResourceLike {
  readonly path: {
    readonly base: string;
    readonly ext: string;
  };
  toString(): string;
}

export interface TheiaPreferenceInputOptions {
  readonly preferenceService?: PreferenceService | TheiaPreferenceServiceLike;
  readonly values?: Readonly<Record<string, PreferenceValue>>;
}

export interface TheiaPreferenceServiceLike {
  get<T>(preferenceName: string, defaultValue?: T): T | undefined;
}

export interface TheiaKeybindingRegistryLike {
  registerKeybinding(binding: {
    readonly command: string;
    readonly keybinding: string;
    readonly when?: string;
  }): void;
}

export interface TheiaContextKeyLike<T> {
  reset(): void;
  set(value: T | undefined): void;
}

export interface TheiaMarkdownOpenHandlerOptions {
  readonly fileService: TheiaFileServiceLike;
  readonly openWidget: (document: TheiaMarkdownDocument, options?: WidgetOpenerOptions) => Promise<unknown> | unknown;
}

export type TheiaBaseWidgetCompatibility = BaseWidget;

export interface TheiaBaseWidgetLike {
  id: string;
  node: HTMLElement;
  title: {
    caption?: string;
    closable: boolean;
    label: string;
  };
  addClass(className: string): void;
  dispose(): void;
}

export type TheiaBaseWidgetConstructor = new () => TheiaBaseWidgetLike;

export const theiaMarkdownAdapterPackage: TheiaMarkdownAdapterContract = {
  host: "theia",
  packageName: "@momentarise/md-adapter-theia",
  shellAdapter: true
};

export const THEIA_MARKDOWN_COMMANDS = {
  find: {
    id: "momentarise.markdown.find"
  },
  save: {
    id: "momentarise.markdown.save"
  }
} as const;
export const THEIA_MARKDOWN_OPEN_PRIORITY = 200000;

export function createTheiaFileSaveTarget(options: TheiaFileSaveTargetOptions): SaveTarget {
  return {
    persistenceTarget: "disk",
    targetLabel: options.targetLabel ?? `theia://${options.resource.toString()}`,
    async readExternalHash() {
      const content = await readTheiaFileContent(options.fileService, options.resource);
      return hashMarkdownContent(content);
    },
    async write(request: SaveTargetWriteRequest): Promise<SaveTargetWriteResult> {
      const beforeWriteHash = hashMarkdownContent(await readTheiaFileContent(options.fileService, options.resource));
      if (request.previousSavedHash && beforeWriteHash !== request.previousSavedHash) {
        return {
          externalHash: beforeWriteHash,
          message: "External Theia file content changed before save.",
          status: "conflict"
        };
      }
      try {
        await options.fileService.writeFile(options.resource, BinaryBuffer.fromString(request.content));
      } catch (error) {
        return {
          message: error instanceof Error ? error.message : "Failed to write Theia file.",
          status: "error",
          target: "error"
        };
      }
      return {
        externalHash: request.contentHash,
        status: "saved"
      };
    }
  };
}

export async function readTheiaMarkdownDocument(
  fileService: TheiaFileServiceLike,
  resource: TheiaResourceLike
): Promise<TheiaMarkdownDocument> {
  const content = await readTheiaFileContent(fileService, resource);
  return {
    content,
    fileName: resource.path.base || "untitled.md",
    resource,
    target: createTheiaFileSaveTarget({
      fileService,
      resource
    })
  };
}

export function createTheiaMarkdownEditorMount(options: TheiaMarkdownEditorMountOptions): TheiaMarkdownEditorMount {
  const root = options.container.ownerDocument.createElement("div");
  const modeHost = options.container.ownerDocument.createElement("div");
  const statusHost = options.container.ownerDocument.createElement("div");
  const findHost = options.container.ownerDocument.createElement("div");
  const sourceHost = options.container.ownerDocument.createElement("div");
  const preferences = createTheiaPreferenceInput({
    ...(options.preferenceService === undefined ? {} : { preferenceService: options.preferenceService }),
    ...(options.preferences === undefined ? {} : { values: options.preferences })
  });
  const surfacePreferences: SurfacePreferences = {
    aiEntryPoints: [],
    toolbarMode: stringPreference(preferences["toolbar.mode"], "hidden"),
    visibleCommandGroups: []
  };
  const sourcePreferences = {
    density: sourceDensityPreference(preferences["layout.density"]),
    keymapDelegateToHost: booleanPreference(preferences["keymap.delegateToHost"], true),
    keymapProfile: keymapProfilePreference(preferences["keymap.profile"]),
    lineWrapping: booleanPreference(preferences["source.lineWrapping"], true)
  };
  const session = createMarkdownEditorSession({
    content: options.document.content,
    path: options.document.resource.toString(),
    scheduler: createTheiaTimeoutScheduler(),
    target: options.document.target,
    ...options.sessionOptions
  });
  let destroyed = false;
  let findReplaceState: SurfaceFindReplaceState = {
    activeIndex: 0,
    matches: [],
    open: false,
    query: "",
    replacement: ""
  };
  let syncingFromSession = false;

  root.className = "mme-theia-editor-shell";
  root.tabIndex = -1;
  modeHost.dataset.mmeTheiaMode = "";
  statusHost.dataset.mmeTheiaStatus = "";
  findHost.dataset.mmeTheiaFind = "";
  sourceHost.dataset.mmeTheiaSource = "";
  applyMmeThemeToElement(root);
  root.append(modeHost, statusHost, findHost, sourceHost);
  options.container.replaceChildren(root);

  const sourceView = createMomentariseSourceView({
    doc: session.getContent(),
    parent: sourceHost,
    preferences: sourcePreferences,
    onChange(content) {
      if (!syncingFromSession) {
        session.setContent(content, "source-view");
      }
    },
    onSave() {
      void session.flush("manual");
      return true;
    }
  });
  const modeControl = createModeControl({
    host: modeHost,
    icons: defaultIconSet,
    preferences: surfacePreferences,
    session,
    state: {
      documentKind: "markdown",
      editorMode: session.getMode()
    },
    strings: defaultMmeStrings,
    onSwitchMode(mode: EditorMode) {
      session.setMode(mode);
    }
  });
  const documentStatus = createDocumentStatus({
    document: createSurfaceDocumentState({
      path: options.document.resource.toString(),
      saveState: session.getSaveState(),
      targetLabel: options.document.target.targetLabel
    }),
    host: statusHost,
    icons: defaultIconSet,
    preferences: surfacePreferences,
    saveState: session.getSaveState(),
    session,
    strings: defaultMmeStrings,
    onPrimaryAction() {
      void session.flush("manual");
    }
  });
  const findReplaceSurface = createFindReplaceSurface({
    host: findHost,
    icons: defaultIconSet,
    preferences: surfacePreferences,
    session,
    state: findReplaceState,
    strings: defaultMmeStrings,
    onClose() {
      setFindReplaceState({ open: false });
      sourceView.focus();
    },
    onFind(query) {
      setFindReplaceState({
        activeIndex: 0,
        query
      });
      refreshFindMatches();
    },
    onFindNext() {
      moveFindMatch(1);
    },
    onFindPrevious() {
      moveFindMatch(-1);
    },
    onReplace(replacement) {
      replaceActiveFindMatch(replacement);
    },
    onReplaceAll(replacement) {
      replaceAllFindMatches(replacement);
    }
  });

  const updateSurfaces = (): void => {
    modeControl.setState({
      documentKind: "markdown",
      editorMode: session.getMode()
    });
    documentStatus.setState({
      document: createSurfaceDocumentState({
        path: options.document.resource.toString(),
        saveState: session.getSaveState(),
        targetLabel: options.document.target.targetLabel
      }),
      saveState: session.getSaveState()
    });
    options.onDirtyStateChanged?.(session.getSaveState().status === "dirty");
  };
  const updateFocusContext = (focused: boolean): void => {
    options.contextKey?.set(focused);
  };
  const setFindReplaceState = (nextState: Partial<SurfaceFindReplaceState>): void => {
    findReplaceState = {
      ...findReplaceState,
      ...nextState
    };
    findReplaceSurface.setState(findReplaceState);
  };
  const refreshFindMatches = (): void => {
    const matches = findReplaceState.query ? session.find(findReplaceState.query, { caseSensitive: false }) : [];
    const activeIndex = Math.max(0, Math.min(findReplaceState.activeIndex, Math.max(0, matches.length - 1)));
    setFindReplaceState({
      activeIndex,
      matches
    });
    sourceView.setFindMatches(matches.map((match, index) => toSourceFindMatch(match, index === activeIndex)));
  };
  const moveFindMatch = (direction: 1 | -1): void => {
    if (findReplaceState.matches.length === 0) {
      return;
    }
    const activeIndex = (findReplaceState.activeIndex + direction + findReplaceState.matches.length) % findReplaceState.matches.length;
    setFindReplaceState({ activeIndex });
    sourceView.setFindMatches(findReplaceState.matches.map((match, index) => toSourceFindMatch(match, index === activeIndex)));
  };
  const replaceActiveFindMatch = (replacement: string): void => {
    const match = findReplaceState.matches[findReplaceState.activeIndex];
    setFindReplaceState({ replacement });
    if (!match) {
      return;
    }
    session.replace(match, replacement, "host");
    refreshFindMatches();
  };
  const replaceAllFindMatches = (replacement: string): void => {
    setFindReplaceState({ replacement });
    if (!findReplaceState.query) {
      return;
    }
    session.replaceAll(findReplaceState.query, replacement, {
      caseSensitive: false,
      origin: "host"
    });
    refreshFindMatches();
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
      refreshFindMatches();
      updateSurfaces();
    }),
    session.on("mode", updateSurfaces),
    session.on("save-state", updateSurfaces),
    session.on("destroy", () => {
      destroy();
    })
  ];
  const onFocusIn = (): void => {
    updateFocusContext(true);
  };
  const onFocusOut = (event: FocusEvent): void => {
    if (!root.contains(event.relatedTarget as Node | null)) {
      updateFocusContext(false);
    }
  };
  root.addEventListener("focusin", onFocusIn);
  root.addEventListener("focusout", onFocusOut);

  function destroy(): void {
    if (destroyed) {
      return;
    }
    destroyed = true;
    for (const cleanup of cleanups.splice(0)) {
      cleanup();
    }
    root.removeEventListener("focusin", onFocusIn);
    root.removeEventListener("focusout", onFocusOut);
    options.contextKey?.reset();
    destroySurface(findReplaceSurface);
    destroySurface(documentStatus);
    destroySurface(modeControl);
    sourceView.destroy();
    root.remove();
    session.destroy();
  }

  updateSurfaces();
  return {
    session,
    destroy,
    focus() {
      updateFocusContext(true);
      sourceView.focus();
    },
    openFind(query = "") {
      setFindReplaceState({
        activeIndex: 0,
        open: true,
        query
      });
      refreshFindMatches();
      findReplaceSurface.open();
    },
    async save() {
      await session.flush("manual");
    }
  };
}

export interface TheiaMarkdownEditorWidget extends TheiaBaseWidgetLike {
  readonly document: TheiaMarkdownDocument;
  initialize(): void;
  openFind(): void;
  save(): Promise<void>;
}

export interface TheiaMarkdownEditorWidgetOptions {
  readonly contextKey?: TheiaContextKeyLike<boolean>;
  readonly preferenceService?: TheiaPreferenceServiceLike;
}

export function createTheiaMarkdownEditorWidgetClass(BaseWidgetCtor: TheiaBaseWidgetConstructor): {
  readonly ID: string;
  new (document: TheiaMarkdownDocument, options?: TheiaMarkdownEditorWidgetOptions): TheiaMarkdownEditorWidget;
} {
  return class TheiaMarkdownEditorWidgetImpl extends BaseWidgetCtor implements TheiaMarkdownEditorWidget {
    static readonly ID = "momentarise.markdown.editor";
    protected mount: TheiaMarkdownEditorMount | undefined;

    constructor(
      readonly document: TheiaMarkdownDocument,
      readonly options: TheiaMarkdownEditorWidgetOptions = {}
    ) {
      super();
      this.id = `${TheiaMarkdownEditorWidgetImpl.ID}:${document.resource.toString()}`;
      this.title.label = document.fileName;
      this.title.caption = document.resource.toString();
      this.title.closable = true;
      this.addClass("mme-theia-markdown-editor-widget");
    }

    initialize(): void {
      this.mount = createTheiaMarkdownEditorMount({
        container: this.node,
        document: this.document,
        ...(this.options.contextKey === undefined ? {} : { contextKey: this.options.contextKey }),
        ...(this.options.preferenceService === undefined ? {} : { preferenceService: this.options.preferenceService }),
        onDirtyStateChanged: (dirty) => {
          this.title.label = dirty ? `${this.document.fileName} *` : this.document.fileName;
        }
      });
    }

    async save(): Promise<void> {
      await this.mount?.save();
    }

    openFind(): void {
      this.mount?.openFind();
    }

    dispose(): void {
      this.mount?.destroy();
      this.mount = undefined;
      super.dispose();
    }

    protected onActivateRequest(): void {
      this.options.contextKey?.set(true);
      this.mount?.focus();
    }
  };
}

export class TheiaMarkdownOpenHandler implements OpenHandler {
  readonly id = "momentarise.markdown.open-handler";
  readonly label = "Momentarise Markdown Editor";
  readonly providerName = "momentarise";

  constructor(readonly options: TheiaMarkdownOpenHandlerOptions) {}

  canHandle(uri: Parameters<OpenHandler["canHandle"]>[0]): number {
    return isMarkdownResource(uri as TheiaResourceLike) ? THEIA_MARKDOWN_OPEN_PRIORITY : 0;
  }

  async open(uri: Parameters<OpenHandler["open"]>[0], options?: WidgetOpenerOptions): Promise<unknown> {
    const document = await readTheiaMarkdownDocument(this.options.fileService, uri as TheiaResourceLike);
    return this.options.openWidget(document, options);
  }
}

export function registerTheiaMarkdownKeybindings(registry: TheiaKeybindingRegistryLike): void {
  registry.registerKeybinding({
    command: THEIA_MARKDOWN_COMMANDS.save.id,
    keybinding: "ctrlcmd+s",
    when: "momentariseMarkdownEditorFocus"
  });
  registry.registerKeybinding({
    command: THEIA_MARKDOWN_COMMANDS.find.id,
    keybinding: "ctrlcmd+f",
    when: "momentariseMarkdownEditorFocus"
  });
}

export function createTheiaPreferenceInput(options: TheiaPreferenceInputOptions = {}): Readonly<Record<string, PreferenceValue>> {
  const service = options.preferenceService;
  return {
    "keymap.delegateToHost": true,
    "keymap.profile": "delegate",
    "modeSwitcher.style": "compact-tabs",
    "status.disclosure": "discreet",
    ...(options.values ?? {}),
    ...(service
      ? {
          "layout.density": service.get("momentariseMarkdown.layout.density", "comfortable") ?? "comfortable",
          "source.lineWrapping": service.get("momentariseMarkdown.source.lineWrapping", true) ?? true,
          "toolbar.mode": service.get("momentariseMarkdown.toolbar.mode", "hidden") ?? "hidden"
        }
      : {})
  };
}

function booleanPreference(value: PreferenceValue | undefined, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function keymapProfilePreference(value: PreferenceValue | undefined): "default" | "delegate" | "minimal" {
  return value === "default" || value === "minimal" ? value : "delegate";
}

function sourceDensityPreference(value: PreferenceValue | undefined): "compact" | "comfortable" | "spacious" {
  return value === "compact" || value === "spacious" ? value : "comfortable";
}

function stringPreference(value: PreferenceValue | undefined, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function toSourceFindMatch(match: SurfaceFindMatch, active: boolean): SurfaceFindMatch & { readonly active: boolean } {
  return {
    active,
    from: match.from,
    to: match.to
  };
}

function isMarkdownResource(uri: TheiaResourceLike): boolean {
  const extension = uri.path.ext.toLowerCase();
  return extension === ".md" || extension === ".markdown" || extension === ".mdown";
}

async function readTheiaFileContent(fileService: Pick<TheiaFileServiceLike, "readFile">, resource: TheiaResourceLike): Promise<string> {
  const file = await fileService.readFile(resource);
  return file.value.toString();
}

function destroySurface(surface: SurfaceComponent | { destroy(): void }): void {
  surface.destroy();
}

function createTheiaTimeoutScheduler(): MarkdownEditorSessionOptions["scheduler"] {
  return {
    schedule(callback, delayMs) {
      const handle = setTimeout(() => {
        void callback();
      }, delayMs);
      return () => {
        clearTimeout(handle);
      };
    }
  };
}
