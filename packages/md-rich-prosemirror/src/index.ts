import type {
  Diagnostic,
  DocumentDialect,
  KnownNode,
  MomentariseNode,
  NodeAttributeValue,
  OpaqueNode,
  ParseResult,
  SourceRange
} from "@momentarise/md-core";
import { createMarkdownAstFormatter } from "@momentarise/md-format";
import {
  baseKeymap,
  chainCommands,
  createParagraphNear,
  liftEmptyBlock,
  newlineInCode,
  setBlockType,
  splitBlock,
  toggleMark,
  wrapIn
} from "prosemirror-commands";
import { history, redo, undo } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import { Mark, Node as ProseMirrorNode, Schema, type MarkSpec, type NodeSpec } from "prosemirror-model";
import { EditorState, Plugin, TextSelection, type Transaction } from "prosemirror-state";

export interface MomentariseRichProseMirrorContract {
  readonly packageName: "@momentarise/md-rich-prosemirror";
  readonly richMode: "prosemirror";
}

export type RichCommandId =
  | "blockquote"
  | "bold"
  | "bulletList"
  | "callout"
  | "codeBlock"
  | "divider"
  | "heading1"
  | "heading2"
  | "heading3"
  | "image"
  | "inlineCode"
  | "italic"
  | "link"
  | "orderedList"
  | "paragraph"
  | "todo";

export interface RichMarkdownCommand {
  readonly aliases: readonly string[];
  readonly group: "block" | "inline" | "insert";
  readonly id: RichCommandId;
  readonly label: string;
}

export interface ApplyRichMarkdownCommandOptions {
  readonly alt?: string;
  readonly href?: string;
  readonly language?: string;
  readonly src?: string;
  readonly title?: string;
}

export interface RichMarkdownCommandResult {
  readonly handled: boolean;
  readonly state: RichMarkdownState;
}

export interface CreateRichMarkdownStateOptions {
  readonly dialect?: DocumentDialect;
  readonly schema?: MomentariseRichSchema;
}

export interface RichMarkdownState {
  readonly diagnostics: readonly Diagnostic[];
  readonly editorState: EditorState;
  readonly frontmatterSource?: string;
  readonly parseResult: ParseResult;
  readonly schema: MomentariseRichSchema;
  readonly source: string;
}

export type MomentariseRichSchema = Schema<
  | "blockquote"
  | "bullet_list"
  | "code_block"
  | "doc"
  | "hard_break"
  | "heading"
  | "horizontal_rule"
  | "image"
  | "list_item"
  | "ordered_list"
  | "paragraph"
  | "text"
  | "todo_item"
  | "unsupported_block",
  "code" | "em" | "link" | "strong"
>;

export const momentariseRichProseMirrorPackage: MomentariseRichProseMirrorContract = {
  packageName: "@momentarise/md-rich-prosemirror",
  richMode: "prosemirror"
};

export const richCommandRegistry: readonly RichMarkdownCommand[] = [
  {
    aliases: ["p", "paragraph", "text"],
    group: "block",
    id: "paragraph",
    label: "Paragraph"
  },
  {
    aliases: ["h1", "H1", "heading", "heading1", "title"],
    group: "block",
    id: "heading1",
    label: "Heading 1"
  },
  {
    aliases: ["h2", "H2", "heading2", "subtitle"],
    group: "block",
    id: "heading2",
    label: "Heading 2"
  },
  {
    aliases: ["h3", "H3", "heading3"],
    group: "block",
    id: "heading3",
    label: "Heading 3"
  },
  {
    aliases: ["todo", "task", "checkbox", "check"],
    group: "block",
    id: "todo",
    label: "Todo"
  },
  {
    aliases: ["bullet", "ul", "list"],
    group: "block",
    id: "bulletList",
    label: "Bullet list"
  },
  {
    aliases: ["ordered", "ol", "numbered"],
    group: "block",
    id: "orderedList",
    label: "Numbered list"
  },
  {
    aliases: ["quote", "blockquote"],
    group: "block",
    id: "blockquote",
    label: "Quote"
  },
  {
    aliases: ["code", "codeblock", "fence"],
    group: "block",
    id: "codeBlock",
    label: "Code block"
  },
  {
    aliases: ["callout", "note", "aside"],
    group: "insert",
    id: "callout",
    label: "Callout"
  },
  {
    aliases: ["image", "img", "picture"],
    group: "insert",
    id: "image",
    label: "Image"
  },
  {
    aliases: ["divider", "hr", "rule"],
    group: "insert",
    id: "divider",
    label: "Divider"
  },
  {
    aliases: ["bold", "strong"],
    group: "inline",
    id: "bold",
    label: "Bold"
  },
  {
    aliases: ["italic", "em"],
    group: "inline",
    id: "italic",
    label: "Italic"
  },
  {
    aliases: ["inlinecode", "monospace"],
    group: "inline",
    id: "inlineCode",
    label: "Inline code"
  },
  {
    aliases: ["link", "url"],
    group: "inline",
    id: "link",
    label: "Link"
  }
];

export function createMomentariseRichSchema(): MomentariseRichSchema {
  return new Schema({
    marks: richMarks,
    nodes: richNodes
  }) as MomentariseRichSchema;
}

export function createMomentariseRichPlugins(): Plugin[] {
  return [
    keymap({
      "Mod-z": undo,
      "Mod-y": redo,
      "Mod-Shift-z": redo,
      Enter: chainCommands(newlineInCode, createParagraphNear, liftEmptyBlock, splitBlock)
    }),
    history(),
    keymap(baseKeymap)
  ];
}

export function createRichMarkdownState(
  source: string,
  options: CreateRichMarkdownStateOptions = {}
): RichMarkdownState {
  const schema = options.schema ?? createMomentariseRichSchema();
  const parseResult = createMarkdownAstFormatter().parse(source, {
    dialect: options.dialect ?? "momentarise-enhanced"
  });
  const doc = markdownDocumentToProseMirror(parseResult, schema);
  const editorState = EditorState.create({
    doc,
    plugins: createMomentariseRichPlugins(),
    schema
  });
  const frontmatterSource = extractLeadingFrontmatterSource(source);
  return {
    diagnostics: [
      ...parseResult.diagnostics,
      {
        code: "rich_prosemirror_bridge",
        message: "Mapped Momentarise Markdown nodes into a ProseMirror rich-mode document.",
        severity: "info"
      }
    ],
    editorState,
    ...(frontmatterSource ? { frontmatterSource } : {}),
    parseResult,
    schema,
    source
  };
}

export function filterRichMarkdownCommands(query: string): readonly RichMarkdownCommand[] {
  const normalized = normalizeCommandQuery(query);
  if (!normalized) {
    return richCommandRegistry;
  }
  return richCommandRegistry.filter((command) =>
    [command.id, command.label, ...command.aliases].some((candidate) => normalizeCommandQuery(candidate).includes(normalized))
  );
}

export function applyRichMarkdownCommand(
  state: RichMarkdownState,
  commandId: RichCommandId,
  options: ApplyRichMarkdownCommandOptions = {}
): RichMarkdownState {
  return runRichMarkdownCommand(state, commandId, options).state;
}

export function runRichMarkdownCommand(
  state: RichMarkdownState,
  commandId: RichCommandId,
  options: ApplyRichMarkdownCommandOptions = {}
): RichMarkdownCommandResult {
  let editorState = state.editorState;
  const dispatch = (transaction: Transaction): void => {
    editorState = editorState.apply(transaction);
  };
  const handled = executeRichMarkdownCommand(commandId, editorState, dispatch, options);
  return {
    handled,
    state: handled
      ? {
          ...state,
          editorState
        }
      : state
  };
}

export function replaceFirstRichText(
  state: RichMarkdownState,
  search: string,
  replacement: string
): RichMarkdownState {
  let from: number | null = null;
  let to: number | null = null;
  state.editorState.doc.descendants((node, position) => {
    if (!node.isText || typeof node.text !== "string") {
      return true;
    }
    const index = node.text.indexOf(search);
    if (index < 0) {
      return true;
    }
    from = position + index;
    to = from + search.length;
    return false;
  });
  if (from === null || to === null) {
    throw new Error(`Could not find rich text: ${search}`);
  }
  const editorState = state.editorState.apply(state.editorState.tr.insertText(replacement, from, to));
  return {
    ...state,
    editorState
  };
}

export function selectFirstRichText(state: RichMarkdownState, search: string): RichMarkdownState {
  let from: number | null = null;
  let to: number | null = null;
  state.editorState.doc.descendants((node, position) => {
    if (!node.isText || typeof node.text !== "string") {
      return true;
    }
    const index = node.text.indexOf(search);
    if (index < 0) {
      return true;
    }
    from = position + index;
    to = from + search.length;
    return false;
  });
  if (from === null || to === null) {
    throw new Error(`Could not select rich text: ${search}`);
  }
  const editorState = state.editorState.apply(
    state.editorState.tr.setSelection(TextSelection.create(state.editorState.doc, from, to))
  );
  return {
    ...state,
    editorState
  };
}

export function serializeRichMarkdownState(state: RichMarkdownState): {
  readonly content: string;
  readonly diagnostics: readonly Diagnostic[];
} {
  const body = serializeBlockList(state.editorState.doc, 0).trimEnd();
  const content = state.frontmatterSource
    ? `${state.frontmatterSource}\n\n${body}\n`
    : `${body}\n`;
  return {
    content,
    diagnostics: [
      {
        code: "rich_prosemirror_serializer",
        message: "Serialized the supported ProseMirror rich-mode subset back to Markdown.",
        severity: "info"
      }
    ]
  };
}

export function markdownDocumentToProseMirror(
  parseResult: ParseResult,
  schema: MomentariseRichSchema = createMomentariseRichSchema()
): ProseMirrorNode {
  const content = filterRichRootNodes(parseResult.document.root.children ?? [])
    .filter((node) => node.type !== "yaml" && node.type !== "yamlFrontmatter")
    .map((node) => blockNodeToProseMirror(node, schema))
    .filter((node): node is ProseMirrorNode => Boolean(node));
  return schema.nodes.doc.create(null, content.length > 0 ? content : [schema.nodes.paragraph.create()]);
}

function filterRichRootNodes(nodes: readonly MomentariseNode[]): readonly MomentariseNode[] {
  const opaqueNodes = nodes.filter((node): node is OpaqueNode => node.kind === "opaque" && Boolean(node.sourceRange));
  return nodes.filter((node) => {
    if (node.type === "yaml" || node.type === "yamlFrontmatter" || !node.sourceRange) {
      return true;
    }

    if (node.kind !== "opaque") {
      return !opaqueNodes.some((opaque) => rangeCovers(opaque.sourceRange, node.sourceRange!));
    }

    return !nodes.some(
      (candidate) =>
        candidate !== node &&
        candidate.kind !== "opaque" &&
        candidate.sourceRange &&
        rangeStrictlyContains(candidate.sourceRange, node.sourceRange!)
    );
  });
}

function rangeCovers(outer: SourceRange, inner: SourceRange): boolean {
  return outer.start.offset <= inner.start.offset && outer.end.offset >= inner.end.offset;
}

function rangeStrictlyContains(outer: SourceRange, inner: SourceRange): boolean {
  return (
    rangeCovers(outer, inner) &&
    (outer.start.offset < inner.start.offset || outer.end.offset > inner.end.offset)
  );
}

function executeRichMarkdownCommand(
  commandId: RichCommandId,
  state: EditorState,
  dispatch: (transaction: Transaction) => void,
  options: ApplyRichMarkdownCommandOptions
): boolean {
  const { schema } = state;
  switch (commandId) {
    case "paragraph":
      return setBlockType(schema.nodes.paragraph!)(state, dispatch);
    case "heading1":
      return setBlockType(schema.nodes.heading!, { level: 1 })(state, dispatch);
    case "heading2":
      return setBlockType(schema.nodes.heading!, { level: 2 })(state, dispatch);
    case "heading3":
      return setBlockType(schema.nodes.heading!, { level: 3 })(state, dispatch);
    case "blockquote":
      return wrapIn(schema.nodes.blockquote!)(state, dispatch);
    case "codeBlock":
      return setBlockType(schema.nodes.code_block!, {
        language: options.language ?? null,
        meta: options.title ?? null
      })(state, dispatch);
    case "todo":
      return replaceCurrentBlock(
        state,
        dispatch,
        schema.nodes.todo_item!.create({ checked: false }, [paragraphFromCurrentBlock(state)])
      );
    case "bulletList":
      return replaceCurrentBlock(
        state,
        dispatch,
        schema.nodes.bullet_list!.create(null, [
          schema.nodes.list_item!.create(null, [paragraphFromCurrentBlock(state)])
        ])
      );
    case "orderedList":
      return replaceCurrentBlock(
        state,
        dispatch,
        schema.nodes.ordered_list!.create({ order: 1 }, [
          schema.nodes.list_item!.create(null, [paragraphFromCurrentBlock(state)])
        ])
      );
    case "divider":
      return replaceCurrentBlock(state, dispatch, schema.nodes.horizontal_rule!.create());
    case "callout":
      return replaceCurrentBlock(
        state,
        dispatch,
        schema.nodes.unsupported_block!.create({
          raw: `> [!NOTE] ${currentBlockText(state) || "Callout"}\n> `,
          reason: "callout command raw fallback"
        })
      );
    case "image":
      return replaceCurrentBlock(
        state,
        dispatch,
        schema.nodes.paragraph!.create(null, [
          schema.nodes.image!.create({
            alt: options.alt ?? currentBlockText(state) ?? "Image",
            src: options.src ?? "image.png",
            title: options.title ?? null
          })
        ])
      );
    case "bold":
      return toggleMark(schema.marks.strong!)(state, dispatch);
    case "italic":
      return toggleMark(schema.marks.em!)(state, dispatch);
    case "inlineCode":
      return toggleMark(schema.marks.code!)(state, dispatch);
    case "link":
      return toggleMark(schema.marks.link!, {
        href: options.href ?? "https://example.invalid",
        title: options.title ?? null
      })(state, dispatch);
  }
}

function normalizeCommandQuery(query: string): string {
  return query.trim().replace(/^\/+/, "").toLowerCase().replace(/[\s_-]+/g, "");
}

function replaceCurrentBlock(
  state: EditorState,
  dispatch: (transaction: Transaction) => void,
  replacement: ProseMirrorNode
): boolean {
  const range = currentBlockRange(state);
  if (!range) {
    return false;
  }
  if (range.parent.type !== state.schema.nodes.doc) {
    return false;
  }
  try {
    const transaction = state.tr.replaceWith(range.from, range.to, replacement);
    const selectionPosition = Math.min(range.from + 1, transaction.doc.content.size);
    dispatch(transaction.setSelection(TextSelection.near(transaction.doc.resolve(selectionPosition))));
    return true;
  } catch {
    return false;
  }
}

function currentBlockRange(state: EditorState): {
  readonly from: number;
  readonly node: ProseMirrorNode;
  readonly parent: ProseMirrorNode;
  readonly to: number;
} | null {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.isBlock) {
      return {
        from: $from.before(depth),
        node,
        parent: $from.node(depth - 1),
        to: $from.after(depth)
      };
    }
  }
  return null;
}

function paragraphFromCurrentBlock(state: EditorState): ProseMirrorNode {
  const paragraph = state.schema.nodes.paragraph!;
  const range = currentBlockRange(state);
  if (!range) {
    return paragraph.create();
  }
  if (range.node.type === paragraph) {
    return range.node;
  }
  const text = range.node.textContent;
  return text ? paragraph.create(null, [state.schema.text(text)]) : paragraph.create();
}

function currentBlockText(state: EditorState): string {
  return currentBlockRange(state)?.node.textContent.trim() ?? "";
}

const richNodes: Record<string, NodeSpec> = {
  doc: {
    content: "block+"
  },
  paragraph: {
    content: "inline*",
    group: "block",
    parseDOM: [{ tag: "p" }],
    toDOM: () => ["p", 0]
  },
  blockquote: {
    content: "block+",
    defining: true,
    group: "block",
    parseDOM: [{ tag: "blockquote" }],
    toDOM: () => ["blockquote", 0]
  },
  horizontal_rule: {
    group: "block",
    parseDOM: [{ tag: "hr" }],
    toDOM: () => ["hr"]
  },
  heading: {
    attrs: {
      level: { default: 1 }
    },
    content: "inline*",
    defining: true,
    group: "block",
    parseDOM: [1, 2, 3, 4, 5, 6].map((level) => ({
      attrs: { level },
      tag: `h${level}`
    })),
    toDOM: (node) => [`h${Number(node.attrs.level) || 1}`, 0]
  },
  code_block: {
    attrs: {
      language: { default: null },
      meta: { default: null }
    },
    code: true,
    content: "text*",
    defining: true,
    group: "block",
    marks: "",
    parseDOM: [
      {
        preserveWhitespace: "full",
        tag: "pre",
        getAttrs: (element) => {
          const codeElement = element instanceof HTMLElement ? element.querySelector("code") : null;
          const className = codeElement?.className ?? "";
          const match = className.match(/language-([^\s]+)/);
          return {
            language: match?.[1] ?? null
          };
        }
      }
    ],
    toDOM: (node) => {
      const language = typeof node.attrs.language === "string" ? node.attrs.language : null;
      return ["pre", ["code", language ? { class: `language-${language}` } : {}, 0]];
    }
  },
  bullet_list: {
    content: "(list_item | todo_item)+",
    group: "block",
    parseDOM: [{ tag: "ul" }],
    toDOM: () => ["ul", 0]
  },
  ordered_list: {
    attrs: {
      order: { default: 1 }
    },
    content: "(list_item | todo_item)+",
    group: "block",
    parseDOM: [
      {
        tag: "ol",
        getAttrs: (element) => ({
          order: element instanceof HTMLOListElement ? Number(element.start || 1) : 1
        })
      }
    ],
    toDOM: (node) => (Number(node.attrs.order) === 1 ? ["ol", 0] : ["ol", { start: node.attrs.order }, 0])
  },
  list_item: {
    content: "paragraph block*",
    defining: true,
    parseDOM: [{ tag: "li" }],
    toDOM: () => ["li", 0]
  },
  todo_item: {
    attrs: {
      checked: { default: false }
    },
    content: "paragraph block*",
    defining: true,
    group: "block",
    toDOM: (node) => ["div", { "data-checked": String(Boolean(node.attrs.checked)), "data-type": "todo-item" }, 0]
  },
  image: {
    attrs: {
      alt: { default: "" },
      src: {},
      title: { default: null }
    },
    draggable: true,
    group: "inline",
    inline: true,
    parseDOM: [
      {
        tag: "img[src]",
        getAttrs: (element) =>
          element instanceof HTMLImageElement
            ? {
                alt: element.alt,
                src: element.getAttribute("src"),
                title: element.getAttribute("title")
              }
            : false
      }
    ],
    toDOM: (node) => [
      "img",
      {
        alt: node.attrs.alt,
        src: node.attrs.src,
        title: node.attrs.title
      }
    ]
  },
  hard_break: {
    group: "inline",
    inline: true,
    parseDOM: [{ tag: "br" }],
    selectable: false,
    toDOM: () => ["br"]
  },
  unsupported_block: {
    atom: true,
    attrs: {
      raw: { default: "" },
      reason: { default: "unsupported Markdown" }
    },
    group: "block",
    selectable: true,
    toDOM: (node) => ["pre", { "data-unsupported": "true" }, String(node.attrs.raw)]
  },
  text: {
    group: "inline"
  }
};

const richMarks: Record<string, MarkSpec> = {
  em: {
    parseDOM: [{ tag: "em" }, { tag: "i" }],
    toDOM: () => ["em", 0]
  },
  strong: {
    parseDOM: [{ tag: "strong" }, { tag: "b" }],
    toDOM: () => ["strong", 0]
  },
  code: {
    code: true,
    parseDOM: [{ tag: "code" }],
    toDOM: () => ["code", 0]
  },
  link: {
    attrs: {
      href: {},
      title: { default: null }
    },
    inclusive: false,
    parseDOM: [
      {
        tag: "a[href]",
        getAttrs: (element) =>
          element instanceof HTMLAnchorElement
            ? {
                href: element.getAttribute("href"),
                title: element.getAttribute("title")
              }
            : false
      }
    ],
    toDOM: (mark) => ["a", { href: mark.attrs.href, title: mark.attrs.title }, 0]
  }
};

function blockNodeToProseMirror(node: MomentariseNode, schema: MomentariseRichSchema): ProseMirrorNode | null {
  if (node.kind === "opaque") {
    return unsupportedNodeToProseMirror(node, schema);
  }

  switch (node.type) {
    case "heading":
      return schema.nodes.heading.create(
        { level: Number(node.attributes?.depth ?? 1) },
        inlineChildrenToProseMirror(node.children ?? [], schema)
      );
    case "paragraph":
      return schema.nodes.paragraph.create(null, inlineChildrenToProseMirror(node.children ?? [], schema));
    case "blockquote":
      return schema.nodes.blockquote.create(null, blockChildrenToProseMirror(node.children ?? [], schema));
    case "thematicBreak":
      return schema.nodes.horizontal_rule.create();
    case "code":
    case "codeFence":
      return schema.nodes.code_block.create(
        {
          language: stringAttribute(node.attributes?.language),
          meta: stringAttribute(node.attributes?.meta)
        },
        textNode(schema, stringAttribute(node.attributes?.value) ?? rawFromRange(node))
      );
    case "list":
      return listNodeToProseMirror(node, schema);
    case "html":
      return unsupportedNodeToProseMirror(node, schema);
    default:
      return node.children && node.children.length > 0
        ? schema.nodes.paragraph.create(null, inlineChildrenToProseMirror(node.children, schema))
        : unsupportedNodeToProseMirror(node, schema);
  }
}

function listNodeToProseMirror(node: KnownNode, schema: MomentariseRichSchema): ProseMirrorNode {
  const items = (node.children ?? [])
    .map((child) => listItemToProseMirror(child, schema))
    .filter((child): child is ProseMirrorNode => Boolean(child));
  if (node.attributes?.ordered === true) {
    return schema.nodes.ordered_list.create({ order: Number(node.attributes.start) || 1 }, items);
  }
  return schema.nodes.bullet_list.create(null, items);
}

function listItemToProseMirror(node: MomentariseNode, schema: MomentariseRichSchema): ProseMirrorNode | null {
  if (node.kind === "opaque") {
    return null;
  }
  const children = blockChildrenToProseMirror(node.children ?? [], schema);
  const safeChildren = children.length > 0 ? children : [schema.nodes.paragraph.create()];
  if (typeof node.attributes?.checked === "boolean") {
    return schema.nodes.todo_item.create({ checked: node.attributes.checked }, safeChildren);
  }
  return schema.nodes.list_item.create(null, safeChildren);
}

function blockChildrenToProseMirror(
  children: readonly MomentariseNode[],
  schema: MomentariseRichSchema
): ProseMirrorNode[] {
  return children
    .map((child) => blockNodeToProseMirror(child, schema))
    .filter((child): child is ProseMirrorNode => Boolean(child));
}

function inlineChildrenToProseMirror(
  children: readonly MomentariseNode[],
  schema: MomentariseRichSchema,
  marks: readonly Mark[] = []
): readonly ProseMirrorNode[] {
  const inlineNodes: ProseMirrorNode[] = [];
  for (const child of children) {
    inlineNodes.push(...inlineNodeToProseMirror(child, schema, marks));
  }
  return inlineNodes;
}

function inlineNodeToProseMirror(
  node: MomentariseNode,
  schema: MomentariseRichSchema,
  marks: readonly Mark[]
): readonly ProseMirrorNode[] {
  if (node.kind === "opaque") {
    return [schema.text(node.raw, marks)];
  }
  if (node.type === "text") {
    return [schema.text(stringAttribute(node.attributes?.value) ?? rawFromRange(node), marks)];
  }
  if (node.type === "inlineCode") {
    return [
      schema.text(stringAttribute(node.attributes?.value) ?? rawFromRange(node), [
        ...marks,
        schema.marks.code.create()
      ])
    ];
  }
  if (node.type === "emphasis") {
    return inlineChildrenToProseMirror(node.children ?? [], schema, [...marks, schema.marks.em.create()]);
  }
  if (node.type === "strong") {
    return inlineChildrenToProseMirror(node.children ?? [], schema, [...marks, schema.marks.strong.create()]);
  }
  if (node.type === "link") {
    return inlineChildrenToProseMirror(node.children ?? [], schema, [
      ...marks,
      schema.marks.link.create({
        href: stringAttribute(node.attributes?.url) ?? "",
        title: stringAttribute(node.attributes?.title)
      })
    ]);
  }
  if (node.type === "image") {
    return [
      schema.nodes.image.create({
        alt: stringAttribute(node.attributes?.alt) ?? "",
        src: stringAttribute(node.attributes?.url) ?? "",
        title: stringAttribute(node.attributes?.title)
      })
    ];
  }
  if (node.type === "break") {
    return [schema.nodes.hard_break.create()];
  }
  return inlineChildrenToProseMirror(node.children ?? [], schema, marks);
}

function unsupportedNodeToProseMirror(node: MomentariseNode, schema: MomentariseRichSchema): ProseMirrorNode {
  const raw = node.kind === "opaque" ? node.raw : rawFromRange(node);
  return schema.nodes.unsupported_block.create({
    raw,
    reason: node.kind === "opaque" ? node.reason ?? "opaque Markdown" : `unsupported ${node.type}`
  });
}

function serializeBlockList(node: ProseMirrorNode, indentLevel: number): string {
  const parts: string[] = [];
  node.forEach((child) => {
    parts.push(serializeBlock(child, indentLevel));
  });
  return parts.join("\n").replace(/\n{3,}/g, "\n\n");
}

function serializeBlock(node: ProseMirrorNode, indentLevel: number): string {
  switch (node.type.name) {
    case "heading":
      return `${"#".repeat(Number(node.attrs.level) || 1)} ${serializeInline(node)}`;
    case "paragraph":
      return serializeInline(node);
    case "blockquote":
      return serializeBlockList(node, indentLevel)
        .split("\n")
        .map((line) => (line.trim() ? `> ${line}` : ">"))
        .join("\n");
    case "code_block": {
      const language = stringAttribute(node.attrs.language) ?? "";
      const meta = stringAttribute(node.attrs.meta);
      const info = [language, meta].filter(Boolean).join(" ");
      return `\`\`\`${info}\n${node.textContent}\n\`\`\``;
    }
    case "bullet_list":
      return serializeList(node, indentLevel, false);
    case "ordered_list":
      return serializeList(node, indentLevel, true);
    case "list_item":
      return serializeListItem(node, indentLevel, "-");
    case "todo_item":
      return serializeListItem(node, indentLevel, Boolean(node.attrs.checked) ? "- [x]" : "- [ ]");
    case "horizontal_rule":
      return "---";
    case "unsupported_block":
      return String(node.attrs.raw ?? "").trimEnd();
    default:
      return node.textContent;
  }
}

function serializeList(node: ProseMirrorNode, indentLevel: number, ordered: boolean): string {
  const lines: string[] = [];
  let index = Number(node.attrs.order) || 1;
  node.forEach((child) => {
    const marker = listMarkerForChild(child, ordered, index);
    lines.push(serializeListItem(child, indentLevel, marker));
    index += 1;
  });
  return lines.join("\n");
}

function listMarkerForChild(node: ProseMirrorNode, ordered: boolean, index: number): string {
  if (node.type.name !== "todo_item") {
    return ordered ? `${index}.` : "-";
  }
  const checkbox = Boolean(node.attrs.checked) ? "[x]" : "[ ]";
  return ordered ? `${index}. ${checkbox}` : `- ${checkbox}`;
}

function serializeListItem(node: ProseMirrorNode, indentLevel: number, marker: string): string {
  const indentation = "  ".repeat(indentLevel);
  const childBlocks: ProseMirrorNode[] = [];
  node.forEach((child) => {
    childBlocks.push(child);
  });
  const [first, ...rest] = childBlocks;
  const firstText = first ? serializeBlock(first, indentLevel + 1) : "";
  const lines = [`${indentation}${marker} ${firstText}`.trimEnd()];
  for (const child of rest) {
    lines.push(
      serializeBlock(child, indentLevel + 1)
        .split("\n")
        .map((line) => `${indentation}  ${line}`)
        .join("\n")
    );
  }
  return lines.join("\n");
}

function serializeInline(node: ProseMirrorNode): string {
  const parts: string[] = [];
  node.forEach((child) => {
    if (child.isText) {
      parts.push(wrapTextWithMarks(child.text ?? "", child.marks));
      return;
    }
    if (child.type.name === "hard_break") {
      parts.push("  \n");
      return;
    }
    if (child.type.name === "image") {
      const alt = stringAttribute(child.attrs.alt) ?? "";
      const src = stringAttribute(child.attrs.src) ?? "";
      const title = stringAttribute(child.attrs.title);
      parts.push(title ? `![${alt}](${src} "${title}")` : `![${alt}](${src})`);
    }
  });
  return parts.join("");
}

function wrapTextWithMarks(text: string, marks: readonly Mark[]): string {
  return marks.reduce((value, mark) => {
    if (mark.type.name === "code") {
      return `\`${value}\``;
    }
    if (mark.type.name === "strong") {
      return `**${value}**`;
    }
    if (mark.type.name === "em") {
      return `*${value}*`;
    }
    if (mark.type.name === "link") {
      const href = stringAttribute(mark.attrs.href) ?? "";
      const title = stringAttribute(mark.attrs.title);
      return title ? `[${value}](${href} "${title}")` : `[${value}](${href})`;
    }
    return value;
  }, text);
}

function textNode(schema: MomentariseRichSchema, text: string | null): readonly ProseMirrorNode[] {
  return text ? [schema.text(text)] : [];
}

function rawFromRange(node: MomentariseNode): string {
  if (!node.sourceRange) {
    return "";
  }
  return node.kind === "opaque" ? node.raw : "";
}

function stringAttribute(value: NodeAttributeValue | undefined): string | null {
  return typeof value === "string" ? value : null;
}

function extractLeadingFrontmatterSource(source: string): string | null {
  if (!source.startsWith("---\n")) {
    return null;
  }
  const end = source.indexOf("\n---", 4);
  if (end < 0) {
    return null;
  }
  const closingEnd = source.indexOf("\n", end + 4);
  return source.slice(0, closingEnd >= 0 ? closingEnd : source.length).trimEnd();
}
