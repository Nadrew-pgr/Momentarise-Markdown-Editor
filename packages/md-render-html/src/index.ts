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

export type RenderHtmlDiagnosticCode = "render_html_stripped";

export interface RenderHtmlDiagnostic {
  readonly code: RenderHtmlDiagnosticCode;
  readonly message: string;
  readonly postSanitizeAttributeCount?: number;
  readonly postSanitizeElementCount?: number;
  readonly preSanitizeAttributeCount?: number;
  readonly preSanitizeElementCount?: number;
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

interface TreeInventory {
  readonly attributeCount: number;
  readonly attributes: ReadonlyMap<string, number>;
  readonly elementCount: number;
  readonly elements: ReadonlyMap<string, number>;
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
  const postInventory = inventoryTree(sanitizedTree);
  const html = String(stringifyProcessor.stringify(sanitizedTree as never));
  const diagnostics = createStripDiagnostics(preInventory, postInventory);
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

function increment(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function visit(node: HastLikeNode, visitor: (node: HastLikeNode) => void): void {
  visitor(node);
  for (const child of node.children ?? []) {
    visit(child, visitor);
  }
}

function isEventAttributeName(name: string): boolean {
  return /^on/i.test(name);
}
