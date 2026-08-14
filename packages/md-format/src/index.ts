import {
  hashMarkdownContent,
  isMomentariseLineBreakNode,
  MOMENTARISE_LINE_BREAK_TYPE,
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
    atLineStart = isMomentariseLineBreakNode(node);
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
  // Ahead of the switch: a `case` label can only spell the type name, and
  // spelling it is what MME-0123 forbids. The shared predicate owns it.
  if (isMomentariseLineBreakNode(node)) {
    return "  \n";
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
    break: MOMENTARISE_LINE_BREAK_TYPE,
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

/* ===========================================================================
 * MME-0090 — positional YAML frontmatter model.
 *
 * Lives in this file rather than its own module because the docs site resolves
 * `@momentarise/md-format` straight to `src/index.ts` through the workspace
 * `paths` mapping, and Turbopack does not apply TypeScript's `.js` -> `.ts`
 * import rewriting: a `./frontmatter.js` specifier failed the docs-site build
 * with "Module not found" while `tsc` and every other consumer were happy.
 *
 * This exists so the Properties panel can edit frontmatter *without a YAML round
 * trip*. Parsing the block with a YAML library and re-dumping it is the obvious
 * implementation and it is forbidden here: it silently reorders keys, drops
 * comments, expands anchors, renormalises every quote, and rewrites bytes the
 * user never touched. AGENT.md calls that "full-document normalization presented
 * as preservation", and it is the single most expensive defect class this
 * project has.
 *
 * So every operation below is a *splice*: a byte range taken from the block's
 * own text plus a replacement string. Bytes outside that range are never seen,
 * let alone rewritten. A value the scanner does not fully understand — a nested
 * map, a block scalar, an anchor, an alias, a tag, a value carrying a trailing
 * comment — is not edited at all. It is reported as read-only with a reason, and
 * the panel points the writer at Source mode.
 *
 * The scanner deliberately understands a *subset* of YAML. Everything outside
 * that subset must fall into the read-only bucket rather than be guessed at,
 * because a wrong guess here writes to the user's file.
 * ======================================================================== */

export type FrontmatterPropertyType = "checkbox" | "date" | "datetime" | "list" | "number" | "text";

export type FrontmatterPropertyValue = string | number | boolean | readonly string[] | null;

export type FrontmatterReadOnlyReason =
  | "anchor-or-tag"
  | "block-scalar"
  | "inline-comment"
  | "nested-map"
  | "unsupported-value";

export type FrontmatterRefusalCode =
  | "complex-value"
  | "duplicate-key"
  | "frontmatter-exists"
  | "invalid-key"
  | "no-frontmatter"
  | "unknown-property";

export interface TextSpan {
  readonly from: number;
  readonly to: number;
}

export interface FrontmatterPropertyEntry {
  /** False when the value must be edited in Source mode instead. */
  readonly editable: boolean;
  /** The whole property, first line through the last line's terminator. Removal splices this. */
  readonly entryRange: TextSpan;
  readonly index: number;
  readonly key: string;
  readonly keyRange: TextSpan;
  /** Everything after the colon, exactly as authored. */
  readonly rawValue: string;
  readonly reason: FrontmatterReadOnlyReason | null;
  readonly type: FrontmatterPropertyType;
  readonly value: FrontmatterPropertyValue;
  /** From just after the colon to the end of the property's last line. Value edits splice this. */
  readonly valueRange: TextSpan;
}

export interface FrontmatterBlockModel {
  readonly blockRange: TextSpan;
  readonly entries: readonly FrontmatterPropertyEntry[];
  readonly lineEnding: string;
  readonly listIndent: string;
  /**
   * True when the block contains a line the scanner refused to interpret. The
   * whole block is then read-only: a partial understanding of a YAML block is
   * exactly how an edit lands on the wrong bytes.
   */
  readonly partial: boolean;
  readonly raw: string;
}

export interface FrontmatterRefusal {
  readonly code: FrontmatterRefusalCode;
  readonly message: string;
}

export interface FrontmatterSplice extends TextSpan {
  readonly replacement: string;
}

export interface FrontmatterEditResult {
  /** The source with the splice applied, or the original source when refused. */
  readonly content: string;
  readonly refusal: FrontmatterRefusal | null;
  readonly splice: FrontmatterSplice | null;
}

export interface AddFrontmatterPropertyOptions {
  readonly key: string;
  readonly type?: FrontmatterPropertyType;
  readonly value?: FrontmatterPropertyValue;
}

interface SourceLine {
  readonly end: number;
  readonly next: number;
  readonly start: number;
  readonly terminator: string;
  readonly text: string;
}

const DEFAULT_LIST_INDENT = "  ";

const NUMBER_PATTERN = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/;
const BOOLEAN_PATTERN = /^(?:true|false)$/;
/*
 * YAML 1.1 reads all of these back as booleans or null. They are not classified
 * as the `checkbox` type — that stays `true`/`false`, which is what this project
 * writes — but a TEXT value equal to one of them must be quoted, or the property
 * silently stops being text. `NaN`/`Infinity` share the shape via the number path.
 */
const YAML_RESERVED_SCALAR_PATTERN = /^(?:~|null|Null|NULL|yes|Yes|YES|no|No|NO|on|On|ON|off|Off|OFF|y|Y|n|N|true|True|TRUE|false|False|FALSE|\.nan|\.NaN|\.NAN|\.inf|\.Inf|\.INF|[-+]\.inf|[-+]\.Inf|[-+]\.INF|NaN|Infinity|-Infinity)$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATETIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/;
// The first character class excludes `-` so that a top-level YAML *sequence*
// (`- a: 1`) is not read as a mapping entry keyed `- a`; renaming that "key"
// destroyed the sequence and left a block that no longer parses.
const PLAIN_KEY_PATTERN = /^([^-:#\s][^:]*?)[ \t]*:(.*)$/;
const QUOTED_KEY_PATTERN = /^(["'])((?:\\.|(?!\1).)*)\1[ \t]*:(.*)$/;
const OPENING_DELIMITER_PATTERN = /^---[ \t]*$/;
/*
 * `---` only. `...` is a YAML document-end marker, but remark-frontmatter does
 * NOT accept it as a closing fence — so a document like "---\ntitle: x\n...\n"
 * has NO frontmatter as far as the parser is concerned, and those bytes belong
 * to the rich view's own doc, not to this block. Accepting `...` here made the
 * panel render over body content and let a splice through the rebase guard whose
 * whole job is to refuse body splices; the next rich serialization then silently
 * reverted the writer's edit. Measured by the MME-0090 architecture reviewer.
 */
const CLOSING_DELIMITER_PATTERN = /^---[ \t]*$/;
const LIST_ITEM_PATTERN = /^([ \t]+)-[ \t]+(.*)$/;
const COMMENT_OR_BLANK_PATTERN = /^[ \t]*(?:#.*)?$/;

/* -------------------------------------------------------------- line scanning */

function splitLines(source: string, from: number, to: number): readonly SourceLine[] {
  const lines: SourceLine[] = [];
  let cursor = from;
  while (cursor < to) {
    const newlineIndex = source.indexOf("\n", cursor);
    const hasNewline = newlineIndex !== -1 && newlineIndex < to;
    const next = hasNewline ? newlineIndex + 1 : to;
    const end = hasNewline && source[newlineIndex - 1] === "\r" ? newlineIndex - 1 : hasNewline ? newlineIndex : to;
    lines.push({
      end,
      next,
      start: cursor,
      terminator: source.slice(end, next),
      text: source.slice(cursor, end)
    });
    cursor = next;
  }
  return lines;
}

function documentLineEnding(source: string): string {
  return source.includes("\r\n") ? "\r\n" : "\n";
}

/* ------------------------------------------------------------ value analysis */

function isCalendarDate(year: string, month: string, day: string): boolean {
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return (
    date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() === Number(month) - 1 &&
    date.getUTCDate() === Number(day)
  );
}

function isClockTime(hour: string, minute: string, second: string | undefined): boolean {
  return Number(hour) < 24 && Number(minute) < 60 && (second === undefined || Number(second) < 60);
}

/**
 * The type a raw YAML scalar would parse back as. Used both to label a property
 * and — critically — to decide whether a *text* value needs quoting: writing
 * `42` into a text property without quotes silently changes its type.
 */
export function frontmatterPropertyTypeOfRawValue(raw: string): FrontmatterPropertyType {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return "text";
  }
  if (trimmed.startsWith('"') || trimmed.startsWith("'")) {
    return "text";
  }
  if (trimmed.startsWith("[")) {
    return "list";
  }
  if (NUMBER_PATTERN.test(trimmed)) {
    return "number";
  }
  if (BOOLEAN_PATTERN.test(trimmed)) {
    return "checkbox";
  }
  const dateMatch = DATE_PATTERN.exec(trimmed);
  if (dateMatch && isCalendarDate(dateMatch[1]!, dateMatch[2]!, dateMatch[3]!)) {
    return "date";
  }
  const dateTimeMatch = DATETIME_PATTERN.exec(trimmed);
  if (
    dateTimeMatch &&
    isCalendarDate(dateTimeMatch[1]!, dateTimeMatch[2]!, dateTimeMatch[3]!) &&
    isClockTime(dateTimeMatch[4]!, dateTimeMatch[5]!, dateTimeMatch[6])
  ) {
    /*
     * Only the shape `<input type="datetime-local">` can actually render.
     * A zone offset (`Z`, `+02:00`) or a space separator blanks that input
     * silently, so the writer sees an empty field for a value that exists and
     * committing it drops the offset. Those stay `text`, where they round-trip
     * verbatim.
     */
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(trimmed) ? "datetime" : "text";
  }
  return "text";
}

function unquoteScalar(trimmed: string): string {
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
    return trimmed.slice(1, -1).replace(/\\(["\\])/g, "$1");
  }
  if (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2) {
    return trimmed.slice(1, -1).replace(/''/g, "'");
  }
  return trimmed;
}

/*
 * A start/end character test is not enough: `title: "a" # "b"` starts and ends
 * with a quote while the quoted scalar is only `"a"`. Treating it as quoted
 * suppressed the trailing-comment check, displayed the wrong value, and let an
 * edit destroy the comment. The closing quote is found by scanning, and only
 * whitespace or a comment may follow it.
 */
function quoteCharacterOf(trimmed: string): '"' | "'" | null {
  const opener = trimmed[0];
  if (opener !== '"' && opener !== "'") {
    return null;
  }
  const closingIndex = closingQuoteIndex(trimmed, opener);
  if (closingIndex === -1) {
    return null;
  }
  return /^[ \t]*(?:#.*)?$/.test(trimmed.slice(closingIndex + 1)) ? opener : null;
}

/** Index of the quote that closes the scalar opened at position 0, or -1. */
function closingQuoteIndex(trimmed: string, opener: '"' | "'"): number {
  for (let index = 1; index < trimmed.length; index += 1) {
    const character = trimmed[index];
    if (opener === '"' && character === "\\") {
      index += 1;
      continue;
    }
    if (character !== opener) {
      continue;
    }
    if (opener === "'" && trimmed[index + 1] === "'") {
      index += 1;
      continue;
    }
    return index;
  }
  return -1;
}

/** A quote that opens on the line but never closes on it is beyond this scanner. */
function hasUnterminatedQuote(trimmed: string): boolean {
  const opener = trimmed[0];
  if (opener !== '"' && opener !== "'") {
    return false;
  }
  return quoteCharacterOf(trimmed) === null;
}

function splitFlowSequence(trimmed: string): readonly string[] | null {
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
    return null;
  }
  const inner = trimmed.slice(1, -1).trim();
  if (inner === "") {
    return [];
  }
  const items: string[] = [];
  let current = "";
  let quote: string | null = null;
  for (const character of inner) {
    if (quote) {
      if (character === quote) {
        quote = null;
      }
      current += character;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      current += character;
      continue;
    }
    if (character === "," ) {
      items.push(current.trim());
      current = "";
      continue;
    }
    if (character === "[" || character === "]" || character === "{" || character === "}") {
      // A nested collection: not a flat list of scalars.
      return null;
    }
    current += character;
  }
  if (quote) {
    return null;
  }
  items.push(current.trim());
  return items.map((item) => unquoteScalar(item));
}

/**
 * `title: Draft # not published` — the comment is authored bytes inside the
 * value range, so rewriting the value would delete it. Read-only instead.
 */
function hasTrailingComment(trimmed: string): boolean {
  const opener = trimmed[0];
  if (opener === '"' || opener === "'") {
    const closingIndex = closingQuoteIndex(trimmed, opener);
    return closingIndex !== -1 && /(?:^|[ \t])#/.test(trimmed.slice(closingIndex + 1));
  }
  return /(?:^|[ \t])#/.test(trimmed);
}

/* --------------------------------------------------------------- the scanner */

interface ScannedEntry {
  readonly editable: boolean;
  readonly entryEnd: number;
  readonly entryStart: number;
  readonly key: string;
  readonly keyRange: TextSpan;
  readonly listIndent: string | null;
  readonly rawValue: string;
  readonly reason: FrontmatterReadOnlyReason | null;
  readonly type: FrontmatterPropertyType;
  readonly value: FrontmatterPropertyValue;
  readonly valueRange: TextSpan;
}

function scanEntry(
  lines: readonly SourceLine[],
  startIndex: number
): { readonly consumed: number; readonly entry: ScannedEntry } | null {
  const line = lines[startIndex]!;
  const quotedKey = QUOTED_KEY_PATTERN.exec(line.text);
  const plainKey = quotedKey ? null : PLAIN_KEY_PATTERN.exec(line.text);
  if (!quotedKey && !plainKey) {
    return null;
  }
  const key = quotedKey ? quotedKey[2]! : plainKey![1]!;
  const rawValue = quotedKey ? quotedKey[3]! : plainKey![2]!;
  const keyOffsetInLine = quotedKey ? line.text.indexOf(key, 1) : line.text.indexOf(key);
  const keyRange = { from: line.start + keyOffsetInLine, to: line.start + keyOffsetInLine + key.length };
  const valueStart = line.end - rawValue.length;
  const trimmed = rawValue.trim();

  const complex = (
    reason: FrontmatterReadOnlyReason,
    consumed: number,
    lastLine: SourceLine
  ): { readonly consumed: number; readonly entry: ScannedEntry } => ({
    consumed,
    entry: {
      editable: false,
      entryEnd: lastLine.next,
      entryStart: line.start,
      key,
      keyRange,
      listIndent: null,
      rawValue,
      reason,
      type: "text",
      value: null,
      valueRange: { from: valueStart, to: lastLine.end }
    }
  });

  /* A value that continues onto indented lines below the key. */
  let lastFollowerIndex = startIndex;
  const followers: SourceLine[] = [];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const candidate = lines[index]!;
    if (candidate.text === "" || !/^[ \t]/.test(candidate.text)) {
      break;
    }
    followers.push(candidate);
    lastFollowerIndex = index;
  }
  const lastLine = lines[lastFollowerIndex]!;
  const consumed = lastFollowerIndex - startIndex + 1;

  if (trimmed.startsWith("|") || trimmed.startsWith(">")) {
    return complex("block-scalar", consumed, lastLine);
  }
  if (trimmed.startsWith("&") || trimmed.startsWith("*") || trimmed.startsWith("!")) {
    return complex("anchor-or-tag", consumed, lastLine);
  }
  if (trimmed.startsWith("{")) {
    return complex("nested-map", consumed, lastLine);
  }

  if (trimmed === "") {
    if (followers.length === 0) {
      return {
        consumed: 1,
        entry: {
          editable: true,
          entryEnd: line.next,
          entryStart: line.start,
          key,
          keyRange,
          listIndent: null,
          rawValue,
          reason: null,
          type: "text",
          value: "",
          valueRange: { from: valueStart, to: line.end }
        }
      };
    }
    const items: string[] = [];
    let indent: string | null = null;
    for (const follower of followers) {
      const itemMatch = LIST_ITEM_PATTERN.exec(follower.text);
      if (!itemMatch) {
        return complex(/:/.test(follower.text) ? "nested-map" : "unsupported-value", consumed, lastLine);
      }
      if (indent === null) {
        indent = itemMatch[1]!;
      } else if (itemMatch[1] !== indent) {
        return complex("nested-map", consumed, lastLine);
      }
      const itemText = itemMatch[2]!.trim();
      if (itemText === "" || itemText.endsWith(":") || hasUnterminatedQuote(itemText)) {
        return complex("nested-map", consumed, lastLine);
      }
      if (/^[-&*!|>[{]/.test(itemText) || (!quoteCharacterOf(itemText) && /:[ \t]/.test(itemText))) {
        return complex("nested-map", consumed, lastLine);
      }
      if (hasTrailingComment(itemText)) {
        return complex("inline-comment", consumed, lastLine);
      }
      items.push(unquoteScalar(itemText));
    }
    return {
      consumed,
      entry: {
        editable: true,
        entryEnd: lastLine.next,
        entryStart: line.start,
        key,
        keyRange,
        listIndent: indent,
        rawValue,
        reason: null,
        type: "list",
        value: items,
        valueRange: { from: valueStart, to: lastLine.end }
      }
    };
  }

  // A scalar with indented lines beneath it is a multi-line plain scalar: the
  // scanner does not fold those, so it does not edit them either.
  if (followers.length > 0) {
    return complex("unsupported-value", consumed, lastLine);
  }

  if (hasUnterminatedQuote(trimmed)) {
    return complex("unsupported-value", 1, line);
  }
  if (hasTrailingComment(trimmed)) {
    return complex("inline-comment", 1, line);
  }

  if (trimmed.startsWith("[")) {
    const items = splitFlowSequence(trimmed);
    if (!items) {
      return complex("unsupported-value", 1, line);
    }
    return {
      consumed: 1,
      entry: {
        editable: true,
        entryEnd: line.next,
        entryStart: line.start,
        key,
        keyRange,
        listIndent: null,
        rawValue,
        reason: null,
        type: "list",
        value: items,
        valueRange: { from: valueStart, to: line.end }
      }
    };
  }

  const type = frontmatterPropertyTypeOfRawValue(trimmed);
  const text = unquoteScalar(trimmed);
  const value: FrontmatterPropertyValue =
    type === "number" ? Number(trimmed) : type === "checkbox" ? trimmed === "true" : text;
  return {
    consumed: 1,
    entry: {
      editable: true,
      entryEnd: line.next,
      entryStart: line.start,
      key,
      keyRange,
      listIndent: null,
      rawValue,
      reason: null,
      type,
      value,
      valueRange: { from: valueStart, to: line.end }
    }
  };
}

export function readFrontmatterBlock(source: string): FrontmatterBlockModel | null {
  if (!source.startsWith("---")) {
    return null;
  }
  const allLines = splitLines(source, 0, source.length);
  const openingLine = allLines[0];
  if (!openingLine || !OPENING_DELIMITER_PATTERN.test(openingLine.text) || openingLine.terminator === "") {
    return null;
  }
  let closingIndex = -1;
  for (let index = 1; index < allLines.length; index += 1) {
    if (CLOSING_DELIMITER_PATTERN.test(allLines[index]!.text)) {
      closingIndex = index;
      break;
    }
  }
  if (closingIndex === -1) {
    return null;
  }
  const closingLine = allLines[closingIndex]!;
  const interior = allLines.slice(1, closingIndex);
  const lineEnding = openingLine.terminator;

  const entries: FrontmatterPropertyEntry[] = [];
  let listIndent: string | null = null;
  let partial = false;
  for (let index = 0; index < interior.length; ) {
    const line = interior[index]!;
    if (COMMENT_OR_BLANK_PATTERN.test(line.text)) {
      index += 1;
      continue;
    }
    const scanned = scanEntry(interior, index);
    if (!scanned) {
      partial = true;
      break;
    }
    const { consumed, entry } = scanned;
    if (listIndent === null && entry.listIndent !== null) {
      listIndent = entry.listIndent;
    }
    entries.push({
      editable: entry.editable,
      entryRange: { from: entry.entryStart, to: entry.entryEnd },
      index: entries.length,
      key: entry.key,
      keyRange: entry.keyRange,
      rawValue: entry.rawValue,
      reason: entry.reason,
      type: entry.type,
      value: entry.value,
      valueRange: entry.valueRange
    });
    index += consumed;
  }

  return {
    blockRange: { from: 0, to: closingLine.next },
    /*
     * A block the scanner could not read end to end is read-only in full. Half
     * an understanding of a YAML block is how a splice lands on the wrong bytes.
     */
    entries: partial ? [] : entries,
    lineEnding,
    listIndent: listIndent ?? DEFAULT_LIST_INDENT,
    partial,
    raw: source.slice(0, closingLine.next)
  };
}

/* ---------------------------------------------------------------- rendering */

function escapeDoubleQuoted(text: string): string {
  /*
   * `\n` and `\r` are escaped, not emitted literally: a real newline inside a
   * double-quoted scalar adds a LINE to the block, which shifts every offset
   * below it and folds back to a space on read. These are exported functions, so
   * a consumer reaches this long before the panel's single-line inputs could.
   */
  return text
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r");
}

function needsQuoting(text: string): boolean {
  if (text === "") {
    return false;
  }
  if (text !== text.trim()) {
    return true;
  }
  if (/[\r\n]/.test(text)) {
    return true;
  }
  if (/:(?:[ \t]|$)/.test(text) || /(?:^|[ \t])#/.test(text)) {
    return true;
  }
  if (/^[-?:,[\]{}#&*!|>'"%@`]/.test(text)) {
    return true;
  }
  if (YAML_RESERVED_SCALAR_PATTERN.test(text)) {
    return true;
  }
  // Anything that would parse back as another type has to be quoted, or the
  // property silently changes type on the next read.
  return frontmatterPropertyTypeOfRawValue(text) !== "text";
}

function renderScalar(value: string, type: FrontmatterPropertyType, preferredQuote: '"' | "'" | null): string {
  if (type === "number" || type === "checkbox") {
    return value;
  }
  if ((type === "date" || type === "datetime") && frontmatterPropertyTypeOfRawValue(value) === type) {
    return value;
  }
  if (preferredQuote === "'") {
    return `'${value.replace(/'/g, "''")}'`;
  }
  if (preferredQuote === '"' || needsQuoting(value)) {
    return `"${escapeDoubleQuoted(value)}"`;
  }
  return value;
}

interface RenderValueOptions {
  /** True when the value this replaces was authored as `[a, b]`. */
  readonly flowSequence?: boolean;
  readonly lineEnding: string;
  readonly listIndent: string;
  readonly preferredQuote: '"' | "'" | null;
}

/** Renders everything that follows the colon, leading space included. */
function renderValue(
  value: FrontmatterPropertyValue,
  type: FrontmatterPropertyType,
  options: RenderValueOptions
): string {
  if (type === "list") {
    const items = Array.isArray(value) ? (value as readonly string[]) : value === null || value === "" ? [] : [String(value)];
    if (items.length === 0) {
      return " []";
    }
    /*
     * A document that writes its lists as `[a, b]` keeps writing them that way:
     * the acceptance criterion is the document's own conventions, and silently
     * converting every flow sequence to block style on the first edit breaks it.
     */
    if (options.flowSequence) {
      return ` [${items.map((item) => renderScalar(String(item), "text", null)).join(", ")}]`;
    }
    return items
      .map((item) => `${options.lineEnding}${options.listIndent}- ${renderScalar(String(item), "text", null)}`)
      .join("");
  }
  if (value === null) {
    return " ";
  }
  if (typeof value === "boolean") {
    return ` ${value ? "true" : "false"}`;
  }
  if (typeof value === "number") {
    return ` ${String(value)}`;
  }
  const text = String(value);
  if (text === "") {
    return " ";
  }
  return ` ${renderScalar(text, type, options.preferredQuote)}`;
}

function coerceValue(
  value: FrontmatterPropertyValue,
  type: FrontmatterPropertyType
): FrontmatterPropertyValue {
  if (type === "list") {
    if (Array.isArray(value)) {
      return value;
    }
    const text = value === null ? "" : String(value);
    return text === "" ? [] : [text];
  }
  const text = Array.isArray(value)
    ? (value as readonly string[]).join(", ")
    : value === null
      ? ""
      : String(value);
  switch (type) {
    case "checkbox":
      return typeof value === "boolean" ? value : /^(?:true|yes|1)$/i.test(text.trim());
    case "number": {
      const parsed = Number(text.trim());
      return Number.isFinite(parsed) ? parsed : 0;
    }
    case "date": {
      const detected = frontmatterPropertyTypeOfRawValue(text.trim());
      if (detected === "date") {
        return text.trim();
      }
      if (detected === "datetime") {
        return text.trim().slice(0, 10);
      }
      return "";
    }
    case "datetime": {
      const detected = frontmatterPropertyTypeOfRawValue(text.trim());
      if (detected === "datetime") {
        return text.trim();
      }
      if (detected === "date") {
        return `${text.trim()}T00:00:00`;
      }
      return "";
    }
    default:
      return text;
  }
}

/* ------------------------------------------------------------- edit helpers */

function refuse(source: string, code: FrontmatterRefusalCode, message: string): FrontmatterEditResult {
  return { content: source, refusal: { code, message }, splice: null };
}

function applySplice(source: string, splice: FrontmatterSplice): FrontmatterEditResult {
  return {
    content: `${source.slice(0, splice.from)}${splice.replacement}${source.slice(splice.to)}`,
    refusal: null,
    splice
  };
}

interface ResolvedProperty {
  readonly entry: FrontmatterPropertyEntry;
  readonly model: FrontmatterBlockModel;
}

function resolveProperty(
  source: string,
  index: number
): ResolvedProperty | FrontmatterEditResult {
  const model = readFrontmatterBlock(source);
  if (!model) {
    return refuse(source, "no-frontmatter", "This document has no YAML frontmatter block.");
  }
  const entry = model.entries[index];
  if (!entry) {
    return refuse(source, "unknown-property", `No frontmatter property at index ${index}.`);
  }
  return { entry, model };
}

function isEditResult(value: ResolvedProperty | FrontmatterEditResult): value is FrontmatterEditResult {
  return "refusal" in value;
}

function refuseComplex(source: string, entry: FrontmatterPropertyEntry): FrontmatterEditResult {
  return refuse(
    source,
    "complex-value",
    `The value of "${entry.key}" (${entry.reason ?? "unsupported-value"}) cannot be edited safely here. Edit it in Source mode.`
  );
}

/*
 * Keys are spliced into the block as authored, so a key carrying a YAML
 * indicator changes what the block means — or destroys it. `a #b` starts a
 * comment that swallows the colon, and the whole frontmatter block stops
 * parsing, taking every other property with it. Measured by the MME-0090
 * architecture reviewer.
 */
const UNSAFE_KEY_START = /^[?:,[\]{}#&*!|>'"%@`]/;

function validateKey(
  source: string,
  model: FrontmatterBlockModel,
  key: string,
  selfIndex: number | null
): FrontmatterEditResult | null {
  const trimmed = key.trim();
  if (
    trimmed === "" ||
    /[:\r\n]/.test(trimmed) ||
    /(?:^|[ \t])#/.test(trimmed) ||
    trimmed.startsWith("-") ||
    UNSAFE_KEY_START.test(trimmed)
  ) {
    return refuse(source, "invalid-key", `"${key}" is not a usable property name.`);
  }
  const clash = model.entries.some((entry) => entry.key === trimmed && entry.index !== selfIndex);
  if (clash) {
    return refuse(source, "duplicate-key", `A property named "${trimmed}" already exists.`);
  }
  return null;
}

/* ------------------------------------------------------------------- edits */

export function setFrontmatterPropertyValue(
  source: string,
  index: number,
  value: FrontmatterPropertyValue
): FrontmatterEditResult {
  const resolved = resolveProperty(source, index);
  if (isEditResult(resolved)) {
    return resolved;
  }
  const { entry, model } = resolved;
  if (!entry.editable) {
    return refuseComplex(source, entry);
  }
  const type = typeForIncomingValue(value, entry.type);
  return applySplice(source, {
    from: entry.valueRange.from,
    replacement: renderValue(value, type, {
      flowSequence: entry.type === "list" && entry.rawValue.trim().startsWith("["),
      lineEnding: model.lineEnding,
      listIndent: entry.type === "list" ? listIndentOfEntry(source, entry, model) : model.listIndent,
      preferredQuote: quoteCharacterOf(entry.rawValue.trim())
    }),
    to: entry.valueRange.to
  });
}

/**
 * The JS type of the incoming value decides the YAML shape, except that a string
 * keeps a date/datetime/text property's own type — the panel's date input hands
 * back a string, and re-labelling it `text` would quote it.
 */
function typeForIncomingValue(
  value: FrontmatterPropertyValue,
  entryType: FrontmatterPropertyType
): FrontmatterPropertyType {
  if (Array.isArray(value)) {
    return "list";
  }
  if (typeof value === "boolean") {
    return "checkbox";
  }
  if (typeof value === "number") {
    return "number";
  }
  return entryType === "date" || entryType === "datetime" || entryType === "list" ? entryType : "text";
}

/** A list keeps the indentation its own items were written with. */
function listIndentOfEntry(
  source: string,
  entry: FrontmatterPropertyEntry,
  model: FrontmatterBlockModel
): string {
  const match = LIST_ITEM_PATTERN.exec(
    source.slice(entry.valueRange.from, entry.valueRange.to).split(/\r?\n/).find((line) => LIST_ITEM_PATTERN.test(line)) ?? ""
  );
  return match?.[1] ?? model.listIndent;
}

export function setFrontmatterPropertyType(
  source: string,
  index: number,
  type: FrontmatterPropertyType
): FrontmatterEditResult {
  const resolved = resolveProperty(source, index);
  if (isEditResult(resolved)) {
    return resolved;
  }
  const { entry, model } = resolved;
  if (!entry.editable) {
    return refuseComplex(source, entry);
  }
  return applySplice(source, {
    from: entry.valueRange.from,
    replacement: renderValue(coerceValue(entry.value, type), type, {
      lineEnding: model.lineEnding,
      listIndent: model.listIndent,
      /*
       * A type change still keeps the block's authoring conventions: a
       * single-quoted value stays single-quoted. Quoting that the *new* type
       * requires is added on top — `3` becoming text gains quotes because
       * `needsQuoting` demands them, not because the style was discarded.
       */
      preferredQuote: quoteCharacterOf(entry.rawValue.trim())
    }),
    to: entry.valueRange.to
  });
}

export function renameFrontmatterProperty(source: string, index: number, key: string): FrontmatterEditResult {
  const resolved = resolveProperty(source, index);
  if (isEditResult(resolved)) {
    return resolved;
  }
  const { entry, model } = resolved;
  const invalid = validateKey(source, model, key, entry.index);
  if (invalid) {
    return invalid;
  }
  return applySplice(source, {
    from: entry.keyRange.from,
    replacement: key.trim(),
    to: entry.keyRange.to
  });
}

export function addFrontmatterProperty(
  source: string,
  options: AddFrontmatterPropertyOptions
): FrontmatterEditResult {
  const model = readFrontmatterBlock(source);
  if (!model) {
    return refuse(source, "no-frontmatter", "This document has no YAML frontmatter block.");
  }
  /*
   * A partial block exposes no entries, so the duplicate check has nothing to
   * compare against and would happily write a second `title:`. A block the
   * scanner could not read end to end is read-only in full, additions included.
   */
  if (model.partial) {
    return refuse(source, "complex-value", "This frontmatter block contains syntax that cannot be edited here.");
  }
  const invalid = validateKey(source, model, options.key, null);
  if (invalid) {
    return invalid;
  }
  const type = options.type ?? typeForIncomingValue(options.value ?? "", "text");
  const value = options.value === undefined ? (type === "list" ? [] : "") : options.value;
  const rendered = renderValue(coerceValue(value, type), type, {
    lineEnding: model.lineEnding,
    listIndent: model.listIndent,
    preferredQuote: null
  });
  /*
   * The insertion point is the start of the closing delimiter's line, so the
   * new property lands after every existing one and the closing `---` is never
   * part of the splice.
   */
  const closingLineStart = closingDelimiterLineStart(source, model);
  return applySplice(source, {
    from: closingLineStart,
    replacement: `${options.key.trim()}:${rendered}${model.lineEnding}`,
    to: closingLineStart
  });
}

function closingDelimiterLineStart(source: string, model: FrontmatterBlockModel): number {
  const blockText = source.slice(model.blockRange.from, model.blockRange.to);
  const lines = splitLines(source, model.blockRange.from, model.blockRange.to);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (CLOSING_DELIMITER_PATTERN.test(lines[index]!.text)) {
      return lines[index]!.start;
    }
  }
  // Unreachable while `readFrontmatterBlock` requires a closing delimiter, but
  // returning the block end keeps the splice inside the block if that changes.
  return model.blockRange.from + blockText.length;
}

export function removeFrontmatterProperty(source: string, index: number): FrontmatterEditResult {
  const resolved = resolveProperty(source, index);
  if (isEditResult(resolved)) {
    return resolved;
  }
  const { entry } = resolved;
  return applySplice(source, {
    from: entry.entryRange.from,
    replacement: "",
    to: entry.entryRange.to
  });
}

export function createFrontmatterBlock(source: string): FrontmatterEditResult {
  if (readFrontmatterBlock(source)) {
    return refuse(source, "frontmatter-exists", "This document already has a frontmatter block.");
  }
  const lineEnding = documentLineEnding(source);
  const gap = source.length > 0 && !source.startsWith(lineEnding) ? lineEnding : "";
  return applySplice(source, {
    from: 0,
    replacement: `---${lineEnding}title: ${lineEnding}---${lineEnding}${gap}`,
    to: 0
  });
}
