type Brand<Value, Name extends string> = Value & {
  readonly __brand: Name;
};

export type DocumentPath = Brand<string, "DocumentPath">;
export type DocumentHash = Brand<string, "DocumentHash">;
export type DocumentRevision = Brand<string, "DocumentRevision">;
export type NodeId = Brand<string, "NodeId"> | string;

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
}

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

export type EditorMode = "source" | "rich" | "preview";

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

export interface PolicySubject {
  readonly documentPath: DocumentPath | null;
  readonly dialect?: DocumentDialect;
  readonly frontmatter?: FrontmatterRecord;
}

export interface PolicyDecision {
  readonly capability: PolicyCapability;
  readonly allowed: boolean;
  readonly reason?: string;
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
