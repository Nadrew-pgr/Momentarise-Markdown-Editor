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
import { addRowAfter, CellSelection, goToNextCell, tableEditing, tableNodes } from "prosemirror-tables";

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
  | "footnote"
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
  readonly preferredIdentifier?: string;
  readonly language?: string;
  readonly src?: string;
  readonly text?: string;
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

export type RichFoldKind = "callout" | "code" | "heading" | "opaque";

export interface RichFoldItem {
  readonly folded: boolean;
  readonly foldable: true;
  readonly foldKind: RichFoldKind;
  readonly hiddenBlockCount: number;
  readonly level: number | null;
  readonly nodeId: string;
  readonly position: number;
  readonly text: string;
  readonly type: string;
}

export interface RichHeadingFoldItem extends RichFoldItem {
  readonly foldKind: "heading";
  readonly level: number;
}

export interface RichFoldedBlock {
  readonly foldKind: RichFoldKind | null;
  readonly foldable: boolean;
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
  readonly identifier?: string | null;
  readonly reason?: RichFootnoteInsertionFailureReason | null;
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
  readonly footnoteInsertionBaseSource?: string;
  readonly frontmatterSource?: string;
  readonly parseResult: ParseResult;
  readonly schema: MomentariseRichSchema;
  readonly source: string;
}

export interface RichTableCellCoordinates {
  readonly columnIndex: number;
  readonly rowIndex: number;
  readonly tableIndex: number;
}

export interface SelectRichTableCellOptions {
  readonly columnIndex: number;
  readonly rowIndex: number;
  readonly tableIndex?: number;
}

export interface ReplaceRichTableCellTextOptions extends SelectRichTableCellOptions {
  readonly text: string;
}

export interface SelectRichFootnoteDefinitionOptions {
  readonly identifier: string;
}

export interface ReplaceRichFootnoteDefinitionTextOptions extends SelectRichFootnoteDefinitionOptions {
  readonly text: string;
}

export type RichFootnoteInsertionFailureReason =
  | "identifier-conflict"
  | "invalid-body"
  | "invalid-identifier"
  | "mapping-unavailable"
  | "selection-not-collapsed"
  | "stale-source"
  | "unsupported-selection";

export interface InsertRichFootnoteOptions {
  readonly preferredIdentifier?: string;
  readonly text: string;
}

export type RichFootnoteInsertionResult =
  | {
      readonly handled: true;
      readonly identifier: string;
      readonly reason: null;
      readonly state: RichMarkdownState;
    }
  | {
      readonly handled: false;
      readonly identifier: null;
      readonly reason: RichFootnoteInsertionFailureReason;
      readonly state: RichMarkdownState;
    };

export type RichFootnoteRenameFailureReason =
  | "ambiguous-identifier"
  | "identifier-conflict"
  | "identifier-not-found"
  | "invalid-identifier"
  | "mapping-unavailable"
  | "stale-source";

export interface RenameRichFootnoteIdentifierOptions {
  readonly identifier: string;
  readonly nextIdentifier: string;
}

export type RichFootnoteRenameResult =
  | {
      readonly handled: true;
      readonly identifier: string;
      readonly previousIdentifier: string;
      readonly reason: null;
      readonly state: RichMarkdownState;
    }
  | {
      readonly handled: false;
      readonly identifier: null;
      readonly previousIdentifier: null;
      readonly reason: RichFootnoteRenameFailureReason;
      readonly state: RichMarkdownState;
    };

export type MomentariseRichSchema = Schema<
  | "blockquote"
  | "bullet_list"
  | "code_block"
  | "doc"
  | "footnote_definition"
  | "footnote_reference"
  | "hard_break"
  | "heading"
  | "horizontal_rule"
  | "image"
  | "list_item"
  | "ordered_list"
  | "paragraph"
  | "table"
  | "table_cell"
  | "table_header"
  | "table_row"
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
    aliases: ["footnote", "note", "reference", "citation"],
    group: "insert",
    id: "footnote",
    label: "Footnote"
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
    createTodoTogglePlugin(),
    createDocumentEndInsertionPlugin()
  ];
  if (!normalized.keymapDelegateToHost && normalized.keymapProfile !== "delegate") {
    plugins.push(...createRichKeymapPlugins(normalized));
  }
  plugins.push(history());
  if (!normalized.keymapDelegateToHost && normalized.keymapProfile !== "delegate") {
    plugins.push(keymap(baseKeymap));
  }
  plugins.push(tableEditing());
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

export function richTableCellCoordinates(state: RichMarkdownState): RichTableCellCoordinates | null {
  return richTableCellCoordinatesInEditorState(state.editorState);
}

export function selectRichTableCell(
  state: RichMarkdownState,
  options: SelectRichTableCellOptions
): RichMarkdownState {
  const location = findRichTableCellLocation(state.editorState.doc, options);
  if (!location) {
    throw new RangeError(
      `Could not find rich table cell ${options.tableIndex ?? 0}:${options.rowIndex}:${options.columnIndex}.`
    );
  }
  const transaction = state.editorState.tr.setSelection(
    new CellSelection(state.editorState.doc.resolve(location.cellPosition))
  );
  return {
    ...state,
    editorState: state.editorState.apply(transaction)
  };
}

export function moveRichTableCell(
  state: RichMarkdownState,
  direction: "next" | "previous"
): RichMarkdownState {
  let editorState = state.editorState;
  const command = direction === "next" ? moveToNextRichTableCellCommand : goToNextCell(-1);
  if (!command(editorState, (transaction) => {
    editorState = editorState.apply(transaction);
  })) {
    return state;
  }
  return {
    ...state,
    editorState
  };
}

export function replaceRichTableCellText(
  state: RichMarkdownState,
  options: ReplaceRichTableCellTextOptions
): RichMarkdownState {
  const location = findRichTableCellLocation(state.editorState.doc, options);
  if (!location) {
    throw new RangeError(
      `Could not find rich table cell ${options.tableIndex ?? 0}:${options.rowIndex}:${options.columnIndex}.`
    );
  }
  const text = options.text.replace(/\r?\n/g, " ");
  const paragraph = location.cell.firstChild;
  if (!paragraph || paragraph.type !== state.schema.nodes.paragraph) {
    throw new Error("Rich table cells must contain exactly one paragraph.");
  }
  const from = location.contentPosition;
  const to = from + paragraph.content.size;
  let transaction = state.editorState.tr.replaceWith(
    from,
    to,
    text ? state.schema.text(text) : Fragment.empty
  );
  transaction = transaction.setSelection(TextSelection.near(transaction.doc.resolve(from + text.length)));
  return {
    ...state,
    editorState: state.editorState.apply(transaction)
  };
}

export function selectRichFootnoteDefinition(
  state: RichMarkdownState,
  options: SelectRichFootnoteDefinitionOptions
): RichMarkdownState {
  const location = findRichFootnoteDefinitionLocation(state.editorState.doc, options.identifier);
  if (!location) {
    throw new RangeError(`Could not find editable rich footnote definition: ${options.identifier}.`);
  }
  const from = location.position + 2;
  const to = location.position + location.node.nodeSize - 2;
  const selection = from < to
    ? TextSelection.between(state.editorState.doc.resolve(from), state.editorState.doc.resolve(to))
    : TextSelection.near(state.editorState.doc.resolve(from));
  return {
    ...state,
    editorState: state.editorState.apply(state.editorState.tr.setSelection(selection))
  };
}

export function replaceRichFootnoteDefinitionText(
  state: RichMarkdownState,
  options: ReplaceRichFootnoteDefinitionTextOptions
): RichMarkdownState {
  const location = findRichFootnoteDefinitionLocation(state.editorState.doc, options.identifier);
  if (!location) {
    throw new RangeError(`Could not find editable rich footnote definition: ${options.identifier}.`);
  }
  const text = options.text.replace(/[\r\n]+/g, " ");
  const from = location.position + 1;
  const to = from + location.node.content.size;
  const paragraph = state.schema.nodes.paragraph!.create(
    null,
    text ? state.schema.text(text) : null
  );
  let transaction = state.editorState.tr.replaceWith(
    from,
    to,
    paragraph
  );
  transaction = transaction.setSelection(TextSelection.near(transaction.doc.resolve(from + text.length + 1)));
  return {
    ...state,
    editorState: state.editorState.apply(transaction)
  };
}

export function insertRichFootnote(
  state: RichMarkdownState,
  options: InsertRichFootnoteOptions
): RichFootnoteInsertionResult {
  const selection = state.editorState.selection;
  if (!(selection instanceof TextSelection) || !selection.empty) {
    return rejectedRichFootnoteInsertion(state, "selection-not-collapsed");
  }
  if (
    selection.$from.depth !== 1 ||
    !["heading", "paragraph"].includes(selection.$from.parent.type.name) ||
    selection.$from.marks().some((mark) => mark.type.name === "code")
  ) {
    return rejectedRichFootnoteInsertion(state, "unsupported-selection");
  }

  const text = options.text.trim();
  if (!text || /[\r\n]/.test(text)) {
    return rejectedRichFootnoteInsertion(state, "invalid-body");
  }

  const usedIdentifiers = richFootnoteIdentifiers(state);
  let identifier: string;
  if (options.preferredIdentifier !== undefined) {
    identifier = options.preferredIdentifier.trim();
    if (!isSafeFootnoteIdentifier(identifier)) {
      return rejectedRichFootnoteInsertion(state, "invalid-identifier");
    }
    if (usedIdentifiers.has(normalizeFootnoteIdentifier(identifier))) {
      return rejectedRichFootnoteInsertion(state, "identifier-conflict");
    }
  } else {
    identifier = allocateRichFootnoteIdentifier(usedIdentifiers);
  }

  if (!isRepresentableInsertedFootnoteBody(state, identifier, text)) {
    return rejectedRichFootnoteInsertion(state, "invalid-body");
  }

  const mappedSourceOffset = sourceOffsetForRichInlineSelection(state, selection);
  if (mappedSourceOffset === null) {
    return rejectedRichFootnoteInsertion(state, "mapping-unavailable");
  }
  const baselineSourceOffset = footnoteBaselineOffset(state, mappedSourceOffset);
  if (baselineSourceOffset === null) {
    return rejectedRichFootnoteInsertion(state, "stale-source");
  }

  const rawReference = `[^${identifier}]`;
  const reference = state.schema.nodes.footnote_reference!.create({
    identifier: normalizeFootnoteIdentifier(identifier),
    insertionSourceOffset: baselineSourceOffset,
    label: identifier,
    raw: rawReference
  });
  const definition = state.schema.nodes.footnote_definition!.create(
    {
      identifier: normalizeFootnoteIdentifier(identifier),
      inserted: true,
      label: identifier,
      prefix: `[^${identifier}]: `
    },
    state.schema.nodes.paragraph!.create(null, text ? state.schema.text(text) : null)
  );
  let transaction = state.editorState.tr.replaceSelectionWith(reference, false);
  transaction = transaction.insert(transaction.doc.content.size, definition).scrollIntoView();
  return {
    handled: true,
    identifier,
    reason: null,
    state: {
      ...state,
      editorState: state.editorState.apply(transaction),
      footnoteInsertionBaseSource: state.footnoteInsertionBaseSource ?? state.source
    }
  };
}

function rejectedRichFootnoteInsertion(
  state: RichMarkdownState,
  reason: RichFootnoteInsertionFailureReason
): RichFootnoteInsertionResult {
  return {
    handled: false,
    identifier: null,
    reason,
    state
  };
}

export function renameRichFootnoteIdentifier(
  state: RichMarkdownState,
  options: RenameRichFootnoteIdentifierOptions
): RichFootnoteRenameResult {
  const requestedIdentifier = options.identifier.trim();
  const nextIdentifier = options.nextIdentifier.trim();
  if (!isSafeFootnoteIdentifier(requestedIdentifier) || !isSafeFootnoteIdentifier(nextIdentifier)) {
    return rejectedRichFootnoteRename(state, "invalid-identifier");
  }
  if (state.source !== state.parseResult.snapshot.content) {
    return rejectedRichFootnoteRename(state, "stale-source");
  }

  const normalizedIdentifier = normalizeFootnoteIdentifier(requestedIdentifier);
  const normalizedNextIdentifier = normalizeFootnoteIdentifier(nextIdentifier);
  const materializedSource = materializeInsertedRichFootnotes(state);
  const currentParseResult = createMarkdownAstFormatter().parse(materializedSource, {
    dialect: state.parseResult.document.dialect,
    ...(state.parseResult.snapshot.path ? { path: state.parseResult.snapshot.path } : {})
  });
  const occurrences = collectParsedFootnoteOccurrences(currentParseResult.document.root);
  const currentOccurrences = occurrences.get(normalizedIdentifier);
  if (!currentOccurrences || currentOccurrences.definitions === 0) {
    return rejectedRichFootnoteRename(state, "identifier-not-found");
  }
  if (currentOccurrences.definitions > 1) {
    return rejectedRichFootnoteRename(state, "ambiguous-identifier");
  }
  if (normalizedNextIdentifier !== normalizedIdentifier && occurrences.has(normalizedNextIdentifier)) {
    return rejectedRichFootnoteRename(state, "identifier-conflict");
  }

  const locations = richFootnoteNodeLocations(state.editorState.doc, normalizedIdentifier);
  const definitions = locations.filter((location) => location.node.type.name === "footnote_definition");
  const references = locations.filter((location) => location.node.type.name === "footnote_reference");
  if (
    definitions.length !== 1 ||
    currentOccurrences.definitions !== definitions.length ||
    currentOccurrences.references !== references.length ||
    locations.some((location) => !hasValidRichFootnoteSourceMapping(state, location.node))
  ) {
    return rejectedRichFootnoteRename(state, "mapping-unavailable");
  }

  const previousIdentifier =
    stringAttribute(definitions[0]!.node.attrs.label) ??
    stringAttribute(definitions[0]!.node.attrs.identifier) ??
    requestedIdentifier;
  let transaction = state.editorState.tr;
  for (const location of locations) {
    const nextAttrs = renamedRichFootnoteNodeAttrs(location.node, nextIdentifier);
    if (!nextAttrs) {
      return rejectedRichFootnoteRename(state, "mapping-unavailable");
    }
    transaction = transaction.setNodeMarkup(location.position, undefined, nextAttrs);
  }
  return {
    handled: true,
    identifier: nextIdentifier,
    previousIdentifier,
    reason: null,
    state: {
      ...state,
      editorState: state.editorState.apply(transaction),
      footnoteInsertionBaseSource: state.footnoteInsertionBaseSource ?? state.source
    }
  };
}

function rejectedRichFootnoteRename(
  state: RichMarkdownState,
  reason: RichFootnoteRenameFailureReason
): RichFootnoteRenameResult {
  return {
    handled: false,
    identifier: null,
    previousIdentifier: null,
    reason,
    state
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
      ArrowDown: chainCommands(insertParagraphAfterFinalBlockCommand, exitCodeBlockAtEndCommand),
      ArrowRight: chainCommands(insertParagraphAfterFinalBlockCommand, exitCodeBlockAtEndCommand),
      Backspace: liftOrMergeListItemAtStartCommand,
      Enter: chainCommands(exitCodeBlockOnFinalBlankLineCommand, newlineInCode, splitListItemCommand, createParagraphNear, liftEmptyBlock, splitBlock),
      Tab: chainCommands(moveToNextRichTableCellCommand, sinkListItemCommand),
      "Shift-Tab": chainCommands(goToNextCell(-1), liftListItemCommand)
    })
  ];
}

function moveToNextRichTableCellCommand(
  state: EditorState,
  dispatch?: (transaction: Transaction) => void
): boolean {
  const moveNext = goToNextCell(1);
  if (moveNext(state, dispatch)) {
    return true;
  }
  const coordinates = richTableCellCoordinatesInEditorState(state);
  const table = coordinates ? findRichTable(state.doc, coordinates.tableIndex) : null;
  if (
    !coordinates ||
    !table ||
    coordinates.rowIndex !== table.node.childCount - 1 ||
    coordinates.columnIndex !== table.node.lastChild!.childCount - 1
  ) {
    return false;
  }
  if (!dispatch) {
    return true;
  }

  const rowTransactions: Transaction[] = [];
  if (!addRowAfter(state, (transaction) => {
    rowTransactions.push(transaction);
  })) {
    return false;
  }
  const rowTransaction = rowTransactions[0];
  if (!rowTransaction) {
    return false;
  }
  let transaction = rowTransaction;
  const appendedTable = findRichTable(transaction.doc, coordinates.tableIndex);
  const headerRow = appendedTable?.node.firstChild;
  const appendedRow = appendedTable?.node.child(coordinates.rowIndex + 1);
  if (headerRow && appendedRow) {
    for (let columnIndex = 0; columnIndex < appendedRow.childCount; columnIndex += 1) {
      const location = findRichTableCellLocation(transaction.doc, {
        columnIndex,
        rowIndex: coordinates.rowIndex + 1,
        tableIndex: coordinates.tableIndex
      });
      if (!location) {
        continue;
      }
      transaction = transaction.setNodeMarkup(location.cellPosition, state.schema.nodes.table_cell, {
        ...location.cell.attrs,
        alignment: normalizeTableAlignment(headerRow.child(columnIndex).attrs.alignment)
      });
    }
  }
  const nextLocation = findRichTableCellLocation(transaction.doc, {
    columnIndex: 0,
    rowIndex: coordinates.rowIndex + 1,
    tableIndex: coordinates.tableIndex
  });
  if (nextLocation) {
    transaction = transaction
      .setSelection(TextSelection.near(transaction.doc.resolve(nextLocation.contentPosition)))
      .scrollIntoView();
  }
  dispatch(transaction);
  return true;
}

interface RichTableLocation {
  readonly node: ProseMirrorNode;
  readonly position: number;
  readonly tableIndex: number;
}

interface RichTableCellLocation extends RichTableCellCoordinates {
  readonly cell: ProseMirrorNode;
  readonly cellPosition: number;
  readonly contentPosition: number;
}

interface RichFootnoteDefinitionLocation {
  readonly node: ProseMirrorNode;
  readonly position: number;
}

interface RichFootnoteNodeLocation {
  readonly node: ProseMirrorNode;
  readonly position: number;
}

interface ParsedFootnoteOccurrences {
  definitions: number;
  references: number;
}

function findRichFootnoteDefinitionLocation(
  doc: ProseMirrorNode,
  identifier: string
): RichFootnoteDefinitionLocation | null {
  const normalizedIdentifier = normalizeFootnoteIdentifier(identifier);
  let result: RichFootnoteDefinitionLocation | null = null;
  doc.forEach((node, offset) => {
    if (
      !result &&
      node.type.name === "footnote_definition" &&
      normalizeFootnoteIdentifier(stringAttribute(node.attrs.identifier) ?? "") === normalizedIdentifier
    ) {
      result = { node, position: offset };
    }
  });
  return result;
}

function richFootnoteIdentifiers(state: RichMarkdownState): ReadonlySet<string> {
  const identifiers = new Set<string>();
  const materializedSource = materializeInsertedRichFootnotes(state);
  const currentParseResult =
    materializedSource === state.source
      ? state.parseResult
      : createMarkdownAstFormatter().parse(materializedSource, {
          dialect: state.parseResult.document.dialect,
          ...(state.parseResult.snapshot.path ? { path: state.parseResult.snapshot.path } : {})
        });
  collectModelFootnoteIdentifiers(currentParseResult.document.root, identifiers);
  state.editorState.doc.descendants((node) => {
    if (!["footnote_definition", "footnote_reference"].includes(node.type.name)) {
      return true;
    }
    const identifier = stringAttribute(node.attrs.identifier) ?? stringAttribute(node.attrs.label);
    if (identifier) {
      identifiers.add(normalizeFootnoteIdentifier(identifier));
    }
    return true;
  });
  return identifiers;
}

function collectParsedFootnoteOccurrences(
  root: MomentariseNode
): ReadonlyMap<string, ParsedFootnoteOccurrences> {
  const occurrences = new Map<string, ParsedFootnoteOccurrences>();
  const visit = (node: MomentariseNode): void => {
    if (node.kind !== "opaque" && ["footnoteDefinition", "footnoteReference"].includes(node.type)) {
      const identifier = stringAttribute(node.attributes?.identifier) ?? stringAttribute(node.attributes?.label);
      if (identifier) {
        const normalizedIdentifier = normalizeFootnoteIdentifier(identifier);
        const current = occurrences.get(normalizedIdentifier) ?? { definitions: 0, references: 0 };
        if (node.type === "footnoteDefinition") {
          current.definitions += 1;
        } else {
          current.references += 1;
        }
        occurrences.set(normalizedIdentifier, current);
      }
    }
    for (const child of node.kind === "opaque" ? [] : node.children ?? []) {
      visit(child);
    }
  };
  visit(root);
  return occurrences;
}

function richFootnoteNodeLocations(
  doc: ProseMirrorNode,
  normalizedIdentifier: string
): readonly RichFootnoteNodeLocation[] {
  const locations: RichFootnoteNodeLocation[] = [];
  doc.descendants((node, position) => {
    if (!["footnote_definition", "footnote_reference"].includes(node.type.name)) {
      return true;
    }
    const identifier = stringAttribute(node.attrs.identifier) ?? stringAttribute(node.attrs.label);
    if (identifier && normalizeFootnoteIdentifier(identifier) === normalizedIdentifier) {
      locations.push({ node, position });
    }
    return true;
  });
  return locations;
}

function hasValidRichFootnoteSourceMapping(state: RichMarkdownState, node: ProseMirrorNode): boolean {
  const identifier = stringAttribute(node.attrs.identifier);
  if (!identifier) {
    return false;
  }
  const sourceIdentifierFrom = numberAttribute(node.attrs.sourceIdentifierFrom);
  const sourceIdentifierTo = numberAttribute(node.attrs.sourceIdentifierTo);
  const sourceIdentifier = stringAttribute(node.attrs.sourceIdentifier);
  if (sourceIdentifierFrom !== null || sourceIdentifierTo !== null || sourceIdentifier !== null) {
    const baseline = state.footnoteInsertionBaseSource ?? state.source;
    return (
      sourceIdentifierFrom !== null &&
      sourceIdentifierTo !== null &&
      sourceIdentifier !== null &&
      sourceIdentifierFrom >= 0 &&
      sourceIdentifierTo > sourceIdentifierFrom &&
      sourceIdentifierTo <= baseline.length &&
      baseline.slice(sourceIdentifierFrom, sourceIdentifierTo) === sourceIdentifier
    );
  }
  if (node.type.name === "footnote_reference") {
    const rawIdentifier = richFootnoteReferenceIdentifier(stringAttribute(node.attrs.raw) ?? "");
    return (
      numberAttribute(node.attrs.insertionSourceOffset) !== null &&
      rawIdentifier !== null &&
      normalizeFootnoteIdentifier(rawIdentifier) === normalizeFootnoteIdentifier(identifier)
    );
  }
  const prefixIdentifier = richFootnoteDefinitionPrefixIdentifier(stringAttribute(node.attrs.prefix) ?? "");
  return (
    node.type.name === "footnote_definition" &&
    node.attrs.inserted === true &&
    prefixIdentifier !== null &&
    normalizeFootnoteIdentifier(prefixIdentifier) === normalizeFootnoteIdentifier(identifier)
  );
}

function renamedRichFootnoteNodeAttrs(
  node: ProseMirrorNode,
  nextIdentifier: string
): Readonly<Record<string, unknown>> | null {
  if (node.type.name === "footnote_reference") {
    const raw = stringAttribute(node.attrs.raw) ?? "";
    const rawIdentifier = richFootnoteReferenceIdentifier(raw);
    const identifier = stringAttribute(node.attrs.label) ?? stringAttribute(node.attrs.identifier);
    if (!rawIdentifier || !identifier || normalizeFootnoteIdentifier(rawIdentifier) !== normalizeFootnoteIdentifier(identifier)) {
      return null;
    }
    return {
      ...node.attrs,
      identifier: normalizeFootnoteIdentifier(nextIdentifier),
      label: nextIdentifier,
      raw: `[^${nextIdentifier}]`
    };
  }
  if (node.type.name === "footnote_definition") {
    const prefix = stringAttribute(node.attrs.prefix) ?? "";
    const match = prefix.match(/^([ \t]{0,3}\[\^)([^\]\r\n]+)(\]:[ \t]*)$/);
    const identifier = stringAttribute(node.attrs.label) ?? stringAttribute(node.attrs.identifier);
    if (!match || !identifier || normalizeFootnoteIdentifier(match[2]!) !== normalizeFootnoteIdentifier(identifier)) {
      return null;
    }
    return {
      ...node.attrs,
      identifier: normalizeFootnoteIdentifier(nextIdentifier),
      label: nextIdentifier,
      prefix: `${match[1]}${nextIdentifier}${match[3]}`
    };
  }
  return null;
}

function richFootnoteReferenceIdentifier(raw: string): string | null {
  return raw.match(/^\[\^([^\]\r\n]+)]$/)?.[1] ?? null;
}

function richFootnoteDefinitionPrefixIdentifier(prefix: string): string | null {
  return prefix.match(/^[ \t]{0,3}\[\^([^\]\r\n]+)]:[ \t]*$/)?.[1] ?? null;
}

function collectModelFootnoteIdentifiers(node: MomentariseNode, identifiers: Set<string>): void {
  if (node.kind !== "opaque" && ["footnoteDefinition", "footnoteReference"].includes(node.type)) {
    const identifier = stringAttribute(node.attributes?.identifier) ?? stringAttribute(node.attributes?.label);
    if (identifier) {
      identifiers.add(normalizeFootnoteIdentifier(identifier));
    }
  }
  for (const child of node.kind === "opaque" ? [] : node.children ?? []) {
    collectModelFootnoteIdentifiers(child, identifiers);
  }
}

function allocateRichFootnoteIdentifier(usedIdentifiers: ReadonlySet<string>): string {
  if (!usedIdentifiers.has("note")) {
    return "note";
  }
  let suffix = 2;
  while (usedIdentifiers.has(`note-${suffix}`)) {
    suffix += 1;
  }
  return `note-${suffix}`;
}

function isRepresentableInsertedFootnoteBody(
  state: RichMarkdownState,
  identifier: string,
  text: string
): boolean {
  const candidate = createMarkdownAstFormatter().parse(`[^${identifier}]: ${text}\n`, {
    dialect: state.parseResult.document.dialect
  });
  const candidateDoc = markdownDocumentToProseMirror(candidate, state.schema);
  return (
    candidateDoc.childCount === 1 &&
    candidateDoc.firstChild?.type.name === "footnote_definition" &&
    candidateDoc.firstChild.textContent === text
  );
}

function sourceOffsetForRichInlineSelection(
  state: RichMarkdownState,
  selection: TextSelection
): number | null {
  const source = materializeInsertedRichFootnotes(state);
  const parseResult =
    source === state.source
      ? state.parseResult
      : createMarkdownAstFormatter().parse(source, {
          dialect: state.parseResult.document.dialect,
          ...(state.parseResult.snapshot.path ? { path: state.parseResult.snapshot.path } : {})
        });
  const blockPosition = selection.$from.before(1);
  const blocks: ProseMirrorNode[] = [];
  let blockIndex = -1;
  state.editorState.doc.forEach((block, offset, index) => {
    blocks.push(block);
    if (offset === blockPosition) {
      blockIndex = index;
    }
  });
  if (blockIndex < 0) {
    return null;
  }
  if (
    source.length === 0 &&
    blocks.length === 1 &&
    blocks[0]?.type.name === "paragraph" &&
    blocks[0].content.size === 0
  ) {
    return 0;
  }

  const pairs = richTopLevelBlockPairs(parseResult, state.schema).filter(
    (pair) => pair.pm !== null && Boolean(pair.model.sourceRange)
  );
  const alignment = alignRichBlocks(blocks, pairs)[blockIndex];
  if (!alignment || alignment.kind !== "matched") {
    return null;
  }
  const model = pairs[alignment.pairIndex]!.model;
  if (model.kind === "opaque" || !["heading", "paragraph"].includes(model.type)) {
    return null;
  }
  return sourceOffsetForModelInlineList(
    model.children ?? [],
    source,
    selection.$from.parentOffset
  );
}

function sourceOffsetForModelInlineList(
  nodes: readonly MomentariseNode[],
  source: string,
  inlineOffset: number
): number | null {
  if (inlineOffset < 0) {
    return null;
  }
  let remaining = inlineOffset;
  for (const node of nodes) {
    const size = modelInlineSize(node);
    if (remaining <= size) {
      return sourceOffsetForModelInlineNode(node, source, remaining);
    }
    remaining -= size;
  }
  if (remaining !== 0) {
    return null;
  }
  const finalRange = nodes.at(-1)?.sourceRange;
  return finalRange?.end.offset ?? null;
}

function sourceOffsetForModelInlineNode(
  node: MomentariseNode,
  source: string,
  inlineOffset: number
): number | null {
  const range = node.sourceRange;
  const size = modelInlineSize(node);
  if (!range || inlineOffset < 0 || inlineOffset > size) {
    return null;
  }
  if (inlineOffset === 0) {
    return range.start.offset;
  }
  if (inlineOffset === size) {
    return range.end.offset;
  }
  if (node.kind === "opaque") {
    return null;
  }
  if (node.type === "text") {
    const value = stringAttribute(node.attributes?.value) ?? "";
    const raw = source.slice(range.start.offset, range.end.offset);
    const rawOffset = sourceOffsetForPlainTextValue(raw, value, inlineOffset);
    return rawOffset === null ? null : range.start.offset + rawOffset;
  }
  if (node.type === "inlineCode") {
    const value = stringAttribute(node.attributes?.value) ?? "";
    const raw = source.slice(range.start.offset, range.end.offset);
    const valueOffset = raw.indexOf(value);
    return valueOffset >= 0 ? range.start.offset + valueOffset + inlineOffset : null;
  }
  if (["footnoteReference", "image", "break", "lineBreak"].includes(node.type)) {
    return null;
  }
  return sourceOffsetForModelInlineList(node.children ?? [], source, inlineOffset);
}

function sourceOffsetForPlainTextValue(raw: string, value: string, valueOffset: number): number | null {
  if (valueOffset < 0 || valueOffset > value.length) {
    return null;
  }
  if (raw === value) {
    return valueOffset;
  }
  if (valueOffset === 0) {
    return 0;
  }

  let rawOffset = 0;
  let decodedOffset = 0;
  while (rawOffset < raw.length && decodedOffset < value.length) {
    if (raw[rawOffset] === "&" && /^&(?:#[xX][0-9A-Fa-f]+|#[0-9]+|[A-Za-z][A-Za-z0-9]+);/.test(raw.slice(rawOffset))) {
      return null;
    }
    const escaped = raw[rawOffset] === "\\" && isMarkdownEscapableCharacter(raw[rawOffset + 1]);
    const rawCharacterOffset = rawOffset + (escaped ? 1 : 0);
    if (raw[rawCharacterOffset] !== value[decodedOffset]) {
      return null;
    }
    rawOffset = rawCharacterOffset + 1;
    decodedOffset += 1;
    if (decodedOffset === valueOffset) {
      return rawOffset;
    }
  }
  return decodedOffset === valueOffset ? rawOffset : null;
}

function isMarkdownEscapableCharacter(value: string | undefined): boolean {
  return Boolean(value && /^[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]$/.test(value));
}

function modelInlineSize(node: MomentariseNode): number {
  if (node.kind === "opaque") {
    return node.raw.length;
  }
  if (node.type === "text" || node.type === "inlineCode") {
    return (stringAttribute(node.attributes?.value) ?? "").length;
  }
  if (["footnoteReference", "image", "break", "lineBreak"].includes(node.type)) {
    return 1;
  }
  return (node.children ?? []).reduce((size, child) => size + modelInlineSize(child), 0);
}

function footnoteBaselineOffset(state: RichMarkdownState, sourceOffset: number): number | null {
  const baseline = state.footnoteInsertionBaseSource;
  const materialized = materializeInsertedRichFootnotes(state);
  if (!baseline) {
    return sourceOffset <= state.source.length ? sourceOffset : null;
  }
  if (state.source !== baseline && state.source !== materialized) {
    return null;
  }
  if (materialized === baseline) {
    return sourceOffset <= baseline.length ? sourceOffset : null;
  }
  let materializedDelta = 0;
  for (const patch of [...richFootnoteSourcePatches(state)].sort(
    (first, second) => first.from - second.from || first.position - second.position
  )) {
    const patchStart = patch.from + materializedDelta;
    const patchEnd = patchStart + patch.replacement.length;
    if (sourceOffset > patchStart && sourceOffset < patchEnd) {
      return null;
    }
    if (sourceOffset >= patchEnd) {
      materializedDelta += patch.replacement.length - (patch.to - patch.from);
    }
  }
  const baselineOffset = sourceOffset - materializedDelta;
  return baselineOffset >= 0 && baselineOffset <= baseline.length ? baselineOffset : null;
}

function findRichTable(doc: ProseMirrorNode, tableIndex: number): RichTableLocation | null {
  let currentTableIndex = 0;
  let result: RichTableLocation | null = null;
  doc.forEach((node, offset) => {
    if (result || node.type.name !== "table") {
      return;
    }
    if (currentTableIndex === tableIndex) {
      result = { node, position: offset, tableIndex };
      return;
    }
    currentTableIndex += 1;
  });
  return result;
}

function findRichTableCellLocation(
  doc: ProseMirrorNode,
  options: SelectRichTableCellOptions
): RichTableCellLocation | null {
  const table = findRichTable(doc, options.tableIndex ?? 0);
  if (!table || options.rowIndex < 0 || options.rowIndex >= table.node.childCount) {
    return null;
  }
  const row = table.node.child(options.rowIndex);
  if (options.columnIndex < 0 || options.columnIndex >= row.childCount) {
    return null;
  }
  let rowOffset = 0;
  for (let index = 0; index < options.rowIndex; index += 1) {
    rowOffset += table.node.child(index).nodeSize;
  }
  let cellOffset = 0;
  for (let index = 0; index < options.columnIndex; index += 1) {
    cellOffset += row.child(index).nodeSize;
  }
  const cell = row.child(options.columnIndex);
  const cellPosition = table.position + 2 + rowOffset + cellOffset;
  return {
    cell,
    cellPosition,
    columnIndex: options.columnIndex,
    contentPosition: cellPosition + 2,
    rowIndex: options.rowIndex,
    tableIndex: table.tableIndex
  };
}

function richTableCellCoordinatesInEditorState(state: EditorState): RichTableCellCoordinates | null {
  const selection = state.selection as Selection & { readonly $anchorCell?: ResolvedPos };
  const position = selection.$anchorCell ?? state.selection.$from;
  return richTableCellCoordinatesForResolvedPosition(state.doc, position);
}

function richTableCellCoordinatesForResolvedPosition(
  doc: ProseMirrorNode,
  position: ResolvedPos
): RichTableCellCoordinates | null {
  const boundaryCoordinates = richTableCellCoordinatesAtPosition(doc, position.pos);
  if (boundaryCoordinates) {
    return boundaryCoordinates;
  }
  for (let depth = position.depth; depth > 0; depth -= 1) {
    const role = position.node(depth).type.spec.tableRole;
    if (role !== "cell" && role !== "header_cell") {
      continue;
    }
    const tableDepth = depth - 2;
    if (tableDepth <= 0) {
      return null;
    }
    const tablePosition = position.before(tableDepth);
    let tableIndex = 0;
    doc.forEach((node, offset) => {
      if (node.type.name === "table" && offset < tablePosition) {
        tableIndex += 1;
      }
    });
    return {
      columnIndex: position.index(depth - 1),
      rowIndex: position.index(depth - 2),
      tableIndex
    };
  }
  return null;
}

function richTableCellCoordinatesAtPosition(
  doc: ProseMirrorNode,
  position: number
): RichTableCellCoordinates | null {
  let tableIndex = 0;
  let result: RichTableCellCoordinates | null = null;
  doc.forEach((table, tableOffset) => {
    if (result || table.type.name !== "table") {
      return;
    }
    let rowOffset = 0;
    table.forEach((row, _rowOffset, rowIndex) => {
      let cellOffset = 0;
      row.forEach((cell, _cellOffset, columnIndex) => {
        if (tableOffset + 2 + rowOffset + cellOffset === position) {
          result = { columnIndex, rowIndex, tableIndex };
        }
        cellOffset += cell.nodeSize;
      });
      rowOffset += row.nodeSize;
    });
    tableIndex += 1;
  });
  return result;
}

function normalizeTableAlignment(value: unknown): TableAlignment {
  return value === "center" || value === "left" || value === "right" ? value : null;
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
  if (commandId === "footnote") {
    if (options.text === undefined) {
      return { handled: false, identifier: null, reason: "invalid-body", state };
    }
    const result = insertRichFootnote(state, {
      ...(options.preferredIdentifier !== undefined
        ? { preferredIdentifier: options.preferredIdentifier }
        : {}),
      text: options.text
    });
    return {
      handled: result.handled,
      identifier: result.identifier,
      reason: result.reason,
      state: result.state
    };
  }
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
  const transaction = insertParagraphAfterBlockTransaction(state.editorState, range, text);
  if (!transaction) {
    return state;
  }
  const editorState = state.editorState.apply(transaction);
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

export function insertParagraphAfterFinalBlock(state: RichMarkdownState, text = ""): RichMarkdownState {
  const transaction = createInsertParagraphAfterFinalBlockTransaction(state.editorState, text);
  if (!transaction) {
    return state;
  }
  return {
    ...state,
    editorState: state.editorState.apply(transaction)
  };
}

export function canInsertParagraphAfterFinalBlock(state: RichMarkdownState): boolean {
  const range = finalTopLevelBlockRange(state.editorState);
  return Boolean(range && isFinalParagraphInsertionBlock(range.node));
}

export function getRichHeadingFoldItems(
  state: RichMarkdownState,
  folds: readonly FoldState[] = []
): readonly RichHeadingFoldItem[] {
  return getRichFoldItems(state, folds).filter((item): item is RichHeadingFoldItem => item.foldKind === "heading");
}

export function getRichFoldItems(
  state: RichMarkdownState,
  folds: readonly FoldState[] = []
): readonly RichFoldItem[] {
  const foldMap = collapsedFoldMap(folds);
  const blockRecords = richTopLevelBlockRecords(state.editorState.doc, foldMap);
  return blockRecords
    .filter((record) => record.foldable && record.foldKind !== null)
    .map((record) => ({
      folded: record.folded,
      foldable: true,
      foldKind: record.foldKind!,
      hiddenBlockCount:
        record.headingLevel === null
          ? 0
          : countHeadingSectionBlocks(blockRecords, record.index, record.headingLevel),
      level: record.headingLevel,
      nodeId: record.nodeId,
      position: record.position,
      text: record.text,
      type: record.type
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
  return toggleRichFold(folds, foldNodeId);
}

export function toggleRichFold(
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

export function sourceRangeForRichRange(
  state: RichMarkdownState,
  richRange: SourceOffsetRange
): SourceOffsetRange | null {
  const normalized = {
    from: Math.min(richRange.from, richRange.to),
    to: Math.max(richRange.from, richRange.to)
  };
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
    if (aligned.kind !== "matched") {
      continue;
    }
    const blockRange = blockRanges[blockIndex];
    if (!blockRange) {
      return null;
    }
    const textFrom = blockRange.from + 1;
    const textTo = textFrom + blockRange.text.length;
    if (normalized.from < textFrom || normalized.to > textTo) {
      continue;
    }
    const modelRange = pairs[aligned.pairIndex]!.model.sourceRange!;
    const raw = state.source.slice(modelRange.start.offset, modelRange.end.offset);
    const textStartInRaw = blockRange.text ? raw.indexOf(blockRange.text) : 0;
    if (textStartInRaw < 0) {
      return null;
    }
    const sourceTextStart = modelRange.start.offset + textStartInRaw;
    return {
      from: sourceTextStart + normalized.from - textFrom,
      to: sourceTextStart + normalized.to - textFrom
    };
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
  const transaction = insertParagraphAfterBlockTransaction(view.state, range);
  if (!transaction) {
    return;
  }
  view.dispatch(transaction);
  view.focus();
}

function insertParagraphAfterBlockTransaction(
  state: EditorState,
  range: Pick<RichTopLevelBlockRange, "node" | "to">,
  text = ""
): Transaction | null {
  const paragraph = text
    ? state.schema.nodes.paragraph!.create(null, [state.schema.text(text)])
    : state.schema.nodes.paragraph!.create();
  let transaction = state.tr.insert(range.to, paragraph);
  const selectionPosition = Math.min(range.to + 1 + text.length, transaction.doc.content.size);
  transaction = transaction.setSelection(TextSelection.create(transaction.doc, selectionPosition)).scrollIntoView();
  return transaction;
}

function createInsertParagraphAfterFinalBlockTransaction(state: EditorState, text = ""): Transaction | null {
  const range = finalTopLevelBlockRange(state);
  if (!range || !isFinalParagraphInsertionBlock(range.node)) {
    return null;
  }
  return insertParagraphAfterBlockTransaction(state, range, text);
}

function finalTopLevelBlockRange(state: EditorState): RichTopLevelBlockRange | null {
  return richTopLevelBlockRanges(state).at(-1) ?? null;
}

function isFinalParagraphInsertionBlock(node: ProseMirrorNode): boolean {
  return (
    ["blockquote", "code_block", "footnote_definition", "horizontal_rule", "table", "unsupported_block"].includes(node.type.name) ||
    isImageOnlyParagraph(node)
  );
}

function isImageOnlyParagraph(node: ProseMirrorNode): boolean {
  if (node.type.name !== "paragraph" || node.childCount !== 1) {
    return false;
  }
  return node.firstChild?.type.name === "image";
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
  const source = materializeInsertedRichFootnotes(state);
  const parseResult =
    source === state.source
      ? state.parseResult
      : createMarkdownAstFormatter().parse(source, {
          dialect: state.parseResult.document.dialect,
          ...(state.parseResult.snapshot.path ? { path: state.parseResult.snapshot.path } : {})
        });
  const pairs = richTopLevelBlockPairs(parseResult, state.schema).filter(
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
      let text = serializeReconstructedProseMirrorBlock(aligned.block);
      let separator: string;
      if (originalIndex >= 0) {
        const range = pairs[originalIndex]!.model.sourceRange!;
        text = applySourceLineEnding(text, source.slice(range.start.offset, range.end.offset));
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
        text = applySourceLineEnding(text, source);
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

interface InsertedRichFootnoteReference {
  readonly position: number;
  readonly raw: string;
  readonly sourceOffset: number;
}

interface RichFootnoteSourcePatch {
  readonly from: number;
  readonly position: number;
  readonly replacement: string;
  readonly to: number;
}

function insertedRichFootnoteReferences(doc: ProseMirrorNode): readonly InsertedRichFootnoteReference[] {
  const references: InsertedRichFootnoteReference[] = [];
  doc.descendants((node, position) => {
    if (node.type.name !== "footnote_reference") {
      return true;
    }
    const sourceOffset = numberAttribute(node.attrs.insertionSourceOffset);
    const raw = stringAttribute(node.attrs.raw);
    if (sourceOffset !== null && raw) {
      references.push({ position, raw, sourceOffset });
    }
    return true;
  });
  return references.sort(
    (first, second) => first.sourceOffset - second.sourceOffset || first.position - second.position
  );
}

function insertedRichFootnoteDefinitions(doc: ProseMirrorNode): readonly ProseMirrorNode[] {
  const definitions: ProseMirrorNode[] = [];
  doc.forEach((node) => {
    if (node.type.name === "footnote_definition" && node.attrs.inserted === true) {
      definitions.push(node);
    }
  });
  return definitions;
}

function richFootnoteSourcePatches(state: RichMarkdownState): readonly RichFootnoteSourcePatch[] {
  const baseline = state.footnoteInsertionBaseSource ?? state.source;
  const patches: RichFootnoteSourcePatch[] = insertedRichFootnoteReferences(state.editorState.doc).map(
    (reference) => ({
      from: reference.sourceOffset,
      position: reference.position,
      replacement: reference.raw,
      to: reference.sourceOffset
    })
  );
  state.editorState.doc.descendants((node, position) => {
    if (!["footnote_definition", "footnote_reference"].includes(node.type.name)) {
      return true;
    }
    const from = numberAttribute(node.attrs.sourceIdentifierFrom);
    const to = numberAttribute(node.attrs.sourceIdentifierTo);
    const sourceIdentifier = stringAttribute(node.attrs.sourceIdentifier);
    const identifier = stringAttribute(node.attrs.label) ?? stringAttribute(node.attrs.identifier);
    if (
      from !== null &&
      to !== null &&
      sourceIdentifier !== null &&
      identifier !== null &&
      from >= 0 &&
      to > from &&
      to <= baseline.length &&
      baseline.slice(from, to) === sourceIdentifier &&
      identifier !== sourceIdentifier
    ) {
      patches.push({ from, position, replacement: identifier, to });
    }
    return true;
  });
  return patches;
}

function materializeInsertedRichFootnotes(state: RichMarkdownState): string {
  const baseline = state.footnoteInsertionBaseSource ?? state.source;
  const definitions = insertedRichFootnoteDefinitions(state.editorState.doc);
  const patches = richFootnoteSourcePatches(state);
  if (patches.length === 0 && definitions.length === 0) {
    return baseline;
  }

  let content = baseline;
  for (const patch of [...patches].sort(
    (first, second) =>
      second.from - first.from ||
      Number(second.to > second.from) - Number(first.to > first.from) ||
      second.position - first.position
  )) {
    if (patch.from < 0 || patch.to < patch.from || patch.to > baseline.length) {
      continue;
    }
    content = `${content.slice(0, patch.from)}${patch.replacement}${content.slice(patch.to)}`;
  }

  const lineEnding = baseline.includes("\r\n") ? "\r\n" : "\n";
  for (const definition of definitions) {
    const markdown = applySourceLineEnding(serializeReconstructedProseMirrorBlock(definition), baseline);
    content = appendMarkdownBlock(content, markdown, lineEnding);
  }
  return content;
}

function appendMarkdownBlock(content: string, block: string, lineEnding: "\n" | "\r\n"): string {
  if (!content) {
    return `${block}${lineEnding}`;
  }
  const separator = content.endsWith(`${lineEnding}${lineEnding}`)
    ? ""
    : content.endsWith(lineEnding)
      ? lineEnding
      : `${lineEnding}${lineEnding}`;
  return `${content}${separator}${block}${lineEnding}`;
}

function applySourceLineEnding(value: string, sourceContext: string): string {
  return sourceContext.includes("\r\n") ? value.replace(/\r?\n/g, "\r\n") : value;
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
  if (block.type.name === "footnote_definition") {
    return serializeRichFootnoteDefinition(block);
  }
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
    case "table":
      return proseMirrorTableToMomentariseNode(node, nextId);
    case "footnote_definition":
      return knownNode(
        nextId,
        "block",
        "footnoteDefinition",
        proseMirrorBlockChildrenToMomentariseNodes(node, nextId),
        {
          identifier: stringAttribute(node.attrs.identifier) ?? "",
          label: stringAttribute(node.attrs.label) ?? stringAttribute(node.attrs.identifier) ?? "",
          prefix: stringAttribute(node.attrs.prefix) ?? "",
          continuationIndent: stringAttribute(node.attrs.continuationIndent) ?? ""
        }
      );
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

function proseMirrorTableToMomentariseNode(
  node: ProseMirrorNode,
  nextId: () => ReturnType<typeof createNodeId>
): KnownNode {
  const rows: MomentariseNode[] = [];
  node.forEach((row) => {
    const cells: MomentariseNode[] = [];
    row.forEach((cell) => {
      const paragraph = cell.firstChild;
      cells.push(
        knownNode(
          nextId,
          "block",
          "tableCell",
          paragraph ? proseMirrorInlineChildrenToMomentariseNodes(paragraph, nextId) : []
        )
      );
    });
    rows.push(knownNode(nextId, "block", "tableRow", cells));
  });
  const firstRow = node.firstChild;
  const alignments: TableAlignment[] = [];
  firstRow?.forEach((cell) => {
    alignments.push(normalizeTableAlignment(cell.attrs.alignment));
  });
  return knownNode(nextId, "block", "table", rows, { align: alignments });
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
  if (node.type.name === "footnote_reference") {
    return [
      knownNode(nextId, "inline", "footnoteReference", [], {
        identifier: stringAttribute(node.attrs.identifier) ?? "",
        label: stringAttribute(node.attrs.label) ?? stringAttribute(node.attrs.identifier) ?? "",
        raw: stringAttribute(node.attrs.raw) ?? ""
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
    if (richNodesEquivalent(pairs[pairIndex]!.pm!, block)) {
      return pairIndex;
    }
  }
  return -1;
}

function richNodesEquivalent(first: ProseMirrorNode, second: ProseMirrorNode): boolean {
  if (first.eq(second)) {
    return true;
  }
  return richNodeWithoutSourceMetadata(first).eq(richNodeWithoutSourceMetadata(second));
}

function richNodeWithoutSourceMetadata(node: ProseMirrorNode): ProseMirrorNode {
  if (node.isText) {
    return node;
  }
  const attrs = { ...node.attrs };
  if (["footnote_definition", "footnote_reference"].includes(node.type.name)) {
    attrs.sourceIdentifier = null;
    attrs.sourceIdentifierFrom = null;
    attrs.sourceIdentifierTo = null;
  }
  if (node.type.name === "footnote_reference") {
    attrs.insertionSourceOffset = null;
  }
  if (node.type.name === "footnote_definition") {
    attrs.inserted = false;
  }
  const children: ProseMirrorNode[] = [];
  node.forEach((child) => {
    children.push(richNodeWithoutSourceMetadata(child));
  });
  return node.type.create(attrs, children.length > 0 ? Fragment.fromArray(children) : null, node.marks);
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
  const nodes = filterRichRootNodes(parseResult.document.root.children ?? []).filter(
    (node) => node.type !== "yaml" && node.type !== "yamlFrontmatter"
  );
  const footnoteDefinitionCounts = countFootnoteDefinitions(nodes);
  return nodes.map((node) => ({
    model: node,
    pm: blockNodeToProseMirror(node, schema, source, true, footnoteDefinitionCounts)
  }));
}

function countFootnoteDefinitions(nodes: readonly MomentariseNode[]): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  const visit = (node: MomentariseNode): void => {
    if (node.kind === "opaque") {
      return;
    }
    if (node.type === "footnoteDefinition") {
      const identifier = normalizeFootnoteIdentifier(
        stringAttribute(node.attributes?.identifier) ?? stringAttribute(node.attributes?.label) ?? ""
      );
      if (identifier) {
        counts.set(identifier, (counts.get(identifier) ?? 0) + 1);
      }
    }
    for (const child of node.children ?? []) {
      visit(child);
    }
  };
  for (const node of nodes) {
    visit(node);
  }
  return counts;
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
    case "footnote":
      return false;
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
  | { readonly kind: "horizontal_rule"; readonly prefixLength: number }
  | { readonly kind: "ordered_list"; readonly prefixLength: number }
  | { readonly checked: boolean; readonly kind: "todo_item"; readonly prefixLength: number };

type RichInlineInputRule =
  | { readonly from: number; readonly kind: "inline_code"; readonly text: string; readonly to: number }
  | { readonly from: number; readonly href: string; readonly kind: "link"; readonly text: string; readonly title: string | null; readonly to: number };

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

      const inlineRule = inlineMarkdownInputRuleForText(textBeforeCursor);
      if (inlineRule) {
        return createInlineMarkdownInputRuleTransaction(state, inlineRule, text);
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

function insertParagraphAfterFinalBlockCommand(state: EditorState, dispatch?: (transaction: Transaction) => void): boolean {
  if (!selectionCanMovePastFinalBlock(state)) {
    return false;
  }
  const transaction = createInsertParagraphAfterFinalBlockTransaction(state);
  if (!transaction) {
    return false;
  }
  dispatch?.(transaction);
  return true;
}

function selectionCanMovePastFinalBlock(state: EditorState): boolean {
  const range = finalTopLevelBlockRange(state);
  if (!range || !isFinalParagraphInsertionBlock(range.node)) {
    return false;
  }
  if (state.selection instanceof NodeSelection) {
    if (state.selection.from === range.from && state.selection.to === range.to) {
      return true;
    }
    if (range.node.type.name === "paragraph" && isImageOnlyParagraph(range.node)) {
      return state.selection.from >= range.from && state.selection.to <= range.to;
    }
    return false;
  }
  const cellSelection = state.selection as Selection & {
    readonly $anchorCell?: ResolvedPos;
    readonly $headCell?: ResolvedPos;
  };
  if (range.node.type.name === "table" && cellSelection.$anchorCell && cellSelection.$headCell) {
    const anchor = richTableCellCoordinatesForResolvedPosition(state.doc, cellSelection.$anchorCell);
    const head = richTableCellCoordinatesForResolvedPosition(state.doc, cellSelection.$headCell);
    if (!anchor || !head || anchor.tableIndex !== head.tableIndex) {
      return false;
    }
    const lastRow = range.node.childCount - 1;
    const lastColumn = range.node.lastChild!.childCount - 1;
    return (
      (anchor.rowIndex === 0 && anchor.columnIndex === 0 && head.rowIndex === lastRow && head.columnIndex === lastColumn) ||
      (head.rowIndex === 0 && head.columnIndex === 0 && anchor.rowIndex === lastRow && anchor.columnIndex === lastColumn)
    );
  }
  if (!(state.selection instanceof TextSelection) || !state.selection.empty) {
    return false;
  }
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.before(depth) === range.from && $from.after(depth) === range.to) {
      return $from.pos === range.to - 1 || $from.parentOffset === $from.parent.content.size;
    }
  }
  return false;
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

function createDocumentEndInsertionPlugin(): Plugin {
  return new Plugin({
    props: {
      handleDOMEvents: {
        mousedown(view, event) {
          return handleDocumentEndInsertionPointerEvent(view, event as MouseEvent);
        },
        click(view, event) {
          return handleDocumentEndInsertionPointerEvent(view, event as MouseEvent);
        }
      }
    }
  });
}

function handleDocumentEndInsertionPointerEvent(
  view: RichEditorViewLike & { readonly dom?: HTMLElement },
  event: MouseEvent
): boolean {
  if (event.button !== 0) {
    return false;
  }
  const transaction = createClickAfterFinalBlockTransaction(
    view.state,
    view.dom,
    event,
    (position) => view.nodeDOM(position)
  );
  if (!transaction) {
    return false;
  }
  event.preventDefault();
  view.dispatch(transaction);
  view.focus();
  return true;
}

function createClickAfterFinalBlockTransaction(
  state: EditorState,
  editorDom: HTMLElement | undefined,
  event: MouseEvent,
  nodeDOM: (position: number) => Node | null
): Transaction | null {
  if (typeof HTMLElement === "undefined" || !editorDom) {
    return null;
  }
  if (event.target !== editorDom) {
    return null;
  }
  const range = finalTopLevelBlockRange(state);
  if (!range || !isFinalParagraphInsertionBlock(range.node)) {
    return null;
  }
  const finalDom = nodeDOM(range.from);
  if (!(finalDom instanceof HTMLElement)) {
    return null;
  }
  const editorRect = editorDom.getBoundingClientRect();
  const finalRect = finalDom.getBoundingClientRect();
  const insideEditorX = event.clientX >= editorRect.left && event.clientX <= editorRect.right;
  const belowFinalBlock = event.clientY > finalRect.bottom;
  const insideEditorY = event.clientY <= editorRect.bottom;
  if (!insideEditorX || !belowFinalBlock || !insideEditorY) {
    return null;
  }
  return createInsertParagraphAfterFinalBlockTransaction(state);
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

  if (text === "---" || text === "***" || text === "___") {
    return {
      kind: "horizontal_rule",
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

function inlineMarkdownInputRuleForText(text: string): RichInlineInputRule | null {
  const inlineCode = text.match(/`([^`\n]+)`$/u);
  if (inlineCode?.index !== undefined) {
    return {
      from: inlineCode.index,
      kind: "inline_code",
      text: inlineCode[1]!,
      to: text.length
    };
  }

  const link = text.match(/(?<!!)\[([^\]\n]+)\]\((.*)\)$/u);
  if (link?.index !== undefined) {
    const parsed = parseMarkdownLinkDestinationAndTitle(link[2]!);
    if (!parsed || !isSafeUrl(parsed.href)) {
      return null;
    }
    return {
      from: link.index,
      href: parsed.href,
      kind: "link",
      text: link[1]!,
      title: parsed.title,
      to: text.length
    };
  }

  return null;
}

function parseMarkdownLinkDestinationAndTitle(raw: string): { readonly href: string; readonly title: string | null } | null {
  const value = raw.trim();
  if (!value) {
    return null;
  }
  if (value.startsWith("<")) {
    const closing = value.indexOf(">");
    if (closing <= 1) {
      return null;
    }
    const href = unescapeMarkdownLinkPart(value.slice(1, closing));
    const title = parseMarkdownLinkTitle(value.slice(closing + 1).trim());
    return title === undefined ? null : { href, title };
  }

  const destinationMatch = value.match(/^((?:\\.|[^\s])+)(.*)$/u);
  if (!destinationMatch) {
    return null;
  }
  const href = unescapeMarkdownLinkPart(destinationMatch[1]!);
  const title = parseMarkdownLinkTitle(destinationMatch[2]!.trim());
  return title === undefined ? null : { href, title };
}

function parseMarkdownLinkTitle(raw: string): string | null | undefined {
  if (!raw) {
    return null;
  }
  const doubleQuoted = raw.match(/^"((?:\\.|[^"\\])*)"$/u);
  if (doubleQuoted) {
    return unescapeMarkdownLinkPart(doubleQuoted[1]!);
  }
  const singleQuoted = raw.match(/^'((?:\\.|[^'\\])*)'$/u);
  if (singleQuoted) {
    return unescapeMarkdownLinkPart(singleQuoted[1]!);
  }
  return undefined;
}

function unescapeMarkdownLinkPart(value: string): string {
  return value.replace(/\\([\\()"'])/gu, "$1");
}

function createInlineMarkdownInputRuleTransaction(
  state: EditorState,
  rule: RichInlineInputRule,
  undoText: string
): Transaction | null {
  const { $from } = state.selection;
  if ($from.parent.type !== state.schema.nodes.paragraph) {
    return null;
  }
  const from = $from.start() + rule.from;
  const to = $from.start() + rule.to;
  const mark =
    rule.kind === "inline_code"
      ? state.schema.marks.code!.create()
      : state.schema.marks.link!.create({
          href: rule.href,
          title: rule.title
        });
  const transaction = state.tr
    .replaceWith(from, to, state.schema.text(rule.text, [mark]))
    .setMeta(richInputRulesPluginKey, {
      undoText
    });
  transaction.setSelection(TextSelection.create(transaction.doc, Math.min(from + rule.text.length, transaction.doc.content.size)));
  transaction.removeStoredMark(mark.type);
  return transaction;
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
    case "horizontal_rule":
      return schema.nodes.horizontal_rule!.create();
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
    case "horizontal_rule":
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
    const text = foldRecordText(node);
    const foldKind = richFoldKindForNode(node, headingLevel, text);
    let nodeId = `block:${index}:${node.type.name}`;
    if (headingLevel !== null) {
      while (collapsedStack.length > 0 && collapsedStack[collapsedStack.length - 1]!.level >= headingLevel) {
        collapsedStack.pop();
      }
      while (headingPath.length > 0 && headingPath[headingPath.length - 1]!.level >= headingLevel) {
        headingPath.pop();
      }
      nodeId = createHeadingNodeId(headingPath, headingLevel, node.textContent, siblingCounts);
    } else if (foldKind !== null) {
      nodeId = createBlockFoldNodeId(node.type.name, text, siblingCounts);
    }

    const hiddenBy = collapsedStack[collapsedStack.length - 1]?.nodeId ?? null;
    const folded = foldKind !== null && foldMap.get(nodeId) === true;
    records.push({
      foldKind,
      foldable: foldKind !== null,
      folded,
      headingLevel,
      hidden: Boolean(hiddenBy),
      hiddenBy,
      index,
      nodeId,
      position: offset,
      text,
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

function foldRecordText(node: ProseMirrorNode): string {
  if (node.type.name === "unsupported_block") {
    return String(node.attrs.raw ?? "").trim();
  }
  return node.textContent.trim();
}

function richFoldKindForNode(
  node: ProseMirrorNode,
  headingLevel: number | null,
  text: string
): RichFoldKind | null {
  if (headingLevel !== null) {
    return "heading";
  }
  if (node.type.name === "code_block") {
    return "code";
  }
  if (node.type.name === "blockquote" && /^\s*\[!/i.test(text)) {
    return "callout";
  }
  if (node.type.name === "unsupported_block") {
    const reason = String(node.attrs.reason ?? "");
    if (/callout/i.test(reason) || /^\s*>\s*\[!/i.test(text)) {
      return "callout";
    }
    return "opaque";
  }
  return null;
}

function createBlockFoldNodeId(
  typeName: string,
  text: string,
  siblingCounts: Map<string, number>
): string {
  const hash = String(hashMarkdownContent(text || typeName)).replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
  const key = `fold|${typeName}|${hash}`;
  const occurrence = (siblingCounts.get(key) ?? 0) + 1;
  siblingCounts.set(key, occurrence);
  return `fold:${typeName}:${hash}${occurrence > 1 ? `-${occurrence}` : ""}`;
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

const richTableNodes = tableNodes({
  cellAttributes: {
    alignment: {
      default: null,
      getFromDOM(element) {
        return normalizeTableAlignment(element.getAttribute("data-mme-table-align") ?? element.style.textAlign);
      },
      setDOMAttr(value, attributes) {
        const alignment = normalizeTableAlignment(value);
        if (!alignment) {
          return;
        }
        attributes["data-mme-table-align"] = alignment;
        attributes.style = `${typeof attributes.style === "string" ? `${attributes.style}; ` : ""}text-align: ${alignment}`;
      },
      validate(value) {
        if (value !== null && !normalizeTableAlignment(value)) {
          throw new RangeError(`Invalid table alignment: ${String(value)}.`);
        }
      }
    }
  },
  cellContent: "paragraph",
  tableGroup: "block"
});

const richNodes: Record<string, NodeSpec> = {
  doc: {
    content: "block+"
  },
  ...richTableNodes,
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
  footnote_definition: {
    attrs: {
      continuationIndent: { default: "" },
      identifier: { default: "" },
      inserted: { default: false },
      label: { default: "" },
      blockContinuationIndents: { default: "[]" },
      blockFingerprints: { default: "[]" },
      blockSeparators: { default: "[]" },
      blockSources: { default: "[]" },
      prefix: { default: "" },
      sourceIdentifier: { default: null },
      sourceIdentifierFrom: { default: null },
      sourceIdentifierTo: { default: null }
    },
    content: "paragraph (paragraph | bullet_list | ordered_list)*",
    defining: true,
    group: "block",
    parseDOM: [
      {
        tag: '[data-mme-footnote-definition="true"]',
        getAttrs: (element) =>
          element instanceof HTMLElement
            ? {
                identifier: element.dataset.mmeFootnoteIdentifier ?? "",
                label: element.dataset.mmeFootnoteLabel ?? element.dataset.mmeFootnoteIdentifier ?? "",
                prefix: element.dataset.mmeFootnotePrefix ?? "",
                continuationIndent: element.dataset.mmeFootnoteContinuationIndent ?? ""
              }
            : false
      }
    ],
    toDOM: (node) => {
      const identifier = stringAttribute(node.attrs.identifier) ?? "";
      const label = stringAttribute(node.attrs.label) ?? identifier;
      const prefix = stringAttribute(node.attrs.prefix) ?? `[^${label}]: `;
      return [
        "div",
        {
          "aria-label": `Footnote ${label}`,
          "data-mme-footnote-definition": "true",
          "data-mme-footnote-continuation-indent": stringAttribute(node.attrs.continuationIndent) ?? "",
          "data-mme-footnote-identifier": identifier,
          "data-mme-footnote-label": label,
          "data-mme-footnote-prefix": prefix,
          role: "doc-footnote"
        },
        [
          "span",
          {
            "aria-hidden": "true",
            contenteditable: "false",
            "data-mme-footnote-marker": "true",
            "data-mme-footnote-marker-label": `[^${label}]:`
          }
        ],
        ["div", { "data-mme-footnote-body": "true" }, 0]
      ];
    }
  },
  footnote_reference: {
    atom: true,
    attrs: {
      identifier: { default: "" },
      insertionSourceOffset: { default: null },
      label: { default: "" },
      raw: { default: "" },
      sourceIdentifier: { default: null },
      sourceIdentifierFrom: { default: null },
      sourceIdentifierTo: { default: null }
    },
    group: "inline",
    inline: true,
    parseDOM: [
      {
        tag: '[data-mme-footnote-reference="true"]',
        getAttrs: (element) =>
          element instanceof HTMLElement
            ? {
                identifier: element.dataset.mmeFootnoteIdentifier ?? "",
                label: element.dataset.mmeFootnoteLabel ?? element.dataset.mmeFootnoteIdentifier ?? "",
                raw: element.dataset.mmeFootnoteRaw ?? element.textContent ?? ""
              }
            : false
      }
    ],
    selectable: true,
    toDOM: (node) => {
      const identifier = stringAttribute(node.attrs.identifier) ?? "";
      const label = stringAttribute(node.attrs.label) ?? identifier;
      const raw = stringAttribute(node.attrs.raw) ?? `[^${label}]`;
      return [
        "sup",
        {
          "aria-label": `Footnote reference ${label}`,
          "data-mme-footnote-identifier": identifier,
          "data-mme-footnote-label": label,
          "data-mme-footnote-raw": raw,
          "data-mme-footnote-reference": "true"
        },
        raw
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
    inclusive: false,
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
  source: string,
  allowTopLevelRichStructures = true,
  footnoteDefinitionCounts: ReadonlyMap<string, number> = new Map()
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
    case "table":
      return allowTopLevelRichStructures
        ? tableNodeToProseMirror(node, schema, source) ?? unsupportedNodeToProseMirror(node, schema, source)
        : unsupportedNodeToProseMirror(node, schema, source);
    case "footnoteDefinition":
      return allowTopLevelRichStructures
        ? footnoteDefinitionToProseMirror(node, schema, source, footnoteDefinitionCounts) ??
            unsupportedNodeToProseMirror(node, schema, source)
        : unsupportedNodeToProseMirror(node, schema, source);
    default:
      // Closed whitelist: anything the rich subset cannot represent (complex
      // footnotes, raw HTML, ...) is preserved as raw source in an
      // unsupported block. It must never be flattened into an editable paragraph.
      return unsupportedNodeToProseMirror(node, schema, source);
  }
}

function footnoteDefinitionToProseMirror(
  node: KnownNode,
  schema: MomentariseRichSchema,
  source: string,
  footnoteDefinitionCounts: ReadonlyMap<string, number>
): ProseMirrorNode | null {
  const identifier = stringAttribute(node.attributes?.identifier) ?? stringAttribute(node.attributes?.label);
  const label = stringAttribute(node.attributes?.label) ?? identifier;
  const normalizedIdentifier = normalizeFootnoteIdentifier(identifier ?? "");
  const blocks = node.children ?? [];
  const layout = richFootnoteDefinitionLayout(node, source);
  if (
    !identifier ||
    !label ||
    !isSafeFootnoteIdentifier(identifier) ||
    footnoteDefinitionCounts.get(normalizedIdentifier) !== 1 ||
    !layout ||
    normalizeFootnoteIdentifier(layout.sourceIdentifier) !== normalizedIdentifier ||
    blocks.length === 0 ||
    blocks[0]?.kind === "opaque" ||
    blocks[0]?.type !== "paragraph" ||
    blocks.some((block) => !isRepresentableRichFootnoteBlock(block))
  ) {
    return null;
  }
  const blockNodes = blocks.map((block) => {
    if (block.kind === "opaque") {
      throw new Error("Opaque footnote blocks must be rejected before rich conversion.");
    }
    return block.type === "paragraph"
      ? schema.nodes.paragraph!.create(
          null,
          inlineChildrenToProseMirror(block.children ?? [], schema, source)
        )
      : listNodeToProseMirror(block, schema, source);
  });
  const raw = rawFromRange(node, source);
  const identifierOffset = raw.indexOf("[^") + 2;
  const sourceIdentifierFrom = node.sourceRange!.start.offset + identifierOffset;
  return schema.nodes.footnote_definition!.create(
    {
      identifier,
      label,
      prefix: layout.prefix,
      continuationIndent: layout.blockContinuationIndents[0] ?? "",
      blockContinuationIndents: JSON.stringify(layout.blockContinuationIndents),
      blockFingerprints: JSON.stringify(blockNodes.map(richFootnoteBlockFingerprint)),
      blockSeparators: JSON.stringify(layout.blockSeparators),
      blockSources: JSON.stringify(layout.blockSources),
      sourceIdentifier: layout.sourceIdentifier,
      sourceIdentifierFrom,
      sourceIdentifierTo: sourceIdentifierFrom + layout.sourceIdentifier.length
    },
    blockNodes
  );
}

interface RichFootnoteDefinitionLayout {
  readonly blockContinuationIndents: readonly string[];
  readonly blockSeparators: readonly string[];
  readonly blockSources: readonly string[];
  readonly prefix: string;
  readonly sourceIdentifier: string;
}

function richFootnoteDefinitionLayout(
  node: KnownNode,
  source: string
): RichFootnoteDefinitionLayout | null {
  const sourceRange = node.sourceRange;
  const blocks = node.children ?? [];
  if (!sourceRange || blocks.length === 0 || blocks.some((block) => !block.sourceRange)) {
    return null;
  }

  const blockRanges = blocks.map((block) => block.sourceRange!);
  if (
    blockRanges[0]!.start.offset < sourceRange.start.offset ||
    blockRanges.at(-1)!.end.offset > sourceRange.end.offset
  ) {
    return null;
  }

  const prefix = source.slice(sourceRange.start.offset, blockRanges[0]!.start.offset);
  const prefixMatch = prefix.match(/^([ \t]{0,3}\[\^([^\]\r\n]+)\]:[ \t]*)$/);
  if (!prefixMatch) {
    return null;
  }

  const blockSeparators: string[] = [];
  for (let index = 1; index < blockRanges.length; index += 1) {
    const previous = blockRanges[index - 1]!;
    const current = blockRanges[index]!;
    const separator = source.slice(previous.end.offset, current.start.offset);
    if (!isSafeRichFootnoteBlockSeparator(separator)) {
      return null;
    }
    blockSeparators.push(separator);
  }

  const blockSources = blockRanges.map((range) => source.slice(range.start.offset, range.end.offset));
  const blockContinuationIndents = blockSources.map((raw, index) => {
    const block = blocks[index];
    if (block?.kind !== "opaque" && block?.type === "list" && index > 0) {
      const containerIndent = richFootnoteBlockSeparatorIndent(blockSeparators[index - 1]!);
      return containerIndent && richFootnoteListBlockHasContainerIndent(raw, containerIndent)
        ? containerIndent
        : null;
    }
    return richFootnoteBlockContinuationIndent(raw);
  });
  if (blockContinuationIndents.some((indent) => indent === null)) {
    return null;
  }

  return {
    blockContinuationIndents: blockContinuationIndents as readonly string[],
    blockSeparators,
    blockSources,
    prefix,
    sourceIdentifier: prefixMatch[2]!
  };
}

function richFootnoteBlockContinuationIndent(raw: string): string | null {
  const lines = raw.split(/\r?\n/);
  if (lines.length === 1) {
    return "";
  }
  if (!lines[0]) {
    return null;
  }
  const continuationMatches = lines.slice(1).map((line) => line.match(/^([ \t]+)(\S[\s\S]*)$/));
  const continuationIndent = continuationMatches[0]?.[1] ?? "";
  if (
    !isSafeRichFootnoteContinuationIndent(continuationIndent) ||
    continuationMatches.some((match) => !match || match[1] !== continuationIndent)
  ) {
    return null;
  }
  return continuationIndent;
}

function isSafeRichFootnoteBlockSeparator(value: string): boolean {
  return richFootnoteBlockSeparatorIndent(value) !== null;
}

function richFootnoteBlockSeparatorIndent(value: string): string | null {
  const match = value.match(/^(?:[ \t]*(?:\r\n|\n)){2,}([ \t]+)$/);
  const indent = match?.[1] ?? "";
  return isSafeRichFootnoteContinuationIndent(indent) ? indent : null;
}

function richFootnoteListBlockHasContainerIndent(raw: string, containerIndent: string): boolean {
  const lines = raw.split(/\r?\n/);
  return Boolean(
    lines[0] &&
    lines.slice(1).every((line) => line.startsWith(containerIndent) && /\S/.test(line.slice(containerIndent.length)))
  );
}

function isSafeRichFootnoteContinuationIndent(value: string): boolean {
  return /^(?: {4,}|\t+)$/.test(value);
}

function richFootnoteBlockFingerprint(node: ProseMirrorNode): string {
  return JSON.stringify(node.toJSON());
}

function isRepresentableRichFootnoteBlock(node: MomentariseNode): boolean {
  if (node.kind === "opaque") {
    return false;
  }
  if (node.type === "paragraph") {
    return (node.children ?? []).every(isRepresentableRichFootnoteInlineNode);
  }
  if (node.type !== "list") {
    return false;
  }
  return isRepresentableRichFootnoteList(node);
}

function isRepresentableRichFootnoteList(node: MomentariseNode): boolean {
  if (node.kind === "opaque" || node.type !== "list") {
    return false;
  }
  const items = node.children ?? [];
  return items.length > 0 && items.every(isRepresentableRichFootnoteListItem);
}

function isRepresentableRichFootnoteListItem(item: MomentariseNode): boolean {
  if (item.kind === "opaque" || item.type !== "listItem") {
    return false;
  }
  const checked = item.attributes?.checked;
  if (checked !== undefined && typeof checked !== "boolean") {
    return false;
  }
  const itemBlocks = item.children ?? [];
  const paragraph = itemBlocks[0];
  const nestedList = itemBlocks[1];
  return (
    (itemBlocks.length === 1 || itemBlocks.length === 2) &&
    paragraph?.kind !== "opaque" &&
    paragraph?.type === "paragraph" &&
    (paragraph.children ?? []).every(isRepresentableRichFootnoteInlineNode) &&
    (itemBlocks.length === 1 || Boolean(nestedList && isRepresentableRichFootnoteList(nestedList)))
  );
}

function isRepresentableRichFootnoteInlineNode(node: MomentariseNode): boolean {
  if (node.kind === "opaque") {
    return false;
  }
  if (["text", "inlineCode"].includes(node.type)) {
    return true;
  }
  if (node.type === "footnoteReference") {
    const identifier = stringAttribute(node.attributes?.identifier) ?? stringAttribute(node.attributes?.label);
    return Boolean(identifier && isSafeFootnoteIdentifier(identifier));
  }
  if (!["emphasis", "strong", "strikethrough", "link"].includes(node.type)) {
    return false;
  }
  if (node.type === "link" && !isSafeUrl(stringAttribute(node.attributes?.url))) {
    return false;
  }
  return (node.children ?? []).every(isRepresentableRichFootnoteInlineNode);
}

type TableAlignment = "center" | "left" | "right" | null;

function tableNodeToProseMirror(
  node: KnownNode,
  schema: MomentariseRichSchema,
  source: string
): ProseMirrorNode | null {
  const rows = (node.children ?? []).filter(
    (child): child is KnownNode => child.kind !== "opaque" && child.type === "tableRow"
  );
  const width = rows[0] ? richTableCells(rows[0]).length : 0;
  if (
    rows.length === 0 ||
    width === 0 ||
    rows.length !== (node.children ?? []).length ||
    rows.some(
      (row) => richTableCells(row).length !== width || richTableCells(row).length !== (row.children ?? []).length
    )
  ) {
    return null;
  }
  const alignments = modelTableAlignments(node, width);
  const tableRows: ProseMirrorNode[] = [];
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const cells = richTableCells(rows[rowIndex]!);
    const tableCells: ProseMirrorNode[] = [];
    for (let columnIndex = 0; columnIndex < cells.length; columnIndex += 1) {
      const cell = cells[columnIndex]!;
      if (!(cell.children ?? []).every(isRepresentableRichTableInlineNode)) {
        return null;
      }
      const paragraph = schema.nodes.paragraph.create(
        null,
        inlineChildrenToProseMirror(cell.children ?? [], schema, source)
      );
      const cellType = rowIndex === 0 ? schema.nodes.table_header : schema.nodes.table_cell;
      tableCells.push(cellType.create({ alignment: alignments[columnIndex] }, paragraph));
    }
    tableRows.push(schema.nodes.table_row.create(null, tableCells));
  }
  return schema.nodes.table.create(null, tableRows);
}

function richTableCells(node: KnownNode): KnownNode[] {
  return (node.children ?? []).filter(
    (child): child is KnownNode => child.kind !== "opaque" && child.type === "tableCell"
  );
}

function isRepresentableRichTableInlineNode(node: MomentariseNode): boolean {
  if (node.kind === "opaque") {
    return false;
  }
  if (["text", "inlineCode", "image", "break", "lineBreak"].includes(node.type)) {
    return true;
  }
  if (!["emphasis", "strong", "strikethrough", "link"].includes(node.type)) {
    return false;
  }
  return (node.children ?? []).every(isRepresentableRichTableInlineNode);
}

function modelTableAlignments(node: KnownNode, width: number): readonly TableAlignment[] {
  const alignments = Array.isArray(node.attributes?.align) ? node.attributes.align : [];
  return Array.from({ length: width }, (_, index) => normalizeTableAlignment(alignments[index]));
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
    .map((child) => blockNodeToProseMirror(child, schema, source, false))
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
    const identifier = stringAttribute(node.attributes?.identifier) ?? stringAttribute(node.attributes?.label);
    const label = stringAttribute(node.attributes?.label) ?? identifier;
    const raw = footnoteReferenceText(node, source);
    if (!identifier || !label || !raw || !isSafeFootnoteIdentifier(identifier)) {
      return raw ? [schema.text(raw, marks)] : [];
    }
    const sourceIdentifierFrom = node.sourceRange ? node.sourceRange.start.offset + 2 : null;
    const sourceIdentifierTo = node.sourceRange ? node.sourceRange.end.offset - 1 : null;
    return [
      schema.nodes.footnote_reference!.create(
        {
          identifier,
          label,
          raw,
          sourceIdentifier: node.sourceRange ? source.slice(sourceIdentifierFrom!, sourceIdentifierTo!) : null,
          sourceIdentifierFrom,
          sourceIdentifierTo
        },
        null,
        marks
      )
    ];
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

function normalizeFootnoteIdentifier(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function isSafeFootnoteIdentifier(value: string): boolean {
  return value.trim().length > 0 && !/[\[\]\r\n]/.test(value);
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
    case "table":
      return serializeRichTable(node);
    case "footnote_definition":
      return serializeRichFootnoteDefinition(node);
    case "horizontal_rule":
      return "---";
    case "unsupported_block":
      return String(node.attrs.raw ?? "").trimEnd();
    default:
      return node.textContent;
  }
}

function serializeRichFootnoteDefinition(node: ProseMirrorNode): string {
  const prefix = stringAttribute(node.attrs.prefix) ??
    `[^${stringAttribute(node.attrs.label) ?? stringAttribute(node.attrs.identifier) ?? ""}]: `;
  const blocks: ProseMirrorNode[] = [];
  node.forEach((block) => {
    blocks.push(block);
  });
  const continuationIndents = parseRichFootnoteStringArray(node.attrs.blockContinuationIndents);
  const fingerprints = parseRichFootnoteStringArray(node.attrs.blockFingerprints);
  const separators = parseRichFootnoteStringArray(node.attrs.blockSeparators);
  const sources = parseRichFootnoteStringArray(node.attrs.blockSources);
  const hasCompleteSourceLayout =
    continuationIndents.length === blocks.length &&
    fingerprints.length === blocks.length &&
    sources.length === blocks.length &&
    separators.length === Math.max(0, blocks.length - 1);
  const parts: string[] = [];

  blocks.forEach((block, index) => {
    const unchangedSource =
      hasCompleteSourceLayout && fingerprints[index] === richFootnoteBlockFingerprint(block)
        ? sources[index]
        : null;
    const continuationIndent =
      (hasCompleteSourceLayout ? continuationIndents[index] : null) ||
      (index === 0 ? stringAttribute(node.attrs.continuationIndent) : null) ||
      "    ";
    const reconstructed = block.type.name === "paragraph" ? serializeInline(block) : serializeBlock(block, 0);
    const body = unchangedSource ?? reconstructed.replace(/\r?\n/g, `\n${continuationIndent}`);
    const separator = index === 0
      ? prefix
      : hasCompleteSourceLayout
        ? separators[index - 1]!
        : "\n\n    ";
    parts.push(`${separator}${body}`);
  });

  return parts.join("");
}

function parseRichFootnoteStringArray(value: NodeAttributeValue | undefined): readonly string[] {
  const serialized = stringAttribute(value);
  if (!serialized) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(serialized);
    return Array.isArray(parsed) && parsed.every((entry) => typeof entry === "string") ? parsed : [];
  } catch {
    return [];
  }
}

function serializeRichTable(node: ProseMirrorNode): string {
  const rows: string[] = [];
  const firstRow = node.firstChild;
  node.forEach((row) => {
    const cells: string[] = [];
    row.forEach((cell) => {
      cells.push(escapeRichTableCellMarkdown(cell.firstChild ? serializeInline(cell.firstChild) : ""));
    });
    rows.push(`| ${cells.join(" | ")} |`);
  });
  if (!firstRow || rows.length === 0) {
    return "";
  }
  const delimiterCells: string[] = [];
  firstRow.forEach((cell) => {
    delimiterCells.push(tableDelimiterForAlignment(normalizeTableAlignment(cell.attrs.alignment)));
  });
  return [rows[0]!, `| ${delimiterCells.join(" | ")} |`, ...rows.slice(1)].join("\n");
}

function escapeRichTableCellMarkdown(value: string): string {
  return value.replace(/\r?\n/g, " ").trim().replace(/\|/g, "\\|");
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
    const structuralMarker = marker.replace(/\s+\[[ xX]\]$/, "");
    const childIndentation = childIsList
      ? `${indentation}${" ".repeat(structuralMarker.length + 1)}`
      : `${indentation}  `;
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
      const alt = escapeMarkdownImageAlt(stringAttribute(child.attrs.alt) ?? "");
      const src = stringAttribute(child.attrs.src) ?? "";
      const title = escapeMarkdownTitle(stringAttribute(child.attrs.title));
      parts.push(title ? `![${alt}](${src} "${title}")` : `![${alt}](${src})`);
      return;
    }
    if (child.type.name === "footnote_reference") {
      const label = stringAttribute(child.attrs.label) ?? stringAttribute(child.attrs.identifier) ?? "";
      parts.push(stringAttribute(child.attrs.raw) ?? `[^${label}]`);
    }
  });
  return parts.join("");
}

function escapeMarkdownImageAlt(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\[/g, "\\[").replace(/\]/g, "\\]").replace(/\r?\n/g, " ");
}

function escapeMarkdownTitle(value: string | null): string {
  return value ? value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r?\n/g, " ") : "";
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

function numberAttribute(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
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
