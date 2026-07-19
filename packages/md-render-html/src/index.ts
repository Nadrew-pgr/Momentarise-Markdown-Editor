import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { VFile } from "vfile";

export interface MarkdownHtmlRendererContract {
  readonly packageName: "@momentarise/md-render-html";
  readonly renderKind: "markdown-html";
}

export interface RenderMarkdownToHtmlOptions {
  readonly fileName?: string;
}

export interface RenderMarkdownToHtmlResult {
  readonly diagnostics: readonly RenderHtmlDiagnostic[];
  readonly html: string;
}

export type RenderHtmlDiagnosticCode = "render_html_stripped" | "render_html_footnote_preserved";

export interface RenderHtmlDiagnostic {
  readonly code: RenderHtmlDiagnosticCode;
  readonly message: string;
  readonly postSanitizeAttributeCount?: number;
  readonly postSanitizeElementCount?: number;
  readonly preSanitizeAttributeCount?: number;
  readonly preSanitizeElementCount?: number;
  readonly preservedFootnoteIdentifiers?: readonly string[];
  readonly removedAttributes?: readonly string[];
  readonly removedElements?: readonly string[];
  readonly severity: "warning";
}

const safeResourceUrlPattern = /^(?![a-zA-Z][a-zA-Z0-9+.-]*:)(?!\/\/)[^"\s<>]+$/;

type AttributeSchemaValue = string | number | boolean | RegExp | null | undefined;
type AttributeSchemaEntry = string | [string, ...AttributeSchemaValue[]];

type HastLikeNode = {
  readonly children?: readonly HastLikeNode[];
  readonly properties?: Readonly<Record<string, unknown>>;
  readonly tagName?: string;
  readonly type: string;
  readonly value?: unknown;
};

type MarkdownAstLikeNode = {
  readonly children?: readonly MarkdownAstLikeNode[];
  readonly identifier?: string | null;
  readonly type: string;
};

interface TreeInventory {
  readonly attributeCount: number;
  readonly attributes: ReadonlyMap<string, number>;
  readonly elementCount: number;
  readonly elements: ReadonlyMap<string, number>;
}

interface PreservedFootnoteSource {
  readonly identifier: string;
  readonly raw: string;
}

export const markdownHtmlRendererPackage: MarkdownHtmlRendererContract = {
  packageName: "@momentarise/md-render-html",
  renderKind: "markdown-html"
};

export const mmeSanitizeSchema = createMmeSanitizeSchema();

const markdownToRawHastProcessor = unified()
  .use(remarkParse)
  .use(remarkFrontmatter, ["yaml"])
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw);

const markdownToAstProcessor = unified().use(remarkParse).use(remarkFrontmatter, ["yaml"]).use(remarkGfm);
const sanitizeProcessor = unified().use(rehypeSanitize, mmeSanitizeSchema);
const stringifyProcessor = unified().use(rehypeStringify);

export function renderMarkdownToHtml(
  markdown: string,
  options: RenderMarkdownToHtmlOptions = {}
): RenderMarkdownToHtmlResult {
  const file = new VFile({
    path: options.fileName,
    value: markdown
  });
  const parsedTree = markdownToRawHastProcessor.parse(file);
  const rawTree = markdownToRawHastProcessor.runSync(parsedTree, file) as HastLikeNode;
  const preInventory = inventoryTree(rawTree);
  const sanitizableTree = cloneTree(rawTree);
  sanitizeResourceAttributes(sanitizableTree);
  const sanitizedTree = sanitizeProcessor.runSync(sanitizableTree as never, file) as HastLikeNode;
  renderImagesWithoutSourceAsAltText(sanitizedTree);
  normalizeFootnoteFragmentTargets(sanitizedTree);
  const postInventory = inventoryTree(sanitizedTree);
  const preservedFootnotes = collectPreservedFootnoteDefinitionSources(markdown);
  const html = appendPreservedFootnoteSources(
    String(stringifyProcessor.stringify(sanitizedTree as never)),
    preservedFootnotes
  );
  const diagnostics = [
    ...createStripDiagnostics(preInventory, postInventory),
    ...createPreservedFootnoteDiagnostics(preservedFootnotes)
  ];
  return {
    diagnostics,
    html
  };
}

function sanitizeResourceAttributes(tree: HastLikeNode): void {
  visit(tree, (node) => {
    if (node.type !== "element" || !node.properties) {
      return;
    }
    const properties = node.properties as Record<string, unknown>;

    for (const [propertyName, value] of Object.entries(properties)) {
      if (isEventAttributeName(propertyName)) {
        delete properties[propertyName];
        continue;
      }

      if (propertyName === "srcset") {
        delete properties[propertyName];
        continue;
      }

      if (!isResourceAttribute(propertyName)) {
        continue;
      }

      const values = sanitizeUrlAttributeValue(value);
      if (values === null || values.length === 0) {
        delete properties[propertyName];
      } else {
        properties[propertyName] = values as string | string[];
      }
    }
  });
}

function renderImagesWithoutSourceAsAltText(tree: HastLikeNode): void {
  const mutableTree = tree as unknown as { children?: HastLikeNode[] };
  if (mutableTree.children) {
    mutableTree.children = mutableTree.children.flatMap((child) => {
      if (child.type === "element" && child.tagName?.toLowerCase() === "img") {
        const src = child.properties?.src;
        const alt = child.properties?.alt;
        if (typeof src !== "string" && typeof alt === "string" && alt.trim().length > 0) {
          return [
            {
              type: "text",
              value: alt
            } satisfies HastLikeNode
          ];
        }
      }
      renderImagesWithoutSourceAsAltText(child);
      return [child];
    });
  }
}

function normalizeFootnoteFragmentTargets(tree: HastLikeNode): void {
  visit(tree, (node) => {
    if (node.type !== "element" || !node.properties) {
      return;
    }
    const properties = node.properties as Record<string, unknown>;
    const href = properties.href;
    if (typeof href === "string" && href.startsWith("#user-content-fn")) {
      properties.href = `#mme-render-${href.slice(1)}`;
    }
  });
}

function sanitizeUrlAttributeValue(value: unknown): string | readonly string[] | null {
  if (typeof value === "string") {
    const normalized = value.trim();
    return isSafeResourceUrl(normalized) ? normalized : null;
  }

  if (Array.isArray(value)) {
    const flattened = value
      .filter((entry) => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0 && isSafeResourceUrl(entry));

    if (flattened.length === 0) {
      return null;
    }

    if (flattened.length === 1) {
      return flattened[0] ?? null;
    }

    return flattened;
  }

  return null;
}

function isResourceAttribute(attributeName: string): boolean {
  const normalized = attributeName.toLowerCase();
  return [
    "href",
    "src",
    "xlink:href",
    "action",
    "formaction",
    "srcdoc",
    "poster",
    "longdesc",
    "cite"
  ].includes(normalized);
}

function isSafeResourceUrl(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return false;
  }

  if (trimmed.startsWith("#") || trimmed.startsWith("?")) {
    return true;
  }

  if (trimmed.startsWith("/")) {
    return true;
  }

  if (/^[a-z][a-zA-Z0-9+.-]*:/i.test(trimmed)) {
    return false;
  }

  if (/^\/\//.test(trimmed)) {
    return false;
  }

  return true;
}

function createMmeSanitizeSchema(): typeof defaultSchema {
  const tagNames = (defaultSchema.tagNames ?? []).filter(
    (tagName) => !["iframe", "script", "style"].includes(tagName)
  );
  const attributes = cloneAttributes(defaultSchema.attributes ?? {});
  const globalAttributes = attributes["*"] ?? [];
  attributes["*"] = [
    ...globalAttributes.filter(
      (attribute) => !isEventAttributeSchemaEntry(attribute) && !isClassNameSchemaEntry(attribute)
    ),
    ["className", /^language-[\w-]+$/, /^token-[\w-]+$/, /^mme-[\w-]+$/]
  ];
  attributes.a = [
    ...withSafeUrlAttribute(attributes.a ?? [], "href"),
    "target",
    "rel"
  ];
  attributes.img = withSafeUrlAttribute(withoutAttributeSchemaEntry(attributes.img ?? [], "srcset"), "src");
  attributes.input = [
    ...(attributes.input ?? []),
    ["type", "checkbox"],
    "checked",
    "disabled",
    ["disabled", true, ""]
  ];
  attributes.button = withoutAttributeSchemaEntry(attributes.button ?? [], "formaction");
  attributes.form = withoutAttributeSchemaEntry(attributes.form ?? [], "action");
  attributes.link = withoutAttributeSchemaEntry(attributes.link ?? [], "href");
  attributes.iframe = withoutAttributeSchemaEntry(attributes.iframe ?? [], "src");
  attributes.source = withoutAttributeSchemaEntry(attributes.source ?? [], "src");
  attributes.video = withoutAttributeSchemaEntry(attributes.video ?? [], "src");
  attributes.track = withoutAttributeSchemaEntry(attributes.track ?? [], "src");

  return {
    ...defaultSchema,
    attributes,
    clobberPrefix: "mme-render-",
    tagNames
  };
}

function cloneAttributes(
  attributes: NonNullable<typeof defaultSchema.attributes>
): Record<string, AttributeSchemaEntry[]> {
  const cloned: Record<string, AttributeSchemaEntry[]> = {};
  for (const [key, value] of Object.entries(attributes)) {
    cloned[key] = [...value];
  }
  return cloned;
}

function withSafeUrlAttribute(
  attributes: readonly AttributeSchemaEntry[],
  attributeName: string
): AttributeSchemaEntry[] {
  return [
    ...withoutAttributeSchemaEntry(attributes, attributeName),
    [attributeName, safeResourceUrlPattern]
  ];
}

function withoutAttributeSchemaEntry(
  attributes: readonly AttributeSchemaEntry[],
  attributeName: string
): AttributeSchemaEntry[] {
  return attributes.filter((attribute) => !isSchemaAttributeName(attribute, attributeName));
}

function isEventAttributeSchemaEntry(entry: unknown): boolean {
  if (typeof entry === "string") {
    return /^on/i.test(entry);
  }
  if (Array.isArray(entry) && typeof entry[0] === "string") {
    return /^on/i.test(entry[0]);
  }
  return false;
}

function isClassNameSchemaEntry(entry: unknown): boolean {
  if (entry === "className" || entry === "class") {
    return true;
  }
  if (Array.isArray(entry) && (entry[0] === "className" || entry[0] === "class")) {
    return true;
  }
  return false;
}

function isSchemaAttributeName(entry: AttributeSchemaEntry, attributeName: string): boolean {
  if (typeof entry === "string") {
    return entry === attributeName;
  }
  if (Array.isArray(entry) && typeof entry[0] === "string") {
    return entry[0] === attributeName;
  }
  return false;
}

function cloneTree(tree: HastLikeNode): HastLikeNode {
  return JSON.parse(JSON.stringify(tree)) as HastLikeNode;
}

function inventoryTree(tree: HastLikeNode): TreeInventory {
  const elements = new Map<string, number>();
  const attributes = new Map<string, number>();
  let elementCount = 0;
  let attributeCount = 0;

  visit(tree, (node) => {
    if (node.type !== "element" || !node.tagName) {
      return;
    }
    const tagName = node.tagName.toLowerCase();
    elementCount += 1;
    increment(elements, tagName);
    for (const propertyName of Object.keys(node.properties ?? {})) {
      if (isEventAttributeName(propertyName)) {
        increment(attributes, `${tagName}.${propertyName}`);
      } else {
        increment(attributes, `${tagName}.${propertyName}`);
      }
      attributeCount += 1;
    }
  });

  return {
    attributeCount,
    attributes,
    elementCount,
    elements
  };
}

function createStripDiagnostics(
  preInventory: TreeInventory,
  postInventory: TreeInventory
): readonly RenderHtmlDiagnostic[] {
  const removedElements = diffInventory(preInventory.elements, postInventory.elements);
  const removedAttributes = diffInventory(preInventory.attributes, postInventory.attributes);

  if (removedElements.length === 0 && removedAttributes.length === 0) {
    return [];
  }

  return [
    {
      code: "render_html_stripped",
      message:
        "Unsafe or unsupported HTML was stripped from the render artifact only; source Markdown was not modified.",
      postSanitizeAttributeCount: postInventory.attributeCount,
      postSanitizeElementCount: postInventory.elementCount,
      preSanitizeAttributeCount: preInventory.attributeCount,
      preSanitizeElementCount: preInventory.elementCount,
      removedAttributes,
      removedElements,
      severity: "warning"
    }
  ];
}

function createPreservedFootnoteDiagnostics(
  preservedFootnotes: readonly PreservedFootnoteSource[]
): readonly RenderHtmlDiagnostic[] {
  if (preservedFootnotes.length === 0) {
    return [];
  }
  return [
    {
      code: "render_html_footnote_preserved",
      message:
        "Duplicate or unreferenced footnote definitions were preserved as visible raw Markdown because the render artifact normalizes GFM footnotes.",
      preservedFootnoteIdentifiers: preservedFootnotes.map((footnote) => footnote.identifier),
      severity: "warning"
    }
  ];
}

function appendPreservedFootnoteSources(
  html: string,
  preservedFootnotes: readonly PreservedFootnoteSource[]
): string {
  if (preservedFootnotes.length === 0) {
    return html;
  }
  const blocks = preservedFootnotes
    .map(
      (footnote) =>
        `<pre data-mme-preserved-footnote-source="true">${escapeHtml(scrubUnsafePreviewAttributes(footnote.raw.trimEnd()))}</pre>`
    )
    .join("");
  return `${html}<section data-mme-preserved-footnotes="true" aria-label="Preserved footnote source"><h2>Preserved footnote source</h2>${blocks}</section>`;
}

function collectPreservedFootnoteDefinitionSources(markdown: string): readonly PreservedFootnoteSource[] {
  const definitions = collectFootnoteDefinitionBlocks(markdown);
  const references = new Set(collectFootnoteReferenceIdentifiers(markdown).map((identifier) => identifier.trim().toLowerCase()));
  const seen = new Set<string>();
  const preserved: PreservedFootnoteSource[] = [];
  for (const definition of definitions) {
    const normalizedIdentifier = definition.identifier.trim().toLowerCase();
    if (seen.has(normalizedIdentifier) || !references.has(normalizedIdentifier)) {
      preserved.push(definition);
    } else {
      seen.add(normalizedIdentifier);
    }
  }
  return preserved;
}

function collectFootnoteDefinitionBlocks(markdown: string): readonly PreservedFootnoteSource[] {
  const fencedRegions = fencedCodeRegions(markdown);
  const lines = sourceLines(markdown);
  const definitions: PreservedFootnoteSource[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    if (isInsideFencedRegion(fencedRegions, line.start)) {
      continue;
    }
    const match = line.text.match(/^ {0,3}\[\^([^\]\n]+)]:/);
    if (!match) {
      continue;
    }
    let end = line.end;
    let cursor = index + 1;
    while (cursor < lines.length) {
      const next = lines[cursor]!;
      const following = lines[cursor + 1];
      if (next.text.trim() === "" && following && /^(?: {4,}|\t)\S/.test(following.text)) {
        end = next.end;
        cursor += 1;
        continue;
      }
      if (/^(?: {4,}|\t)/.test(next.text)) {
        end = next.end;
        cursor += 1;
        continue;
      }
      break;
    }
    definitions.push({
      identifier: match[1]!,
      raw: markdown.slice(line.start, end)
    });
  }
  return definitions;
}

function collectFootnoteReferenceIdentifiers(markdown: string): readonly string[] {
  const identifiers: string[] = [];
  const ast = markdownToAstProcessor.parse(markdown) as MarkdownAstLikeNode;
  visitMarkdownAst(ast, (node) => {
    if (node.type === "footnoteReference" && node.identifier) {
      identifiers.push(node.identifier);
    }
  });
  return identifiers;
}

function diffInventory(before: ReadonlyMap<string, number>, after: ReadonlyMap<string, number>): readonly string[] {
  const removed: string[] = [];
  for (const [name, count] of before.entries()) {
    const nextCount = after.get(name) ?? 0;
    for (let index = nextCount; index < count; index += 1) {
      removed.push(name);
    }
  }
  return removed.sort();
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function scrubUnsafePreviewAttributes(value: string): string {
  return value
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(
      /\s+(href|src)\s*=\s*(?:"\s*(?:javascript:|data:|https?:\/\/|\/\/)[^"]*"|'\s*(?:javascript:|data:|https?:\/\/|\/\/)[^']*'|(?:javascript:|data:|https?:\/\/|\/\/)[^\s>]*)/gi,
      ""
    );
}

function increment(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function visit(node: HastLikeNode, visitor: (node: HastLikeNode) => void): void {
  visitor(node);
  for (const child of node.children ?? []) {
    visit(child, visitor);
  }
}

function visitMarkdownAst(node: MarkdownAstLikeNode, visitor: (node: MarkdownAstLikeNode) => void): void {
  visitor(node);
  for (const child of node.children ?? []) {
    visitMarkdownAst(child, visitor);
  }
}

function isEventAttributeName(name: string): boolean {
  return /^on/i.test(name);
}
