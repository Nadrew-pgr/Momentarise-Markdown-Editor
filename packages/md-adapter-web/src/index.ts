import type { DocumentHash, DocumentSnapshot, EditorDocumentKind, EditorMode, SaveState, SidecarState } from "@momentarise/md-core";
import {
  classifyEditorDocumentKind,
  isMarkdownDocumentFileName,
  isSvgArtifactFileName
} from "@momentarise/md-core";
import {
  createDownloadRequiredSaveTarget,
  hashMarkdownContent,
  type SaveTarget,
  type SaveTargetWriteRequest,
  type SaveTargetWriteResult
} from "@momentarise/md-save";

export interface WebAdapterContract {
  readonly packageName: "@momentarise/md-adapter-web";
  readonly dependsOnCore: true;
  readonly host: "web";
}

export interface WebDocumentSession {
  readonly snapshot: DocumentSnapshot;
  readonly mode: EditorMode;
  readonly saveState: SaveState;
  readonly sidecar: SidecarState;
}

export interface WebAdapterHost {
  open(snapshot: DocumentSnapshot): WebDocumentSession;
}

export type WebOpenedMarkdownMode = "writable-file" | "imported-copy" | "unsupported";
export type WebOpenedSourceDocumentKind = Extract<EditorDocumentKind, "lightweight-source" | "markdown" | "svg-artifact">;
export type WebOpenedDocumentKind = WebOpenedSourceDocumentKind | "unsupported";

export interface WebFileLike {
  readonly name: string;
  readonly type?: string;
  text(): Promise<string>;
}

export interface WebFileWritableLike {
  abort?: () => Promise<void>;
  close(): Promise<void>;
  write(value: string): Promise<void>;
}

export interface WebFileHandleLike {
  readonly kind?: string;
  readonly name: string;
  createWritable?: () => Promise<WebFileWritableLike>;
  getFile(): Promise<WebFileLike>;
}

export interface WebFileAccessHostLike {
  showOpenFilePicker?: (options?: WebOpenFilePickerOptions) => Promise<readonly WebFileHandleLike[]>;
  showSaveFilePicker?: (options?: WebSaveFilePickerOptions) => Promise<WebFileHandleLike>;
}

export interface WebFilePickerType {
  readonly accept: Readonly<Record<string, readonly string[]>>;
  readonly description: string;
}

export interface WebOpenFilePickerOptions {
  readonly excludeAcceptAllOption?: boolean;
  readonly multiple?: boolean;
  readonly types?: readonly WebFilePickerType[];
}

export interface WebSaveFilePickerOptions {
  readonly excludeAcceptAllOption?: boolean;
  readonly suggestedName?: string;
  readonly types?: readonly WebFilePickerType[];
}

export interface WebOpenedMarkdownFile {
  readonly content: string;
  readonly fileName: string;
  readonly kind: WebOpenedDocumentKind;
  readonly mode: WebOpenedMarkdownMode;
  readonly pathLabel: string;
  readonly target: SaveTarget;
}

export interface CreateWritableFileSaveTargetOptions {
  readonly handle: WebFileHandleLike;
  readonly lineEnding?: MarkdownLineEnding;
  readonly targetLabel?: string;
}

export interface CreateImportedCopyDocumentOptions {
  readonly content: string;
  readonly fileName: string;
  readonly kind?: WebOpenedSourceDocumentKind;
}

export interface CreateNewMarkdownFileOptions {
  readonly content?: string;
  readonly fileName?: string;
  readonly host?: WebFileAccessHostLike;
  readonly lineEnding?: MarkdownLineEnding;
  readonly now?: Date;
}

export interface SaveMarkdownAsFileOptions {
  readonly content: string;
  readonly fileName?: string;
  readonly host?: WebFileAccessHostLike;
  readonly kind?: WebOpenedSourceDocumentKind;
  readonly lineEnding?: MarkdownLineEnding;
  readonly now?: Date;
}

export type ExternalChangeListener = () => void | Promise<void>;

export interface ExternalChangeWatcher {
  start(): void;
  stop(): void;
}

export interface CreateFocusRefreshWatcherOptions {
  readonly getLastSavedHash: () => DocumentHash | undefined;
  readonly listen: (handler: ExternalChangeListener) => () => void;
  readonly onError?: (error: unknown) => void;
  readonly onExternalChange: (externalHash: DocumentHash) => void | Promise<void>;
  readonly readExternalHash: () => DocumentHash | null | Promise<DocumentHash | null>;
}

export type MarkdownLineEnding = "crlf" | "lf";

export function canUseFileSystemAccess(host: WebFileAccessHostLike = defaultWebFileAccessHost()): boolean {
  return typeof host.showOpenFilePicker === "function";
}

export function canCreateWritableFile(host: WebFileAccessHostLike = defaultWebFileAccessHost()): boolean {
  return typeof host.showSaveFilePicker === "function";
}

export function createImportedCopyDocument(
  options: CreateImportedCopyDocumentOptions
): WebOpenedMarkdownFile {
  const content = normalizeMarkdownLineEndings(options.content);
  const kind = options.kind ?? sourceDocumentKindForFile(options.fileName);
  if (kind === "unsupported") {
    return createUnsupportedOpenedDocument(content, options.fileName);
  }
  return {
    content,
    fileName: options.fileName,
    kind,
    mode: "imported-copy",
    pathLabel: `imported-copy://${options.fileName}`,
    target: createDownloadRequiredSaveTarget({
      initialContent: content,
      targetLabel: `imported-copy://${options.fileName}`
    })
  };
}

export async function createNewMarkdownFile(options: CreateNewMarkdownFileOptions = {}): Promise<WebOpenedMarkdownFile> {
  const request: {
    content: string;
    fileName: string;
    host: WebFileAccessHostLike;
    kind: WebOpenedSourceDocumentKind;
    lineEnding: MarkdownLineEnding;
    now?: Date;
  } = {
    content: options.content ?? "",
    fileName: options.fileName ?? "Untitled.md",
    host: options.host ?? defaultWebFileAccessHost(),
    kind: "markdown",
    lineEnding: options.lineEnding ?? "lf"
  };
  if (options.now) {
    request.now = options.now;
  }
  return createOrSaveWritableMarkdownFile(request);
}

export async function saveMarkdownAsFile(options: SaveMarkdownAsFileOptions): Promise<WebOpenedMarkdownFile> {
  const request: {
    content: string;
    fileName: string;
    host: WebFileAccessHostLike;
    kind: WebOpenedSourceDocumentKind;
    lineEnding: MarkdownLineEnding;
    now?: Date;
  } = {
    content: options.content,
    fileName: options.fileName ?? "Untitled.md",
    host: options.host ?? defaultWebFileAccessHost(),
    kind: options.kind ?? "markdown",
    lineEnding: options.lineEnding ?? "lf"
  };
  if (options.now) {
    request.now = options.now;
  }
  return createOrSaveWritableMarkdownFile(request);
}

export function createWritableFileSaveTarget(
  options: CreateWritableFileSaveTargetOptions
): SaveTarget {
  const targetLabel = options.targetLabel ?? `disk://${options.handle.name}`;
  const lineEnding = options.lineEnding ?? "lf";
  return {
    persistenceTarget: "disk",
    targetLabel,
    async readExternalContent() {
      const file = await options.handle.getFile();
      return normalizeMarkdownLineEndings(await file.text());
    },
    async readExternalHash() {
      const file = await options.handle.getFile();
      return hashMarkdownContent(normalizeMarkdownLineEndings(await file.text()));
    },
    async write(request: SaveTargetWriteRequest): Promise<SaveTargetWriteResult> {
      if (!options.handle.createWritable) {
        return {
          message: "This file handle is not writable.",
          status: "error",
          target: "unsupported"
        };
      }

      let writable: WebFileWritableLike | undefined;
      try {
        const beforeWriteHash = hashMarkdownContent(normalizeMarkdownLineEndings(await (await options.handle.getFile()).text()));
        if (request.previousSavedHash && beforeWriteHash !== request.previousSavedHash) {
          return {
            externalHash: beforeWriteHash,
            message: "External file content changed before save.",
            status: "conflict"
          };
        }

        writable = await options.handle.createWritable();
        const afterWritableHash = hashMarkdownContent(
          normalizeMarkdownLineEndings(await (await options.handle.getFile()).text())
        );
        if (request.previousSavedHash && afterWritableHash !== request.previousSavedHash) {
          await writable.abort?.();
          return {
            externalHash: afterWritableHash,
            message: "External file content changed before writable stream commit.",
            status: "conflict"
          };
        }

        await writable.write(restoreMarkdownLineEndings(request.content, lineEnding));
        await writable.close();
      } catch (error) {
        await writable?.abort?.();
        return {
          message: error instanceof Error ? error.message : "Failed to write local file.",
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

async function createOrSaveWritableMarkdownFile(options: {
  readonly content: string;
  readonly fileName: string;
  readonly host: WebFileAccessHostLike;
  readonly kind: WebOpenedSourceDocumentKind;
  readonly lineEnding: MarkdownLineEnding;
  readonly now?: Date;
}): Promise<WebOpenedMarkdownFile> {
  const fileName = ensureSourceDocumentFileName(options.fileName, options.kind);
  const content = normalizeMarkdownLineEndings(options.content);
  if (!canCreateWritableFile(options.host) || !options.host.showSaveFilePicker) {
    return createImportedCopyDocument({
      content,
      fileName,
      kind: options.kind
    });
  }

  const handle = await options.host.showSaveFilePicker({
    excludeAcceptAllOption: false,
    suggestedName: fileName,
    types: markdownFilePickerTypes()
  });
  const selectedFileName = ensureSourceDocumentFileName(handle.name || fileName, options.kind);
  const targetLabel = `disk://${selectedFileName}`;
  const target = createWritableFileSaveTarget({
    handle,
    lineEnding: options.lineEnding,
    targetLabel
  });
  const result = await target.write?.({
    content,
    contentHash: hashMarkdownContent(content),
    now: options.now ?? new Date(),
    reason: "manual"
  });
  if (!result || result.status !== "saved") {
    const message = result?.message ?? "Failed to create writable Markdown file.";
    throw new Error(message);
  }

  return {
    content,
    fileName: selectedFileName,
    kind: options.kind,
    mode: "writable-file",
    pathLabel: targetLabel,
    target
  };
}

export function createFocusRefreshWatcher(options: CreateFocusRefreshWatcherOptions): ExternalChangeWatcher {
  let cleanup: (() => void) | null = null;
  let generation = 0;
  let lastNotifiedHash: DocumentHash | null = null;

  const checkExternalHash = async (runGeneration: number): Promise<void> => {
    try {
      const externalHash = await options.readExternalHash();
      if (runGeneration !== generation || !cleanup) {
        return;
      }
      const lastSavedHash = options.getLastSavedHash();
      if (!externalHash || !lastSavedHash || externalHash === lastSavedHash) {
        lastNotifiedHash = null;
        return;
      }
      if (lastNotifiedHash === externalHash) {
        return;
      }
      lastNotifiedHash = externalHash;
      await options.onExternalChange(externalHash);
    } catch (error) {
      options.onError?.(error);
    }
  };

  return {
    start() {
      if (cleanup) {
        return;
      }
      generation += 1;
      const runGeneration = generation;
      cleanup = options.listen(() => checkExternalHash(runGeneration));
    },
    stop() {
      generation += 1;
      cleanup?.();
      cleanup = null;
      lastNotifiedHash = null;
    }
  };
}

export async function openWritableMarkdownFile(
  host: WebFileAccessHostLike = defaultWebFileAccessHost()
): Promise<WebOpenedMarkdownFile> {
  if (!canUseFileSystemAccess(host) || !host.showOpenFilePicker) {
    return {
      content: "",
      fileName: "unsupported.md",
      kind: "markdown",
      mode: "unsupported",
      pathLabel: "unsupported://file-system-access",
      target: {
        persistenceTarget: "unsupported",
        targetLabel: "unsupported://file-system-access"
      }
    };
  }

  const [handle] = await host.showOpenFilePicker({
    excludeAcceptAllOption: false,
    multiple: false,
    types: markdownFilePickerTypes()
  });
  if (!handle) {
    throw new Error("No Markdown file handle was selected.");
  }

  const file = await handle.getFile();
  const rawContent = await file.text();
  const lineEnding = detectMarkdownLineEnding(rawContent);
  const content = normalizeMarkdownLineEndings(rawContent);
  const fileName = file.name || handle.name;
  const kind = sourceDocumentKindForFile(fileName, file.type);
  if (kind === "unsupported") {
    return createUnsupportedOpenedDocument(content, fileName);
  }
  return {
    content,
    fileName,
    kind,
    mode: "writable-file",
    pathLabel: `disk://${fileName}`,
    target: createWritableFileSaveTarget({
      handle,
      lineEnding,
      targetLabel: `disk://${fileName}`
    })
  };
}

function markdownFilePickerTypes(): readonly WebFilePickerType[] {
  return [
    {
      accept: {
        "text/markdown": [".md", ".markdown", ".mdown"],
        "text/plain": [".md", ".markdown", ".mdown", ".txt", ".text", ".log"],
        "text/csv": [".csv"],
        "text/tab-separated-values": [".tsv"],
        "application/json": [".json"],
        "application/toml": [".toml"],
        "application/yaml": [".yaml", ".yml"],
        "image/svg+xml": [".svg"]
      },
      description: "Markdown, source text, and SVG files"
    }
  ];
}

function ensureMarkdownFileName(fileName: string): string {
  const trimmed = fileName.trim() || "Untitled.md";
  return isMarkdownDocumentFileName(trimmed) ? trimmed : `${trimmed}.md`;
}

function ensureSourceDocumentFileName(fileName: string, kind: WebOpenedSourceDocumentKind): string {
  if (kind === "markdown") {
    return ensureMarkdownFileName(fileName);
  }
  if (kind === "svg-artifact") {
    const trimmed = fileName.trim() || "Untitled.svg";
    return isSvgArtifactFileName(trimmed) ? trimmed : `${trimmed}.svg`;
  }
  const trimmed = fileName.trim() || "Untitled.txt";
  return classifyEditorDocumentKind(trimmed) === "lightweight-source" ? trimmed : `${trimmed}.txt`;
}

function sourceDocumentKindForFile(fileName: string, mediaType?: string | null): WebOpenedDocumentKind {
  const kind = classifyEditorDocumentKind(fileName, mediaType);
  return kind === "lightweight-source" || kind === "markdown" || kind === "svg-artifact" ? kind : "unsupported";
}

function createUnsupportedOpenedDocument(content: string, fileName: string): WebOpenedMarkdownFile {
  const safeFileName = fileName.trim() || "unsupported";
  return {
    content,
    fileName: safeFileName,
    kind: "unsupported",
    mode: "unsupported",
    pathLabel: `unsupported://${safeFileName}`,
    target: {
      persistenceTarget: "unsupported",
      targetLabel: `unsupported://${safeFileName}`
    }
  };
}

export function detectMarkdownLineEnding(content: string): MarkdownLineEnding {
  return content.includes("\r\n") ? "crlf" : "lf";
}

export function normalizeMarkdownLineEndings(content: string): string {
  return content.replace(/\r\n?/g, "\n");
}

export function restoreMarkdownLineEndings(content: string, lineEnding: MarkdownLineEnding): string {
  const normalized = normalizeMarkdownLineEndings(content);
  return lineEnding === "crlf" ? normalized.replace(/\n/g, "\r\n") : normalized;
}

function defaultWebFileAccessHost(): WebFileAccessHostLike {
  return globalThis as unknown as WebFileAccessHostLike;
}

export type {
  DocumentSnapshot,
  EditorMode,
  PersistenceTarget,
  SaveState,
  SaveStatus,
  SidecarState
} from "@momentarise/md-core";
