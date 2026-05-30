import type { DocumentHash, PersistenceTarget, SaveState, SaveStatus } from "@momentarise/md-core";

export type { SaveState } from "@momentarise/md-core";

export interface SaveEngineContract {
  readonly packageName: "@momentarise/md-save";
  readonly dependsOnCore: true;
}

export type SaveFlushReason = "manual" | "autosave" | "tab-switch" | "close-guard" | "mode-switch";

export interface SaveTargetWriteRequest {
  readonly content: string;
  readonly contentHash: DocumentHash;
  readonly now: Date;
  readonly previousSavedHash?: DocumentHash;
  readonly reason: SaveFlushReason;
}

export type SaveTargetWriteResult =
  | {
      readonly status: "saved";
      readonly externalHash?: DocumentHash;
      readonly message?: string;
    }
  | {
      readonly status: "conflict";
      readonly externalHash: DocumentHash;
      readonly message?: string;
    }
  | {
      readonly status: "error";
      readonly message: string;
      readonly target?: PersistenceTarget;
    };

export interface SaveTarget {
  readonly persistenceTarget: PersistenceTarget;
  readonly targetLabel: string;
  readonly readExternalHash?: () => DocumentHash | null | Promise<DocumentHash | null>;
  readonly write?: (request: SaveTargetWriteRequest) => Promise<SaveTargetWriteResult>;
}

export interface SaveEngineOptions {
  readonly autosaveDelayMs?: number;
  readonly content: string;
  readonly now?: Date;
  readonly target: SaveTarget;
}

export interface SaveUpdateOptions {
  readonly now?: Date;
}

export interface SaveFlushOptions {
  readonly now?: Date;
  readonly reason: SaveFlushReason;
}

export type SaveFlushResult =
  | {
      readonly status: "saved" | "noop";
      readonly state: SaveState;
    }
  | {
      readonly status: "dirty";
      readonly state: SaveState;
      readonly message: string;
    }
  | {
      readonly status: "blocked";
      readonly state: SaveState;
      readonly message: string;
    }
  | {
      readonly status: "conflict";
      readonly state: SaveState;
      readonly message: string;
    }
  | {
      readonly status: "error";
      readonly state: SaveState;
      readonly message: string;
    };

export interface SaveEngine {
  readonly autosaveDelayMs: number;
  readonly target: SaveTarget;
  flush(options: SaveFlushOptions): Promise<SaveFlushResult>;
  getContent(): string;
  getState(): SaveState;
  shouldAutosave(now?: Date): boolean;
  shouldBlockClose(): boolean;
  updateContent(content: string, options?: SaveUpdateOptions): SaveState;
}

export interface MemorySaveTarget extends SaveTarget {
  readonly persistenceTarget: "memory-only";
  readContent(): string;
  simulateExternalChange(content: string): void;
  writeCount(): number;
}

export interface MemorySaveTargetOptions {
  readonly initialContent: string;
  readonly targetLabel?: string;
  readonly writeDelayMs?: number;
}

export interface DownloadRequiredSaveTargetOptions {
  readonly initialContent: string;
  readonly targetLabel?: string;
}

export function createSaveEngine(options: SaveEngineOptions): SaveEngine {
  return new DefaultSaveEngine(options);
}

export function createMemorySaveTarget(options: MemorySaveTargetOptions): MemorySaveTarget {
  let content = options.initialContent;
  let writes = 0;
  const writeDelayMs = options.writeDelayMs ?? 0;

  async function waitForWriteDelay(): Promise<void> {
    if (writeDelayMs <= 0) {
      return;
    }
    await new Promise<void>((resolve) => {
      setTimeout(resolve, writeDelayMs);
    });
  }

  return {
    persistenceTarget: "memory-only",
    targetLabel: options.targetLabel ?? "memory://markdown",
    readContent() {
      return content;
    },
    readExternalHash() {
      return hashMarkdownContent(content);
    },
    simulateExternalChange(nextContent: string) {
      content = nextContent;
    },
    async write(request: SaveTargetWriteRequest) {
      const beforeWriteHash = hashMarkdownContent(content);
      if (request.previousSavedHash && beforeWriteHash !== request.previousSavedHash) {
        return {
          externalHash: beforeWriteHash,
          message: "External content changed before save.",
          status: "conflict"
        };
      }

      await waitForWriteDelay();

      const currentExternalHash = hashMarkdownContent(content);
      if (request.previousSavedHash && currentExternalHash !== request.previousSavedHash) {
        return {
          externalHash: currentExternalHash,
          message: "External content changed during save.",
          status: "conflict"
        };
      }

      content = request.content;
      writes += 1;
      return {
        externalHash: request.contentHash,
        status: "saved"
      };
    },
    writeCount() {
      return writes;
    }
  };
}

export function createDownloadRequiredSaveTarget(
  options: DownloadRequiredSaveTargetOptions
): SaveTarget {
  return {
    persistenceTarget: "download-required",
    targetLabel: options.targetLabel ?? "download://markdown",
    readExternalHash() {
      return hashMarkdownContent(options.initialContent);
    }
  };
}

export function hashMarkdownContent(content: string): DocumentHash {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (const codePoint of content) {
    hash ^= BigInt(codePoint.codePointAt(0) ?? 0);
    hash = BigInt.asUintN(64, hash * prime);
  }
  return `fnv1a64:${hash.toString(16).padStart(16, "0")}` as DocumentHash;
}

export function persistenceTargetLabel(state: SaveState): string {
  if (state.status === "conflict" || state.target === "conflict") {
    return "conflict: external change detected";
  }
  if (state.status === "error" || state.target === "error") {
    return state.errorMessage ? `error: ${state.errorMessage}` : "error: save failed";
  }
  if (state.target === "download-required") {
    return state.status === "dirty" ? "download required / not persisted" : "download required";
  }
  if (state.target === "unsupported") {
    return "unsupported persistence";
  }
  if (state.target === "disk") {
    return state.status === "saved" ? "disk saved" : `disk / ${state.status}`;
  }
  if (state.target === "memory-only") {
    if (state.status === "saved") {
      return "memory saved (not persisted)";
    }
    if (state.status === "saving") {
      return "memory only / saving";
    }
    return "memory only / dirty";
  }
  return `${state.target} / ${state.status}`;
}

class DefaultSaveEngine implements SaveEngine {
  readonly autosaveDelayMs: number;
  readonly target: SaveTarget;
  private activeFlush: Promise<SaveFlushResult> | null = null;
  private content: string;
  private currentHash: DocumentHash;
  private dirtySince: Date | undefined;
  private errorMessage: string | undefined;
  private externalHash: DocumentHash | undefined;
  private lastSavedAt: Date | undefined;
  private lastSavedHash: DocumentHash | undefined;
  private pendingFlush: SaveFlushOptions | null = null;
  private status: SaveStatus;
  private targetState: PersistenceTarget;
  private readonly baseHash: DocumentHash;

  constructor(options: SaveEngineOptions) {
    const now = options.now ?? new Date();
    this.autosaveDelayMs = options.autosaveDelayMs ?? 1000;
    this.target = options.target;
    this.content = options.content;
    this.currentHash = hashMarkdownContent(options.content);
    this.baseHash = this.currentHash;
    this.lastSavedHash = this.currentHash;
    this.lastSavedAt = now;
    this.status = "saved";
    this.targetState = options.target.persistenceTarget;
  }

  flush(options: SaveFlushOptions): Promise<SaveFlushResult> {
    this.pendingFlush = options;
    this.activeFlush ??= this.runFlushLoop();
    return this.activeFlush;
  }

  getContent(): string {
    return this.content;
  }

  getState(): SaveState {
    return this.toState();
  }

  shouldAutosave(now: Date = new Date()): boolean {
    if (this.status !== "dirty" || !this.dirtySince || !this.target.write) {
      return false;
    }
    if (this.target.persistenceTarget === "download-required" || this.target.persistenceTarget === "unsupported") {
      return false;
    }
    return now.getTime() - this.dirtySince.getTime() >= this.autosaveDelayMs;
  }

  shouldBlockClose(): boolean {
    if (this.status === "dirty" || this.status === "saving" || this.status === "conflict") {
      return true;
    }
    return this.status === "error" && this.currentHash !== this.lastSavedHash;
  }

  updateContent(content: string, options: SaveUpdateOptions = {}): SaveState {
    this.content = content;
    this.currentHash = hashMarkdownContent(content);
    this.errorMessage = undefined;
    const now = options.now ?? new Date();

    if (this.status === "conflict") {
      this.targetState = "conflict";
      if (!this.dirtySince) {
        this.dirtySince = now;
      }
      return this.toState();
    }

    if (this.lastSavedHash && this.currentHash === this.lastSavedHash) {
      this.dirtySince = undefined;
      this.status = "saved";
      this.targetState = this.target.persistenceTarget;
      return this.toState();
    }

    if (!this.dirtySince) {
      this.dirtySince = now;
    }
    this.status = "dirty";
    this.targetState = this.target.persistenceTarget;
    return this.toState();
  }

  private async runFlushLoop(): Promise<SaveFlushResult> {
    let result: SaveFlushResult = {
      state: this.toState(),
      status: "noop"
    };
    try {
      while (this.pendingFlush) {
        const nextFlush = this.pendingFlush;
        this.pendingFlush = null;
        result = await this.runSingleFlush(nextFlush);
      }
      return result;
    } finally {
      this.activeFlush = null;
    }
  }

  private async runSingleFlush(options: SaveFlushOptions): Promise<SaveFlushResult> {
    if (this.status === "conflict") {
      return {
        message: this.errorMessage ?? "Conflict must be resolved before saving.",
        state: this.toState(),
        status: "conflict"
      };
    }

    if (this.currentHash === this.lastSavedHash && this.status === "saved") {
      return {
        state: this.toState(),
        status: "noop"
      };
    }

    if (!this.target.write) {
      this.status = "dirty";
      this.targetState = this.target.persistenceTarget;
      this.errorMessage = this.target.persistenceTarget === "download-required"
        ? "Download/export is required; the original source cannot be overwritten."
        : "This persistence target does not support writing.";
      return {
        message: this.errorMessage,
        state: this.toState(),
        status: "blocked"
      };
    }

    let externalHash: DocumentHash | null | undefined;
    try {
      externalHash = await this.target.readExternalHash?.();
    } catch (error) {
      this.status = "error";
      this.targetState = "error";
      this.errorMessage = error instanceof Error ? error.message : "Failed to read external save target.";
      return {
        message: this.errorMessage,
        state: this.toState(),
        status: "error"
      };
    }
    if (externalHash) {
      this.externalHash = externalHash;
    }
    if (this.lastSavedHash && externalHash && externalHash !== this.lastSavedHash) {
      return this.markConflict(externalHash, "External content changed since the last saved hash.");
    }

    const writeContent = this.content;
    const writeHash = this.currentHash;
    const previousSavedHash = this.lastSavedHash;
    this.status = "saving";
    this.targetState = this.target.persistenceTarget;

    const writeRequest: {
      content: string;
      contentHash: DocumentHash;
      now: Date;
      previousSavedHash?: DocumentHash;
      reason: SaveFlushReason;
    } = {
      content: writeContent,
      contentHash: writeHash,
      now: options.now ?? new Date(),
      reason: options.reason
    };
    if (previousSavedHash) {
      writeRequest.previousSavedHash = previousSavedHash;
    }

    let result: SaveTargetWriteResult;
    try {
      result = await this.target.write(writeRequest);
    } catch (error) {
      this.status = "error";
      this.targetState = "error";
      this.errorMessage = error instanceof Error ? error.message : "Unexpected save target failure.";
      return {
        message: this.errorMessage,
        state: this.toState(),
        status: "error"
      };
    }

    if (result.status === "conflict") {
      return this.markConflict(result.externalHash, result.message ?? "External content changed during save.");
    }

    if (result.status === "error") {
      this.status = "error";
      this.targetState = result.target ?? "error";
      this.errorMessage = result.message;
      return {
        message: result.message,
        state: this.toState(),
        status: "error"
      };
    }

    this.externalHash = result.externalHash ?? writeHash;
    this.lastSavedHash = writeHash;
    this.lastSavedAt = options.now ?? new Date();
    if (this.currentHash === writeHash) {
      this.dirtySince = undefined;
      this.status = "saved";
      this.targetState = this.target.persistenceTarget;
    } else {
      this.status = "dirty";
      this.targetState = this.target.persistenceTarget;
      return {
        message: "Content changed during save; latest content remains dirty.",
        state: this.toState(),
        status: "dirty"
      };
    }

    return {
      state: this.toState(),
      status: "saved"
    };
  }

  private markConflict(externalHash: DocumentHash, message: string): SaveFlushResult {
    this.externalHash = externalHash;
    this.status = "conflict";
    this.targetState = "conflict";
    this.errorMessage = message;
    return {
      message,
      state: this.toState(),
      status: "conflict"
    };
  }

  private toState(): SaveState {
    const state: {
      status: SaveStatus;
      target: PersistenceTarget;
      baseHash: DocumentHash;
      currentHash: DocumentHash;
      dirtySince?: Date;
      errorMessage?: string;
      externalHash?: DocumentHash;
      lastSavedAt?: Date;
      lastSavedHash?: DocumentHash;
    } = {
      baseHash: this.baseHash,
      currentHash: this.currentHash,
      status: this.status,
      target: this.targetState
    };
    if (this.dirtySince) {
      state.dirtySince = this.dirtySince;
    }
    if (this.errorMessage) {
      state.errorMessage = this.errorMessage;
    }
    if (this.externalHash) {
      state.externalHash = this.externalHash;
    }
    if (this.lastSavedAt) {
      state.lastSavedAt = this.lastSavedAt;
    }
    if (this.lastSavedHash) {
      state.lastSavedHash = this.lastSavedHash;
    }
    return state;
  }
}
