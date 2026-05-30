import type { DocumentSnapshot, EditorMode, SaveState, SidecarState } from "@momentarise/md-core";
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

export interface WebFileLike {
  readonly name: string;
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
}

export interface WebOpenFilePickerOptions {
  readonly excludeAcceptAllOption?: boolean;
  readonly multiple?: boolean;
  readonly types?: readonly {
    readonly accept: Readonly<Record<string, readonly string[]>>;
    readonly description: string;
  }[];
}

export interface WebOpenedMarkdownFile {
  readonly content: string;
  readonly fileName: string;
  readonly mode: WebOpenedMarkdownMode;
  readonly pathLabel: string;
  readonly target: SaveTarget;
}

export interface CreateWritableFileSaveTargetOptions {
  readonly handle: WebFileHandleLike;
  readonly targetLabel?: string;
}

export interface CreateImportedCopyDocumentOptions {
  readonly content: string;
  readonly fileName: string;
}

export function canUseFileSystemAccess(host: WebFileAccessHostLike = defaultWebFileAccessHost()): boolean {
  return typeof host.showOpenFilePicker === "function";
}

export function createImportedCopyDocument(
  options: CreateImportedCopyDocumentOptions
): WebOpenedMarkdownFile {
  return {
    content: options.content,
    fileName: options.fileName,
    mode: "imported-copy",
    pathLabel: `imported-copy://${options.fileName}`,
    target: createDownloadRequiredSaveTarget({
      initialContent: options.content,
      targetLabel: `imported-copy://${options.fileName}`
    })
  };
}

export function createWritableFileSaveTarget(
  options: CreateWritableFileSaveTargetOptions
): SaveTarget {
  const targetLabel = options.targetLabel ?? `disk://${options.handle.name}`;
  return {
    persistenceTarget: "disk",
    targetLabel,
    async readExternalHash() {
      const file = await options.handle.getFile();
      return hashMarkdownContent(await file.text());
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
        const beforeWriteHash = hashMarkdownContent(await (await options.handle.getFile()).text());
        if (request.previousSavedHash && beforeWriteHash !== request.previousSavedHash) {
          return {
            externalHash: beforeWriteHash,
            message: "External file content changed before save.",
            status: "conflict"
          };
        }

        writable = await options.handle.createWritable();
        await writable.write(request.content);
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

export async function openWritableMarkdownFile(
  host: WebFileAccessHostLike = defaultWebFileAccessHost()
): Promise<WebOpenedMarkdownFile> {
  if (!canUseFileSystemAccess(host) || !host.showOpenFilePicker) {
    return {
      content: "",
      fileName: "unsupported.md",
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
    types: [
      {
        accept: {
          "text/markdown": [".md", ".markdown", ".mdown"],
          "text/plain": [".md", ".markdown", ".txt"]
        },
        description: "Markdown files"
      }
    ]
  });
  if (!handle) {
    throw new Error("No Markdown file handle was selected.");
  }

  const file = await handle.getFile();
  const content = await file.text();
  return {
    content,
    fileName: file.name || handle.name,
    mode: "writable-file",
    pathLabel: `disk://${file.name || handle.name}`,
    target: createWritableFileSaveTarget({
      handle,
      targetLabel: `disk://${file.name || handle.name}`
    })
  };
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
