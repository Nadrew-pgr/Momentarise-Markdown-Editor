import type {
  Diagnostic,
  DocumentDialect,
  FoldState,
  KnownNode,
  MomentariseNode,
  NodeAttributes,
  NodeAttributeValue,
  OpaqueNode,
  ParseResult,
  SourceRange
} from "@momentarise/md-core";
import { createHeadingNodeId, hashMarkdownContent, headingSegmentFromNodeId, nodeId as createNodeId } from "@momentarise/md-core";
import { createMarkdownAstFormatter, serializeMomentariseDocument } from "@momentarise/md-format";
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
import { Fragment, Mark, Node as ProseMirrorNode, Schema, type DOMOutputSpec, type MarkSpec, type NodeSpec, type ResolvedPos } from "prosemirror-model";
import { EditorState, NodeSelection, Plugin, PluginKey, Selection, TextSelection, type Transaction } from "prosemirror-state";

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
  | "toggleBlock"
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

export interface RichCodeBlockInfo {
  readonly language: string | null;
  readonly meta: string | null;
}

export interface SetRichCodeBlockInfoOptions {
  readonly language?: string | null;
  readonly meta?: string | null;
}

export interface RichHeadingFoldItem {
  readonly folded: boolean;
  readonly hiddenBlockCount: number;
  readonly level: number;
  readonly nodeId: string;
  readonly position: number;
  readonly text: string;
}

export interface RichFoldedBlock {
  readonly folded: boolean;
  readonly headingLevel: number | null;
  readonly hidden: boolean;
  readonly hiddenBy: string | null;
  readonly index: number;
  readonly nodeId: string;
  readonly position: number;
  readonly text: string;
  readonly to: number;
  readonly type: string;
}

export interface RichFoldVisibility {
  readonly blocks: readonly RichFoldedBlock[];
  readonly hiddenBlockCount: number;
  readonly hiddenText: readonly string[];
  readonly visibleBlockCount: number;
  readonly visibleText: readonly string[];
}

export type RichBlockReorderPlacement = "after" | "before";

export interface RichTopLevelBlockRange {
  readonly from: number;
  readonly index: number;
  readonly node: ProseMirrorNode;
  readonly text: string;
  readonly to: number;
  readonly type: string;
}

export interface RichSourcePosition {
  readonly approximate: boolean;
  readonly blockIndex: number;
  readonly position: number;
  readonly sourceOffset: number;
}

export interface RichSourceRange {
  readonly approximate: boolean;
  readonly blockIndex: number;
  readonly from: number;
  readonly sourceFrom: number;
  readonly sourceTo: number;
  readonly to: number;
}

export interface SourceOffsetRange {
  readonly from: number;
  readonly to: number;
}

export interface ReorderRichTopLevelBlockOptions {
  readonly fromIndex: number;
  readonly placement?: RichBlockReorderPlacement;
  readonly toIndex: number;
}

export interface RichBlockAffordanceLabels {
  readonly delete: string;
  readonly drag: string;
  readonly dragInstructions: string;
  readonly duplicate: string;
  readonly insertAfter: string;
  readonly menu: string;
  readonly placeholder: string;
}

export interface RichEditorViewLike {
  readonly state: EditorState;
  dispatch(transaction: Transaction): void;
  focus(): void;
  nodeDOM(position: number): Node | null;
  posAtCoords(coords: { readonly left: number; readonly top: number }): { readonly pos: number } | null;
}

export interface RichDecorationSetLike {
  forChild(offset: number, node: ProseMirrorNode): RichDecorationSetLike;
  forEachSet(callback: (set: any) => void): void;
  map(mapping: Transaction["mapping"], doc: ProseMirrorNode): RichDecorationSetLike;
}

export interface RichDecorationAdapter {
  readonly Decoration: {
    node(from: number, to: number, attrs: Readonly<Record<string, string>>): unknown;
    widget(
      position: number,
      toDom: (view: RichEditorViewLike) => HTMLElement,
      options: Readonly<Record<string, unknown>>
    ): unknown;
  };
  readonly DecorationSet: {
    readonly empty: RichDecorationSetLike;
    create(doc: ProseMirrorNode, decorations: readonly unknown[]): RichDecorationSetLike;
  };
}

export interface RichBlockAffordanceContext extends RichTopLevelBlockRange {
  readonly view: RichEditorViewLike;
}

export interface RichBlockAffordancePluginOptions {
  readonly dragHandle?: boolean;
  readonly labels?: Partial<RichBlockAffordanceLabels>;
  readonly onInsertAfter?: (context: RichBlockAffordanceContext) => void;
  readonly onOpenMenu?: (context: RichBlockAffordanceContext) => void;
  readonly onReorder?: (context: {
    readonly fromIndex: number;
    readonly placement: RichBlockReorderPlacement;
    readonly toIndex: number;
    readonly view: RichEditorViewLike;
  }) => void;
  readonly placeholder?: string | null;
  readonly plusButton?: boolean;
}

export interface RichMarkdownCommandResult {
  readonly handled: boolean;
  readonly state: RichMarkdownState;
}

export interface CreateRichMarkdownStateOptions {
  readonly dialect?: DocumentDialect;
  readonly preferences?: MomentariseRichPreferences;
  readonly schema?: MomentariseRichSchema;
}

export interface MomentariseRichPreferences {
  readonly keymapDelegateToHost?: boolean;
  readonly keymapProfile?: "default" | "delegate" | "minimal";
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
  "code" | "em" | "link" | "strike" | "strong"
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
    aliases: ["toggle", "details", "summary", "foldblock"],
    group: "insert",
    id: "toggleBlock",
    label: "Toggle block"
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

export function createMomentariseRichPlugins(preferences: MomentariseRichPreferences = {}): Plugin[] {
  const normalized = normalizeRichPreferences(preferences);
  const plugins: Plugin[] = [
    createRichPasteSanitizerPlugin(),
    createRichInputRulesPlugin(),
    createTodoTogglePlugin()
  ];
  if (!normalized.keymapDelegateToHost && normalized.keymapProfile !== "delegate") {
    plugins.push(...createRichKeymapPlugins(normalized));
  }
  plugins.push(history());
  if (!normalized.keymapDelegateToHost && normalized.keymapProfile !== "delegate") {
    plugins.push(keymap(baseKeymap));
  }
  return plugins;
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
    plugins: createMomentariseRichPlugins(options.preferences),
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

export function reconfigureRichPlugins(
  state: RichMarkdownState,
  preferences: MomentariseRichPreferences = {}
): RichMarkdownState {
  return {
    ...state,
    editorState: state.editorState.reconfigure({
      plugins: createMomentariseRichPlugins(preferences)
    })
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

function createRichKeymapPlugins(preferences: Required<MomentariseRichPreferences>): Plugin[] {
  if (preferences.keymapProfile === "minimal") {
    return [
      keymap({
        "Mod-z": undo,
        "Mod-y": redo,
        "Mod-Shift-z": redo
      })
    ];
  }
  return [
    keymap({
      "Mod-z": chainCommands(undoRichInputRuleCommand, undo),
      "Mod-y": redo,
      "Mod-Shift-z": redo,
      ArrowDown: exitCodeBlockAtEndCommand,
      ArrowRight: exitCodeBlockAtEndCommand,
      Backspace: liftOrMergeListItemAtStartCommand,
      Enter: chainCommands(exitCodeBlockOnFinalBlankLineCommand, newlineInCode, splitListItemCommand, createParagraphNear, liftEmptyBlock, splitBlock),
      Tab: sinkListItemCommand,
      "Shift-Tab": liftListItemCommand
    })
  ];
}

function normalizeRichPreferences(preferences: MomentariseRichPreferences = {}): Required<MomentariseRichPreferences> {
  return {
    keymapDelegateToHost: preferences.keymapDelegateToHost ?? false,
    keymapProfile: preferences.keymapProfile ?? "default"
  };
}

function isSafeUrl(value: string | null | undefined, options: { readonly allowDataImage?: boolean } = {}): boolean {
  const normalized = normalizeUrlForSafetyCheck(value);
  if (!normalized) {
    return true;
  }
  const schemeMatch = normalized.match(/^([a-z][a-z0-9+.-]*):/i);
  if (!schemeMatch) {
    return true;
  }
  const scheme = schemeMatch[1]!.toLowerCase();
  if (scheme === "http" || scheme === "https" || scheme === "mailto") {
    return true;
  }
  if (options.allowDataImage && scheme === "data") {
    return /^data:image\//i.test(normalized);
  }
  return false;
}

function safeUrlAttribute(
  value: string | null | undefined,
  options: { readonly allowDataImage?: boolean } = {}
): string | null {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed || !isSafeUrl(trimmed, options)) {
    return null;
  }
  return trimmed;
}

function normalizeUrlForSafetyCheck(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim().replace(/[\u0000-\u001F\u007F\s]+/g, "") : "";
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

export function toggleCurrentTodoItem(state: RichMarkdownState): RichMarkdownState {
  const range = currentAncestorBlockRange(state.editorState, "todo_item");
  if (!range) {
    return state;
  }
  const editorState = state.editorState.apply(
    state.editorState.tr.setNodeMarkup(range.from, undefined, {
      ...range.node.attrs,
      checked: !Boolean(range.node.attrs.checked)
    })
  );
  return {
    ...state,
    editorState
  };
}

export function getCurrentCodeBlockInfo(state: RichMarkdownState): RichCodeBlockInfo | null {
  const range = currentAncestorBlockRange(state.editorState, "code_block");
  if (!range) {
    return null;
  }
  return {
    language: stringAttribute(range.node.attrs.language),
    meta: stringAttribute(range.node.attrs.meta)
  };
}

export function setCurrentCodeBlockInfo(
  state: RichMarkdownState,
  options: SetRichCodeBlockInfoOptions
): RichMarkdownState {
  const range = currentAncestorBlockRange(state.editorState, "code_block");
  if (!range) {
    return state;
  }
  const language =
    options.language === undefined
      ? stringAttribute(range.node.attrs.language)
      : normalizeOptionalString(options.language);
  const meta =
    options.meta === undefined
      ? stringAttribute(range.node.attrs.meta)
      : normalizeOptionalString(options.meta);
  const editorState = state.editorState.apply(
    state.editorState.tr.setNodeMarkup(range.from, undefined, {
      ...range.node.attrs,
      language,
      meta
    })
  );
  return {
    ...state,
    editorState
  };
}

export function insertParagraphAfterCurrentBlock(state: RichMarkdownState, text = ""): RichMarkdownState {
  const range = currentTopLevelBlockRange(state.editorState);
  if (!range) {
    return state;
  }
  const paragraph = text
    ? state.editorState.schema.nodes.paragraph!.create(null, [state.editorState.schema.text(text)])
    : state.editorState.schema.nodes.paragraph!.create();
  const transaction = state.editorState.tr.insert(range.to, paragraph);
  const selectionPosition = Math.min(range.to + 1 + text.length, transaction.doc.content.size);
  const editorState = state.editorState.apply(
    transaction.setSelection(TextSelection.near(transaction.doc.resolve(selectionPosition)))
  );
  return {
    ...state,
    editorState
  };
}

export function canInsertParagraphAfterCurrentBlock(state: RichMarkdownState): boolean {
  const range = currentTopLevelBlockRange(state.editorState);
  if (!range) {
    return false;
  }
  return ["blockquote", "code_block", "horizontal_rule", "unsupported_block"].includes(range.node.type.name);
}

export function getRichHeadingFoldItems(
  state: RichMarkdownState,
  folds: readonly FoldState[] = []
): readonly RichHeadingFoldItem[] {
  const foldMap = collapsedFoldMap(folds);
  const blockRecords = richTopLevelBlockRecords(state.editorState.doc, foldMap);
  return blockRecords
    .filter((record) => record.type === "heading" && record.headingLevel !== null)
    .map((record) => ({
      folded: record.folded,
      hiddenBlockCount: countHeadingSectionBlocks(blockRecords, record.index, record.headingLevel ?? 1),
      level: record.headingLevel ?? 1,
      nodeId: record.nodeId,
      position: record.position,
      text: record.text
    }));
}

export function getRichFoldVisibility(
  state: RichMarkdownState,
  folds: readonly FoldState[] = []
): RichFoldVisibility {
  const foldMap = collapsedFoldMap(folds);
  const blocks = richTopLevelBlockRecords(state.editorState.doc, foldMap);
  const hiddenText = blocks.filter((block) => block.hidden).map((block) => block.text);
  const visibleText = blocks.filter((block) => !block.hidden).map((block) => block.text);
  return {
    blocks,
    hiddenBlockCount: hiddenText.length,
    hiddenText,
    visibleBlockCount: visibleText.length,
    visibleText
  };
}

export function toggleRichHeadingFold(
  folds: readonly FoldState[],
  foldNodeId: string
): readonly FoldState[] {
  const existingIndex = folds.findIndex((fold) => fold.nodeId === foldNodeId);
  if (existingIndex < 0) {
    return [
      ...folds,
      {
        collapsed: true,
        nodeId: createNodeId(foldNodeId)
      }
    ];
  }
  return folds.map((fold, index) =>
    index === existingIndex
      ? {
          ...fold,
          collapsed: !fold.collapsed
        }
      : fold
  );
}

const richBlockAffordancePluginKey = new PluginKey<RichDecorationSetLike>("momentarise-rich-block-affordance");

const defaultRichBlockAffordanceLabels: RichBlockAffordanceLabels = {
  delete: "Delete block",
  drag: "Drag block",
  dragInstructions: "Drag to reorder. Press Enter for block actions.",
  duplicate: "Duplicate block",
  insertAfter: "Insert block after",
  menu: "Block actions",
  placeholder: "Type / for commands"
};

export function richTopLevelBlockRanges(state: EditorState): readonly RichTopLevelBlockRange[] {
  const ranges: RichTopLevelBlockRange[] = [];
  state.doc.forEach((node, offset, index) => {
    ranges.push({
      from: offset,
      index,
      node,
      text: node.textContent,
      to: offset + node.nodeSize,
      type: node.type.name
    });
  });
  return ranges;
}

export function richPositionForSourceOffset(
  state: RichMarkdownState,
  sourceOffset: number
): RichSourcePosition | null {
  const mappedRange = richRangeForSourceRange(state, {
    from: sourceOffset,
    to: sourceOffset
  });
  return mappedRange
    ? {
        approximate: mappedRange.approximate,
        blockIndex: mappedRange.blockIndex,
        position: mappedRange.from,
        sourceOffset
      }
    : null;
}

export function richRangeForSourceRange(
  state: RichMarkdownState,
  sourceRange: SourceOffsetRange
): RichSourceRange | null {
  const pairs = richTopLevelBlockPairs(state.parseResult, state.schema).filter(
    (pair) => pair.pm !== null && Boolean(pair.model.sourceRange)
  );
  const blocks: ProseMirrorNode[] = [];
  state.editorState.doc.forEach((child) => {
    blocks.push(child);
  });
  const blockRanges = richTopLevelBlockRanges(state.editorState);
  const alignedBlocks = alignRichBlocks(blocks, pairs);
  for (let blockIndex = 0; blockIndex < alignedBlocks.length; blockIndex += 1) {
    const aligned = alignedBlocks[blockIndex]!;
    if (aligned.kind === "inserted") {
      continue;
    }
    const pair = pairs[aligned.pairIndex]!;
    const modelRange = pair.model.sourceRange!;
    if (sourceRange.from < modelRange.start.offset || sourceRange.to > modelRange.end.offset) {
      continue;
    }
    const blockRange = blockRanges[blockIndex];
    if (!blockRange) {
      return null;
    }
    const mapped = mapSourceRangeInsideRichBlock(
      state.source,
      modelRange,
      sourceRange,
      blockRange,
      aligned.kind !== "matched"
    );
    if (mapped) {
      return mapped;
    }
  }
  return null;
}

export function reorderRichTopLevelBlock(
  state: RichMarkdownState,
  options: ReorderRichTopLevelBlockOptions
): RichMarkdownState {
  const transaction = reorderRichTopLevelBlockTransaction(state.editorState, options);
  if (!transaction) {
    return state;
  }
  return {
    ...state,
    editorState: state.editorState.apply(transaction)
  };
}

export function reorderRichTopLevelBlockTransaction(
  state: EditorState,
  options: ReorderRichTopLevelBlockOptions
): Transaction | null {
  const ranges = richTopLevelBlockRanges(state);
  const from = ranges[options.fromIndex];
  const target = ranges[options.toIndex];
  if (!from || !target || from.index === target.index) {
    return null;
  }
  let transaction = state.tr.delete(from.from, from.to);
  const placement = options.placement ?? "before";
  const targetPosition = placement === "after" ? target.to : target.from;
  const mappedTargetPosition = transaction.mapping.map(targetPosition, placement === "after" ? 1 : -1);
  const insertPosition = Math.max(0, Math.min(mappedTargetPosition, transaction.doc.content.size));
  transaction = transaction.insert(insertPosition, from.node);
  const selectionPosition = Math.min(insertPosition, transaction.doc.content.size);
  return transaction.setSelection(NodeSelection.create(transaction.doc, selectionPosition)).scrollIntoView();
}

export function createRichBlockAffordancePlugin(
  adapter: RichDecorationAdapter,
  options: RichBlockAffordancePluginOptions = {}
): Plugin {
  return new Plugin({
    key: richBlockAffordancePluginKey,
    props: {
      decorations(state) {
        return richBlockAffordancePluginKey.getState(state) ?? adapter.DecorationSet.empty;
      },
      handleDOMEvents: {
        dragover(_view, event) {
          const dragEvent = event as DragEvent;
          if (dragEvent.dataTransfer?.types.includes("application/x-momentarise-rich-block-index")) {
            dragEvent.preventDefault();
            dragEvent.dataTransfer.dropEffect = "move";
            return true;
          }
          return false;
        },
        drop(view, event) {
          return handleRichBlockDrop(view, event as DragEvent, options);
        }
      }
    },
    state: {
      apply(transaction, previous, _oldState, nextState) {
        if (transaction.docChanged || transaction.selectionSet || transaction.getMeta(richBlockAffordancePluginKey)) {
          return createRichBlockAffordanceDecorations(nextState, adapter, options);
        }
        return previous.map(transaction.mapping, transaction.doc);
      },
      init(_config, state) {
        return createRichBlockAffordanceDecorations(state, adapter, options);
      }
    }
  });
}

function createRichBlockAffordanceDecorations(
  state: EditorState,
  adapter: RichDecorationAdapter,
  options: RichBlockAffordancePluginOptions
): RichDecorationSetLike {
  const labels = richBlockAffordanceLabels(options);
  const decorations: unknown[] = [];
  const ranges = richTopLevelBlockRanges(state);
  const first = ranges[0];
  if (
    first &&
    ranges.length === 1 &&
    first.type === "paragraph" &&
    first.node.content.size === 0 &&
    options.placeholder !== null
  ) {
    decorations.push(
      adapter.Decoration.node(first.from, first.to, {
        class: "empty-rich-document",
        "data-placeholder": options.placeholder ?? labels.placeholder
      })
    );
  }

  for (const range of ranges) {
    decorations.push(
      adapter.Decoration.widget(range.from + 1, (view) => createRichBlockAffordanceWidget(view, range, options), {
        key: `rich-block-affordance:${range.index}:${range.type}:${range.text}`,
        side: -1
      })
    );
  }

  return adapter.DecorationSet.create(state.doc, decorations);
}

function createRichBlockAffordanceWidget(
  view: RichEditorViewLike,
  range: RichTopLevelBlockRange,
  options: RichBlockAffordancePluginOptions
): HTMLElement {
  const labels = richBlockAffordanceLabels(options);
  const root = document.createElement("span");
  root.className = "rich-block-affordance";
  root.contentEditable = "false";
  root.dataset.richBlockAffordance = "";
  root.dataset.richBlockIndex = String(range.index);
  root.dataset.testid = `rich-block-affordance-${range.index}`;
  root.addEventListener("focusin", () => {
    root.dataset.focusVisible = "true";
  });
  root.addEventListener("focusout", () => {
    delete root.dataset.focusVisible;
  });

  if (options.plusButton !== false) {
    const insertButton = document.createElement("button");
    insertButton.className = "rich-block-affordance-button rich-block-insert-button";
    insertButton.dataset.richBlockInsertAfter = "";
    insertButton.dataset.testid = `rich-block-insert-after-${range.index}`;
    insertButton.setAttribute("aria-label", labels.insertAfter);
    insertButton.title = labels.insertAfter;
    insertButton.type = "button";
    insertButton.textContent = "+";
    insertButton.addEventListener("focus", () => {
      root.dataset.focusVisible = "true";
      root.style.opacity = "1";
    });
    insertButton.addEventListener("blur", () => {
      delete root.dataset.focusVisible;
      root.style.removeProperty("opacity");
    });
    insertButton.addEventListener("mousedown", preventEditorBlur);
    insertButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const currentRange = richTopLevelBlockRanges(view.state)[range.index];
      if (!currentRange) {
        return;
      }
      insertParagraphAfterRichBlock(view, currentRange);
      options.onInsertAfter?.(richBlockAffordanceContext(view, currentRange));
    });
    root.append(insertButton);
  }

  const menuButton = document.createElement("button");
  menuButton.className = "rich-block-affordance-button rich-block-drag-handle";
  menuButton.dataset.richBlockDragHandle = "";
  menuButton.dataset.testid = `rich-block-drag-handle-${range.index}`;
  menuButton.draggable = options.dragHandle !== false;
  menuButton.setAttribute("aria-describedby", `rich-block-drag-instructions-${range.index}`);
  menuButton.setAttribute("aria-label", labels.menu);
  menuButton.title = labels.dragInstructions;
  menuButton.type = "button";
  menuButton.textContent = "::";
  menuButton.addEventListener("focus", () => {
    root.dataset.focusVisible = "true";
    root.style.opacity = "1";
  });
  menuButton.addEventListener("blur", () => {
    delete root.dataset.focusVisible;
    root.style.removeProperty("opacity");
  });
  menuButton.addEventListener("mousedown", preventEditorBlur);
  menuButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openRichBlockMenu(view, range.index, options);
  });
  menuButton.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    openRichBlockMenu(view, range.index, options);
  });
  menuButton.addEventListener("dragstart", (event) => {
    if (options.dragHandle === false) {
      event.preventDefault();
      return;
    }
    const currentRange = richTopLevelBlockRanges(view.state)[range.index];
    if (!currentRange || !event.dataTransfer) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-momentarise-rich-block-index", String(currentRange.index));
    event.dataTransfer.setData("text/plain", `momentarise-rich-block:${currentRange.index}`);
    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, currentRange.from)));
  });
  root.append(menuButton);

  const instructions = document.createElement("span");
  instructions.id = `rich-block-drag-instructions-${range.index}`;
  instructions.className = "rich-block-drag-instructions";
  instructions.textContent = labels.dragInstructions;
  root.append(instructions);

  return root;
}

function handleRichBlockDrop(
  view: RichEditorViewLike,
  event: DragEvent,
  options: RichBlockAffordancePluginOptions
): boolean {
  const viewDom = (view as { readonly dom?: HTMLElement }).dom;
  viewDom?.setAttribute("data-rich-block-drop-seen", "true");
  const rawIndex = event.dataTransfer?.getData("application/x-momentarise-rich-block-index");
  const fallbackIndex = event.dataTransfer?.getData("text/plain").match(/^momentarise-rich-block:(\d+)$/)?.[1] ?? "";
  const syntheticIndex = (event as DragEvent & { readonly mmeRichBlockIndex?: number }).mmeRichBlockIndex;
  if (!rawIndex && !fallbackIndex && syntheticIndex === undefined) {
    viewDom?.setAttribute("data-rich-block-drop-result", "missing-index");
    return false;
  }
  const fromIndex = Number(rawIndex || fallbackIndex || syntheticIndex);
  if (!Number.isInteger(fromIndex)) {
    viewDom?.setAttribute("data-rich-block-drop-result", "invalid-index");
    return false;
  }
  const coords = {
    left: event.clientX,
    top: event.clientY
  };
  const position = view.posAtCoords(coords);
  if (!position) {
    viewDom?.setAttribute("data-rich-block-drop-result", "missing-position");
    return false;
  }
  const ranges = richTopLevelBlockRanges(view.state);
  const target = richBlockRangeAtPosition(ranges, position.pos);
  if (!target) {
    viewDom?.setAttribute("data-rich-block-drop-result", "missing-target");
    return false;
  }
  const placement = richBlockDropPlacement(view, target, event.clientY);
  const transaction = reorderRichTopLevelBlockTransaction(view.state, {
    fromIndex,
    placement,
    toIndex: target.index
  });
  if (!transaction) {
    viewDom?.setAttribute("data-rich-block-drop-result", "missing-transaction");
    return false;
  }
  event.preventDefault();
  view.dispatch(transaction);
  viewDom?.setAttribute("data-rich-block-drop-result", `reordered:${fromIndex}:${placement}:${target.index}`);
  options.onReorder?.({
    fromIndex,
    placement,
    toIndex: target.index,
    view
  });
  return true;
}

function richBlockRangeAtPosition(
  ranges: readonly RichTopLevelBlockRange[],
  position: number
): RichTopLevelBlockRange | null {
  return ranges.find((range) => position >= range.from && position <= range.to) ?? ranges.at(-1) ?? null;
}

function richBlockDropPlacement(
  view: RichEditorViewLike,
  target: RichTopLevelBlockRange,
  clientY: number
): RichBlockReorderPlacement {
  const dom = view.nodeDOM(target.from);
  if (dom instanceof HTMLElement) {
    const rect = dom.getBoundingClientRect();
    return clientY > rect.top + rect.height / 2 ? "after" : "before";
  }
  return "before";
}

function insertParagraphAfterRichBlock(view: RichEditorViewLike, range: RichTopLevelBlockRange): void {
  const paragraph = view.state.schema.nodes.paragraph?.create();
  if (!paragraph) {
    return;
  }
  let transaction = view.state.tr.insert(range.to, paragraph);
  const selectionPosition = Math.min(range.to + 1, transaction.doc.content.size);
  transaction = transaction.setSelection(TextSelection.create(transaction.doc, selectionPosition)).scrollIntoView();
  view.dispatch(transaction);
  view.focus();
}

function openRichBlockMenu(
  view: RichEditorViewLike,
  index: number,
  options: RichBlockAffordancePluginOptions
): void {
  const range = richTopLevelBlockRanges(view.state)[index];
  if (!range) {
    return;
  }
  view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, range.from)));
  options.onOpenMenu?.(richBlockAffordanceContext(view, range));
}

function richBlockAffordanceContext(
  view: RichEditorViewLike,
  range: RichTopLevelBlockRange
): RichBlockAffordanceContext {
  return {
    ...range,
    view
  };
}

function richBlockAffordanceLabels(options: RichBlockAffordancePluginOptions): RichBlockAffordanceLabels {
  return {
    ...defaultRichBlockAffordanceLabels,
    ...options.labels
  };
}

function mapSourceRangeInsideRichBlock(
  source: string,
  modelRange: SourceRange,
  sourceRange: SourceOffsetRange,
  blockRange: RichTopLevelBlockRange,
  approximate: boolean
): RichSourceRange | null {
  const raw = source.slice(modelRange.start.offset, modelRange.end.offset);
  const text = blockRange.text;
  const textStartInRaw = text ? raw.indexOf(text) : 0;
  if (textStartInRaw < 0) {
    return null;
  }
  const sourceTextStart = modelRange.start.offset + textStartInRaw;
  const sourceTextEnd = sourceTextStart + text.length;
  if (sourceRange.from < sourceTextStart || sourceRange.to > sourceTextEnd) {
    return null;
  }
  const relativeFrom = Math.max(0, Math.min(sourceRange.from - sourceTextStart, text.length));
  const relativeTo = Math.max(relativeFrom, Math.min(sourceRange.to - sourceTextStart, text.length));
  return {
    approximate,
    blockIndex: blockRange.index,
    from: blockRange.from + 1 + relativeFrom,
    sourceFrom: sourceRange.from,
    sourceTo: sourceRange.to,
    to: blockRange.from + 1 + relativeTo
  };
}

function preventEditorBlur(event: MouseEvent): void {
  event.preventDefault();
}

export function serializeRichMarkdownState(state: RichMarkdownState): {
  readonly content: string;
  readonly diagnostics: readonly Diagnostic[];
} {
  return {
    content: serializeRichMarkdownContent(state),
    diagnostics: [
      {
        code: "rich_prosemirror_serializer",
        message:
          "Serialized rich mode back to Markdown, emitting original source bytes for untouched top-level blocks.",
        severity: "info"
      }
    ]
  };
}

function serializeRichMarkdownContent(state: RichMarkdownState): string {
  const source = state.source;
  const pairs = richTopLevelBlockPairs(state.parseResult, state.schema).filter(
    (pair) => pair.pm !== null && Boolean(pair.model.sourceRange)
  );
  const blocks: ProseMirrorNode[] = [];
  state.editorState.doc.forEach((child) => {
    blocks.push(child);
  });

  if (pairs.length === 0) {
    const onlyDefaultEmptyParagraph =
      blocks.length === 1 && blocks[0]!.type.name === "paragraph" && blocks[0]!.content.size === 0;
    if (onlyDefaultEmptyParagraph) {
      // The mapping produced only the default empty paragraph and nothing was typed:
      // the document is untouched, so the original bytes are the truth.
      return source;
    }
    const body = serializeReconstructedProseMirrorDoc(state.editorState.doc).trimEnd();
    return state.frontmatterSource ? `${state.frontmatterSource}\n\n${body}\n` : `${body}\n`;
  }

  const fallbackPrefix = state.frontmatterSource ? `${state.frontmatterSource}\n\n` : "";
  const segments: string[] = [];
  const alignedBlocks = alignRichBlocks(blocks, pairs);
  let lastOriginalIndex = -1;

  for (const aligned of alignedBlocks) {
    if (aligned.kind === "matched") {
      const originalIndex = aligned.pairIndex;
      const range = pairs[originalIndex]!.model.sourceRange!;
      let separator: string;
      if (segments.length === 0) {
        separator = originalIndex === 0 ? source.slice(0, range.start.offset) : fallbackPrefix;
      } else if (lastOriginalIndex >= 0 && originalIndex === lastOriginalIndex + 1) {
        separator = source.slice(pairs[lastOriginalIndex]!.model.sourceRange!.end.offset, range.start.offset);
      } else {
        separator = "\n\n";
      }
      segments.push(separator + source.slice(range.start.offset, range.end.offset));
      lastOriginalIndex = originalIndex;
    } else {
      const originalIndex = aligned.kind === "replaced" ? aligned.pairIndex : -1;
      const text = serializeReconstructedProseMirrorBlock(aligned.block);
      let separator: string;
      if (originalIndex >= 0) {
        const range = pairs[originalIndex]!.model.sourceRange!;
        if (segments.length === 0) {
          separator = originalIndex === 0 ? source.slice(0, range.start.offset) : fallbackPrefix;
        } else if (lastOriginalIndex >= 0 && originalIndex === lastOriginalIndex + 1) {
          separator = source.slice(pairs[lastOriginalIndex]!.model.sourceRange!.end.offset, range.start.offset);
        } else {
          separator = "\n\n";
        }
        // A reconstructed replacement still occupies the original pair slot,
        // so the next untouched neighbor can reuse the original gap-after.
        lastOriginalIndex = originalIndex;
      } else {
        separator = segments.length === 0 ? fallbackPrefix : "\n\n";
      }
      segments.push(separator + text);
    }
  }

  let content = segments.join("");
  if (lastOriginalIndex === pairs.length - 1) {
    content += source.slice(pairs[lastOriginalIndex]!.model.sourceRange!.end.offset);
  } else {
    content = `${content.trimEnd()}\n`;
  }
  return content;
}

export function proseMirrorDocToMomentariseNodes(doc: ProseMirrorNode): readonly MomentariseNode[] {
  const idFactory = createModelNodeIdFactory();
  const nodes: MomentariseNode[] = [];
  doc.forEach((child) => {
    nodes.push(proseMirrorBlockToMomentariseNode(child, idFactory));
  });
  return nodes;
}

function serializeReconstructedProseMirrorDoc(doc: ProseMirrorNode): string {
  const result = createSyntheticParseResult(proseMirrorDocToMomentariseNodes(doc));
  return serializeMomentariseDocument(result).content;
}

function serializeReconstructedProseMirrorBlock(block: ProseMirrorNode): string {
  const doc = block.type.schema.nodes.doc!.create(null, [block]);
  return serializeReconstructedProseMirrorDoc(doc).trimEnd();
}

function createSyntheticParseResult(nodes: readonly MomentariseNode[]): ParseResult {
  const content = "";
  const diagnostics: Diagnostic[] = [];
  const hash = hashMarkdownContent(content);
  return {
    diagnostics,
    document: {
      diagnostics,
      dialect: "momentarise-enhanced",
      root: {
        children: nodes,
        id: createNodeId("rich-reconstructed-root"),
        kind: "root",
        type: "document"
      }
    },
    snapshot: {
      content,
      dialect: "momentarise-enhanced",
      hash,
      path: null
    }
  };
}

function createModelNodeIdFactory(): () => ReturnType<typeof createNodeId> {
  let index = 0;
  return () => {
    index += 1;
    return createNodeId(`rich-reconstructed-${index}`);
  };
}

function proseMirrorBlockToMomentariseNode(
  node: ProseMirrorNode,
  nextId: () => ReturnType<typeof createNodeId>
): KnownNode {
  switch (node.type.name) {
    case "heading":
      return knownNode(nextId, "block", "heading", proseMirrorInlineChildrenToMomentariseNodes(node, nextId), {
        depth: Number(node.attrs.level) || 1
      });
    case "paragraph":
      return knownNode(nextId, "block", "paragraph", proseMirrorInlineChildrenToMomentariseNodes(node, nextId));
    case "blockquote":
      return knownNode(nextId, "block", "blockquote", proseMirrorBlockChildrenToMomentariseNodes(node, nextId));
    case "code_block":
      return knownNode(nextId, "block", "codeFence", [], {
        language: stringAttribute(node.attrs.language),
        meta: stringAttribute(node.attrs.meta),
        value: node.textContent
      });
    case "bullet_list":
      return knownNode(nextId, "block", "list", proseMirrorBlockChildrenToMomentariseNodes(node, nextId), {
        ordered: false
      });
    case "ordered_list":
      return knownNode(nextId, "block", "list", proseMirrorBlockChildrenToMomentariseNodes(node, nextId), {
        ordered: true,
        start: Number(node.attrs.order) || 1
      });
    case "list_item":
      return knownNode(nextId, "block", "listItem", proseMirrorBlockChildrenToMomentariseNodes(node, nextId));
    case "todo_item":
      return knownNode(nextId, "block", "listItem", proseMirrorBlockChildrenToMomentariseNodes(node, nextId), {
        checked: Boolean(node.attrs.checked)
      });
    case "horizontal_rule":
      return knownNode(nextId, "block", "thematicBreak", []);
    case "unsupported_block":
      return knownNode(nextId, "block", "rawMarkdown", [], {
        raw: String(node.attrs.raw ?? "")
      });
    default:
      return knownNode(nextId, "block", "paragraph", [
        knownNode(nextId, "inline", "text", [], {
          value: node.textContent
        })
      ]);
  }
}

function proseMirrorBlockChildrenToMomentariseNodes(
  node: ProseMirrorNode,
  nextId: () => ReturnType<typeof createNodeId>
): readonly MomentariseNode[] {
  const children: MomentariseNode[] = [];
  node.forEach((child) => {
    children.push(proseMirrorBlockToMomentariseNode(child, nextId));
  });
  return children;
}

function proseMirrorInlineChildrenToMomentariseNodes(
  node: ProseMirrorNode,
  nextId: () => ReturnType<typeof createNodeId>
): readonly MomentariseNode[] {
  const children: MomentariseNode[] = [];
  node.forEach((child) => {
    children.push(...proseMirrorInlineNodeToMomentariseNodes(child, nextId));
  });
  return children;
}

function proseMirrorInlineNodeToMomentariseNodes(
  node: ProseMirrorNode,
  nextId: () => ReturnType<typeof createNodeId>
): readonly MomentariseNode[] {
  if (node.isText) {
    return [wrapMomentariseTextMarks(knownNode(nextId, "inline", "text", [], { value: node.text ?? "" }), node.marks, nextId)];
  }
  if (node.type.name === "hard_break") {
    return [knownNode(nextId, "inline", "lineBreak", [])];
  }
  if (node.type.name === "image") {
    return [
      knownNode(nextId, "inline", "image", [], {
        alt: stringAttribute(node.attrs.alt) ?? "",
        title: stringAttribute(node.attrs.title),
        url: stringAttribute(node.attrs.src) ?? ""
      })
    ];
  }
  return [knownNode(nextId, "inline", "text", [], { value: node.textContent })];
}

function wrapMomentariseTextMarks(
  base: KnownNode,
  marks: readonly Mark[],
  nextId: () => ReturnType<typeof createNodeId>
): KnownNode {
  return marks.reduceRight((child, mark) => {
    if (mark.type.name === "code") {
      return knownNode(nextId, "inline", "inlineCode", [], { value: inlineTextContent(child) });
    }
    if (mark.type.name === "strong") {
      return knownNode(nextId, "inline", "strong", [child]);
    }
    if (mark.type.name === "em") {
      return knownNode(nextId, "inline", "emphasis", [child]);
    }
    if (mark.type.name === "strike") {
      return knownNode(nextId, "inline", "strikethrough", [child]);
    }
    if (mark.type.name === "link") {
      return knownNode(nextId, "inline", "link", [child], {
        title: stringAttribute(mark.attrs.title),
        url: stringAttribute(mark.attrs.href) ?? ""
      });
    }
    return child;
  }, base);
}

function inlineTextContent(node: MomentariseNode): string {
  if (node.kind === "opaque") {
    return node.raw;
  }
  if (node.type === "text") {
    return stringAttribute(node.attributes?.value) ?? "";
  }
  return (node.children ?? []).map((child) => inlineTextContent(child)).join("");
}

function knownNode(
  nextId: () => ReturnType<typeof createNodeId>,
  kind: "root" | "block" | "inline",
  type: string,
  children: readonly MomentariseNode[],
  attributes?: NodeAttributes
): KnownNode {
  return {
    ...(attributes ? { attributes: removeNullAttributes(attributes) } : {}),
    ...(children.length > 0 ? { children } : {}),
    id: nextId(),
    kind,
    type
  };
}

function removeNullAttributes(attributes: NodeAttributes): NodeAttributes {
  return Object.fromEntries(Object.entries(attributes).filter(([, value]) => value !== null)) as NodeAttributes;
}

type RichBlockAlignment =
  | {
      readonly block: ProseMirrorNode;
      readonly kind: "inserted";
    }
  | {
      readonly block: ProseMirrorNode;
      readonly kind: "matched" | "replaced";
      readonly pairIndex: number;
    };

function alignRichBlocks(
  blocks: readonly ProseMirrorNode[],
  pairs: readonly RichTopLevelBlockPair[]
): readonly RichBlockAlignment[] {
  const alignment: RichBlockAlignment[] = [];
  const consumedPairIndexes = new Set<number>();

  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex += 1) {
    const block = blocks[blockIndex]!;
    const exactMatchIndex = findExactRichPairIndex(block, pairs, consumedPairIndexes);
    if (exactMatchIndex >= 0) {
      alignment.push({
        block,
        kind: "matched",
        pairIndex: exactMatchIndex
      });
      consumedPairIndexes.add(exactMatchIndex);
      continue;
    }

    const replacementIndex = findReplacementRichPairIndex(blockIndex, blocks, pairs, consumedPairIndexes);
    if (replacementIndex >= 0) {
      alignment.push({
        block,
        kind: "replaced",
        pairIndex: replacementIndex
      });
      consumedPairIndexes.add(replacementIndex);
    } else {
      alignment.push({
        block,
        kind: "inserted"
      });
    }
  }

  return alignment;
}

function findExactRichPairIndex(
  block: ProseMirrorNode,
  pairs: readonly RichTopLevelBlockPair[],
  consumedPairIndexes: ReadonlySet<number>
): number {
  for (let pairIndex = 0; pairIndex < pairs.length; pairIndex += 1) {
    if (consumedPairIndexes.has(pairIndex)) {
      continue;
    }
    if (pairs[pairIndex]!.pm!.eq(block)) {
      return pairIndex;
    }
  }
  return -1;
}

function findReplacementRichPairIndex(
  blockIndex: number,
  blocks: readonly ProseMirrorNode[],
  pairs: readonly RichTopLevelBlockPair[],
  consumedPairIndexes: ReadonlySet<number>
): number {
  for (let pairIndex = 0; pairIndex < pairs.length; pairIndex += 1) {
    if (consumedPairIndexes.has(pairIndex)) {
      continue;
    }
    const insertScore = countFutureExactRichMatches(blockIndex + 1, blocks, pairs, consumedPairIndexes);
    const consumedWithReplacement = new Set(consumedPairIndexes);
    consumedWithReplacement.add(pairIndex);
    const replaceScore = countFutureExactRichMatches(blockIndex + 1, blocks, pairs, consumedWithReplacement);
    return replaceScore >= insertScore ? pairIndex : -1;
  }
  return -1;
}

function countFutureExactRichMatches(
  fromBlockIndex: number,
  blocks: readonly ProseMirrorNode[],
  pairs: readonly RichTopLevelBlockPair[],
  consumedPairIndexes: ReadonlySet<number>
): number {
  const consumed = new Set(consumedPairIndexes);
  let matchCount = 0;
  for (let blockIndex = fromBlockIndex; blockIndex < blocks.length; blockIndex += 1) {
    const pairIndex = findExactRichPairIndex(blocks[blockIndex]!, pairs, consumed);
    if (pairIndex >= 0) {
      consumed.add(pairIndex);
      matchCount += 1;
    }
  }
  return matchCount;
}

export function markdownDocumentToProseMirror(
  parseResult: ParseResult,
  schema: MomentariseRichSchema = createMomentariseRichSchema()
): ProseMirrorNode {
  const content = richTopLevelBlockPairs(parseResult, schema)
    .map((pair) => pair.pm)
    .filter((node): node is ProseMirrorNode => Boolean(node));
  return schema.nodes.doc.create(null, content.length > 0 ? content : [schema.nodes.paragraph.create()]);
}

interface RichTopLevelBlockPair {
  readonly model: MomentariseNode;
  readonly pm: ProseMirrorNode | null;
}

function richTopLevelBlockPairs(
  parseResult: ParseResult,
  schema: MomentariseRichSchema
): readonly RichTopLevelBlockPair[] {
  const source = parseResult.snapshot.content;
  return filterRichRootNodes(parseResult.document.root.children ?? [])
    .filter((node) => node.type !== "yaml" && node.type !== "yamlFrontmatter")
    .map((node) => ({
      model: node,
      pm: blockNodeToProseMirror(node, schema, source)
    }));
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
    case "toggleBlock": {
      const summary = escapeDetailsSummary(currentBlockText(state) || "Toggle");
      return replaceCurrentBlock(
        state,
        dispatch,
        schema.nodes.unsupported_block!.create({
          raw: `<details>\n<summary>${summary}</summary>\n\n</details>`,
          reason: "toggle block explicit details fallback"
        })
      );
    }
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

const richInputRulesPluginKey = new PluginKey("momentarise-rich-input-rules");

interface RichInputRulesPluginState {
  readonly undoText: string;
}

type RichMarkdownInputRule =
  | { readonly kind: "blockquote"; readonly prefixLength: number }
  | { readonly kind: "bullet_list"; readonly prefixLength: number }
  | { readonly kind: "code_block"; readonly language: string | null; readonly prefixLength: number }
  | { readonly kind: "heading"; readonly level: number; readonly prefixLength: number }
  | { readonly kind: "ordered_list"; readonly prefixLength: number }
  | { readonly checked: boolean; readonly kind: "todo_item"; readonly prefixLength: number };

function createRichPasteSanitizerPlugin(): Plugin {
  return new Plugin({
    props: {
      transformPastedHTML(html) {
        return sanitizePastedHtml(html);
      }
    }
  });
}

function sanitizePastedHtml(html: string): string {
  if (typeof DOMParser !== "undefined") {
    const document = new DOMParser().parseFromString(html, "text/html");
    for (const element of [...document.body.querySelectorAll("script")]) {
      element.remove();
    }
    for (const element of [...document.body.querySelectorAll("*")]) {
      sanitizeElementAttributes(element);
    }
    return document.body.innerHTML;
  }
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s+(href|src)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, (match, name: string, rawValue: string) => {
      const attributeName = name.toLowerCase();
      const value = decodeHtmlCharacterReferences(stripAttributeQuotes(rawValue));
      return isSafeUrl(value, { allowDataImage: attributeName === "src" }) ? match : "";
    });
}

function stripAttributeQuotes(value: string): string {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function decodeHtmlCharacterReferences(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    colon: ":",
    gt: ">",
    lt: "<",
    quot: '"'
  };
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]+);?/gi, (match, entity: string) => {
    const normalized = entity.toLowerCase();
    if (normalized.startsWith("#x")) {
      const codePoint = Number.parseInt(normalized.slice(2), 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    if (normalized.startsWith("#")) {
      const codePoint = Number.parseInt(normalized.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    return named[normalized] ?? match;
  });
}

function sanitizeElementAttributes(element: Element): void {
  for (const attribute of [...element.attributes]) {
    const name = attribute.name.toLowerCase();
    if (name.startsWith("on")) {
      element.removeAttribute(attribute.name);
      continue;
    }
    if (name === "href" && !isSafeUrl(attribute.value)) {
      element.removeAttribute(attribute.name);
      continue;
    }
    if (name === "src" && !isSafeUrl(attribute.value, { allowDataImage: element.tagName.toLowerCase() === "img" })) {
      element.removeAttribute(attribute.name);
    }
  }
}

function createRichInputRulesPlugin(): Plugin {
  return new Plugin<RichInputRulesPluginState | null>({
    appendTransaction(transactions, _oldState, state) {
      if (transactions.some((transaction) => transaction.getMeta(richInputRulesPluginKey))) {
        return null;
      }
      if (!transactions.some((transaction) => transaction.docChanged)) {
        return null;
      }
      if (!(state.selection instanceof TextSelection) || !state.selection.empty) {
        return null;
      }
      const { $from } = state.selection;
      if ($from.parent.type !== state.schema.nodes.paragraph) {
        return null;
      }
      const text = $from.parent.textBetween(0, $from.parent.content.size, "\n", "\n");
      const textBeforeCursor = $from.parent.textBetween(0, $from.parentOffset, "\n", "\n");
      const listTodoRule = todoInputRuleForListItemText(textBeforeCursor);
      if (listTodoRule) {
        return createListTodoInputRuleTransaction(state, listTodoRule);
      }

      const rule = markdownInputRuleForText(textBeforeCursor);
      if (!rule) {
        return null;
      }

      const from = $from.before();
      const to = $from.after();
      const prefixFrom = $from.start();
      const prefixTo = prefixFrom + rule.prefixLength;
      const transaction = state.tr.delete(prefixFrom, prefixTo).setMeta(richInputRulesPluginKey, {
        undoText: text
      });
      const mappedFrom = transaction.mapping.map(from);
      const mappedTo = transaction.mapping.map(to);

      if (rule.kind === "heading") {
        transaction.setBlockType(mappedFrom, mappedTo, state.schema.nodes.heading!, {
          level: rule.level
        });
        return transaction;
      }

      const retainedParagraph = transaction.doc.nodeAt(mappedFrom);
      const replacement = replacementForInputRule(
        rule,
        state.schema,
        retainedParagraph?.type === state.schema.nodes.paragraph ? retainedParagraph : state.schema.nodes.paragraph!.create()
      );
      if (!replacement) {
        return null;
      }
      transaction.replaceWith(mappedFrom, mappedTo, replacement);
      const selectionPosition = Math.min(mappedFrom + selectionOffsetForInputRule(rule), transaction.doc.content.size);
      return transaction.setSelection(TextSelection.near(transaction.doc.resolve(selectionPosition)));
    },
    key: richInputRulesPluginKey,
    props: {
      handleKeyDown(view, event) {
        if (event.key !== "Enter") {
          return false;
        }
        const transaction = createCodeFenceEnterTransaction(view.state);
        if (!transaction) {
          return false;
        }
        event.preventDefault();
        view.dispatch(transaction);
        return true;
      }
    },
    state: {
      apply(transaction, previous) {
        const meta = transaction.getMeta(richInputRulesPluginKey);
        if (meta && typeof meta === "object" && typeof meta.undoText === "string") {
          return {
            undoText: meta.undoText
          };
        }
        if (transaction.docChanged && !meta) {
          return null;
        }
        return previous;
      },
      init() {
        return null;
      }
    }
  });
}

function undoRichInputRuleCommand(state: EditorState, dispatch?: (transaction: Transaction) => void): boolean {
  const pluginState = richInputRulesPluginKey.getState(state) as RichInputRulesPluginState | null;
  if (!pluginState || !(state.selection instanceof TextSelection)) {
    return false;
  }
  const { $from } = state.selection;
  if ($from.depth < 1) {
    return false;
  }
  const paragraph = state.schema.nodes.paragraph!.create(
    null,
    pluginState.undoText ? state.schema.text(pluginState.undoText) : undefined
  );
  const from = $from.before(1);
  const to = $from.after(1);
  const transaction = state.tr.replaceWith(from, to, paragraph).setMeta(richInputRulesPluginKey, true);
  const selectionPosition = Math.min(from + 1 + pluginState.undoText.length, transaction.doc.content.size);
  dispatch?.(transaction.setSelection(TextSelection.near(transaction.doc.resolve(selectionPosition))));
  return true;
}

function splitListItemCommand(state: EditorState, dispatch?: (transaction: Transaction) => void): boolean {
  const transaction = createListItemEnterTransaction(state);
  if (!transaction) {
    return false;
  }
  dispatch?.(transaction);
  return true;
}

function exitCodeBlockOnFinalBlankLineCommand(state: EditorState, dispatch?: (transaction: Transaction) => void): boolean {
  const transaction = createCodeBlockExitTransaction(state, {
    trimFinalBlankLine: true
  });
  if (!transaction) {
    return false;
  }
  dispatch?.(transaction);
  return true;
}

function exitCodeBlockAtEndCommand(state: EditorState, dispatch?: (transaction: Transaction) => void): boolean {
  const transaction = createCodeBlockExitTransaction(state, {
    trimFinalBlankLine: false
  });
  if (!transaction) {
    return false;
  }
  dispatch?.(transaction);
  return true;
}

function createCodeBlockExitTransaction(
  state: EditorState,
  options: { readonly trimFinalBlankLine: boolean }
): Transaction | null {
  if (!(state.selection instanceof TextSelection) || !state.selection.empty) {
    return null;
  }
  const { $from } = state.selection;
  if ($from.parent.type !== state.schema.nodes.code_block || $from.parentOffset !== $from.parent.content.size) {
    return null;
  }
  if (options.trimFinalBlankLine && !$from.parent.textContent.endsWith("\n")) {
    return null;
  }

  const codeDepth = $from.depth;
  const paragraph = state.schema.nodes.paragraph!.create();
  let transaction = state.tr;
  if (options.trimFinalBlankLine && $from.parent.content.size > 0) {
    const contentStart = $from.start(codeDepth);
    const trimFrom = contentStart + $from.parent.content.size - 1;
    transaction = transaction.delete(trimFrom, trimFrom + 1);
  }

  const insertAt = transaction.mapping.map($from.after(codeDepth));
  transaction = transaction.insert(insertAt, paragraph);
  const selectionPosition = Math.min(insertAt + 1, transaction.doc.content.size);
  return transaction.setSelection(TextSelection.create(transaction.doc, selectionPosition));
}

function createTodoTogglePlugin(): Plugin {
  return new Plugin({
    props: {
      handleKeyDown(view, event) {
        if (event.key !== " " && event.key !== "Enter") {
          return false;
        }
        const posAtDOM = typeof view.posAtDOM === "function" ? view.posAtDOM.bind(view) : undefined;
        const transaction = createTodoToggleTransactionFromTarget(view.state, event.target, posAtDOM);
        if (!transaction) {
          return false;
        }
        event.preventDefault();
        view.dispatch(transaction);
        return true;
      },
      handleClick(view, _position, event) {
        const transaction = createTodoToggleTransactionFromTarget(view.state, event.target, view.posAtDOM.bind(view));
        if (!transaction) {
          return false;
        }
        view.dispatch(transaction);
        return true;
      }
    }
  });
}

function createTodoToggleTransactionFromTarget(
  state: EditorState,
  target: EventTarget | null,
  posAtDOM?: (node: Node, offset: number) => number
): Transaction | null {
  if (typeof Element === "undefined" || !(target instanceof Element)) {
    return null;
  }
  const toggle = target.closest("[data-todo-toggle]");
  if (!toggle) {
    return null;
  }
  const todoElement = toggle.closest('[data-type="todo-item"]');
  if (!todoElement) {
    return null;
  }
  const position = posAtDOM ? posAtDOM(todoElement, 0) : Number(todoElement.getAttribute("data-position") ?? NaN);
  if (!Number.isFinite(position)) {
    return null;
  }
  const match = findNodePositionAround(state.doc, position, "todo_item");
  if (!match) {
    return null;
  }
  return state.tr.setNodeMarkup(match.position, undefined, {
    ...match.node.attrs,
    checked: !Boolean(match.node.attrs.checked)
  });
}

function createListItemEnterTransaction(state: EditorState): Transaction | null {
  if (!(state.selection instanceof TextSelection) || !state.selection.empty) {
    return null;
  }
  const { $from } = state.selection;
  if ($from.parent.type !== state.schema.nodes.paragraph) {
    return null;
  }

  const itemDepth = findNearestListOrTodoItemDepth($from);
  if (itemDepth === null) {
    return null;
  }
  const itemNode = $from.node(itemDepth);
  const itemType = itemNode.type;

  if ($from.parent.textContent.length === 0) {
    return createEmptyListItemExitTransaction(state, itemDepth);
  }

  const itemAttrs = itemType.name === "todo_item" ? { checked: false } : null;
  const transaction = state.tr
    .split($from.pos, 2, [
      { attrs: itemAttrs, type: itemType },
      { type: state.schema.nodes.paragraph! }
    ])
    .setMeta(richInputRulesPluginKey, true);
  const selectionPosition = Math.min($from.pos + 4, transaction.doc.content.size);
  return transaction.setSelection(TextSelection.create(transaction.doc, selectionPosition));
}

function createEmptyListItemExitTransaction(state: EditorState, itemDepth: number): Transaction | null {
  const { $from } = state.selection;
  const paragraph = state.schema.nodes.paragraph!.create();
  if (itemDepth === 1) {
    const itemFrom = $from.before(itemDepth);
    const itemTo = $from.after(itemDepth);
    const transaction = state.tr.replaceWith(itemFrom, itemTo, paragraph).setMeta(richInputRulesPluginKey, true);
    return transaction.setSelection(TextSelection.near(transaction.doc.resolve(itemFrom + 1)));
  }

  const listDepth = itemDepth - 1;
  const listNode = $from.node(listDepth);
  if (![state.schema.nodes.bullet_list, state.schema.nodes.ordered_list].includes(listNode.type)) {
    return null;
  }

  const lifted = currentListItemSelection(state);
  if (listDepth >= 3 && lifted && lifted.itemDepth === itemDepth) {
    const liftedTransaction = createLiftListItemTransaction(state, lifted);
    if (!liftedTransaction) {
      return null;
    }
    const selectionPosition = listItemParagraphStartPosition(
      liftedTransaction.listPosition,
      liftedTransaction.listNode,
      liftedTransaction.itemIndex
    );
    return liftedTransaction.transaction.setSelection(
      TextSelection.create(liftedTransaction.transaction.doc, selectionPosition)
    );
  }

  const listFrom = $from.before(listDepth);
  const listTo = $from.after(listDepth);
  const itemFrom = $from.before(itemDepth);
  const itemTo = $from.after(itemDepth);
  const itemIndex = $from.index(listDepth);
  if (listNode.childCount === 1) {
    const transaction = state.tr.replaceWith(listFrom, listTo, paragraph).setMeta(richInputRulesPluginKey, true);
    return transaction.setSelection(TextSelection.near(transaction.doc.resolve(listFrom + 1)));
  }

  const transaction = state.tr.delete(itemFrom, itemTo).setMeta(richInputRulesPluginKey, true);
  const insertionPosition = transaction.mapping.map(itemIndex === 0 ? listFrom : listTo);
  transaction.insert(insertionPosition, paragraph);
  return transaction.setSelection(TextSelection.near(transaction.doc.resolve(insertionPosition + 1)));
}

function findAncestorDepth($from: ResolvedPos, nodeTypeName: string): number | null {
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === nodeTypeName) {
      return depth;
    }
  }
  return null;
}

function findNearestListOrTodoItemDepth($from: ResolvedPos): number | null {
  const listItemDepth = findAncestorDepth($from, "list_item");
  const todoItemDepth = findAncestorDepth($from, "todo_item");
  if (listItemDepth === null) {
    return todoItemDepth;
  }
  if (todoItemDepth === null) {
    return listItemDepth;
  }
  return Math.max(listItemDepth, todoItemDepth);
}

function sinkListItemCommand(state: EditorState, dispatch?: (transaction: Transaction) => void): boolean {
  const match = currentListItemSelection(state);
  if (!match || match.listDepth < 1 || match.itemIndex === 0) {
    return false;
  }
  const { $from, itemIndex, itemNode, listDepth, listNode } = match;
  if (!isRichListNode(listNode, state.schema)) {
    return false;
  }

  const previousItem = listNode.child(itemIndex - 1);
  const nestedList = listNode.type.create(listNodeAttrs(listNode), Fragment.from(itemNode));
  const nextPreviousItem = previousItem.copy(previousItem.content.append(Fragment.from(nestedList)));
  const nextListChildren = nodeChildren(listNode).filter((_, index) => index !== itemIndex);
  nextListChildren[itemIndex - 1] = nextPreviousItem;
  const nextList = listNode.type.create(listNodeAttrs(listNode), Fragment.fromArray(nextListChildren));
  const listPosition = $from.before(listDepth);
  const transaction = state.tr
    .replaceWith(listPosition, $from.after(listDepth), nextList)
    .setMeta(richInputRulesPluginKey, true);
  const previousItemPosition = listItemPosition(listPosition, listNode, itemIndex - 1);
  const nestedListPosition = previousItemPosition + 1 + previousItem.content.size;
  const selectionPosition = listItemParagraphStartPosition(nestedListPosition, nestedList, 0) + $from.parentOffset;
  dispatch?.(transaction.setSelection(TextSelection.create(transaction.doc, selectionPosition)));
  return true;
}

function liftListItemCommand(state: EditorState, dispatch?: (transaction: Transaction) => void): boolean {
  const match = currentListItemSelection(state);
  if (!match || match.listDepth < 3) {
    return false;
  }
  const lifted = createLiftListItemTransaction(state, match);
  if (!lifted) {
    return false;
  }
  const selectionPosition = listItemParagraphStartPosition(lifted.listPosition, lifted.listNode, lifted.itemIndex) + match.$from.parentOffset;
  dispatch?.(lifted.transaction.setSelection(TextSelection.create(lifted.transaction.doc, selectionPosition)));
  return true;
}

function liftOrMergeListItemAtStartCommand(state: EditorState, dispatch?: (transaction: Transaction) => void): boolean {
  const match = currentListItemSelection(state);
  if (!match || match.listDepth < 1 || match.$from.parentOffset !== 0) {
    return false;
  }
  const { $from, itemIndex, itemNode, listDepth, listNode } = match;
  if (!isRichListNode(listNode, state.schema)) {
    return false;
  }

  if (isEmptyPlainListItem(itemNode, state.schema) && listDepth >= 3 && listNode.childCount === 1) {
    const deleted = createDeleteOnlyNestedEmptyListItemTransaction(state, match);
    if (deleted) {
      dispatch?.(deleted);
      return true;
    }
  }

  if (isEmptyPlainListItem(itemNode, state.schema) && itemIndex > 0) {
    const nextListChildren = nodeChildren(listNode).filter((_, index) => index !== itemIndex);
    const nextList = listNode.type.create(listNodeAttrs(listNode), Fragment.fromArray(nextListChildren));
    const listFrom = $from.before(listDepth);
    const transaction = state.tr
      .replaceWith(listFrom, $from.after(listDepth), nextList)
      .setMeta(richInputRulesPluginKey, true);
    const previousItemEnd = listItemPosition(listFrom, nextList, itemIndex - 1) + nextList.child(itemIndex - 1).nodeSize;
    dispatch?.(transaction.setSelection(Selection.near(transaction.doc.resolve(previousItemEnd), -1)));
    return true;
  }

  if (isEmptyPlainListItem(itemNode, state.schema) && itemIndex === 0 && listNode.childCount > 1) {
    const nextListChildren = nodeChildren(listNode).slice(1);
    const nextList = listNode.type.create(listNodeAttrs(listNode), Fragment.fromArray(nextListChildren));
    const listFrom = $from.before(listDepth);
    const transaction = state.tr
      .replaceWith(listFrom, $from.after(listDepth), nextList)
      .setMeta(richInputRulesPluginKey, true);
    const selectionPosition = listItemParagraphStartPosition(listFrom, nextList, 0);
    dispatch?.(transaction.setSelection(TextSelection.create(transaction.doc, selectionPosition)));
    return true;
  }

  if (itemIndex === 0) {
    const listFrom = $from.before(listDepth);
    const liftedParagraph = state.schema.nodes.paragraph!.create(null, itemNode.firstChild?.content ?? Fragment.empty);
    const remainingItems = nodeChildren(listNode).slice(1);
    const replacement = remainingItems.length > 0
      ? Fragment.fromArray([
          liftedParagraph,
          listNode.type.create(listNodeAttrs(listNode), Fragment.fromArray(remainingItems))
        ])
      : Fragment.from(liftedParagraph);
    const transaction = state.tr
      .replaceWith(listFrom, $from.after(listDepth), replacement)
      .setMeta(richInputRulesPluginKey, true);
    dispatch?.(transaction.setSelection(TextSelection.create(transaction.doc, listFrom + 1)));
    return true;
  }

  const previousItem = listNode.child(itemIndex - 1);
  const previousParagraph = previousItem.firstChild;
  const mergeBoundaryOffset = previousParagraph && previousParagraph.type === state.schema.nodes.paragraph
    ? previousParagraph.content.size
    : itemPrimaryText(previousItem).length;
  const mergedItem = mergeAdjacentListItems(previousItem, itemNode, state.schema);
  const nextListChildren = nodeChildren(listNode).filter((_, index) => index !== itemIndex);
  nextListChildren[itemIndex - 1] = mergedItem;
  const nextList = listNode.type.create(listNodeAttrs(listNode), Fragment.fromArray(nextListChildren));
  const listFrom = $from.before(listDepth);
  const transaction = state.tr
    .replaceWith(listFrom, $from.after(listDepth), nextList)
    .setMeta(richInputRulesPluginKey, true);
  const selectionPosition = listItemParagraphStartPosition(listFrom, nextList, itemIndex - 1) + mergeBoundaryOffset;
  dispatch?.(transaction.setSelection(TextSelection.create(transaction.doc, selectionPosition)));
  return true;
}

function createDeleteOnlyNestedEmptyListItemTransaction(
  state: EditorState,
  match: NonNullable<ReturnType<typeof currentListItemSelection>>
): Transaction | null {
  const { $from, listDepth, listNode } = match;
  const parentItemDepth = listDepth - 1;
  const outerListDepth = listDepth - 2;
  const parentItem = $from.node(parentItemDepth);
  const outerList = $from.node(outerListDepth);
  if (!isRichListNode(listNode, state.schema) || !isRichListNode(outerList, state.schema)) {
    return null;
  }

  const nextParentItemChildren = nodeChildren(parentItem).filter((child) => child !== listNode);
  const nextParentItem = parentItem.copy(Fragment.fromArray(nextParentItemChildren));
  const parentItemIndex = $from.index(outerListDepth);
  const nextOuterChildren = nodeChildren(outerList);
  nextOuterChildren[parentItemIndex] = nextParentItem;
  const nextOuterList = outerList.type.create(listNodeAttrs(outerList), Fragment.fromArray(nextOuterChildren));
  const listPosition = $from.before(outerListDepth);
  const transaction = state.tr
    .replaceWith(listPosition, $from.after(outerListDepth), nextOuterList)
    .setMeta(richInputRulesPluginKey, true);
  const selectionPosition =
    listItemParagraphStartPosition(listPosition, nextOuterList, parentItemIndex) + itemPrimaryText(nextParentItem).length;
  return transaction.setSelection(TextSelection.create(transaction.doc, selectionPosition));
}

function currentListItemSelection(
  state: EditorState
): {
  readonly $from: ResolvedPos;
  readonly itemDepth: number;
  readonly itemIndex: number;
  readonly itemNode: ProseMirrorNode;
  readonly listDepth: number;
  readonly listNode: ProseMirrorNode;
} | null {
  if (!(state.selection instanceof TextSelection) || !state.selection.empty) {
    return null;
  }
  const { $from } = state.selection;
  if ($from.parent.type !== state.schema.nodes.paragraph) {
    return null;
  }
  const itemDepth = findNearestListOrTodoItemDepth($from);
  if (itemDepth === null || itemDepth < 1) {
    return null;
  }
  const listDepth = itemDepth - 1;
  if (listDepth < 0) {
    return null;
  }
  return {
    $from,
    itemDepth,
    itemIndex: $from.index(listDepth),
    itemNode: $from.node(itemDepth),
    listDepth,
    listNode: $from.node(listDepth)
  };
}

function createLiftListItemTransaction(
  state: EditorState,
  match: NonNullable<ReturnType<typeof currentListItemSelection>>
): {
  readonly itemIndex: number;
  readonly listNode: ProseMirrorNode;
  readonly listPosition: number;
  readonly transaction: Transaction;
} | null {
  const { $from, itemIndex, itemNode, listDepth, listNode } = match;
  const parentItemDepth = listDepth - 1;
  const outerListDepth = listDepth - 2;
  const parentItem = $from.node(parentItemDepth);
  const outerList = $from.node(outerListDepth);
  if (!isRichListNode(listNode, state.schema) || !isRichListNode(outerList, state.schema)) {
    return null;
  }

  const remainingNestedItems = nodeChildren(listNode).filter((_, index) => index !== itemIndex);
  const nextParentItemChildren = nodeChildren(parentItem).flatMap((child) => {
    if (child !== listNode) {
      return [child];
    }
    return remainingNestedItems.length > 0
      ? [listNode.type.create(listNodeAttrs(listNode), Fragment.fromArray(remainingNestedItems))]
      : [];
  });
  const nextParentItem = parentItem.copy(Fragment.fromArray(nextParentItemChildren));
  const parentItemIndex = $from.index(outerListDepth);
  const nextOuterChildren = nodeChildren(outerList);
  nextOuterChildren[parentItemIndex] = nextParentItem;
  nextOuterChildren.splice(parentItemIndex + 1, 0, itemNode);
  const nextOuterList = outerList.type.create(listNodeAttrs(outerList), Fragment.fromArray(nextOuterChildren));
  const listPosition = $from.before(outerListDepth);
  const transaction = state.tr
    .replaceWith(listPosition, $from.after(outerListDepth), nextOuterList)
    .setMeta(richInputRulesPluginKey, true);
  return {
    itemIndex: parentItemIndex + 1,
    listNode: nextOuterList,
    listPosition,
    transaction
  };
}

function isRichListNode(node: ProseMirrorNode, schema: MomentariseRichSchema): boolean {
  return [schema.nodes.bullet_list, schema.nodes.ordered_list].includes(node.type);
}

function nodeChildren(node: ProseMirrorNode): ProseMirrorNode[] {
  const children: ProseMirrorNode[] = [];
  node.forEach((child) => {
    children.push(child);
  });
  return children;
}

function isEmptyPlainListItem(node: ProseMirrorNode, schema: MomentariseRichSchema): boolean {
  const children = nodeChildren(node);
  return children.length === 1 && children[0]?.type === schema.nodes.paragraph && children[0].content.size === 0;
}

function listNodeAttrs(node: ProseMirrorNode): Record<string, unknown> | null {
  return node.type.name === "ordered_list" ? node.attrs : null;
}

function listItemPosition(listPosition: number, listNode: ProseMirrorNode, itemIndex: number): number {
  let position = listPosition + 1;
  for (let index = 0; index < itemIndex; index += 1) {
    position += listNode.child(index).nodeSize;
  }
  return position;
}

function listItemParagraphStartPosition(listPosition: number, listNode: ProseMirrorNode, itemIndex: number): number {
  return listItemPosition(listPosition, listNode, itemIndex) + 2;
}

function itemPrimaryText(itemNode: ProseMirrorNode): string {
  return itemNode.firstChild?.textContent ?? itemNode.textContent;
}

function mergeAdjacentListItems(
  previousItem: ProseMirrorNode,
  currentItem: ProseMirrorNode,
  schema: MomentariseRichSchema
): ProseMirrorNode {
  const [previousParagraph, ...previousRest] = nodeChildren(previousItem);
  const [currentParagraph, ...currentRest] = nodeChildren(currentItem);
  if (!previousParagraph || previousParagraph.type !== schema.nodes.paragraph || !currentParagraph || currentParagraph.type !== schema.nodes.paragraph) {
    return previousItem.copy(previousItem.content.append(currentItem.content));
  }
  const mergedParagraph = previousParagraph.copy(previousParagraph.content.append(currentParagraph.content));
  return previousItem.copy(Fragment.fromArray([mergedParagraph, ...previousRest, ...currentRest]));
}

function markdownInputRuleForText(text: string): RichMarkdownInputRule | null {
  const heading = text.match(/^(#{1,6}) $/);
  if (heading) {
    return {
      kind: "heading",
      level: heading[1]!.length,
      prefixLength: text.length
    };
  }

  if (text === "- [ ] ") {
    return {
      checked: false,
      kind: "todo_item",
      prefixLength: text.length
    };
  }

  if (/^- \[[xX]\] $/.test(text)) {
    return {
      checked: true,
      kind: "todo_item",
      prefixLength: text.length
    };
  }

  if (text === "- " || text === "* " || text === "+ ") {
    return {
      kind: "bullet_list",
      prefixLength: text.length
    };
  }

  if (text === "1. ") {
    return {
      kind: "ordered_list",
      prefixLength: text.length
    };
  }

  if (text === "> ") {
    return {
      kind: "blockquote",
      prefixLength: text.length
    };
  }

  const codeFence = text.match(/^```([A-Za-z0-9_-]*) $/);
  if (codeFence) {
    const language = codeFence[1] ?? "";
    return {
      kind: "code_block",
      language: normalizeOptionalString(language),
      prefixLength: text.length
    };
  }

  return null;
}

function todoInputRuleForListItemText(
  text: string
): { readonly checked: boolean; readonly prefixLength: number } | null {
  if (text === "[ ] ") {
    return {
      checked: false,
      prefixLength: text.length
    };
  }
  if (/^\[[xX]\] $/.test(text)) {
    return {
      checked: true,
      prefixLength: text.length
    };
  }
  return null;
}

function createListTodoInputRuleTransaction(
  state: EditorState,
  rule: { readonly checked: boolean; readonly prefixLength: number }
): Transaction | null {
  const { $from } = state.selection;
  if ($from.depth < 3 || $from.node($from.depth - 1).type !== state.schema.nodes.list_item) {
    return null;
  }
  const listItemDepth = $from.depth - 1;
  const listDepth = $from.depth - 2;
  const listNode = $from.node(listDepth);
  if (![state.schema.nodes.bullet_list, state.schema.nodes.ordered_list].includes(listNode.type)) {
    return null;
  }

  const prefixFrom = $from.start();
  const prefixTo = prefixFrom + rule.prefixLength;
  const transaction = state.tr.delete(prefixFrom, prefixTo).setMeta(richInputRulesPluginKey, true);
  const listItemFrom = transaction.mapping.map($from.before(listItemDepth));
  const listItemTo = transaction.mapping.map($from.after(listItemDepth));
  const retainedListItem = transaction.doc.nodeAt(listItemFrom);
  if (!retainedListItem || retainedListItem.type !== state.schema.nodes.list_item) {
    return null;
  }
  const todoItem = state.schema.nodes.todo_item!.create(
    { checked: rule.checked },
    retainedListItem.content
  );

  if (listNode.childCount === 1 && $from.node(listDepth - 1).type === state.schema.nodes.doc) {
    const listFrom = transaction.mapping.map($from.before(listDepth));
    const listTo = transaction.mapping.map($from.after(listDepth));
    transaction.replaceWith(listFrom, listTo, todoItem);
    const selectionPosition = Math.min(listFrom + 2, transaction.doc.content.size);
    return transaction.setSelection(TextSelection.near(transaction.doc.resolve(selectionPosition)));
  }

  transaction.replaceWith(listItemFrom, listItemTo, todoItem);
  const selectionPosition = Math.min(listItemFrom + 2, transaction.doc.content.size);
  return transaction.setSelection(TextSelection.near(transaction.doc.resolve(selectionPosition)));
}

function createCodeFenceEnterTransaction(state: EditorState): Transaction | null {
  if (!(state.selection instanceof TextSelection) || !state.selection.empty) {
    return null;
  }
  const { $from } = state.selection;
  if ($from.parent.type !== state.schema.nodes.paragraph || $from.parentOffset !== $from.parent.content.size) {
    return null;
  }
  const text = $from.parent.textBetween(0, $from.parent.content.size, "\n", "\n");
  const codeFence = text.match(/^```([A-Za-z0-9_-]*)$/);
  if (!codeFence) {
    return null;
  }
  const from = $from.before();
  const to = $from.after();
  const language = normalizeOptionalString(codeFence[1] ?? null);
  const codeBlock = state.schema.nodes.code_block!.create({
    language,
    meta: null
  });
  const transaction = state.tr.replaceWith(from, to, codeBlock).setMeta(richInputRulesPluginKey, true);
  const selectionPosition = Math.min(from + 1, transaction.doc.content.size);
  return transaction.setSelection(TextSelection.near(transaction.doc.resolve(selectionPosition)));
}

function replacementForInputRule(
  rule: Exclude<RichMarkdownInputRule, { readonly kind: "heading" }>,
  schema: MomentariseRichSchema,
  paragraph: ProseMirrorNode
): ProseMirrorNode | null {
  switch (rule.kind) {
    case "blockquote":
      return schema.nodes.blockquote!.create(null, [paragraph]);
    case "bullet_list":
      return schema.nodes.bullet_list!.create(null, [
        schema.nodes.list_item!.create(null, [paragraph])
      ]);
    case "code_block":
      return schema.nodes.code_block!.create(
        {
          language: rule.language,
          meta: null
        },
        paragraph.textContent ? [schema.text(paragraph.textContent)] : undefined
      );
    case "ordered_list":
      return schema.nodes.ordered_list!.create({ order: 1 }, [
        schema.nodes.list_item!.create(null, [paragraph])
      ]);
    case "todo_item":
      return schema.nodes.todo_item!.create({ checked: rule.checked }, [paragraph]);
  }
}

function selectionOffsetForInputRule(rule: Exclude<RichMarkdownInputRule, { readonly kind: "heading" }>): number {
  switch (rule.kind) {
    case "blockquote":
    case "todo_item":
      return 2;
    case "bullet_list":
    case "ordered_list":
      return 3;
    case "code_block":
      return 1;
  }
}

function findNodePositionAround(
  doc: ProseMirrorNode,
  position: number,
  typeName: string
): {
  readonly node: ProseMirrorNode;
  readonly position: number;
} | null {
  let match: { node: ProseMirrorNode; position: number } | null = null;
  doc.descendants((node, nodePosition) => {
    if (node.type.name === typeName && nodePosition <= position && nodePosition + node.nodeSize > position) {
      match = {
        node,
        position: nodePosition
      };
      return false;
    }
    return true;
  });
  return match;
}

function collapsedFoldMap(folds: readonly FoldState[]): ReadonlyMap<string, boolean> {
  return new Map(folds.map((fold) => [String(fold.nodeId), fold.collapsed]));
}

function richTopLevelBlockRecords(
  doc: ProseMirrorNode,
  foldMap: ReadonlyMap<string, boolean>
): readonly RichFoldedBlock[] {
  const records: RichFoldedBlock[] = [];
  const collapsedStack: { readonly level: number; readonly nodeId: string }[] = [];
  const headingPath: { readonly level: number; readonly segment: string }[] = [];
  const siblingCounts = new Map<string, number>();
  doc.forEach((node, offset, index) => {
    const headingLevel = node.type.name === "heading" ? Number(node.attrs.level) || 1 : null;
    let nodeId = `block:${index}:${node.type.name}`;
    if (headingLevel !== null) {
      while (collapsedStack.length > 0 && collapsedStack[collapsedStack.length - 1]!.level >= headingLevel) {
        collapsedStack.pop();
      }
      while (headingPath.length > 0 && headingPath[headingPath.length - 1]!.level >= headingLevel) {
        headingPath.pop();
      }
      nodeId = createHeadingNodeId(headingPath, headingLevel, node.textContent, siblingCounts);
    }

    const hiddenBy = collapsedStack[collapsedStack.length - 1]?.nodeId ?? null;
    const folded = headingLevel !== null && foldMap.get(nodeId) === true;
    records.push({
      folded,
      headingLevel,
      hidden: Boolean(hiddenBy),
      hiddenBy,
      index,
      nodeId,
      position: offset,
      text: node.textContent.trim(),
      to: offset + node.nodeSize,
      type: node.type.name
    });

    if (headingLevel !== null && folded) {
      collapsedStack.push({
        level: headingLevel,
        nodeId
      });
    }
    if (headingLevel !== null) {
      headingPath.push({
        level: headingLevel,
        segment: headingSegmentFromNodeId(nodeId)
      });
    }
  });
  return records;
}

function countHeadingSectionBlocks(
  blocks: readonly RichFoldedBlock[],
  headingIndex: number,
  headingLevel: number
): number {
  let count = 0;
  for (const block of blocks.slice(headingIndex + 1)) {
    if (block.headingLevel !== null && block.headingLevel <= headingLevel) {
      break;
    }
    count += 1;
  }
  return count;
}

function escapeDetailsSummary(summary: string): string {
  return summary
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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

function currentAncestorBlockRange(
  state: EditorState,
  typeName: string
): {
  readonly from: number;
  readonly node: ProseMirrorNode;
  readonly parent: ProseMirrorNode;
  readonly to: number;
} | null {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type.name === typeName) {
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

function currentTopLevelBlockRange(state: EditorState): {
  readonly from: number;
  readonly node: ProseMirrorNode;
  readonly parent: ProseMirrorNode;
  readonly to: number;
} | null {
  if (state.selection instanceof NodeSelection && state.selection.node.isBlock) {
    return {
      from: state.selection.from,
      node: state.selection.node,
      parent: state.doc,
      to: state.selection.to
    };
  }
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const parent = $from.node(depth - 1);
    if (parent.type === state.schema.nodes.doc) {
      const node = $from.node(depth);
      return {
        from: $from.before(depth),
        node,
        parent,
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
    parseDOM: [
      {
        tag: '[data-type="todo-item"]',
        getAttrs: (element) => ({
          checked: element instanceof HTMLElement ? element.dataset.checked === "true" : false
        })
      }
    ],
    toDOM: (node) => {
      const checked = Boolean(node.attrs.checked);
      return [
        "div",
        { "data-checked": String(checked), "data-type": "todo-item" },
        [
          "button",
          {
            "aria-label": checked ? "Mark todo incomplete" : "Mark todo complete",
            "aria-pressed": String(checked),
            "contenteditable": "false",
            "data-todo-toggle": "true",
            type: "button"
          },
          checked ? "\u2713" : ""
        ],
        ["div", { "data-todo-content": "true" }, 0]
      ];
    }
  },
  image: {
    attrs: {
      alt: { default: "" },
      src: { default: null },
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
                src: safeUrlAttribute(element.getAttribute("src"), {
                  allowDataImage: true
                }),
                title: element.getAttribute("title")
              }
            : false
      }
    ],
    toDOM: (node) => {
      const attrs: Record<string, string> = {
        alt: stringAttribute(node.attrs.alt) ?? ""
      };
      const src = safeUrlAttribute(stringAttribute(node.attrs.src), {
        allowDataImage: true
      });
      const title = stringAttribute(node.attrs.title);
      if (src) {
        attrs.src = src;
      }
      if (title) {
        attrs.title = title;
      }
      return ["img", attrs];
    }
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
    toDOM: (node) => unsupportedBlockToDOM(node)
  },
  text: {
    group: "inline"
  }
};

function unsupportedBlockToDOM(node: ProseMirrorNode): DOMOutputSpec {
  const raw = String(node.attrs.raw ?? "");
  const reason = String(node.attrs.reason ?? "unsupported Markdown");
  if (isPreservedFootnoteFallback(reason)) {
    return [
      "figure",
      {
        "aria-label": "Preserved Markdown footnote. Edit in Source mode.",
        "contenteditable": "false",
        "data-mme-preserved-footnote": "true",
        "data-unsupported": "true"
      },
      ["figcaption", { "data-mme-preserved-footnote-label": "true" }, "Preserved Markdown footnote. Edit in Source mode."],
      ["pre", { "data-mme-preserved-footnote-source": "true", "data-unsupported": "true" }, raw]
    ];
  }
  if (isPreservedTableFallback(reason)) {
    return [
      "figure",
      {
        "aria-label": "Preserved Markdown table. Edit in Source mode.",
        "contenteditable": "false",
        "data-mme-preserved-table": "true",
        "data-unsupported": "true"
      },
      ["figcaption", { "data-mme-preserved-table-label": "true" }, "Preserved Markdown table. Edit in Source mode."],
      ["pre", { "data-mme-preserved-table-source": "true", "data-unsupported": "true" }, raw]
    ];
  }
  return ["pre", { "data-unsupported": "true" }, raw];
}

function isPreservedTableFallback(reason: string): boolean {
  return /table/i.test(reason);
}

function isPreservedFootnoteFallback(reason: string): boolean {
  return /footnote/i.test(reason);
}

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
  strike: {
    parseDOM: [{ tag: "s" }, { tag: "del" }, { tag: "strike" }],
    toDOM: () => ["s", 0]
  },
  link: {
    attrs: {
      href: { default: null },
      title: { default: null }
    },
    inclusive: false,
    parseDOM: [
      {
        tag: "a[href]",
        getAttrs: (element) =>
          element instanceof HTMLAnchorElement
            ? {
                href: safeUrlAttribute(element.getAttribute("href")),
                title: element.getAttribute("title")
              }
            : false
      }
    ],
    toDOM: (mark) => {
      const attrs: Record<string, string> = {};
      const href = safeUrlAttribute(stringAttribute(mark.attrs.href));
      const title = stringAttribute(mark.attrs.title);
      if (href) {
        attrs.href = href;
      }
      if (title) {
        attrs.title = title;
      }
      return ["a", attrs, 0];
    }
  }
};

function blockNodeToProseMirror(
  node: MomentariseNode,
  schema: MomentariseRichSchema,
  source: string
): ProseMirrorNode | null {
  if (node.kind === "opaque") {
    return unsupportedNodeToProseMirror(node, schema, source);
  }

  switch (node.type) {
    case "heading":
      return schema.nodes.heading.create(
        { level: Number(node.attributes?.depth ?? 1) },
        inlineChildrenToProseMirror(node.children ?? [], schema, source)
      );
    case "paragraph":
      return schema.nodes.paragraph.create(null, inlineChildrenToProseMirror(node.children ?? [], schema, source));
    case "blockquote":
      return schema.nodes.blockquote.create(null, blockChildrenToProseMirror(node.children ?? [], schema, source));
    case "thematicBreak":
      return schema.nodes.horizontal_rule.create();
    case "code":
    case "codeFence":
      return schema.nodes.code_block.create(
        {
          language: stringAttribute(node.attributes?.language),
          meta: stringAttribute(node.attributes?.meta)
        },
        textNode(schema, stringAttribute(node.attributes?.value) ?? rawFromRange(node, source))
      );
    case "list":
      return listNodeToProseMirror(node, schema, source);
    default:
      // Closed whitelist: anything the rich subset cannot represent (tables,
      // footnotes, definitions, raw HTML, ...) is preserved as raw source in an
      // unsupported block. It must never be flattened into an editable paragraph.
      return unsupportedNodeToProseMirror(node, schema, source);
  }
}

function listNodeToProseMirror(node: KnownNode, schema: MomentariseRichSchema, source: string): ProseMirrorNode {
  const items = (node.children ?? [])
    .map((child) => listItemToProseMirror(child, schema, source))
    .filter((child): child is ProseMirrorNode => Boolean(child));
  if (node.attributes?.ordered === true) {
    return schema.nodes.ordered_list.create({ order: Number(node.attributes.start) || 1 }, items);
  }
  return schema.nodes.bullet_list.create(null, items);
}

function listItemToProseMirror(
  node: MomentariseNode,
  schema: MomentariseRichSchema,
  source: string
): ProseMirrorNode | null {
  if (node.kind === "opaque") {
    return null;
  }
  const children = blockChildrenToProseMirror(node.children ?? [], schema, source);
  const safeChildren = children.length > 0 ? children : [schema.nodes.paragraph.create()];
  if (typeof node.attributes?.checked === "boolean") {
    return schema.nodes.todo_item.create({ checked: node.attributes.checked }, safeChildren);
  }
  return schema.nodes.list_item.create(null, safeChildren);
}

function blockChildrenToProseMirror(
  children: readonly MomentariseNode[],
  schema: MomentariseRichSchema,
  source: string
): ProseMirrorNode[] {
  return children
    .map((child) => blockNodeToProseMirror(child, schema, source))
    .filter((child): child is ProseMirrorNode => Boolean(child));
}

function inlineChildrenToProseMirror(
  children: readonly MomentariseNode[],
  schema: MomentariseRichSchema,
  source: string,
  marks: readonly Mark[] = []
): readonly ProseMirrorNode[] {
  const inlineNodes: ProseMirrorNode[] = [];
  for (const child of children) {
    inlineNodes.push(...inlineNodeToProseMirror(child, schema, source, marks));
  }
  return inlineNodes;
}

function inlineNodeToProseMirror(
  node: MomentariseNode,
  schema: MomentariseRichSchema,
  source: string,
  marks: readonly Mark[]
): readonly ProseMirrorNode[] {
  if (node.kind === "opaque") {
    return [schema.text(node.raw, marks)];
  }
  if (node.type === "text") {
    return [schema.text(stringAttribute(node.attributes?.value) ?? rawFromRange(node, source), marks)];
  }
  if (node.type === "footnoteReference") {
    const referenceText = footnoteReferenceText(node, source);
    return referenceText ? [schema.text(referenceText, marks)] : [];
  }
  if (node.type === "inlineCode") {
    return [
      schema.text(stringAttribute(node.attributes?.value) ?? rawFromRange(node, source), [
        ...marks,
        schema.marks.code.create()
      ])
    ];
  }
  if (node.type === "emphasis") {
    return inlineChildrenToProseMirror(node.children ?? [], schema, source, [...marks, schema.marks.em.create()]);
  }
  if (node.type === "strong") {
    return inlineChildrenToProseMirror(node.children ?? [], schema, source, [...marks, schema.marks.strong.create()]);
  }
  if (node.type === "strikethrough") {
    return inlineChildrenToProseMirror(node.children ?? [], schema, source, [...marks, schema.marks.strike.create()]);
  }
  if (node.type === "link") {
    return inlineChildrenToProseMirror(node.children ?? [], schema, source, [
      ...marks,
      schema.marks.link.create({
        href: safeUrlAttribute(stringAttribute(node.attributes?.url)),
        title: stringAttribute(node.attributes?.title)
      })
    ]);
  }
  if (node.type === "image") {
    return [
      schema.nodes.image.create({
        alt: stringAttribute(node.attributes?.alt) ?? "",
        src: safeUrlAttribute(stringAttribute(node.attributes?.url), {
          allowDataImage: true
        }),
        title: stringAttribute(node.attributes?.title)
      })
    ];
  }
  if (node.type === "break") {
    return [schema.nodes.hard_break.create()];
  }
  return inlineChildrenToProseMirror(node.children ?? [], schema, source, marks);
}

function footnoteReferenceText(node: MomentariseNode, source: string): string {
  const raw = rawFromRange(node, source);
  if (raw) {
    return raw;
  }
  const identifier = stringAttribute(node.attributes?.identifier) ?? stringAttribute(node.attributes?.label);
  return identifier ? `[^${identifier}]` : "";
}

function unsupportedNodeToProseMirror(
  node: MomentariseNode,
  schema: MomentariseRichSchema,
  source: string
): ProseMirrorNode {
  const raw = node.kind === "opaque" ? node.raw : rawFromRange(node, source);
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
    const childIsList = ["bullet_list", "ordered_list"].includes(child.type.name);
    const childIndentation = childIsList ? `${indentation}${" ".repeat(marker.length + 1)}` : `${indentation}  `;
    lines.push(
      serializeBlock(child, childIsList ? 0 : indentLevel + 1)
        .split("\n")
        .map((line) => `${childIndentation}${line}`)
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
    if (mark.type.name === "strike") {
      return `~~${value}~~`;
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

function rawFromRange(node: MomentariseNode, source: string): string {
  if (node.kind === "opaque") {
    return node.raw;
  }
  if (!node.sourceRange) {
    return "";
  }
  return source.slice(node.sourceRange.start.offset, node.sourceRange.end.offset);
}

function stringAttribute(value: NodeAttributeValue | undefined): string | null {
  return typeof value === "string" ? value : null;
}

function normalizeOptionalString(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
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
