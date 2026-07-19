type Brand<Value, Name extends string> = Value & {
  readonly __brand: Name;
};

export type DocumentPath = Brand<string, "DocumentPath">;
export type DocumentHash = Brand<string, "DocumentHash">;
export type DocumentRevision = Brand<string, "DocumentRevision">;
export type NodeId = Brand<string, "NodeId">;

export function nodeId(value: string): NodeId {
  return value as NodeId;
}

export interface HeadingSlugPathEntry {
  readonly level: number;
  readonly segment: string;
}

export function slugHeadingText(text: string): string {
  const slug = text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "empty";
}

export function createHeadingSlugSegment(
  headingPath: readonly HeadingSlugPathEntry[],
  level: number,
  text: string,
  siblingCounts: Map<string, number>
): string {
  const parentPath = headingPath.map((entry) => entry.segment).join("/");
  const slug = slugHeadingText(text);
  const countKey = `${parentPath}|h${level}|${slug}`;
  const occurrence = (siblingCounts.get(countKey) ?? 0) + 1;
  siblingCounts.set(countKey, occurrence);
  return `h${level}-${slug}${occurrence > 1 ? `-${occurrence}` : ""}`;
}

export function createHeadingNodeId(
  headingPath: readonly HeadingSlugPathEntry[],
  level: number,
  text: string,
  siblingCounts: Map<string, number>
): string {
  const segment = createHeadingSlugSegment(headingPath, level, text, siblingCounts);
  return `heading:${[...headingPath.map((entry) => entry.segment), segment].join("/")}`;
}

export function headingSegmentFromNodeId(nodeIdValue: string): string {
  return nodeIdValue.slice(nodeIdValue.lastIndexOf("/") + 1).replace(/^heading:/, "");
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

export type MomentariseErrorCode =
  | "mme_invalid_argument"
  | "mme_path_outside_root"
  | "mme_policy_denied"
  | "mme_provider_error"
  | "mme_save_conflict"
  | "mme_unexpected_error";

export interface MomentariseErrorOptions {
  readonly cause?: unknown;
  readonly details?: Readonly<Record<string, unknown>>;
}

export class MomentariseError extends Error {
  readonly code: MomentariseErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor(code: MomentariseErrorCode, message: string, options: MomentariseErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "MomentariseError";
    this.code = code;
    if (options.details) {
      this.details = options.details;
    }
  }
}

export function isMomentariseError(error: unknown): error is MomentariseError {
  return error instanceof MomentariseError;
}

export type DocumentDialect =
  | "commonmark"
  | "gfm"
  | "obsidian-compatible"
  | "momentarise-enhanced";

export interface SourcePosition {
  readonly line: number;
  readonly column: number;
  readonly offset: number;
}

export interface SourceRange {
  readonly start: SourcePosition;
  readonly end: SourcePosition;
}

export type FrontmatterValue =
  | string
  | number
  | boolean
  | null
  | readonly FrontmatterValue[]
  | {
      readonly [key: string]: FrontmatterValue;
    };

export type FrontmatterRecord = {
  readonly [key: string]: FrontmatterValue;
};

export interface Diagnostic {
  readonly code: string;
  readonly severity: "info" | "warning" | "error";
  readonly message: string;
  readonly sourceRange?: SourceRange;
}

export type NodeKind = "root" | "block" | "inline" | "opaque";

export interface MomentariseNodeBase {
  readonly id: NodeId;
  readonly kind: NodeKind;
  readonly type: string;
  readonly sourceRange?: SourceRange;
  readonly attributes?: NodeAttributes;
}

export type NodeAttributeValue =
  | string
  | number
  | boolean
  | null
  | readonly NodeAttributeValue[]
  | {
      readonly [key: string]: NodeAttributeValue;
    };

export type NodeAttributes = {
  readonly [key: string]: NodeAttributeValue;
};

export interface KnownNode extends MomentariseNodeBase {
  readonly kind: "root" | "block" | "inline";
  readonly children?: readonly MomentariseNode[];
}

export interface OpaqueNode extends MomentariseNodeBase {
  readonly kind: "opaque";
  readonly type: "opaque";
  readonly raw: string;
  readonly sourceRange: SourceRange;
  readonly preservation: "preserve-raw";
  readonly reason?: string;
}

export type MomentariseNode = KnownNode | OpaqueNode;

export interface MomentariseDocument {
  readonly root: KnownNode;
  readonly dialect: DocumentDialect;
  readonly frontmatter?: FrontmatterRecord;
  readonly diagnostics: readonly Diagnostic[];
}

export interface DocumentSnapshot {
  readonly content: string;
  readonly hash: DocumentHash;
  readonly path: DocumentPath | null;
  readonly dialect: DocumentDialect;
  readonly frontmatter?: FrontmatterRecord;
  readonly revision?: DocumentRevision;
}

export type EditorDocumentKind = "html-artifact" | "lightweight-source" | "markdown";
export type EditorDocumentFileKind = EditorDocumentKind | "unsupported";

export const MARKDOWN_DOCUMENT_EXTENSIONS = [".md", ".markdown", ".mdown"] as const;
export const HTML_ARTIFACT_EXTENSIONS = [".html", ".htm"] as const;
export const LIGHTWEIGHT_SOURCE_EXTENSIONS = [
  ".csv",
  ".json",
  ".log",
  ".text",
  ".toml",
  ".tsv",
  ".txt",
  ".yaml",
  ".yml"
] as const;

export function classifyEditorDocumentKind(fileName: string, mediaType?: string | null): EditorDocumentFileKind {
  const normalizedMediaType = normalizeMediaType(mediaType);
  if (normalizedMediaType && MARKDOWN_MEDIA_TYPES.has(normalizedMediaType)) {
    return "markdown";
  }
  if (normalizedMediaType && HTML_MEDIA_TYPES.has(normalizedMediaType)) {
    return "html-artifact";
  }
  if (isMarkdownDocumentFileName(fileName)) {
    return "markdown";
  }
  if (isHtmlArtifactFileName(fileName)) {
    return "html-artifact";
  }
  if (isLightweightSourceFileName(fileName)) {
    return "lightweight-source";
  }
  if (hasFileExtension(fileName)) {
    return "unsupported";
  }
  if (normalizedMediaType && LIGHTWEIGHT_SOURCE_MEDIA_TYPES.has(normalizedMediaType)) {
    return "lightweight-source";
  }
  return "unsupported";
}

export function isMarkdownDocumentFileName(fileName: string): boolean {
  return extensionSetIncludes(MARKDOWN_DOCUMENT_EXTENSIONS, fileName);
}

export function isHtmlArtifactFileName(fileName: string): boolean {
  return extensionSetIncludes(HTML_ARTIFACT_EXTENSIONS, fileName);
}

export function isLightweightSourceFileName(fileName: string): boolean {
  return extensionSetIncludes(LIGHTWEIGHT_SOURCE_EXTENSIONS, fileName);
}

function extensionSetIncludes(extensions: readonly string[], fileName: string): boolean {
  const lower = fileName.trim().toLowerCase();
  return extensions.some((extension) => lower.endsWith(extension));
}

function hasFileExtension(fileName: string): boolean {
  const name = fileName.trim();
  const lastSlash = Math.max(name.lastIndexOf("/"), name.lastIndexOf("\\"));
  const baseName = name.slice(lastSlash + 1);
  const dotIndex = baseName.lastIndexOf(".");
  return dotIndex > 0 && dotIndex < baseName.length - 1;
}

function normalizeMediaType(mediaType: string | null | undefined): string {
  return typeof mediaType === "string" ? mediaType.split(";")[0]!.trim().toLowerCase() : "";
}

const MARKDOWN_MEDIA_TYPES = new Set(["text/markdown", "text/x-markdown"]);
const HTML_MEDIA_TYPES = new Set(["text/html", "application/xhtml+xml"]);
const LIGHTWEIGHT_SOURCE_MEDIA_TYPES = new Set([
  "application/json",
  "application/toml",
  "application/x-toml",
  "application/x-yaml",
  "application/yaml",
  "text/csv",
  "text/plain",
  "text/tab-separated-values",
  "text/toml",
  "text/yaml"
]);

export interface ParseOptions {
  readonly dialect: DocumentDialect;
  readonly path?: DocumentPath;
}

export interface ParseResult {
  readonly document: MomentariseDocument;
  readonly snapshot: DocumentSnapshot;
  readonly diagnostics: readonly Diagnostic[];
}

export interface SerializeOptions {
  readonly dialect?: DocumentDialect;
  readonly preserveUnchangedRanges?: boolean;
}

export interface SerializeResult {
  readonly content: string;
  readonly hash: DocumentHash;
  readonly diagnostics: readonly Diagnostic[];
  readonly normalizations: readonly string[];
}

export interface RoundTripResult {
  readonly input: DocumentSnapshot;
  readonly output: DocumentSnapshot;
  readonly parseDiagnostics: readonly Diagnostic[];
  readonly serializeDiagnostics: readonly Diagnostic[];
  readonly preservedOpaqueNodes: readonly OpaqueNode[];
}

export type EditorMode = "source" | "rich" | "live-preview" | "preview";

export type SaveStatus = "dirty" | "saving" | "saved" | "conflict" | "error";

export type PersistenceTarget =
  | "disk"
  | "memory-only"
  | "download-required"
  | "unsupported"
  | "conflict"
  | "error";

export interface SaveState {
  readonly status: SaveStatus;
  readonly target: PersistenceTarget;
  readonly baseHash: DocumentHash;
  readonly currentHash: DocumentHash;
  readonly lastSavedHash?: DocumentHash;
  readonly externalHash?: DocumentHash;
  readonly dirtySince?: Date;
  readonly lastSavedAt?: Date;
  readonly errorMessage?: string;
}

export type PolicyCapability =
  | "exists"
  | "metadata"
  | "read"
  | "index"
  | "write"
  | "execute"
  | "share"
  | "export";

export type PolicySource =
  | "framework-default"
  | "app-default"
  | "workspace"
  | "folder"
  | "database"
  | "document"
  | "user"
  | "host"
  | "hard-deny";

export type PolicyDecisionSeverity = "info" | "warning" | "blocker";

export interface PolicySubject {
  readonly documentPath: DocumentPath | null;
  readonly dialect?: DocumentDialect;
  readonly frontmatter?: FrontmatterRecord;
}

export interface PolicyDecision {
  readonly capability: PolicyCapability;
  readonly allowed: boolean;
  readonly reason?: string;
  readonly source?: PolicySource;
  readonly severity?: PolicyDecisionSeverity;
  readonly overridable?: boolean;
  readonly requiresUserConfirmation?: boolean;
  readonly ruleId?: string;
}

export interface DocumentAccessPolicy {
  readonly decisions: readonly PolicyDecision[];
}

export interface FoldState {
  readonly nodeId: NodeId;
  readonly collapsed: boolean;
}

export interface SelectionState {
  readonly anchor: SourcePosition;
  readonly head: SourcePosition;
}

export interface SidecarState {
  readonly mode: EditorMode;
  readonly folds: readonly FoldState[];
  readonly selection?: SelectionState;
  readonly metadata?: Readonly<Record<string, unknown>>;
}
