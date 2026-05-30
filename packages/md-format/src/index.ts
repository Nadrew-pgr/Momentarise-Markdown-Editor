import type {
  Diagnostic,
  DocumentHash,
  DocumentPath,
  FrontmatterRecord,
  FrontmatterValue,
  KnownNode,
  MomentariseNode,
  NodeAttributes,
  OpaqueNode,
  ParseOptions,
  ParseResult,
  SerializeOptions,
  SerializeResult,
  SourcePosition,
  SourceRange
} from "@momentarise/md-core";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { VFile } from "vfile";
import { matter } from "vfile-matter";

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

export type RoundTripMode = "strict" | "semantic" | "opaque-preservation";

export type RoundTripStatus = "pass" | "fail";

export interface RoundTripFixture {
  readonly fixtureId: string;
  readonly input: string;
  readonly mode?: RoundTripMode;
}

export interface FixtureRoundTripResult {
  readonly fixtureId: string;
  readonly mode: RoundTripMode;
  readonly status: RoundTripStatus;
  readonly inputHash: DocumentHash;
  readonly outputHash: DocumentHash;
  readonly diff: string;
  readonly diagnostics: readonly Diagnostic[];
  readonly preservedOpaqueNodes: readonly OpaqueNode[];
  readonly frontmatterPreserved: boolean;
  readonly htmlPreserved: boolean;
}

export interface RoundTripHarnessResult {
  readonly results: readonly FixtureRoundTripResult[];
  readonly summary: {
    readonly total: number;
    readonly passed: number;
    readonly failed: number;
    readonly modes: readonly RoundTripMode[];
  };
}

export interface RunFixtureRoundTripOptions {
  readonly fixtures: readonly RoundTripFixture[];
  readonly formatter?: MarkdownFormatter;
  readonly dialect?: ParseOptions["dialect"];
}

export type MarkdownEditKind =
  | "replace-node"
  | "replace-source-range"
  | "replace-code-fence-content"
  | "replace-code-fence-language";

export interface MarkdownSourceEdit {
  readonly kind: MarkdownEditKind;
  readonly replacement: string;
  readonly nodeId?: string;
  readonly sourceRange?: SourceRange;
}

export interface SerializeMarkdownEditsOptions {
  readonly edits: readonly MarkdownSourceEdit[];
}

const defaultDialect: ParseOptions["dialect"] = "momentarise-enhanced";

type MdastLikeNode = {
  readonly type: string;
  readonly children?: readonly MdastLikeNode[];
  readonly position?: {
    readonly start: {
      readonly line: number;
      readonly column: number;
      readonly offset?: number;
    };
    readonly end: {
      readonly line: number;
      readonly column: number;
      readonly offset?: number;
    };
  };
  readonly value?: string;
  readonly lang?: string | null;
  readonly meta?: string | null;
  readonly depth?: number;
  readonly ordered?: boolean;
  readonly checked?: boolean | null;
  readonly url?: string;
  readonly title?: string | null;
  readonly alt?: string | null;
  readonly start?: number | null;
};

export function createMarkdownAstParser(): MarkdownParser {
  const processor = unified().use(remarkParse).use(remarkFrontmatter, ["yaml"]).use(remarkGfm);

  return {
    parse(source: string, options: ParseOptions): ParseResult {
      const hash = hashContent(source);
      const diagnostics: Diagnostic[] = [
        {
          code: "ast_parser_foundation",
          message: "Parsed with unified/remark and mapped to Momentarise host-independent nodes.",
          severity: "info"
        }
      ];

      const frontmatter = parseFrontmatter(source);
      if (frontmatter) {
        diagnostics.push({
          code: "frontmatter_extracted",
          message: "YAML frontmatter extracted into the Momentarise document snapshot.",
          severity: "info"
        });
      }

      let ast: MdastLikeNode;
      try {
        ast = processor.parse(source) as MdastLikeNode;
      } catch (error) {
        const fallbackOpaque = opaqueNodeFromRaw(source, 0, source.length, "parser fallback after AST parse error", 0);
        diagnostics.push({
          code: "ast_parse_error",
          message: error instanceof Error ? error.message : "Markdown AST parser failed.",
          severity: "error"
        });
        const root: KnownNode = {
          children: [fallbackOpaque],
          id: "root",
          kind: "root",
          type: "document"
        };
        return createParseResult(source, hash, options, root, diagnostics, frontmatter);
      }

      const mappedChildren = (ast.children ?? []).map((child, index) =>
        mapMdastNode(child, source, `ast-${index}`)
      );
      const detectedOpaqueNodes = detectOpaqueNodes(source);
      const astOpaqueNodes = collectOpaqueNodesFromList(mappedChildren);
      const extraOpaqueNodes = detectedOpaqueNodes.filter(
        (detected) =>
          !astOpaqueNodes.some(
            (node) =>
              node.sourceRange.start.offset === detected.sourceRange.start.offset &&
              node.sourceRange.end.offset === detected.sourceRange.end.offset &&
              node.reason === detected.reason
          )
      );
      const children: readonly MomentariseNode[] = [...mappedChildren, ...extraOpaqueNodes].sort(
        (first, second) => (first.sourceRange?.start.offset ?? 0) - (second.sourceRange?.start.offset ?? 0)
      );

      for (const node of collectOpaqueNodesFromList(children)) {
        diagnostics.push({
          code: "opaque_preserved",
          message: `Preserved unsupported or extension syntax as opaque source: ${node.reason ?? "opaque"}.`,
          severity: "info",
          sourceRange: node.sourceRange
        });
      }

      const root: KnownNode = {
        children,
        id: "root",
        kind: "root",
        type: "document"
      };

      return createParseResult(source, hash, options, root, diagnostics, frontmatter);
    }
  };
}

export function createMarkdownAstFormatter(): MarkdownFormatter {
  const parser = createMarkdownAstParser();
  return {
    parse: parser.parse,
    serialize(result: ParseResult, _options?: SerializeOptions): SerializeResult {
      const content = result.snapshot.content;
      return {
        content,
        diagnostics: [
          {
            code: "source_preservation_serializer",
            message:
              "Source preservation serializer returned original Markdown bytes until full serializer work starts.",
            severity: "info"
          }
        ],
        hash: hashContent(content),
        normalizations: []
      };
    }
  };
}

export function createIdentityMarkdownFormatter(): MarkdownFormatter {
  return {
    parse(source: string, options: ParseOptions): ParseResult {
      const hash = hashContent(source);
      const frontmatter = parseFrontmatter(source);
      const opaqueNodes = detectOpaqueNodes(source);
      const diagnostics: Diagnostic[] = [
        {
          code: "pre_parser_identity_mode",
          message:
            "Pre-parser preservation mode keeps Markdown bytes unchanged until the real AST parser is introduced.",
          severity: "info"
        }
      ];

      for (const node of opaqueNodes) {
        diagnostics.push({
          code: "opaque_preserved",
          message: `Preserved unsupported or extension syntax as opaque source: ${node.reason ?? node.type}.`,
          severity: "info",
          sourceRange: node.sourceRange
        });
      }

      const root: KnownNode = {
        children: opaqueNodes,
        id: "root",
        kind: "root",
        type: "document"
      };

      return {
        diagnostics,
        document: {
          diagnostics,
          dialect: options.dialect,
          root,
          ...(frontmatter ? { frontmatter: frontmatter.record } : {})
        },
        snapshot: {
          content: source,
          dialect: options.dialect,
          hash,
          path: options.path ?? null,
          ...(frontmatter ? { frontmatter: frontmatter.record } : {})
        }
      };
    },
    serialize(result: ParseResult, _options?: SerializeOptions): SerializeResult {
      const content = result.snapshot.content;
      return {
        content,
        diagnostics: [
          {
            code: "identity_serializer",
            message:
              "Identity serializer returned the original Markdown bytes for round-trip preservation.",
            severity: "info"
          }
        ],
        hash: hashContent(content),
        normalizations: []
      };
    }
  };
}

export function serializeMarkdownEdits(
  result: ParseResult,
  options: SerializeMarkdownEditsOptions
): SerializeResult {
  const resolvedEdits = options.edits
    .map((edit, index) => resolveMarkdownEdit(result, edit, index))
    .sort((first, second) => first.sourceRange.start.offset - second.sourceRange.start.offset);
  assertNoOverlappingEdits(resolvedEdits);

  let content = result.snapshot.content;
  for (const edit of [...resolvedEdits].reverse()) {
    content =
      content.slice(0, edit.sourceRange.start.offset) +
      edit.replacement +
      content.slice(edit.sourceRange.end.offset);
  }

  const editDiagnostics: Diagnostic[] = resolvedEdits.map((edit) => ({
    code: "serializer_edit_applied",
    message: `Applied ${edit.kind} while preserving source outside the edited range.`,
    severity: "info",
    sourceRange: edit.sourceRange
  }));

  return {
    content,
    diagnostics: [
      {
        code: "source_range_serializer",
        message:
          "Source-range serializer applied targeted Markdown edits and preserved unrelated source bytes.",
        severity: "info"
      },
      ...editDiagnostics
    ],
    hash: hashContent(content),
    normalizations: resolvedEdits.map((edit) => `${edit.kind}:${edit.nodeId ?? "source-range"}`)
  };
}

type ResolvedMarkdownEdit = {
  readonly kind: MarkdownEditKind;
  readonly nodeId?: string;
  readonly replacement: string;
  readonly sourceRange: SourceRange;
};

function resolveMarkdownEdit(
  result: ParseResult,
  edit: MarkdownSourceEdit,
  index: number
): ResolvedMarkdownEdit {
  if (edit.kind === "replace-source-range") {
    if (!edit.sourceRange) {
      throw new Error(`Serializer edit ${index} is missing sourceRange.`);
    }
    return {
      kind: edit.kind,
      replacement: edit.replacement,
      sourceRange: edit.sourceRange
    };
  }

  if (!edit.nodeId) {
    throw new Error(`Serializer edit ${index} is missing nodeId.`);
  }
  const node = findNodeById(result.document.root, edit.nodeId);
  if (!node.sourceRange) {
    throw new Error(`Serializer edit ${index} targets node without source range: ${edit.nodeId}`);
  }

  if (edit.kind === "replace-code-fence-content") {
    return {
      kind: edit.kind,
      nodeId: edit.nodeId,
      replacement: replaceCodeFenceContent(result.snapshot.content, node.sourceRange, edit.replacement),
      sourceRange: node.sourceRange
    };
  }

  if (edit.kind === "replace-code-fence-language") {
    return {
      kind: edit.kind,
      nodeId: edit.nodeId,
      replacement: replaceCodeFenceLanguage(result.snapshot.content, node.sourceRange, edit.replacement),
      sourceRange: node.sourceRange
    };
  }

  return {
    kind: edit.kind,
    nodeId: edit.nodeId,
    replacement: edit.replacement,
    sourceRange: node.sourceRange
  };
}

function findNodeById(node: MomentariseNode, nodeId: string): MomentariseNode {
  const found = findNodeByIdOrNull(node, nodeId);
  if (!found) {
    throw new Error(`Could not find node for serializer edit: ${nodeId}`);
  }
  return found;
}

function findNodeByIdOrNull(node: MomentariseNode, nodeId: string): MomentariseNode | null {
  if (node.id === nodeId) {
    return node;
  }
  if (node.kind === "opaque") {
    return null;
  }
  for (const child of node.children ?? []) {
    const found = findNodeByIdOrNull(child, nodeId);
    if (found) {
      return found;
    }
  }
  return null;
}

function replaceCodeFenceContent(source: string, sourceRange: SourceRange, replacement: string): string {
  const raw = source.slice(sourceRange.start.offset, sourceRange.end.offset);
  const firstLineEnding = firstLineEndingIn(raw);
  const closingLineStart = lastLineStartOffset(raw);
  if (!firstLineEnding || closingLineStart <= firstLineEnding.endOffset) {
    throw new Error("Cannot replace code fence content because fence boundaries were not found.");
  }
  const openingLine = raw.slice(0, firstLineEnding.endOffset);
  const closingLine = raw.slice(closingLineStart);
  const contentLineEnding = raw.slice(closingLineStart - firstLineEnding.value.length, closingLineStart);
  const preservedLineEnding = contentLineEnding === "\r\n" || contentLineEnding === "\n"
    ? contentLineEnding
    : firstLineEnding.value;
  return `${openingLine}${withoutOneTrailingLineEnding(replacement)}${preservedLineEnding}${closingLine}`;
}

function replaceCodeFenceLanguage(source: string, sourceRange: SourceRange, replacement: string): string {
  const raw = source.slice(sourceRange.start.offset, sourceRange.end.offset);
  const firstLineEnding = firstLineEndingIn(raw);
  if (!firstLineEnding) {
    throw new Error("Cannot replace code fence language because opening fence was not found.");
  }
  const openingLine = raw.slice(0, firstLineEnding.startOffset);
  const openingMatch = openingLine.match(/^([`~]{3,})(\s*)(\S*)?(.*)$/);
  if (!openingMatch) {
    throw new Error("Cannot replace code fence language on a non-fenced code block.");
  }
  const fence = openingMatch[1]!;
  const spacing = openingMatch[2] ?? "";
  const metadata = openingMatch[4] ?? "";
  return `${fence}${spacing}${replacement}${metadata}${raw.slice(firstLineEnding.startOffset)}`;
}

function withoutOneTrailingLineEnding(value: string): string {
  return value.replace(/\r?\n$/, "");
}

function firstLineEndingIn(value: string): { readonly startOffset: number; readonly endOffset: number; readonly value: string } | null {
  const newlineOffset = value.indexOf("\n");
  if (newlineOffset < 0) {
    return null;
  }
  if (newlineOffset > 0 && value[newlineOffset - 1] === "\r") {
    return {
      endOffset: newlineOffset + 1,
      startOffset: newlineOffset - 1,
      value: "\r\n"
    };
  }
  return {
    endOffset: newlineOffset + 1,
    startOffset: newlineOffset,
    value: "\n"
  };
}

function lastLineStartOffset(value: string): number {
  const lastNewlineOffset = value.lastIndexOf("\n");
  if (lastNewlineOffset < 0) {
    return 0;
  }
  return lastNewlineOffset + 1;
}

function assertNoOverlappingEdits(edits: readonly ResolvedMarkdownEdit[]): void {
  for (let index = 1; index < edits.length; index += 1) {
    const previous = edits[index - 1]!;
    const current = edits[index]!;
    if (current.sourceRange.start.offset < previous.sourceRange.end.offset) {
      throw new Error(
        `Serializer edits overlap: ${previous.kind} ending at ${previous.sourceRange.end.offset}, ` +
          `${current.kind} starting at ${current.sourceRange.start.offset}.`
      );
    }
  }
}

function createParseResult(
  source: string,
  hash: DocumentHash,
  options: ParseOptions,
  root: KnownNode,
  diagnostics: readonly Diagnostic[],
  frontmatter: { readonly raw: string; readonly record: FrontmatterRecord } | null
): ParseResult {
  return {
    diagnostics,
    document: {
      diagnostics,
      dialect: options.dialect,
      root,
      ...(frontmatter ? { frontmatter: frontmatter.record } : {})
    },
    snapshot: {
      content: source,
      dialect: options.dialect,
      hash,
      path: options.path ?? null,
      ...(frontmatter ? { frontmatter: frontmatter.record } : {})
    }
  };
}

function mapMdastNode(node: MdastLikeNode, source: string, id: string): MomentariseNode {
  const reason = opaqueReasonForMdastNode(node);
  if (reason) {
    return opaqueNodeFromMdastNode(node, source, reason, id);
  }

  const children = (node.children ?? []).map((child, index) => mapMdastNode(child, source, `${id}-${index}`));
  const sourceRange = rangeFromMdastPosition(node.position);
  const attributes = attributesForMdastNode(node);
  return {
    ...(attributes ? { attributes } : {}),
    ...(children.length > 0 ? { children } : {}),
    ...(sourceRange ? { sourceRange } : {}),
    id,
    kind: kindForMdastType(node.type),
    type: typeForMdastType(node.type)
  };
}

function attributesForMdastNode(node: MdastLikeNode): NodeAttributes | null {
  const attributes: Record<string, string | number | boolean | null> = {};

  if (node.type === "heading" && typeof node.depth === "number") {
    attributes.depth = node.depth;
  }
  if (node.type === "list" && typeof node.ordered === "boolean") {
    attributes.ordered = node.ordered;
    if (typeof node.start === "number") {
      attributes.start = node.start;
    }
  }
  if (node.type === "listItem" && typeof node.checked === "boolean") {
    attributes.checked = node.checked;
  }
  if (node.type === "code") {
    attributes.value = node.value ?? "";
    if (node.lang) {
      attributes.language = node.lang;
    }
    if (node.meta) {
      attributes.meta = node.meta;
    }
  }
  if (node.type === "inlineCode" || node.type === "text") {
    attributes.value = node.value ?? "";
  }
  if (node.type === "link") {
    attributes.url = node.url ?? "";
    if (node.title) {
      attributes.title = node.title;
    }
  }
  if (node.type === "image") {
    attributes.url = node.url ?? "";
    attributes.alt = node.alt ?? "";
    if (node.title) {
      attributes.title = node.title;
    }
  }

  return Object.keys(attributes).length > 0 ? attributes : null;
}

function opaqueReasonForMdastNode(node: MdastLikeNode): string | null {
  if (node.type === "html") {
    return "raw HTML";
  }
  if (node.type === "code" && node.lang?.toLowerCase() === "mermaid") {
    return "Mermaid fenced block";
  }
  return null;
}

function opaqueNodeFromMdastNode(
  node: MdastLikeNode,
  source: string,
  reason: string,
  id: string
): OpaqueNode {
  const sourceRange = rangeFromMdastPosition(node.position);
  if (sourceRange) {
    return {
      id,
      kind: "opaque",
      preservation: "preserve-raw",
      raw: source.slice(sourceRange.start.offset, sourceRange.end.offset),
      reason,
      sourceRange,
      type: "opaque"
    };
  }

  const raw = node.value ?? "";
  const start = raw ? source.indexOf(raw) : 0;
  return opaqueNodeFromRaw(source, start >= 0 ? start : 0, start >= 0 ? start + raw.length : raw.length, reason, 0);
}

function opaqueNodeFromRaw(
  source: string,
  startOffset: number,
  endOffset: number,
  reason: string,
  index: number
): OpaqueNode {
  const raw = source.slice(startOffset, endOffset);
  return {
    id: `opaque-${index}`,
    kind: "opaque",
    preservation: "preserve-raw",
    raw,
    reason,
    sourceRange: rangeFor(source, startOffset, endOffset),
    type: "opaque"
  };
}

function kindForMdastType(type: string): KnownNode["kind"] {
  if (
    type === "break" ||
    type === "delete" ||
    type === "emphasis" ||
    type === "inlineCode" ||
    type === "link" ||
    type === "strong" ||
    type === "text"
  ) {
    return "inline";
  }
  return "block";
}

function typeForMdastType(type: string): string {
  const typeMap: Record<string, string> = {
    blockquote: "blockquote",
    break: "lineBreak",
    code: "codeFence",
    definition: "definition",
    delete: "strikethrough",
    emphasis: "emphasis",
    footnoteDefinition: "footnoteDefinition",
    heading: "heading",
    image: "image",
    inlineCode: "inlineCode",
    link: "link",
    list: "list",
    listItem: "listItem",
    paragraph: "paragraph",
    root: "document",
    strong: "strong",
    table: "table",
    tableCell: "tableCell",
    tableRow: "tableRow",
    text: "text",
    thematicBreak: "thematicBreak",
    yaml: "yamlFrontmatter"
  };
  return typeMap[type] ?? type;
}

function rangeFromMdastPosition(position: MdastLikeNode["position"]): SourceRange | null {
  if (
    typeof position?.start.offset !== "number" ||
    typeof position.end.offset !== "number" ||
    position.start.offset < 0 ||
    position.end.offset < position.start.offset
  ) {
    return null;
  }
  return {
    end: {
      column: position.end.column,
      line: position.end.line,
      offset: position.end.offset
    },
    start: {
      column: position.start.column,
      line: position.start.line,
      offset: position.start.offset
    }
  };
}

function collectOpaqueNodesFromList(nodes: readonly MomentariseNode[]): readonly OpaqueNode[] {
  return nodes.flatMap((node) => collectOpaqueNodes(node));
}

export function runFixtureRoundTrip(options: RunFixtureRoundTripOptions): RoundTripHarnessResult {
  const formatter = options.formatter ?? createIdentityMarkdownFormatter();
  const dialect = options.dialect ?? defaultDialect;
  const results = options.fixtures.map((fixture) => {
    const parseResult = formatter.parse(fixture.input, {
      dialect,
      path: `fixture://${fixture.fixtureId}/input.md` as DocumentPath
    });
    const serializeResult = formatter.serialize(parseResult, {
      dialect,
      preserveUnchangedRanges: true
    });
    const output = serializeResult.content;
    const preservedOpaqueNodes = collectOpaqueNodes(parseResult.document.root);
    const mode = fixture.mode ?? chooseRoundTripMode(fixture.input, preservedOpaqueNodes);
    const frontmatterPreserved = frontmatterBlock(fixture.input) === frontmatterBlock(output);
    const htmlPreserved = htmlFragments(fixture.input).every((fragment) => output.includes(fragment));
    const contentMatches =
      mode === "strict"
        ? output === fixture.input
        : normalizeMarkdown(output) === normalizeMarkdown(fixture.input);
    const opaqueRequirementMet = mode !== "opaque-preservation" || preservedOpaqueNodes.length > 0;
    const status: RoundTripStatus =
      contentMatches && frontmatterPreserved && htmlPreserved && opaqueRequirementMet ? "pass" : "fail";

    return {
      diagnostics: [...parseResult.diagnostics, ...serializeResult.diagnostics],
      diff: status === "pass" ? "" : createReadableDiff(fixture.input, output),
      fixtureId: fixture.fixtureId,
      frontmatterPreserved,
      htmlPreserved,
      inputHash: parseResult.snapshot.hash,
      mode,
      outputHash: serializeResult.hash,
      preservedOpaqueNodes,
      status
    };
  });
  const passed = results.filter((result) => result.status === "pass").length;
  return {
    results,
    summary: {
      failed: results.length - passed,
      modes: Array.from(new Set(results.map((result) => result.mode))).sort(),
      passed,
      total: results.length
    }
  };
}

export function roundTripMarkdown(
  input: string,
  options: {
    readonly fixtureId?: string;
    readonly formatter?: MarkdownFormatter;
    readonly mode?: RoundTripMode;
  } = {}
): FixtureRoundTripResult {
  return runFixtureRoundTrip({
    fixtures: [
      options.mode
        ? {
            fixtureId: options.fixtureId ?? "memory-document",
            input,
            mode: options.mode
          }
        : {
            fixtureId: options.fixtureId ?? "memory-document",
            input
          }
    ],
    ...(options.formatter ? { formatter: options.formatter } : {})
  }).results[0]!;
}

function chooseRoundTripMode(input: string, opaqueNodes: readonly OpaqueNode[]): RoundTripMode {
  if (opaqueNodes.length > 0) {
    return "opaque-preservation";
  }
  if (frontmatterBlock(input) || /\|.+\|/.test(input)) {
    return "semantic";
  }
  return "strict";
}

function collectOpaqueNodes(node: MomentariseNode): readonly OpaqueNode[] {
  if (node.kind === "opaque") {
    return [node];
  }
  return (node.children ?? []).flatMap((child) => collectOpaqueNodes(child));
}

function parseFrontmatter(source: string): { readonly raw: string; readonly record: FrontmatterRecord } | null {
  const raw = frontmatterBlock(source);
  if (!raw) {
    return null;
  }
  const file = new VFile({
    value: source
  });
  matter(file, {
    strip: false
  });
  const record = toFrontmatterRecord(file.data.matter);
  if (!record) {
    return null;
  }
  return {
    raw,
    record
  };
}

function toFrontmatterRecord(value: unknown): FrontmatterRecord | null {
  if (!isRecord(value)) {
    return null;
  }
  const record: Record<string, FrontmatterValue> = {};
  for (const [key, item] of Object.entries(value)) {
    const frontmatterValue = toFrontmatterValue(item);
    if (frontmatterValue !== undefined) {
      record[key] = frontmatterValue;
    }
  }
  return record;
}

function toFrontmatterValue(value: unknown): FrontmatterValue | undefined {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((item) => toFrontmatterValue(item) ?? String(item));
  }
  if (isRecord(value)) {
    const record: Record<string, FrontmatterValue> = {};
    for (const [key, item] of Object.entries(value)) {
      const frontmatterValue = toFrontmatterValue(item);
      if (frontmatterValue !== undefined) {
        record[key] = frontmatterValue;
      }
    }
    return record;
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function frontmatterBlock(source: string): string {
  const match = source.match(/^---\n[\s\S]*?\n---\n/);
  return match?.[0] ?? "";
}

function htmlFragments(source: string): readonly string[] {
  return [
    ...source.matchAll(/<([A-Za-z][A-Za-z0-9-]*)(?:\s[^>]*)?>[\s\S]*?<\/\1>/g),
    ...source.matchAll(/<([A-Za-z][A-Za-z0-9-]*)(?:\s[^>]*)?\/>/g)
  ].map((match) => match[0]);
}

function detectOpaqueNodes(source: string): readonly OpaqueNode[] {
  const patterns: Array<{ readonly pattern: RegExp; readonly reason: string }> = [
    {
      pattern: /^> \[![A-Z]+][^\n]*(?:\n>.*)*/gm,
      reason: "Obsidian callout"
    },
    {
      pattern: /\[\[[^\]]+]]/g,
      reason: "wikilink"
    },
    {
      pattern: /```(?:mermaid)[\s\S]*?```/g,
      reason: "Mermaid fenced block"
    },
    {
      pattern: /\$\$[\s\S]*?\$\$|\$[^$\n]+\$/g,
      reason: "LaTeX math"
    },
    {
      pattern: /<([A-Za-z][A-Za-z0-9-]*)(?:\s[^>]*)?>[\s\S]*?<\/\1>/g,
      reason: "raw HTML"
    },
    {
      pattern: /:::[^\n]*(?:\n[\s\S]*?)?\n:::|{%\s*([A-Za-z][\w-]*)\b[\s\S]*?%}[\s\S]*?{%\s*end\1\s*%}|{%[\s\S]*?%}/g,
      reason: "unknown extension syntax"
    }
  ];
  const nodes: OpaqueNode[] = [];
  let index = 0;
  for (const { pattern, reason } of patterns) {
    for (const match of source.matchAll(pattern)) {
      const raw = match[0];
      const offset = match.index ?? 0;
      nodes.push({
        id: `opaque-${index}`,
        kind: "opaque",
        preservation: "preserve-raw",
        raw,
        reason,
        sourceRange: rangeFor(source, offset, offset + raw.length),
        type: "opaque"
      });
      index += 1;
    }
  }
  return nodes.sort((first, second) => first.sourceRange.start.offset - second.sourceRange.start.offset);
}

function rangeFor(source: string, startOffset: number, endOffset: number): SourceRange {
  return {
    end: positionFor(source, endOffset),
    start: positionFor(source, startOffset)
  };
}

function positionFor(source: string, offset: number): SourcePosition {
  const prefix = source.slice(0, offset);
  const lines = prefix.split("\n");
  return {
    column: lines[lines.length - 1]!.length + 1,
    line: lines.length,
    offset
  };
}

function normalizeMarkdown(source: string): string {
  return source.replace(/\r\n/g, "\n").replace(/[ \t]+$/gm, "").trimEnd() + "\n";
}

function createReadableDiff(input: string, output: string): string {
  const inputLines = input.split("\n");
  const outputLines = output.split("\n");
  const length = Math.max(inputLines.length, outputLines.length);
  for (let index = 0; index < length; index += 1) {
    if (inputLines[index] !== outputLines[index]) {
      return [
        `First difference at line ${index + 1}:`,
        `- ${inputLines[index] ?? "<missing>"}`,
        `+ ${outputLines[index] ?? "<missing>"}`
      ].join("\n");
    }
  }
  return "Content differs but no line-level difference was found.";
}

function hashContent(content: string): DocumentHash {
  let hash = 2166136261;
  for (let index = 0; index < content.length; index += 1) {
    hash ^= content.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, "0")}` as DocumentHash;
}

export type {
  Diagnostic,
  DocumentDialect,
  DocumentHash,
  DocumentPath,
  DocumentSnapshot,
  FrontmatterRecord,
  MomentariseDocument,
  MomentariseNode,
  NodeAttributes,
  OpaqueNode,
  ParseOptions,
  ParseResult,
  RoundTripResult,
  SerializeOptions,
  SerializeResult,
  SourceRange
} from "@momentarise/md-core";
