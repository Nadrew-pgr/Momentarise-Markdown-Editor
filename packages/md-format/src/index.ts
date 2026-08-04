import {
  hashMarkdownContent,
  nodeId,
  type Diagnostic,
  type DocumentHash,
  type DocumentPath,
  type FrontmatterRecord,
  type FrontmatterValue,
  type KnownNode,
  type MomentariseNode,
  type NodeAttributeValue,
  type NodeAttributes,
  type OpaqueNode,
  type ParseOptions,
  type ParseResult,
  type SerializeOptions,
  type SerializeResult,
  type SourcePosition,
  type SourceRange
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
  readonly identifier?: string | null;
  readonly label?: string | null;
  readonly align?: readonly ("center" | "left" | "right" | null)[];
};

export function createMarkdownAstParser(): MarkdownParser {
  const processor = unified().use(remarkParse).use(remarkFrontmatter, ["yaml"]).use(remarkGfm);

  return {
    parse(source: string, options: ParseOptions): ParseResult {
      const hash = hashMarkdownContent(source);
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
          id: nodeId("root"),
          kind: "root",
          type: "document"
        };
        return createParseResult(source, hash, options, root, diagnostics, frontmatter);
      }

      const mappedChildren = (ast.children ?? []).map((child, index) =>
        mapMdastNode(child, source, `ast-${index}`)
      );
      const supportedTableRanges = collectSourceRangesByType(mappedChildren, "table");
      const footnoteDefinitionRanges = collectSourceRangesByType(mappedChildren, "footnoteDefinition");
      const footnoteDefinitions = collectFootnoteDefinitionMarkers(source);
      const detectedOpaqueNodes = [
        ...detectOpaqueNodes(source),
        ...detectUnsupportedTableLikeNodes(source, supportedTableRanges, footnoteDefinitionRanges),
        ...detectUnsupportedFootnoteLikeNodes(source, footnoteDefinitions)
      ].sort((first, second) => first.sourceRange.start.offset - second.sourceRange.start.offset);
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
      diagnostics.push(...createFootnoteDiagnostics(source, footnoteDefinitions, children));

      const root: KnownNode = {
        children,
        id: nodeId("root"),
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
        hash: hashMarkdownContent(content),
        normalizations: []
      };
    }
  };
}

export function createIdentityMarkdownFormatter(): MarkdownFormatter {
  return {
    parse(source: string, options: ParseOptions): ParseResult {
      const hash = hashMarkdownContent(source);
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
        id: nodeId("root"),
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
        hash: hashMarkdownContent(content),
        normalizations: []
      };
    }
  };
}

export function serializeMomentariseDocument(
  result: ParseResult,
  _options?: SerializeOptions
): SerializeResult {
  const source = result.snapshot.content;
  const rootChildren = result.document.root.children ?? [];
  const frontmatterSource = leadingFrontmatterSourceFromNodes(rootChildren, source);
  const body = serializeMomentariseNodeList(
    rootChildren.filter((node) => node.type !== "yaml" && node.type !== "yamlFrontmatter"),
    source,
    0
  ).trimEnd();
  const content = frontmatterSource
    ? body
      ? `${frontmatterSource}\n\n${body}\n`
      : `${frontmatterSource}\n`
    : body
      ? `${body}\n`
      : "";

  return {
    content,
    diagnostics: [
      {
        code: "momentarise_model_serializer",
        message: "Serialized Momentarise document model nodes to Markdown.",
        severity: "info"
      }
    ],
    hash: hashMarkdownContent(content),
    normalizations: []
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
    hash: hashMarkdownContent(content),
    normalizations: resolvedEdits.map((edit) => `${edit.kind}:${edit.nodeId ?? "source-range"}`)
  };
}

function leadingFrontmatterSourceFromNodes(
  nodes: readonly MomentariseNode[],
  source: string
): string | null {
  const frontmatter = nodes.find(
    (node) => (node.type === "yaml" || node.type === "yamlFrontmatter") && Boolean(node.sourceRange)
  );
  return frontmatter?.sourceRange ? source.slice(frontmatter.sourceRange.start.offset, frontmatter.sourceRange.end.offset) : null;
}

function serializeMomentariseNodeList(
  nodes: readonly MomentariseNode[],
  source: string,
  indentLevel: number
): string {
  let previousNode: MomentariseNode | null = null;
  let content = "";
  for (const node of nodes) {
    const part = serializeMomentariseBlock(node, source, indentLevel);
    if (part.length === 0) {
      continue;
    }
    if (content.length === 0) {
      content = part;
    } else {
      content += `${previousNode && areAdjacentListItems(previousNode, node) ? "\n" : "\n\n"}${part}`;
    }
    previousNode = node;
  }
  return content.replace(/\n{3,}/g, "\n\n");
}

function areAdjacentListItems(first: MomentariseNode, second: MomentariseNode): boolean {
  return first.kind !== "opaque" && second.kind !== "opaque" && first.type === "listItem" && second.type === "listItem";
}

function serializeMomentariseBlock(
  node: MomentariseNode,
  source: string,
  indentLevel: number
): string {
  if (node.kind === "opaque") {
    return node.raw.trimEnd();
  }

  switch (node.type) {
    case "heading": {
      const marker = "#".repeat(numberAttribute(node.attributes?.depth) ?? 1);
      return serializeInlineOwningBlock(node, source, "heading", (mode) =>
        `${marker} ${serializeMomentariseInlineList(node.children ?? [], source, mode, false)}`.trimEnd()
      );
    }
    case "paragraph":
      return serializeInlineOwningBlock(node, source, "paragraph", (mode) =>
        serializeMomentariseInlineList(node.children ?? [], source, mode, true)
      );
    case "blockquote":
      return serializeMomentariseNodeList(node.children ?? [], source, indentLevel)
        .split("\n")
        .map((line) => (line.trim() ? `> ${line}` : ">"))
        .join("\n");
    case "code":
    case "codeFence": {
      const language = stringAttribute(node.attributes?.language) ?? "";
      const meta = stringAttribute(node.attributes?.meta);
      const info = [language, meta].filter(Boolean).join(" ");
      const value = stringAttribute(node.attributes?.value) ?? rawFromRange(node, source);
      return `\`\`\`${info}\n${withoutOneTrailingLineEnding(value)}\n\`\`\``;
    }
    case "rawMarkdown":
    case "unsupported":
      return (stringAttribute(node.attributes?.raw) ?? rawFromRange(node, source)).trimEnd();
    case "list":
      return serializeMomentariseList(node, source, indentLevel);
    case "listItem":
      return serializeMomentariseListItem(node, source, indentLevel, markerForMomentariseListItem(node, false, 1));
    case "table":
      return serializeMomentariseTable(node, source);
    case "footnoteDefinition":
      return node.sourceRange
        ? rawFromRange(node, source).trimEnd()
        : serializeMomentariseFootnoteDefinition(node, source, indentLevel);
    case "thematicBreak":
      return "---";
    default:
      return rawFromRange(node, source).trimEnd();
  }
}

function serializeMomentariseFootnoteDefinition(
  node: KnownNode,
  source: string,
  indentLevel: number
): string {
  const identifier =
    stringAttribute(node.attributes?.label) ?? stringAttribute(node.attributes?.identifier);
  if (!identifier || !isSafeFootnoteIdentifier(identifier)) {
    return rawFromRange(node, source).trimEnd();
  }
  const prefixCandidate = stringAttribute(node.attributes?.prefix);
  const prefixMatch = prefixCandidate?.match(/^[ \t]{0,3}\[\^([^\]\r\n]+)\]:[ \t]*$/);
  const prefix = prefixMatch?.[1] === identifier && prefixCandidate ? prefixCandidate : `[^${identifier}]: `;
  const body = (node.children ?? [])
    .map((child) => serializeMomentariseBlock(child, source, indentLevel))
    .join("\n\n")
    .replace(/\r?\n/g, "\n    ");
  return `${prefix}${body}`.trimEnd();
}

type TableAlignment = "center" | "left" | "right" | null;

function serializeMomentariseTable(node: KnownNode, source: string): string {
  const rows = (node.children ?? []).filter(
    (child): child is KnownNode => child.kind !== "opaque" && child.type === "tableRow"
  );
  const width = rows.reduce((maximum, row) => Math.max(maximum, tableCells(row).length), 0);
  if (rows.length === 0 || width === 0) {
    return rawFromRange(node, source).trimEnd();
  }

  const renderedRows = rows.map((row) => serializeMomentariseTableRow(row, source, width));
  const delimiter = `| ${Array.from({ length: width }, (_, index) =>
    tableDelimiterForAlignment(tableAlignment(node, index))
  ).join(" | ")} |`;
  return [renderedRows[0]!, delimiter, ...renderedRows.slice(1)].join("\n");
}

function serializeMomentariseTableRow(node: KnownNode, source: string, width: number): string {
  const cells = tableCells(node);
  return `| ${Array.from({ length: width }, (_, index) =>
    cells[index] ? serializeMomentariseTableCell(cells[index]!, source) : ""
  ).join(" | ")} |`;
}

function tableCells(node: KnownNode): KnownNode[] {
  return (node.children ?? []).filter(
    (child): child is KnownNode => child.kind !== "opaque" && child.type === "tableCell"
  );
}

function serializeMomentariseTableCell(node: KnownNode, source: string): string {
  const value = (node.children ?? [])
    .map((child) => serializeMomentariseInline(child, source))
    .join("")
    .replace(/\r?\n/g, " ")
    .trim();
  return value.replace(/\|/g, "\\|");
}

function tableAlignment(node: KnownNode, index: number): TableAlignment {
  const alignments = node.attributes?.align;
  if (!Array.isArray(alignments)) {
    return null;
  }
  const alignment = alignments[index];
  return alignment === "center" || alignment === "left" || alignment === "right" ? alignment : null;
}

function tableDelimiterForAlignment(alignment: TableAlignment): string {
  switch (alignment) {
    case "center":
      return ":---:";
    case "left":
      return ":---";
    case "right":
      return "---:";
    default:
      return "---";
  }
}

function serializeMomentariseList(
  node: KnownNode,
  source: string,
  indentLevel: number
): string {
  const ordered = node.attributes?.ordered === true;
  let index = numberAttribute(node.attributes?.start) ?? 1;
  const lines: string[] = [];
  for (const child of node.children ?? []) {
    const marker = markerForMomentariseListItem(child, ordered, index);
    lines.push(serializeMomentariseListItem(child, source, indentLevel, marker));
    index += 1;
  }
  return lines.join("\n");
}

function markerForMomentariseListItem(
  node: MomentariseNode,
  ordered: boolean,
  index: number
): string {
  const checked = node.kind !== "opaque" ? booleanAttribute(node.attributes?.checked) : null;
  if (typeof checked !== "boolean") {
    return ordered ? `${index}.` : "-";
  }
  const checkbox = checked ? "[x]" : "[ ]";
  return ordered ? `${index}. ${checkbox}` : `- ${checkbox}`;
}

function serializeMomentariseListItem(
  node: MomentariseNode,
  source: string,
  indentLevel: number,
  marker: string
): string {
  if (node.kind === "opaque") {
    return node.raw.trimEnd();
  }
  const indentation = "  ".repeat(indentLevel);
  const childBlocks = node.children ?? [];
  const [first, ...rest] = childBlocks;
  const firstText = first ? serializeMomentariseBlock(first, source, indentLevel + 1) : "";
  const lines = [`${indentation}${marker} ${firstText}`.trimEnd()];
  for (const child of rest) {
    const childIsList = child.kind !== "opaque" && child.type === "list";
    const childIndentation = childIsList ? `${indentation}${" ".repeat(marker.length + 1)}` : `${indentation}  `;
    lines.push(
      serializeMomentariseBlock(child, source, childIsList ? 0 : indentLevel + 1)
        .split("\n")
        .map((line) => `${childIndentation}${line}`)
        .join("\n")
    );
  }
  return lines.join("\n");
}

function serializeMomentariseInlineList(
  nodes: readonly MomentariseNode[],
  source: string,
  escapeMode: InlineEscapeMode = "none",
  startsLine = false
): string {
  let atLineStart = startsLine;
  let content = "";
  for (const node of nodes) {
    content += serializeMomentariseInline(node, source, escapeMode, atLineStart);
    atLineStart = node.kind !== "opaque" && (node.type === "lineBreak" || node.type === "break");
  }
  return content;
}

function serializeMomentariseInline(
  node: MomentariseNode,
  source: string,
  escapeMode: InlineEscapeMode = "none",
  atLineStart = false
): string {
  if (node.kind === "opaque") {
    return node.raw;
  }
  switch (node.type) {
    case "text":
      return escapeInlineTextValue(
        stringAttribute(node.attributes?.value) ?? rawFromRange(node, source),
        escapeMode,
        atLineStart
      );
    case "inlineCode":
      return `\`${stringAttribute(node.attributes?.value) ?? rawFromRange(node, source)}\``;
    case "emphasis":
      return `*${serializeMomentariseInlineList(node.children ?? [], source, escapeMode)}*`;
    case "strong":
      return `**${serializeMomentariseInlineList(node.children ?? [], source, escapeMode)}**`;
    case "strikethrough":
      return `~~${serializeMomentariseInlineList(node.children ?? [], source, escapeMode)}~~`;
    case "lineBreak":
    case "break":
      return "  \n";
    case "link": {
      // `escapeMarkdownLabel` owns the bracket/backslash escaping inside a link
      // label; threading the text escaper through it would escape its escapes.
      const text = serializeMomentariseInlineList(node.children ?? [], source);
      const url = stringAttribute(node.attributes?.url) ?? "";
      const title = stringAttribute(node.attributes?.title);
      return title ? `[${escapeMarkdownLabel(text)}](${url} "${escapeMarkdownTitle(title)}")` : `[${escapeMarkdownLabel(text)}](${url})`;
    }
    case "image": {
      const alt = stringAttribute(node.attributes?.alt) ?? "";
      const url = stringAttribute(node.attributes?.url) ?? "";
      const title = stringAttribute(node.attributes?.title);
      return title ? `![${escapeMarkdownLabel(alt)}](${url} "${escapeMarkdownTitle(title)}")` : `![${escapeMarkdownLabel(alt)}](${url})`;
    }
    case "footnoteReference": {
      const raw = stringAttribute(node.attributes?.raw);
      if (raw) {
        return raw;
      }
      const identifier =
        stringAttribute(node.attributes?.label) ?? stringAttribute(node.attributes?.identifier);
      return identifier && isSafeFootnoteIdentifier(identifier) ? `[^${identifier}]` : "";
    }
    default:
      return node.children
        ? serializeMomentariseInlineList(node.children, source, escapeMode, atLineStart)
        : rawFromRange(node, source);
  }
}

/*
 * MME-0120 — literal Markdown in a paragraph must survive a save.
 *
 * A rich-mode edit reaches this serializer as model nodes with no source range,
 * so its inline text was emitted verbatim. Measured at `e11b8e8`: a paragraph
 * whose text is `# ` serialized as `#` and re-opened as an EMPTY HEADING; `3. `
 * re-opened as an empty ordered list; `**bold**` came back bold, reversing the
 * user's undo. Silent, user-visible data loss.
 *
 * The escaping is decided by measurement, not by a table of "unsafe" patterns:
 * the block is serialized, re-parsed, and compared against the model it came
 * from. Text that re-parses correctly is emitted byte-for-byte as before — so
 * minimality is a property of the algorithm, not a promise about a pattern
 * list. Only text proven to re-parse as something else is escaped, and the
 * escape is verified the same way before it is returned.
 */

type InlineEscapeMode = "none" | "targeted" | "aggressive";

function serializeInlineOwningBlock(
  node: KnownNode,
  source: string,
  expectedType: "heading" | "paragraph",
  render: (mode: InlineEscapeMode) => string
): string {
  const children = node.children ?? [];
  const verbatim = render("none");
  /*
   * Fast path: a parsed block whose naive rendering reproduces its own source
   * bytes exactly. Re-parsing the author's own bytes yields the author's own
   * block, so there is nothing to verify — and this is every untouched
   * paragraph of every parsed file. The presence of a range is NOT enough:
   * the bytes must match, or an in-place edit of a parsed model (value changed,
   * range kept) would ship unverified. Measured cost of verifying anyway: the
   * 390KB corpus fixture went 33ms -> 2805ms, one parse per block.
   */
  if (
    node.sourceRange &&
    verbatim === source.slice(node.sourceRange.start.offset, node.sourceRange.end.offset)
  ) {
    return verbatim;
  }
  if (reparsesAs(verbatim, expectedType, children)) {
    return verbatim;
  }
  for (const mode of ["targeted", "aggressive"] as const) {
    const escaped = render(mode);
    if (escaped !== verbatim && reparsesAs(escaped, expectedType, children)) {
      return escaped;
    }
  }
  /*
   * Nothing verified. The shapes that reach here are unreachable by escaping,
   * measured on the corpus after the footnote-definition synthesis below: a
   * block indented by four or more spaces (an indented code block, and a space
   * has no escape), a multi-line setext heading (no ATX heading can hold a
   * newline), a paragraph whose reference cannot be synthesized, and a bare
   * GFM autolink literal (remark-gfm claims it even fully escaped). Returning
   * the escaped bytes would add backslashes to the user's file without fixing
   * anything, so the original bytes are returned and the defect stays exactly
   * as it was. Each class is recorded in BACKLOG.md.
   */
  return verbatim;
}

function escapeInlineTextValue(value: string, mode: InlineEscapeMode, atLineStart: boolean): string {
  if (mode === "none" || value.length === 0) {
    return value;
  }
  // A text node carries its own soft line breaks (measured on
  // `021-large-performance`), and a block marker interrupts a paragraph at any
  // line start, not only the first.
  return value
    .split("\n")
    .map((line, index) => {
      if (mode === "aggressive") {
        return escapeEveryAsciiPunctuation(line);
      }
      const withLiteralBackslashes = escapeLiteralBackslashes(line);
      const withBlockMarker =
        atLineStart || index > 0
          ? escapeLineStartBlockMarker(withLiteralBackslashes)
          : withLiteralBackslashes;
      return escapeSpuriousInlineConstructs(withBlockMarker);
    })
    .join("\n");
}

/*
 * A backslash is only meaningful before ASCII punctuation, so only those are
 * doubled. This runs before every other escape: doubling afterwards would eat
 * the backslashes the other passes just inserted.
 */
function escapeLiteralBackslashes(line: string): string {
  return line.replace(/\\(?=[!-/:-@[-`{-~])/g, "\\\\");
}

function escapeEveryAsciiPunctuation(line: string): string {
  return line.replace(/[!-/:-@[-`{-~]/g, (character) => `\\${character}`);
}

/*
 * Every CommonMark construct that can start or interrupt a paragraph. The
 * ordered-list case escapes the delimiter rather than the digits, because a
 * digit cannot carry a backslash escape: `3\.` not `\3.`.
 */
function escapeLineStartBlockMarker(line: string): string {
  const indent = /^[ \t]{0,3}/.exec(line)?.[0] ?? "";
  const rest = line.slice(indent.length);
  const ordered = /^([0-9]{1,9})[.)](?:[ \t]|$)/.exec(rest);
  if (ordered) {
    return `${indent}${ordered[1]!}\\${rest.slice(ordered[1]!.length)}`;
  }
  const escapesFirstCharacter =
    /^#{1,6}(?:[ \t]|$)/.test(rest) ||
    rest.startsWith(">") ||
    /^(?:`{3,}|~{3,})/.test(rest) ||
    /^(?:\*[ \t]*){3,}$/.test(rest) ||
    /^(?:-[ \t]*){3,}$/.test(rest) ||
    /^(?:_[ \t]*){3,}$/.test(rest) ||
    /^[-+*](?:[ \t]|$)/.test(rest) ||
    /^(?:=+|-+)[ \t]*$/.test(rest);
  return escapesFirstCharacter ? `${indent}\\${rest}` : line;
}

/*
 * Escape the opening delimiter of every inline construct the line produces,
 * then look again: neutralising `**` in `**bold**` exposes the `*bold*` the
 * remaining run forms, and the next pass escapes that. Three passes settle the
 * measured cases (`**a *b* c**` still escalates at a cap of two — measured by
 * the reviewer with caps 1/2/3/8); the cap of eight only bounds pathological
 * input.
 */
function escapeSpuriousInlineConstructs(line: string): string {
  let current = line;
  for (let pass = 0; pass < 8; pass += 1) {
    const offsets = inlineConstructStartOffsets(current);
    if (offsets.length === 0) {
      return current;
    }
    // Insert from the end so the earlier offsets stay valid.
    for (const offset of [...offsets].sort((first, second) => second - first)) {
      current = `${current.slice(0, offset)}\\${current.slice(offset)}`;
    }
  }
  return current;
}

function inlineConstructStartOffsets(line: string): readonly number[] {
  const blocks = verificationBlocks(line);
  const first = blocks[0];
  if (!first || first.kind === "opaque" || first.type !== "paragraph") {
    // Not a paragraph: a block-level marker survived, and that is the line-start
    // escaper's job, not this one's.
    return [];
  }
  const offsets: number[] = [];
  for (const child of first.children ?? []) {
    if (child.kind === "opaque" || child.type === "text" || !child.sourceRange) {
      continue;
    }
    offsets.push(child.sourceRange.start.offset);
  }
  return offsets;
}

function reparsesAs(
  text: string,
  expectedType: string,
  expectedChildren: readonly MomentariseNode[]
): boolean {
  /*
   * `[^ref]` is a footnote reference only when its definition is in the same
   * document, so verifying the block in isolation would report every reference
   * as plain text and no footnote paragraph could ever verify. Measured at the
   * first GREEN of this issue: 340 of the corpus's 341 "nothing verified"
   * decisions were exactly this, and a colliding `a**bold**[^a]` shipped
   * verbatim — the reviewer's blocker. Synthesize a definition per identifier
   * the model expects, then drop those synthetic blocks before comparing.
   */
  const identifiers = verificationFootnoteIdentifiers(expectedChildren);
  const suffix = identifiers.map((identifier) => `\n\n[^${identifier}]: mme-verification`).join("");
  const blocks = verificationBlocks(`${text}${suffix}`).filter(
    (block) =>
      !(
        identifiers.length > 0 &&
        block.kind !== "opaque" &&
        block.type === "footnoteDefinition" &&
        identifiers.includes(
          normalizeVerificationIdentifier(
            stringAttribute(block.attributes?.identifier) ?? stringAttribute(block.attributes?.label) ?? ""
          )
        )
      )
  );
  const first = blocks[0];
  if (blocks.length !== 1 || !first || first.kind === "opaque" || first.type !== expectedType) {
    return false;
  }
  return inlineShapeSignature(first.children) === inlineShapeSignature(expectedChildren);
}

function verificationFootnoteIdentifiers(nodes: readonly MomentariseNode[] | undefined): readonly string[] {
  const identifiers = new Set<string>();
  const walk = (list: readonly MomentariseNode[] | undefined): void => {
    for (const node of list ?? []) {
      if (node.kind !== "opaque" && node.type === "footnoteReference") {
        const identifier =
          stringAttribute(node.attributes?.identifier) ?? stringAttribute(node.attributes?.label);
        if (identifier && isSafeFootnoteIdentifier(identifier)) {
          identifiers.add(normalizeVerificationIdentifier(identifier));
        }
      }
      if (node.kind !== "opaque") {
        walk(node.children);
      }
    }
  };
  walk(nodes);
  return [...identifiers];
}

function normalizeVerificationIdentifier(identifier: string): string {
  // GFM footnote identifiers match case-insensitively.
  return identifier.toLowerCase();
}

/*
 * The parser reports detected opaque spans (wikilinks, inline HTML, LaTeX) as
 * extra root children beside the block that contains them, so a single block
 * legitimately parses to more than one root node. Those are dropped here: they
 * describe the same bytes the block already carries.
 */
function verificationBlocks(text: string): readonly MomentariseNode[] {
  return (verificationParser().parse(text, { dialect: verificationDialect }).document.root.children ?? []).filter(
    (node) => node.kind !== "opaque"
  );
}

const verificationDialect = "gfm-plus" as ParseOptions["dialect"];
let cachedVerificationParser: MarkdownParser | null = null;

function verificationParser(): MarkdownParser {
  cachedVerificationParser ??= createMarkdownAstParser();
  return cachedVerificationParser;
}

/*
 * Structure and text, not identifiers: two shapes are the same when the same
 * inline node types carry the same text in the same order. Adjacent text nodes
 * are merged because the parser splits them at escapes, and trailing spaces are
 * dropped from the final text because Markdown cannot represent them at the end
 * of a block — the same normalization the parser itself applies.
 */
function inlineShapeSignature(nodes: readonly MomentariseNode[] | undefined): string {
  const tokens: string[] = [];
  for (const node of nodes ?? []) {
    if (node.kind === "opaque") {
      tokens.push(`opaque:${node.raw}`);
      continue;
    }
    if (node.type === "text") {
      const value = stringAttribute(node.attributes?.value) ?? "";
      const previous = tokens[tokens.length - 1];
      if (previous?.startsWith("text:")) {
        tokens[tokens.length - 1] = `${previous}${value}`;
        continue;
      }
      tokens.push(`text:${value}`);
      continue;
    }
    // `value` carries inline code; the identifier distinguishes `[^a]` from
    // `[^b]`, which are otherwise identical `footnoteReference()` tokens.
    const value =
      stringAttribute(node.attributes?.value) ??
      (node.type === "footnoteReference"
        ? normalizeVerificationIdentifier(
            stringAttribute(node.attributes?.identifier) ?? stringAttribute(node.attributes?.label) ?? ""
          )
        : null);
    tokens.push(
      `${node.type}${value === null ? "" : `=${value}`}(${inlineShapeSignature(node.children)})`
    );
  }
  const last = tokens[tokens.length - 1];
  if (last?.startsWith("text:")) {
    tokens[tokens.length - 1] = last.replace(/[ \t]+$/, "");
  }
  const first = tokens[0];
  if (first?.startsWith("text:")) {
    tokens[0] = first.replace(/^text:[ \t]+/, "text:");
  }
  return tokens.join("");
}

function isSafeFootnoteIdentifier(value: string): boolean {
  return value.trim().length > 0 && !/[\[\]\r\n]/.test(value);
}

function rawFromRange(node: MomentariseNode, source: string): string {
  if (node.kind === "opaque") {
    return node.raw;
  }
  return node.sourceRange ? source.slice(node.sourceRange.start.offset, node.sourceRange.end.offset) : "";
}

function stringAttribute(value: NodeAttributeValue | undefined): string | null {
  return typeof value === "string" ? value : null;
}

function escapeMarkdownLabel(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\[/g, "\\[").replace(/\]/g, "\\]").replace(/\r?\n/g, " ");
}

function escapeMarkdownTitle(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r?\n/g, " ");
}

function numberAttribute(value: NodeAttributeValue | undefined): number | null {
  return typeof value === "number" ? value : null;
}

function booleanAttribute(value: NodeAttributeValue | undefined): boolean | null {
  return typeof value === "boolean" ? value : null;
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
    id: nodeId(id),
    kind: kindForMdastType(node.type),
    type: typeForMdastType(node.type)
  };
}

function attributesForMdastNode(node: MdastLikeNode): NodeAttributes | null {
  const attributes: Record<string, NodeAttributeValue> = {};

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
  if (node.type === "footnoteReference" || node.type === "footnoteDefinition") {
    if (node.identifier) {
      attributes.identifier = node.identifier;
    }
    if (node.label) {
      attributes.label = node.label;
    }
  }
  if (node.type === "table" && Array.isArray(node.align)) {
    attributes.align = node.align.map((alignment) => alignment ?? null);
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
      id: nodeId(id),
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
    id: nodeId(`opaque-${index}`),
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
    type === "footnoteReference" ||
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
    footnoteReference: "footnoteReference",
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

function collectSourceRangesByType(nodes: readonly MomentariseNode[], type: string): readonly SourceRange[] {
  return nodes.flatMap((node) => {
    const self = node.type === type && node.sourceRange ? [node.sourceRange] : [];
    return node.kind === "opaque" ? self : [...self, ...collectSourceRangesByType(node.children ?? [], type)];
  });
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
  const patterns: Array<{ readonly ignoreInsideFences: boolean; readonly pattern: RegExp; readonly reason: string }> = [
    {
      ignoreInsideFences: true,
      pattern: /^> \[![A-Z]+][^\n]*(?:\n>.*)*/gm,
      reason: "Obsidian callout"
    },
    {
      ignoreInsideFences: true,
      pattern: /\[\[[^\]]+]]/g,
      reason: "wikilink"
    },
    {
      // The fence itself is the construct, so this pattern must keep matching fenced regions.
      ignoreInsideFences: false,
      pattern: /```(?:mermaid)[\s\S]*?```/g,
      reason: "Mermaid fenced block"
    },
    {
      // Inline math must not match currency amounts such as "$5 and $10":
      // the opening $ may not be followed by whitespace, a digit, or another $,
      // and the closing $ must follow a non-space character.
      ignoreInsideFences: true,
      pattern: /\$\$[\s\S]*?\$\$|\$(?![\s\d$])[^$\n]*?(?<=\S)\$/g,
      reason: "LaTeX math"
    },
    {
      ignoreInsideFences: true,
      pattern: /<([A-Za-z][A-Za-z0-9-]*)(?:\s[^>]*)?>[\s\S]*?<\/\1>/g,
      reason: "raw HTML"
    },
    {
      ignoreInsideFences: true,
      pattern: /:::[^\n]*(?:\n[\s\S]*?)?\n:::|{%\s*([A-Za-z][\w-]*)\b[\s\S]*?%}[\s\S]*?{%\s*end\1\s*%}|{%[\s\S]*?%}/g,
      reason: "unknown extension syntax"
    }
  ];
  const fencedRegions = fencedCodeRegions(source);
  const nodes: OpaqueNode[] = [];
  let index = 0;
  for (const { ignoreInsideFences, pattern, reason } of patterns) {
    for (const match of source.matchAll(pattern)) {
      const raw = match[0];
      const offset = match.index ?? 0;
      if (ignoreInsideFences && isInsideFencedRegion(fencedRegions, offset)) {
        continue;
      }
      nodes.push({
        id: nodeId(`opaque-${index}`),
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

function detectUnsupportedTableLikeNodes(
  source: string,
  supportedTableRanges: readonly SourceRange[],
  footnoteDefinitionRanges: readonly SourceRange[]
): readonly OpaqueNode[] {
  const fencedRegions = fencedCodeRegions(source);
  const lines = sourceLines(source);
  const nodes: OpaqueNode[] = [];
  let index = 0;
  let cursor = 0;

  while (cursor < lines.length) {
    const start = cursor;
    while (cursor < lines.length && isTableLikeLine(lines[cursor]!.text) && !isInsideFencedRegion(fencedRegions, lines[cursor]!.start)) {
      cursor += 1;
    }

    const runLength = cursor - start;
    if (runLength >= 2) {
      const first = lines[start]!;
      const last = lines[cursor - 1]!;
      const contentEnd = last.start + last.text.replace(/\r$/, "").length;
      const enclosedByFootnote = footnoteDefinitionRanges.some(
        (range) => range.start.offset <= first.start && range.end.offset >= contentEnd
      );
      if (
        !enclosedByFootnote &&
        !supportedTableRanges.some((range) => sourceRangeOverlapsOffsets(range, first.start, last.end))
      ) {
        nodes.push(opaqueNodeFromRaw(source, first.start, last.end, "unsupported table-like syntax", index));
        index += 1;
      }
    }

    if (runLength === 0) {
      cursor = start + 1;
    }
  }

  return nodes;
}

interface FootnoteDefinitionMarker {
  readonly identifier: string;
  readonly normalizedIdentifier: string;
  readonly sourceRange: SourceRange;
}

interface FootnoteReferenceMarker {
  readonly identifier: string;
  readonly normalizedIdentifier: string;
  readonly sourceRange: SourceRange;
}

interface MalformedFootnoteLikeLine {
  readonly identifier: string | null;
  readonly normalizedIdentifier: string | null;
  readonly sourceRange: SourceRange;
}

function collectFootnoteDefinitionMarkers(source: string): readonly FootnoteDefinitionMarker[] {
  const fencedRegions = fencedCodeRegions(source);
  const definitions: FootnoteDefinitionMarker[] = [];
  for (const line of sourceLines(source)) {
    if (isInsideFencedRegion(fencedRegions, line.start)) {
      continue;
    }
    const match = line.text.match(/^ {0,3}\[\^([^\]\n]+)]:/);
    if (!match) {
      continue;
    }
    const identifier = match[1]!;
    definitions.push({
      identifier,
      normalizedIdentifier: normalizeFootnoteIdentifier(identifier),
      sourceRange: rangeFor(source, line.start, line.end)
    });
  }
  return definitions;
}

function detectUnsupportedFootnoteLikeNodes(
  source: string,
  definitions: readonly FootnoteDefinitionMarker[]
): readonly OpaqueNode[] {
  const definitionIds = new Set(definitions.map((definition) => definition.normalizedIdentifier));
  return collectMalformedFootnoteLikeLines(source, definitionIds).map((line, index) =>
    opaqueNodeFromRaw(
      source,
      line.sourceRange.start.offset,
      line.sourceRange.end.offset,
      "unsupported footnote-like syntax",
      index
    )
  );
}

function createFootnoteDiagnostics(
  source: string,
  definitions: readonly FootnoteDefinitionMarker[],
  nodes: readonly MomentariseNode[]
): readonly Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const definitionsById = new Map<string, FootnoteDefinitionMarker[]>();
  for (const definition of definitions) {
    const entries = definitionsById.get(definition.normalizedIdentifier) ?? [];
    entries.push(definition);
    definitionsById.set(definition.normalizedIdentifier, entries);
  }

  for (const entries of definitionsById.values()) {
    if (entries.length < 2) {
      continue;
    }
    for (const duplicate of entries.slice(1)) {
      diagnostics.push({
        code: "footnote_definition_duplicate",
        message: `Duplicate footnote definition preserved as source fallback: ${duplicate.identifier}.`,
        severity: "warning",
        sourceRange: duplicate.sourceRange
      });
    }
  }

  const definitionIds = new Set(definitionsById.keys());
  const malformedLines = collectMalformedFootnoteLikeLines(source, definitionIds);
  for (const malformed of malformedLines) {
    diagnostics.push({
      code: "footnote_definition_malformed",
      message: "Footnote-like syntax is missing a definition colon and was preserved as raw Markdown.",
      severity: "warning",
      sourceRange: malformed.sourceRange
    });
  }

  const malformedRanges = malformedLines.map((line) => line.sourceRange);
  for (const reference of collectFootnoteReferenceMarkersFromNodes(nodes, source)) {
    if (malformedRanges.some((range) => sourceRangeOverlapsOffsets(range, reference.sourceRange.start.offset, reference.sourceRange.end.offset))) {
      continue;
    }
    if (!definitionIds.has(reference.normalizedIdentifier)) {
      diagnostics.push({
        code: "footnote_reference_missing_definition",
        message: `Footnote reference has no matching definition and was preserved as Markdown text: ${reference.identifier}.`,
        severity: "warning",
        sourceRange: reference.sourceRange
      });
    }
  }

  return diagnostics;
}

function collectFootnoteReferenceMarkersFromNodes(
  nodes: readonly MomentariseNode[],
  source: string
): readonly FootnoteReferenceMarker[] {
  return nodes.flatMap((node) => collectFootnoteReferenceMarkersFromNode(node, source));
}

function collectFootnoteReferenceMarkersFromNode(
  node: MomentariseNode,
  source: string
): readonly FootnoteReferenceMarker[] {
  if (node.kind === "opaque") {
    return [];
  }
  const childReferences = (node.children ?? []).flatMap((child) =>
    collectFootnoteReferenceMarkersFromNode(child, source)
  );
  if (node.type === "footnoteReference" && node.sourceRange) {
    const identifier =
      stringAttribute(node.attributes?.identifier) ??
      stringAttribute(node.attributes?.label) ??
      source.slice(node.sourceRange.start.offset + 2, Math.max(node.sourceRange.start.offset + 2, node.sourceRange.end.offset - 1));
    return [
      ...childReferences,
      {
        identifier,
        normalizedIdentifier: normalizeFootnoteIdentifier(identifier),
        sourceRange: node.sourceRange
      }
    ];
  }
  if (node.type !== "text" || !node.sourceRange) {
    return childReferences;
  }
  const raw = source.slice(node.sourceRange.start.offset, node.sourceRange.end.offset);
  const markers: FootnoteReferenceMarker[] = [];
  for (const match of raw.matchAll(/\[\^([^\]\n]+)]/g)) {
    const relativeOffset = match.index ?? 0;
    const startOffset = node.sourceRange.start.offset + relativeOffset;
    const identifier = match[1]!;
    markers.push({
      identifier,
      normalizedIdentifier: normalizeFootnoteIdentifier(identifier),
      sourceRange: rangeFor(source, startOffset, startOffset + match[0].length)
    });
  }
  return [...childReferences, ...markers];
}

function collectMalformedFootnoteLikeLines(
  source: string,
  definitionIds: ReadonlySet<string>
): readonly MalformedFootnoteLikeLine[] {
  const fencedRegions = fencedCodeRegions(source);
  const lines: MalformedFootnoteLikeLine[] = [];
  for (const line of sourceLines(source)) {
    if (isInsideFencedRegion(fencedRegions, line.start)) {
      continue;
    }
    const closedMarker = line.text.match(/^ {0,3}\[\^([^\]\n]+)](?!:)(?=\s+\S)/);
    if (closedMarker) {
      const identifier = closedMarker[1]!;
      const normalizedIdentifier = normalizeFootnoteIdentifier(identifier);
      if (!definitionIds.has(normalizedIdentifier)) {
        lines.push({
          identifier,
          normalizedIdentifier,
          sourceRange: rangeFor(source, line.start, line.end)
        });
      }
      continue;
    }
    const unclosedMarker = line.text.match(/^ {0,3}\[\^([^\]\n]*)$/);
    if (unclosedMarker) {
      const identifier = unclosedMarker[1] || null;
      lines.push({
        identifier,
        normalizedIdentifier: identifier ? normalizeFootnoteIdentifier(identifier) : null,
        sourceRange: rangeFor(source, line.start, line.end)
      });
    }
  }
  return lines;
}

function normalizeFootnoteIdentifier(identifier: string): string {
  return identifier.trim().replace(/\s+/g, " ").toLowerCase();
}

function sourceLines(source: string): ReadonlyArray<{ readonly end: number; readonly start: number; readonly text: string }> {
  const lines: Array<{ readonly end: number; readonly start: number; readonly text: string }> = [];
  let offset = 0;
  const parts = source.split("\n");
  for (let index = 0; index < parts.length; index += 1) {
    const text = parts[index]!;
    const hasLineEnding = index < parts.length - 1;
    const end = offset + text.length + (hasLineEnding ? 1 : 0);
    lines.push({
      end,
      start: offset,
      text
    });
    offset = end;
  }
  return lines;
}

function isTableLikeLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.slice(1).includes("|");
}

function sourceRangeOverlapsOffsets(range: SourceRange, startOffset: number, endOffset: number): boolean {
  return range.start.offset < endOffset && range.end.offset > startOffset;
}

function fencedCodeRegions(source: string): ReadonlyArray<readonly [number, number]> {
  const regions: Array<readonly [number, number]> = [];
  let offset = 0;
  let open: { readonly fenceChar: string; readonly fenceLength: number; readonly start: number } | null = null;
  for (const line of source.split("\n")) {
    const lineStart = offset;
    offset += line.length + 1;
    if (!open) {
      const opening = line.match(/^ {0,3}(`{3,}|~{3,})/);
      if (opening) {
        open = {
          fenceChar: opening[1]![0]!,
          fenceLength: opening[1]!.length,
          start: lineStart
        };
      }
      continue;
    }
    const closing = line.match(/^ {0,3}(`{3,}|~{3,})\s*$/);
    if (closing && closing[1]![0] === open.fenceChar && closing[1]!.length >= open.fenceLength) {
      regions.push([open.start, Math.min(offset, source.length)]);
      open = null;
    }
  }
  if (open) {
    regions.push([open.start, source.length]);
  }
  return regions;
}

function isInsideFencedRegion(
  regions: ReadonlyArray<readonly [number, number]>,
  offset: number
): boolean {
  return regions.some(([start, end]) => offset > start && offset < end);
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
