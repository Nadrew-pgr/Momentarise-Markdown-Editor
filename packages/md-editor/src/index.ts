import type { DocumentDialect, DocumentPath, EditorMode, ParseResult, SaveState } from "@momentarise/md-core";
import { createMarkdownAstParser } from "@momentarise/md-format";
import {
  acceptAiSuggestion,
  createAiWritingSession,
  rejectAiSuggestion,
  requestAiSuggestion,
  type AiProvider,
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

export function createMarkdownEditorSession(options: MarkdownEditorSessionOptions): MarkdownEditorSession {
  return new DefaultMarkdownEditorSession(options);
}

class DefaultMarkdownEditorSession implements MarkdownEditorSession {
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
