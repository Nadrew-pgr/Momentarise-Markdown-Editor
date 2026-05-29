import type {
  ParseOptions,
  ParseResult,
  SerializeOptions,
  SerializeResult
} from "@momentarise/md-core";

export interface MarkdownFormatContract {
  readonly packageName: "@momentarise/md-format";
  readonly dependsOnCore: true;
}

export interface MarkdownParser {
  parse(source: string, options: ParseOptions): ParseResult;
}

export interface MarkdownSerializer {
  serialize(result: ParseResult, options?: SerializeOptions): SerializeResult;
}

export type MarkdownFormatter = MarkdownParser & MarkdownSerializer;

export type {
  Diagnostic,
  DocumentDialect,
  DocumentHash,
  DocumentPath,
  DocumentSnapshot,
  FrontmatterRecord,
  MomentariseDocument,
  MomentariseNode,
  OpaqueNode,
  ParseOptions,
  ParseResult,
  RoundTripResult,
  SerializeOptions,
  SerializeResult,
  SourceRange
} from "@momentarise/md-core";
