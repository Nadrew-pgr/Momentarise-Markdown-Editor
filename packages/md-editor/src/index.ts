import type { DocumentDialect, DocumentPath, EditorMode, MomentariseNode, ParseResult, SaveState } from "@momentarise/md-core";
import { createMarkdownAstParser } from "@momentarise/md-format";
import {
  acceptAiSuggestion,
  createAiWritingSession,
  rejectAiSuggestion,
  requestAiSuggestion,
  type AiProvider,
  type AiWritingAction,
  type AiWritingRequest,
  type AiWritingSession,
  type AiWritingSuggestion
} from "@momentarise/md-ai";
import { createDefaultPolicyResolver, type PolicyResolver } from "@momentarise/md-policy";
import {
  createSaveEngine,
  type SaveEngine,
  type SaveFlushReason,
  type SaveFlushResult,
  type SaveTarget
} from "@momentarise/md-save";

export interface MarkdownEditorContract {
  readonly packageName: "@momentarise/md-editor";
  readonly dependsOnCore: true;
  readonly headless: true;
}

export type PreferenceScope = "host" | "workspace" | "document" | "user";
export type PreferenceSource = PreferenceScope | "framework";
export type PreferenceType = "boolean" | "enum" | "enum-list" | "number" | "record" | "string" | "string-list";
export type PreferenceScalarValue = boolean | number | string;
export type PreferenceValue =
  | PreferenceScalarValue
  | readonly string[]
  | Readonly<Record<string, string>>;

export interface PreferenceDefinition {
  readonly key: string;
  readonly type: PreferenceType;
  readonly default: PreferenceValue;
  readonly scopes: readonly PreferenceScope[];
  readonly enumValues?: readonly string[];
  readonly min?: number;
  readonly max?: number;
  readonly labelKey: string;
}

export interface PreferenceLock {
  readonly value: PreferenceValue;
  readonly reason: string;
  readonly lockedBy: "host" | "workspace";
}

export type PreferenceRejectionCode =
  | "invalid-value"
  | "locked"
  | "not-document-allowlisted"
  | "not-user-visible"
  | "unknown-key";

export interface PreferenceRejection {
  readonly key: string;
  readonly code: PreferenceRejectionCode;
  readonly source: PreferenceScope;
  readonly reason: string;
  readonly overridable: false;
}

export interface ResolvedPreference {
  readonly key: string;
  readonly value: PreferenceValue;
  readonly source: PreferenceSource;
  readonly locked: boolean;
  readonly lockedBy?: "host" | "workspace";
  readonly lockReason?: string;
  readonly userVisible: boolean;
  readonly layerValues: Partial<Record<PreferenceSource, PreferenceValue>>;
  readonly rejections: readonly PreferenceRejection[];
}

export interface PreferenceResolutionResult {
  readonly preferences: Readonly<Record<string, ResolvedPreference>>;
  readonly rejections: readonly PreferenceRejection[];
}

export interface ResolvePreferencesOptions {
  readonly schema: readonly PreferenceDefinition[];
  readonly layers: {
    readonly host?: Readonly<Record<string, unknown>>;
    readonly workspace?: Readonly<Record<string, unknown>>;
    readonly document?: Readonly<Record<string, unknown>>;
    readonly user?: Readonly<Record<string, unknown>>;
  };
  readonly locks?: Readonly<Record<string, PreferenceLock>>;
  readonly userVisible?: readonly string[];
}

export interface DocumentPreferenceExtractionResult {
  readonly preferences: Readonly<Record<string, PreferenceValue>>;
  readonly diagnostics: readonly PreferenceRejection[];
}

export interface HostCapabilities {
  readonly aiProviderPresent: boolean;
  readonly fileSystemAccess: boolean;
  readonly offline: boolean;
  readonly touchDevice: boolean;
  readonly viewportClass: "constrained" | "desktop" | "mobile" | "tablet";
}

export const DEFAULT_HOST_CAPABILITIES: HostCapabilities = {
  aiProviderPresent: false,
  fileSystemAccess: false,
  offline: false,
  touchDevice: false,
  viewportClass: "desktop"
};

export const DOCUMENT_PREFERENCE_ALLOWLIST = ["layout.readableLineWidth", "stats.enabled"] as const;

export const DEFAULT_EDITOR_BEHAVIOR_PREFERENCES = {
  "ai.entryPoints": ["slash", "toolbar", "selection", "command-palette"],
  "blocks.dragHandle": false,
  "blocks.plusButton": false,
  "codeBlock.languagePicker": true,
  "codeBlock.lineNumbers": false,
  "editor.fontScale": 1,
  "folding.ui": "heading-gutter",
  "keymap.bindings": {},
  "keymap.delegateToHost": false,
  "keymap.profile": "default",
  "layout.density": "comfortable",
  "layout.readableLineWidth": 880,
  "layout.viewportClass": "desktop",
  "modeSwitcher.style": "compact-tabs",
  "palette.enabled": true,
  "palette.hotkey": "Mod-k",
  "save.autosaveDelayMs": 1000,
  "slash.enabled": true,
  "slash.groups": ["blocks", "lists", "insert", "ai"],
  "stats.enabled": false,
  "status.disclosure": "discreet",
  "toolbar.mode": "sticky",
  "toolbar.style": "glass"
} as const satisfies Readonly<Record<string, PreferenceValue>>;

export const DEFAULT_PREFERENCE_SCHEMA: readonly PreferenceDefinition[] = [
  enumPreference("toolbar.mode", DEFAULT_EDITOR_BEHAVIOR_PREFERENCES["toolbar.mode"], ["sticky", "floating", "inline", "hidden"], ["host", "workspace", "user"]),
  enumPreference("toolbar.style", DEFAULT_EDITOR_BEHAVIOR_PREFERENCES["toolbar.style"], ["glass", "solid", "compact"], ["host", "workspace", "user"]),
  booleanPreference("slash.enabled", DEFAULT_EDITOR_BEHAVIOR_PREFERENCES["slash.enabled"], ["host", "workspace", "user"]),
  enumListPreference("slash.groups", DEFAULT_EDITOR_BEHAVIOR_PREFERENCES["slash.groups"], ["blocks", "lists", "insert", "ai"], ["host", "workspace", "user"]),
  booleanPreference("palette.enabled", DEFAULT_EDITOR_BEHAVIOR_PREFERENCES["palette.enabled"], ["host", "workspace", "user"]),
  stringPreference("palette.hotkey", DEFAULT_EDITOR_BEHAVIOR_PREFERENCES["palette.hotkey"], ["host", "workspace", "user"]),
  booleanPreference("blocks.dragHandle", DEFAULT_EDITOR_BEHAVIOR_PREFERENCES["blocks.dragHandle"], ["host", "workspace", "user"]),
  booleanPreference("blocks.plusButton", DEFAULT_EDITOR_BEHAVIOR_PREFERENCES["blocks.plusButton"], ["host", "workspace", "user"]),
  enumListPreference(
    "ai.entryPoints",
    DEFAULT_EDITOR_BEHAVIOR_PREFERENCES["ai.entryPoints"],
    ["slash", "toolbar", "selection", "command-palette", "contextual-toolbar"],
    ["host", "workspace", "user"]
  ),
  enumPreference("modeSwitcher.style", DEFAULT_EDITOR_BEHAVIOR_PREFERENCES["modeSwitcher.style"], ["compact-tabs", "single-toggle", "host-provided"], ["host", "workspace", "user"]),
  enumPreference("status.disclosure", DEFAULT_EDITOR_BEHAVIOR_PREFERENCES["status.disclosure"], ["discreet", "popover", "debug-panel", "hidden"], ["host", "workspace", "user"]),
  enumPreference("folding.ui", DEFAULT_EDITOR_BEHAVIOR_PREFERENCES["folding.ui"], ["heading-gutter", "inline", "hidden"], ["host", "workspace", "user"]),
  booleanPreference("codeBlock.lineNumbers", DEFAULT_EDITOR_BEHAVIOR_PREFERENCES["codeBlock.lineNumbers"], ["host", "workspace", "user"]),
  booleanPreference("codeBlock.languagePicker", DEFAULT_EDITOR_BEHAVIOR_PREFERENCES["codeBlock.languagePicker"], ["host", "workspace", "user"]),
  enumPreference("layout.density", DEFAULT_EDITOR_BEHAVIOR_PREFERENCES["layout.density"], ["compact", "comfortable", "spacious"], ["host", "workspace", "user"]),
  enumPreference("layout.viewportClass", DEFAULT_EDITOR_BEHAVIOR_PREFERENCES["layout.viewportClass"], ["mobile", "tablet", "desktop", "constrained"], ["host", "workspace", "user"]),
  numberPreference("layout.readableLineWidth", DEFAULT_EDITOR_BEHAVIOR_PREFERENCES["layout.readableLineWidth"], ["host", "workspace", "document", "user"], 420, 1200),
  enumPreference("keymap.profile", DEFAULT_EDITOR_BEHAVIOR_PREFERENCES["keymap.profile"], ["default", "minimal", "delegate"], ["host", "workspace", "user"]),
  booleanPreference("keymap.delegateToHost", DEFAULT_EDITOR_BEHAVIOR_PREFERENCES["keymap.delegateToHost"], ["host", "workspace", "user"]),
  recordPreference("keymap.bindings", DEFAULT_EDITOR_BEHAVIOR_PREFERENCES["keymap.bindings"], ["host", "workspace", "user"]),
  numberPreference("editor.fontScale", DEFAULT_EDITOR_BEHAVIOR_PREFERENCES["editor.fontScale"], ["host", "workspace", "user"], 0.8, 1.6),
  numberPreference("save.autosaveDelayMs", DEFAULT_EDITOR_BEHAVIOR_PREFERENCES["save.autosaveDelayMs"], ["host", "workspace", "user"], 250, 5000),
  booleanPreference("stats.enabled", DEFAULT_EDITOR_BEHAVIOR_PREFERENCES["stats.enabled"], ["host", "workspace", "document", "user"])
];

export type ExtensionDiagnosticCode =
  | "disabled"
  | "handler-error"
  | "invalid-id"
  | "invalid-params"
  | "unknown-id";

export interface ExtensionDiagnostic {
  readonly code: ExtensionDiagnosticCode;
  readonly id: string;
  readonly reason: string;
  readonly overridable: false;
}

export interface ExtensionCommandResult {
  readonly handled: boolean;
  readonly diagnostic?: ExtensionDiagnostic;
}

export interface AiActionPromptResult extends ExtensionCommandResult {
  readonly demoAction?: AiWritingAction;
  readonly params?: Readonly<Record<string, string>>;
  readonly prompt?: string;
}

export interface CustomBlockSerializationResult extends ExtensionCommandResult {
  readonly content?: string;
}

export interface ExtensionRunContext {
  readonly session: MarkdownEditorSession;
  readonly [key: string]: unknown;
}

export type ExtensionRunResult = void | ExtensionCommandResult | Promise<void | ExtensionCommandResult>;

export interface SlashItemDefinition {
  readonly aliases: readonly string[];
  readonly group: "ai" | "blocks" | "insert" | "lists" | string;
  readonly id: string;
  readonly labelKey: string;
  run(context: ExtensionRunContext): ExtensionRunResult;
}

export interface ToolbarItemDefinition {
  readonly group: string;
  readonly icon: string;
  readonly id: string;
  readonly labelKey: string;
  isActive?(context: ExtensionRunContext): boolean;
  run(context: ExtensionRunContext): ExtensionRunResult;
}

export interface AiActionParam {
  readonly labelKey: string;
  readonly name: string;
  readonly type: "enum" | "text";
  readonly values?: readonly string[];
}

export interface AiActionDefinition {
  readonly demoAction: AiWritingAction;
  readonly entryPoints?: readonly string[];
  readonly id: string;
  readonly labelKey: string;
  readonly params?: readonly AiActionParam[];
  buildPrompt(params: Readonly<Record<string, string>>): string;
}

export interface KeybindingDefinition {
  readonly commandId: string;
  readonly id: string;
  readonly keys: readonly string[];
  run?(context: ExtensionRunContext): ExtensionRunResult;
}

export interface CustomBlockDefinition {
  readonly id: string;
  readonly persistence: "fenced-directive" | "opaque-passthrough" | "raw-html";
  matches?(node: MomentariseNode): boolean;
  serialize(data: Readonly<Record<string, unknown>>): string;
}

export interface GetKeybindingsOptions {
  readonly keymapDelegateToHost?: boolean;
}

export interface ExtensionRegistry {
  buildAiActionPrompt(id: string, params?: Readonly<Record<string, string>>): AiActionPromptResult;
  disableExtension(id: string, reason: string): void;
  dispatchSlashItem(id: string, context: ExtensionRunContext): Promise<ExtensionCommandResult>;
  dispatchToolbarItem(id: string, context: ExtensionRunContext): Promise<ExtensionCommandResult>;
  enableExtension(id: string): void;
  getAiActions(): readonly AiActionDefinition[];
  getCustomBlocks(): readonly CustomBlockDefinition[];
  getKeybindings(options?: GetKeybindingsOptions): readonly KeybindingDefinition[];
  getSlashItems(): readonly SlashItemDefinition[];
  getToolbarItems(): readonly ToolbarItemDefinition[];
  isDisabled(id: string): boolean;
  registerAiAction(definition: AiActionDefinition): void;
  registerCustomBlock(definition: CustomBlockDefinition): void;
  registerKeybinding(definition: KeybindingDefinition): void;
  registerSlashItem(definition: SlashItemDefinition): void;
  registerToolbarItem(definition: ToolbarItemDefinition): void;
  searchSlashItems(query: string): readonly SlashItemDefinition[];
  serializeCustomBlock(id: string, data: Readonly<Record<string, unknown>>): CustomBlockSerializationResult;
}

export type SessionEvent = "change" | "save-state" | "diagnostics" | "mode" | "destroy";
export type SessionContentOrigin = "source-view" | "rich-view" | "ai" | "host";

export interface SessionScheduler {
  schedule(callback: () => void | Promise<void>, delayMs: number): () => void;
}

export interface MarkdownEditorSessionOptions {
  readonly aiProvider?: AiProvider;
  readonly autosaveDelayMs?: number;
  readonly content: string;
  readonly dialect?: DocumentDialect;
  readonly path?: string | null;
  readonly policyResolver?: PolicyResolver;
  readonly scheduler: SessionScheduler;
  readonly target: SaveTarget;
}

export interface SessionChangePayload {
  readonly content: string;
  readonly origin: SessionContentOrigin;
}

export interface SessionDiagnosticsPayload {
  readonly diagnostics: ParseResult["diagnostics"];
  readonly parseResult: ParseResult;
}

export interface SessionModePayload {
  readonly mode: EditorMode;
}

export type SessionEventPayloadMap = {
  readonly change: SessionChangePayload;
  readonly "save-state": SaveState;
  readonly diagnostics: SessionDiagnosticsPayload;
  readonly mode: SessionModePayload;
  readonly destroy: undefined;
};

export interface MarkdownEditorSession {
  readonly extensions: ExtensionRegistry;
  acceptPendingSuggestion(): string | null;
  destroy(): void;
  flush(reason: SaveFlushReason): Promise<SaveFlushResult>;
  getContent(): string;
  getMode(): EditorMode;
  getParseResult(): ParseResult;
  getPendingSuggestion(): AiWritingSuggestion | null;
  getSaveState(): SaveState;
  on<Event extends SessionEvent>(event: Event, handler: (payload: SessionEventPayloadMap[Event]) => void): () => void;
  rejectPendingSuggestion(): void;
  requestAiSuggestion(request: Omit<AiWritingRequest, "document">): Promise<AiWritingSuggestion>;
  setContent(next: string, origin: SessionContentOrigin): void;
  setMode(mode: EditorMode): void;
  startAiSession(apiKey: string): void;
}

export const markdownEditorPackage: MarkdownEditorContract = {
  dependsOnCore: true,
  headless: true,
  packageName: "@momentarise/md-editor"
};

export function resolvePreferences(options: ResolvePreferencesOptions): PreferenceResolutionResult {
  const definitions = new Map(options.schema.map((definition) => [definition.key, definition]));
  const userVisible = new Set(options.userVisible ?? []);
  const locks = options.locks ?? {};
  const preferences: Record<string, ResolvedPreference> = {};
  const aggregateRejections: PreferenceRejection[] = [];

  for (const definition of options.schema) {
    const layerValues: Partial<Record<PreferenceSource, PreferenceValue>> = {
      framework: definition.default
    };
    const rejections: PreferenceRejection[] = [];
    let source: PreferenceSource = "framework";
    let value: PreferenceValue = definition.default;
    const visible = userVisible.has(definition.key);

    for (const layer of ["host", "workspace", "document", "user"] as const) {
      const candidate = options.layers[layer]?.[definition.key];
      if (candidate === undefined) {
        continue;
      }
      if (!definition.scopes.includes(layer)) {
        const rejection = preferenceRejection(
          definition.key,
          layer === "document" ? "not-document-allowlisted" : "invalid-value",
          layer,
          `Preference ${definition.key} is not accepted from ${layer} scope.`
        );
        rejections.push(rejection);
        aggregateRejections.push(rejection);
        continue;
      }
      if (layer === "user" && !visible) {
        const rejection = preferenceRejection(
          definition.key,
          "not-user-visible",
          "user",
          `Preference ${definition.key} is not exposed to users by the host.`
        );
        rejections.push(rejection);
        aggregateRejections.push(rejection);
        continue;
      }
      const normalized = normalizePreferenceValue(definition, candidate);
      if (!normalized.valid) {
        const rejection = preferenceRejection(
          definition.key,
          "invalid-value",
          layer,
          normalized.reason
        );
        rejections.push(rejection);
        aggregateRejections.push(rejection);
        continue;
      }
      layerValues[layer] = normalized.value;
      value = normalized.value;
      source = layer;
    }

    const lock = locks[definition.key];
    if (lock) {
      const normalizedLock = normalizePreferenceValue(definition, lock.value);
      const lockedValue = normalizedLock.valid ? normalizedLock.value : definition.default;
      if (!normalizedLock.valid) {
        const rejection = preferenceRejection(definition.key, "invalid-value", lock.lockedBy, normalizedLock.reason);
        rejections.push(rejection);
        aggregateRejections.push(rejection);
      }
      const userCandidate = options.layers.user?.[definition.key];
      if (userCandidate !== undefined) {
        const rejection = preferenceRejection(definition.key, "locked", "user", lock.reason);
        rejections.push(rejection);
        aggregateRejections.push(rejection);
      }
      layerValues[lock.lockedBy] = lockedValue;
      preferences[definition.key] = {
        key: definition.key,
        layerValues,
        locked: true,
        lockedBy: lock.lockedBy,
        lockReason: lock.reason,
        rejections,
        source: lock.lockedBy,
        userVisible: visible,
        value: lockedValue
      };
      continue;
    }

    preferences[definition.key] = {
      key: definition.key,
      layerValues,
      locked: false,
      rejections,
      source,
      userVisible: visible,
      value
    };
  }

  for (const layer of ["host", "workspace", "document", "user"] as const) {
    for (const key of Object.keys(options.layers[layer] ?? {})) {
      if (!definitions.has(key)) {
        aggregateRejections.push(
          preferenceRejection(key, "unknown-key", layer, `Unknown preference key ${key} was ignored.`)
        );
      }
    }
  }

  return {
    preferences,
    rejections: aggregateRejections
  };
}

export function extractDocumentPreferences(
  frontmatter: Readonly<Record<string, unknown>>,
  allowlist: readonly string[] = DOCUMENT_PREFERENCE_ALLOWLIST
): DocumentPreferenceExtractionResult {
  const allowlisted = new Set(allowlist);
  const preferences: Record<string, PreferenceValue> = {};
  const diagnostics: PreferenceRejection[] = [];
  const mme = frontmatter["mme"];
  if (!mme || typeof mme !== "object" || Array.isArray(mme)) {
    return {
      diagnostics,
      preferences
    };
  }
  for (const [key, value] of Object.entries(mme as Readonly<Record<string, unknown>>)) {
    if (!allowlisted.has(key)) {
      diagnostics.push(
        preferenceRejection(key, "not-document-allowlisted", "document", `Document preference ${key} is not allowlisted.`)
      );
      continue;
    }
    const definition = DEFAULT_PREFERENCE_SCHEMA.find((candidate) => candidate.key === key);
    if (!definition) {
      diagnostics.push(preferenceRejection(key, "unknown-key", "document", `Unknown document preference ${key}.`));
      continue;
    }
    const normalized = normalizePreferenceValue(definition, value);
    if (!normalized.valid) {
      diagnostics.push(preferenceRejection(key, "invalid-value", "document", normalized.reason));
      continue;
    }
    preferences[key] = normalized.value;
  }
  return {
    diagnostics,
    preferences
  };
}

export function createMarkdownEditorSession(options: MarkdownEditorSessionOptions): MarkdownEditorSession {
  return new DefaultMarkdownEditorSession(options);
}

export function createExtensionRegistry(): ExtensionRegistry {
  return new DefaultExtensionRegistry();
}

class DefaultMarkdownEditorSession implements MarkdownEditorSession {
  readonly extensions = createExtensionRegistry();

  private aiSession: AiWritingSession | null = null;
  private cancelAutosave: (() => void) | null = null;
  private destroyed = false;
  private readonly dialect: DocumentDialect;
  private readonly handlers = new Map<SessionEvent, Set<(payload: unknown) => void>>();
  private mode: EditorMode = "source";
  private readonly parser = createMarkdownAstParser();
  private parseCache: ParseResult | null = null;
  private readonly path: string | null;
  private pendingSuggestion: AiWritingSuggestion | null = null;
  private readonly policyResolver: PolicyResolver;
  private readonly provider: AiProvider | undefined;
  private readonly saveEngine: SaveEngine;
  private readonly scheduler: SessionScheduler;

  constructor(options: MarkdownEditorSessionOptions) {
    this.dialect = options.dialect ?? "momentarise-enhanced";
    this.path = options.path ?? null;
    this.policyResolver = options.policyResolver ?? createDefaultPolicyResolver();
    this.provider = options.aiProvider;
    this.scheduler = options.scheduler;
    this.saveEngine = createSaveEngine({
      ...(options.autosaveDelayMs === undefined ? {} : { autosaveDelayMs: options.autosaveDelayMs }),
      content: options.content,
      target: options.target
    });
  }

  acceptPendingSuggestion(): string | null {
    if (!this.pendingSuggestion) {
      return null;
    }
    const result = acceptAiSuggestion(this.getContent(), this.pendingSuggestion);
    this.pendingSuggestion = result.suggestion;
    if (result.suggestion.status !== "accepted" || result.content === this.getContent()) {
      return null;
    }
    this.setContent(result.content, "ai");
    return result.content;
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.cancelScheduledAutosave();
    this.emit("destroy", undefined);
    this.handlers.clear();
  }

  async flush(reason: SaveFlushReason): Promise<SaveFlushResult> {
    this.cancelScheduledAutosave();
    const result = await this.saveEngine.flush({ reason });
    this.emit("save-state", result.state);
    return result;
  }

  getContent(): string {
    return this.saveEngine.getContent();
  }

  getMode(): EditorMode {
    return this.mode;
  }

  getParseResult(): ParseResult {
    this.parseCache ??= this.parser.parse(this.getContent(), {
      dialect: this.dialect,
      ...(this.path ? { path: this.path as DocumentPath } : {})
    });
    return this.parseCache;
  }

  getPendingSuggestion(): AiWritingSuggestion | null {
    return this.pendingSuggestion;
  }

  getSaveState(): SaveState {
    return this.saveEngine.getState();
  }

  on<Event extends SessionEvent>(
    event: Event,
    handler: (payload: SessionEventPayloadMap[Event]) => void
  ): () => void {
    const handlers = this.handlers.get(event) ?? new Set<(payload: unknown) => void>();
    handlers.add(handler as (payload: unknown) => void);
    this.handlers.set(event, handlers);
    return () => {
      handlers.delete(handler as (payload: unknown) => void);
    };
  }

  rejectPendingSuggestion(): void {
    if (!this.pendingSuggestion) {
      return;
    }
    const result = rejectAiSuggestion(this.getContent(), this.pendingSuggestion);
    this.pendingSuggestion = result.suggestion;
  }

  async requestAiSuggestion(request: Omit<AiWritingRequest, "document">): Promise<AiWritingSuggestion> {
    if (!this.aiSession) {
      throw new Error("AI session has not been started.");
    }
    this.pendingSuggestion = await requestAiSuggestion(this.aiSession, {
      ...request,
      document: {
        content: this.getContent(),
        path: this.path
      }
    });
    return this.pendingSuggestion;
  }

  setContent(next: string, origin: SessionContentOrigin): void {
    this.assertAlive();
    this.saveEngine.updateContent(next);
    this.parseCache = null;
    const saveState = this.saveEngine.getState();
    this.emit("change", {
      content: next,
      origin
    });
    this.emit("save-state", saveState);
    this.emit("diagnostics", {
      diagnostics: this.getParseResult().diagnostics,
      parseResult: this.getParseResult()
    });
    this.scheduleAutosave();
  }

  setMode(mode: EditorMode): void {
    this.assertAlive();
    if (this.mode === mode) {
      return;
    }
    this.mode = mode;
    this.emit("mode", { mode });
  }

  startAiSession(apiKey: string): void {
    if (!this.provider) {
      throw new Error("AI provider is not configured.");
    }
    this.aiSession = createAiWritingSession({
      apiKey,
      policyResolver: this.policyResolver,
      provider: this.provider
    });
  }

  private assertAlive(): void {
    if (this.destroyed) {
      throw new Error("Markdown editor session has been destroyed.");
    }
  }

  private cancelScheduledAutosave(): void {
    this.cancelAutosave?.();
    this.cancelAutosave = null;
  }

  private emit<Event extends SessionEvent>(event: Event, payload: SessionEventPayloadMap[Event]): void {
    const handlers = this.handlers.get(event);
    if (!handlers) {
      return;
    }
    for (const handler of [...handlers]) {
      handler(payload);
    }
  }

  private scheduleAutosave(): void {
    this.cancelScheduledAutosave();
    const state = this.saveEngine.getState();
    if (state.status !== "dirty" || !this.saveEngine.target.write) {
      return;
    }
    this.cancelAutosave = this.scheduler.schedule(async () => {
      this.cancelAutosave = null;
      if (!this.destroyed) {
        await this.flush("autosave");
      }
    }, this.saveEngine.autosaveDelayMs);
  }
}

class DefaultExtensionRegistry implements ExtensionRegistry {
  private readonly aiActions = new Map<string, AiActionDefinition>();
  private readonly customBlocks = new Map<string, CustomBlockDefinition>();
  private readonly disabled = new Map<string, string>();
  private readonly keybindings = new Map<string, KeybindingDefinition>();
  private readonly slashItems = new Map<string, SlashItemDefinition>();
  private readonly toolbarItems = new Map<string, ToolbarItemDefinition>();

  buildAiActionPrompt(id: string, params: Readonly<Record<string, string>> = {}): AiActionPromptResult {
    const definition = this.aiActions.get(id);
    if (!definition) {
      return {
        diagnostic: extensionDiagnostic(id, "unknown-id", `Unknown AI action ${id}.`),
        handled: false
      };
    }
    const disabled = this.disabled.get(id);
    if (disabled) {
      return {
        diagnostic: extensionDiagnostic(id, "disabled", disabled),
        handled: false
      };
    }
    const normalized = normalizeAiActionParams(definition, params);
    if (!normalized.valid) {
      return {
        diagnostic: extensionDiagnostic(id, "invalid-params", normalized.reason),
        handled: false
      };
    }
    return {
      demoAction: definition.demoAction,
      handled: true,
      params: normalized.params,
      prompt: definition.buildPrompt(normalized.params)
    };
  }

  disableExtension(id: string, reason: string): void {
    this.disabled.set(id, reason);
  }

  dispatchSlashItem(id: string, context: ExtensionRunContext): Promise<ExtensionCommandResult> {
    return this.dispatch(id, this.slashItems.get(id), context, "slash item");
  }

  dispatchToolbarItem(id: string, context: ExtensionRunContext): Promise<ExtensionCommandResult> {
    return this.dispatch(id, this.toolbarItems.get(id), context, "toolbar item");
  }

  enableExtension(id: string): void {
    this.disabled.delete(id);
  }

  getAiActions(): readonly AiActionDefinition[] {
    return [...this.aiActions.values()].filter((definition) => !this.disabled.has(definition.id));
  }

  getCustomBlocks(): readonly CustomBlockDefinition[] {
    return [...this.customBlocks.values()].filter((definition) => !this.disabled.has(definition.id));
  }

  getKeybindings(options: GetKeybindingsOptions = {}): readonly KeybindingDefinition[] {
    if (options.keymapDelegateToHost) {
      return [];
    }
    return [...this.keybindings.values()].filter((definition) => !this.disabled.has(definition.id));
  }

  getSlashItems(): readonly SlashItemDefinition[] {
    return [...this.slashItems.values()].filter((definition) => !this.disabled.has(definition.id));
  }

  getToolbarItems(): readonly ToolbarItemDefinition[] {
    return [...this.toolbarItems.values()].filter((definition) => !this.disabled.has(definition.id));
  }

  isDisabled(id: string): boolean {
    return this.disabled.has(id);
  }

  registerAiAction(definition: AiActionDefinition): void {
    this.register(definition.id, this.aiActions, definition);
  }

  registerCustomBlock(definition: CustomBlockDefinition): void {
    this.register(definition.id, this.customBlocks, definition);
  }

  registerKeybinding(definition: KeybindingDefinition): void {
    this.register(definition.id, this.keybindings, definition);
  }

  registerSlashItem(definition: SlashItemDefinition): void {
    this.register(definition.id, this.slashItems, definition);
  }

  registerToolbarItem(definition: ToolbarItemDefinition): void {
    this.register(definition.id, this.toolbarItems, definition);
  }

  searchSlashItems(query: string): readonly SlashItemDefinition[] {
    const normalized = normalizeExtensionQuery(query);
    if (!normalized) {
      return this.getSlashItems();
    }
    return this.getSlashItems().filter((item) =>
      [item.id, item.labelKey, item.group, ...item.aliases].some((candidate) =>
        normalizeExtensionQuery(candidate).includes(normalized)
      )
    );
  }

  serializeCustomBlock(id: string, data: Readonly<Record<string, unknown>>): CustomBlockSerializationResult {
    const definition = this.customBlocks.get(id);
    if (!definition) {
      return {
        diagnostic: extensionDiagnostic(id, "unknown-id", `Unknown custom block ${id}.`),
        handled: false
      };
    }
    const disabled = this.disabled.get(id);
    if (disabled) {
      return {
        diagnostic: extensionDiagnostic(id, "disabled", disabled),
        handled: false
      };
    }
    return {
      content: definition.serialize(data),
      handled: true
    };
  }

  private async dispatch(
    id: string,
    definition: SlashItemDefinition | ToolbarItemDefinition | undefined,
    context: ExtensionRunContext,
    label: string
  ): Promise<ExtensionCommandResult> {
    if (!definition) {
      return {
        diagnostic: extensionDiagnostic(id, "unknown-id", `Unknown ${label} ${id}.`),
        handled: false
      };
    }
    const disabled = this.disabled.get(id);
    if (disabled) {
      return {
        diagnostic: extensionDiagnostic(id, "disabled", disabled),
        handled: false
      };
    }
    try {
      const result = await definition.run(context);
      return result ?? {
        handled: true
      };
    } catch (error) {
      return {
        diagnostic: extensionDiagnostic(id, "handler-error", errorMessage(error)),
        handled: false
      };
    }
  }

  private register<Definition extends { readonly id: string }>(
    id: string,
    target: Map<string, Definition>,
    definition: Definition
  ): void {
    assertValidExtensionId(id);
    if (target.has(id)) {
      throw new Error(`Duplicate extension id: ${id}`);
    }
    target.set(id, definition);
  }
}

function assertValidExtensionId(id: string): void {
  if (!/^[a-z][a-z0-9-]*:[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(id)) {
    throw new Error(`Extension id must be namespaced, for example "host:my-action": ${id}`);
  }
}

function extensionDiagnostic(
  id: string,
  code: ExtensionDiagnosticCode,
  reason: string
): ExtensionDiagnostic {
  return {
    code,
    id,
    overridable: false,
    reason
  };
}

function normalizeAiActionParams(
  definition: AiActionDefinition,
  params: Readonly<Record<string, string>>
):
  | { readonly params: Readonly<Record<string, string>>; readonly valid: true }
  | { readonly reason: string; readonly valid: false } {
  const normalized: Record<string, string> = {};
  for (const param of definition.params ?? []) {
    const value = params[param.name];
    if (typeof value !== "string" || value.length === 0) {
      return {
        reason: `Missing parameter ${param.name} for AI action ${definition.id}.`,
        valid: false
      };
    }
    if (param.type === "enum" && !(param.values ?? []).includes(value)) {
      return {
        reason: `Parameter ${param.name} for AI action ${definition.id} must be one of ${(param.values ?? []).join(", ")}.`,
        valid: false
      };
    }
    normalized[param.name] = value;
  }
  return {
    params: normalized,
    valid: true
  };
}

function normalizeExtensionQuery(query: string): string {
  return query.trim().replace(/^\//, "").toLowerCase();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function booleanPreference(key: string, defaultValue: boolean, scopes: readonly PreferenceScope[]): PreferenceDefinition {
  return {
    default: defaultValue,
    key,
    labelKey: preferenceLabelKey(key),
    scopes,
    type: "boolean"
  };
}

function enumPreference(
  key: string,
  defaultValue: string,
  enumValues: readonly string[],
  scopes: readonly PreferenceScope[]
): PreferenceDefinition {
  return {
    default: defaultValue,
    enumValues,
    key,
    labelKey: preferenceLabelKey(key),
    scopes,
    type: "enum"
  };
}

function enumListPreference(
  key: string,
  defaultValue: readonly string[],
  enumValues: readonly string[],
  scopes: readonly PreferenceScope[]
): PreferenceDefinition {
  return {
    default: defaultValue,
    enumValues,
    key,
    labelKey: preferenceLabelKey(key),
    scopes,
    type: "enum-list"
  };
}

function numberPreference(
  key: string,
  defaultValue: number,
  scopes: readonly PreferenceScope[],
  min: number,
  max: number
): PreferenceDefinition {
  return {
    default: defaultValue,
    key,
    labelKey: preferenceLabelKey(key),
    max,
    min,
    scopes,
    type: "number"
  };
}

function recordPreference(
  key: string,
  defaultValue: Readonly<Record<string, string>>,
  scopes: readonly PreferenceScope[]
): PreferenceDefinition {
  return {
    default: defaultValue,
    key,
    labelKey: preferenceLabelKey(key),
    scopes,
    type: "record"
  };
}

function stringPreference(key: string, defaultValue: string, scopes: readonly PreferenceScope[]): PreferenceDefinition {
  return {
    default: defaultValue,
    key,
    labelKey: preferenceLabelKey(key),
    scopes,
    type: "string"
  };
}

function normalizePreferenceValue(
  definition: PreferenceDefinition,
  candidate: unknown
):
  | { readonly valid: true; readonly value: PreferenceValue }
  | { readonly reason: string; readonly valid: false } {
  switch (definition.type) {
    case "boolean":
      return typeof candidate === "boolean"
        ? { valid: true, value: candidate }
        : { reason: `Preference ${definition.key} expects a boolean value.`, valid: false };
    case "enum":
      return typeof candidate === "string" && (definition.enumValues ?? []).includes(candidate)
        ? { valid: true, value: candidate }
        : { reason: `Preference ${definition.key} expects one of ${(definition.enumValues ?? []).join(", ")}.`, valid: false };
    case "enum-list":
      return Array.isArray(candidate) &&
        candidate.every((value) => typeof value === "string" && (definition.enumValues ?? []).includes(value))
        ? { valid: true, value: candidate }
        : { reason: `Preference ${definition.key} expects an allowlisted string list.`, valid: false };
    case "number":
      return typeof candidate === "number" &&
        Number.isFinite(candidate) &&
        (definition.min === undefined || candidate >= definition.min) &&
        (definition.max === undefined || candidate <= definition.max)
        ? { valid: true, value: candidate }
        : {
            reason: `Preference ${definition.key} expects a number between ${definition.min ?? "-Infinity"} and ${definition.max ?? "Infinity"}.`,
            valid: false
          };
    case "record":
      return isStringRecord(candidate)
        ? { valid: true, value: candidate }
        : { reason: `Preference ${definition.key} expects a string record.`, valid: false };
    case "string":
      return typeof candidate === "string"
        ? { valid: true, value: candidate }
        : { reason: `Preference ${definition.key} expects a string value.`, valid: false };
    case "string-list":
      return Array.isArray(candidate) && candidate.every((value) => typeof value === "string")
        ? { valid: true, value: candidate }
        : { reason: `Preference ${definition.key} expects a string list.`, valid: false };
  }
}

function preferenceLabelKey(key: string): string {
  return `preferences.${key}`;
}

function preferenceRejection(
  key: string,
  code: PreferenceRejectionCode,
  source: PreferenceScope,
  reason: string
): PreferenceRejection {
  return {
    code,
    key,
    overridable: false,
    reason,
    source
  };
}

function isStringRecord(value: unknown): value is Readonly<Record<string, string>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  return Object.values(value).every((entry) => typeof entry === "string");
}
