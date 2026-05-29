import type {
  Diagnostic,
  DocumentHash,
  DocumentPath,
  FrontmatterRecord,
  KnownNode,
  MomentariseNode,
  OpaqueNode,
  ParseOptions,
  ParseResult,
  SerializeOptions,
  SerializeResult,
  SourcePosition,
  SourceRange
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

const defaultDialect: ParseOptions["dialect"] = "momentarise-enhanced";

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
  const record: Record<string, string | readonly string[]> = {};
  const lines = raw.split("\n").slice(1, -1);
  let currentListKey: string | null = null;
  for (const line of lines) {
    const keyValue = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (keyValue) {
      const key = keyValue[1]!;
      const value = keyValue[2]!;
      currentListKey = value ? null : key;
      record[key] = value;
      continue;
    }

    const listItem = line.match(/^\s+-\s+(.+)$/);
    if (listItem && currentListKey) {
      const existing = record[currentListKey];
      record[currentListKey] = [...(Array.isArray(existing) ? existing : []), listItem[1]!];
    }
  }
  return {
    raw,
    record
  };
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
      pattern: /:::[\s\S]*?:::|{%[\s\S]*?%}/g,
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
  OpaqueNode,
  ParseOptions,
  ParseResult,
  RoundTripResult,
  SerializeOptions,
  SerializeResult,
  SourceRange
} from "@momentarise/md-core";
