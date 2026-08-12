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
import {
  createHeadingNodeId,
  hashMarkdownContent,
  headingSegmentFromNodeId,
  isMomentariseLineBreakNode,
  MOMENTARISE_LINE_BREAK_TYPE,
  nodeId as createNodeId
} from "@momentarise/md-core";
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
import { DOMSerializer, Fragment, Mark, Node as ProseMirrorNode, Schema, Slice, type DOMOutputSpec, type MarkSpec, type NodeSpec, type NodeType, type ResolvedPos } from "prosemirror-model";
import { EditorState, NodeSelection, Plugin, PluginKey, Selection, TextSelection, type Transaction } from "prosemirror-state";
import {
  addColumnAfter,
  addColumnBefore,
  addRowAfter,
  addRowBefore,
  CellSelection,
  deleteColumn,
  deleteRow,
  goToNextCell,
  moveTableColumn,
  moveTableRow,
  tableEditing,
  tableNodes
} from "prosemirror-tables";
import { parse as parseCsv } from "csv-parse/browser/esm/sync";
import { parseFragment } from "parse5";

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
  | "strikethrough"
  | "tableColumnAfter"
  | "tableColumnBefore"
  | "tableColumnDelete"
  | "tableColumnLeft"
  | "tableColumnRight"
  | "tableRowAfter"
  | "tableRowBefore"
  | "tableRowDelete"
  | "tableRowDown"
  | "tableRowUp"
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
  readonly reason?: RichFootnoteInsertionFailureReason | RichTableColumnOperationFailureReason | RichTableReorderFailureReason | RichTableRowOperationFailureReason | null;
  readonly state: RichMarkdownState;
}

export interface CreateRichMarkdownStateOptions {
  readonly dialect?: DocumentDialect;
  readonly preferences?: MomentariseRichPreferences;
  readonly schema?: MomentariseRichSchema;
}

export interface MomentariseRichPreferences {
  readonly inputRules?: RichInputRulesPreference;
  readonly keymapDelegateToHost?: boolean;
  readonly keymapProfile?: "default" | "delegate" | "minimal";
}

/**
 * Host control over the Markdown-as-you-type rule set: disable built-ins by id,
 * or add rules of your own, without forking the plugin.
 */
export interface RichInputRulesPreference {
  /** Built-in ids from `richInputRuleIds`, or ids of rules added by `extend`. */
  readonly disable?: readonly string[];
  /** Evaluated before the built-in rules, so a host rule can take precedence. */
  readonly extend?: readonly RichInputRuleDefinition[];
}

export interface RichInputRuleContext {
  /** Document position of the start of the caret's textblock. */
  readonly blockStart: number;
  /** Document position where the match starts. */
  readonly from: number;
  /** Literal text of the whole block, used to restore it in one undo. */
  readonly literalText: string;
  readonly match: RegExpMatchArray;
  readonly state: EditorState;
  /** Document position of the caret, which is where the match ends. */
  readonly to: number;
}

export interface RichInputRuleDefinition {
  readonly id: string;
  /** Matched against the text between the block start and the caret. */
  readonly match: RegExp;
  /** Restricts the rule to plain paragraphs, as block-converting rules must be. */
  readonly requiresParagraph?: boolean;
  /** Returning null falls through to the next rule instead of ending the pass. */
  readonly run: (context: RichInputRuleContext) => Transaction | null;
  /** Requires a block start or whitespace before the match, so `a**b**` stays literal. */
  readonly wordBoundary?: boolean;
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

export type RichTableRowOperation = "delete" | "insert-after" | "insert-before";

export type RichTableRowOperationFailureReason =
  | "cell-not-found"
  | "command-rejected"
  | "header-row-protected"
  | "row-not-found"
  | "selection-outside-table"
  | "stale-source"
  | "table-not-found";

export interface RunRichTableRowOperationOptions {
  readonly columnIndex?: number;
  readonly operation: RichTableRowOperation;
  readonly rowIndex?: number;
  readonly tableIndex?: number;
}

export type RichTableRowOperationResult =
  | {
      readonly handled: true;
      readonly reason: null;
      readonly state: RichMarkdownState;
    }
  | {
      readonly handled: false;
      readonly reason: RichTableRowOperationFailureReason;
      readonly state: RichMarkdownState;
    };

export type RichTableColumnOperation = "delete" | "insert-after" | "insert-before";

export type RichTableColumnOperationFailureReason =
  | "cell-not-found"
  | "command-rejected"
  | "last-column-protected"
  | "row-not-found"
  | "selection-outside-table"
  | "stale-source"
  | "table-not-found";

export interface RunRichTableColumnOperationOptions {
  readonly columnIndex?: number;
  readonly operation: RichTableColumnOperation;
  readonly rowIndex?: number;
  readonly tableIndex?: number;
}

export type RichTableColumnOperationResult =
  | {
      readonly handled: true;
      readonly reason: null;
      readonly state: RichMarkdownState;
    }
  | {
      readonly handled: false;
      readonly reason: RichTableColumnOperationFailureReason;
      readonly state: RichMarkdownState;
    };

export type RichTableReorderFailureReason =
  | "cell-not-found"
  | "column-not-found"
  | "command-rejected"
  | "header-row-protected"
  | "no-op"
  | "row-not-found"
  | "selection-outside-table"
  | "stale-source"
  | "table-not-found";

export interface RunRichTableRowReorderOptions {
  readonly columnIndex?: number;
  readonly fromRowIndex?: number;
  readonly tableIndex?: number;
  readonly toRowIndex: number;
}

export interface RunRichTableColumnReorderOptions {
  readonly fromColumnIndex?: number;
  readonly rowIndex?: number;
  readonly tableIndex?: number;
  readonly toColumnIndex: number;
}

export type RichTableReorderResult =
  | {
      readonly handled: true;
      readonly reason: null;
      readonly state: RichMarkdownState;
    }
  | {
      readonly handled: false;
      readonly reason: RichTableReorderFailureReason;
      readonly state: RichMarkdownState;
    };

export type RichTableMatrixPasteFailureReason =
  | "cell-not-found"
  | "command-rejected"
  | "invalid-csv"
  | "invalid-tsv"
  | "matrix-too-large"
  | "row-not-found"
  | "selection-outside-table"
  | "stale-source"
  | "table-not-found"
  | "unsupported-multiline-cell"
  | "unsafe-control-character";

export interface RunRichTableMatrixPasteOptions {
  readonly columnIndex?: number;
  readonly format?: "csv" | "tsv";
  readonly rowIndex?: number;
  readonly tableIndex?: number;
  readonly text: string;
}

export type RichTableMatrixPasteResult =
  | {
      readonly columns: number;
      readonly handled: true;
      readonly reason: null;
      readonly rows: number;
      readonly state: RichMarkdownState;
    }
  | {
      readonly columns: 0;
      readonly handled: false;
      readonly reason: RichTableMatrixPasteFailureReason;
      readonly rows: 0;
      readonly state: RichMarkdownState;
    };

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
  | "callout"
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
    aliases: ["row before", "insert row before", "table row above"],
    group: "insert",
    id: "tableRowBefore",
    label: "Insert row before"
  },
  {
    aliases: ["row after", "insert row after", "table row below"],
    group: "insert",
    id: "tableRowAfter",
    label: "Insert row after"
  },
  {
    aliases: ["delete row", "remove row", "table row delete"],
    group: "insert",
    id: "tableRowDelete",
    label: "Delete row"
  },
  {
    aliases: ["column before", "insert column before", "table column left"],
    group: "insert",
    id: "tableColumnBefore",
    label: "Insert column before"
  },
  {
    aliases: ["column after", "insert column after", "table column right"],
    group: "insert",
    id: "tableColumnAfter",
    label: "Insert column after"
  },
  {
    aliases: ["delete column", "remove column", "table column delete"],
    group: "insert",
    id: "tableColumnDelete",
    label: "Delete column"
  },
  {
    aliases: ["move row up", "move table row up", "table row up"],
    group: "insert",
    id: "tableRowUp",
    label: "Move row up"
  },
  {
    aliases: ["move row down", "move table row down", "table row down"],
    group: "insert",
    id: "tableRowDown",
    label: "Move row down"
  },
  {
    aliases: ["move column left", "move table column left", "table column left"],
    group: "insert",
    id: "tableColumnLeft",
    label: "Move column left"
  },
  {
    aliases: ["move column right", "move table column right", "table column right"],
    group: "insert",
    id: "tableColumnRight",
    label: "Move column right"
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
  /*
   * MME-0089. The `strike` mark, its `~~` input rule, and its `strikethrough`
   * serialization all shipped earlier — only the command was missing, so the
   * mark was reachable by typing but not by any toolbar, bubble, or slash entry.
   */
  {
    aliases: ["strike", "strikethrough", "strikeout"],
    group: "inline",
    id: "strikethrough",
    label: "Strikethrough"
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
    /*
     * First, so its key, clipboard and text-input handling wins over the
     * keymaps, the input rules and `tableEditing()`. Every handler returns false
     * unless a block selection is active, so nothing else changes behaviour.
     * The presentation ships here rather than in an optional plugin (MME-0103).
     */
    createRichBlockSelectionPlugin({
      keyboard: !normalized.keymapDelegateToHost && normalized.keymapProfile === "default"
    }),
    createRichPasteSanitizerPlugin(),
    /*
     * Before the input rules: pairing must see a typed character first, and the
     * paste-link handler must run before the default replace. Both come after
     * the block-selection and table-matrix handlers, which own their own cases.
     */
    createRichPairingPlugin(),
    createRichPasteLinkPlugin(),
    createRichInputRulesPlugin(normalized),
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
  /*
   * `allowTableNodeSelection` (MME-0103): without it `tableEditing()` normalises
   * a table `NodeSelection` into a `CellSelection`, so `Esc` on a table produced
   * an invisible cell selection and the next `Backspace` wiped every cell
   * instead of deleting the block.
   */
  plugins.push(tableEditing({ allowTableNodeSelection: true }));
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

export function runRichTableRowOperation(
  state: RichMarkdownState,
  options: RunRichTableRowOperationOptions
): RichTableRowOperationResult {
  if (state.source !== state.parseResult.snapshot.content) {
    return rejectedRichTableRowOperation(state, "stale-source");
  }
  const target = resolveRichTableRowTarget(state.editorState, options);
  if ("reason" in target) {
    return rejectedRichTableRowOperation(state, target.reason);
  }

  const location = findRichTableCellLocation(state.editorState.doc, target.coordinates);
  if (!location) {
    return rejectedRichTableRowOperation(state, "cell-not-found");
  }
  let editorState = state.editorState;
  const currentCoordinates = richTableCellCoordinatesInEditorState(editorState);
  if (!sameRichTableCellCoordinates(currentCoordinates, target.coordinates)) {
    editorState = editorState.apply(
      editorState.tr.setSelection(new CellSelection(editorState.doc.resolve(location.cellPosition)))
    );
  }
  let transformedState = editorState;
  const handled = executeRichTableRowOperation(
    editorState,
    options.operation,
    (transaction) => {
      transformedState = editorState.apply(transaction);
    }
  );
  if (!handled) {
    return rejectedRichTableRowOperation(state, "command-rejected");
  }
  return {
    handled: true,
    reason: null,
    state: {
      ...state,
      editorState: transformedState
    }
  };
}

export function runRichTableColumnOperation(
  state: RichMarkdownState,
  options: RunRichTableColumnOperationOptions
): RichTableColumnOperationResult {
  if (state.source !== state.parseResult.snapshot.content) {
    return rejectedRichTableColumnOperation(state, "stale-source");
  }
  const target = resolveRichTableColumnTarget(state.editorState, options);
  if ("reason" in target) {
    return rejectedRichTableColumnOperation(state, target.reason);
  }

  const location = findRichTableCellLocation(state.editorState.doc, target.coordinates);
  if (!location) {
    return rejectedRichTableColumnOperation(state, "cell-not-found");
  }
  let editorState = state.editorState;
  const currentCoordinates = richTableCellCoordinatesInEditorState(editorState);
  if (!sameRichTableCellCoordinates(currentCoordinates, target.coordinates)) {
    editorState = editorState.apply(
      editorState.tr.setSelection(new CellSelection(editorState.doc.resolve(location.cellPosition)))
    );
  }
  let transformedState = editorState;
  const handled = executeRichTableColumnOperation(
    editorState,
    options.operation,
    (transaction) => {
      transformedState = editorState.apply(transaction);
    }
  );
  if (!handled) {
    return rejectedRichTableColumnOperation(state, "command-rejected");
  }
  return {
    handled: true,
    reason: null,
    state: {
      ...state,
      editorState: transformedState
    }
  };
}

export function runRichTableRowReorder(
  state: RichMarkdownState,
  options: RunRichTableRowReorderOptions
): RichTableReorderResult {
  if (state.source !== state.parseResult.snapshot.content) {
    return rejectedRichTableReorder(state, "stale-source");
  }
  const target = resolveRichTableRowReorderTarget(state.editorState, options);
  if ("reason" in target) {
    return rejectedRichTableReorder(state, target.reason);
  }
  const location = findRichTableCellLocation(state.editorState.doc, target.coordinates);
  if (!location) {
    return rejectedRichTableReorder(state, "cell-not-found");
  }
  let editorState = state.editorState;
  const currentCoordinates = richTableCellCoordinatesInEditorState(editorState);
  if (!sameRichTableCellCoordinates(currentCoordinates, target.coordinates)) {
    editorState = editorState.apply(
      editorState.tr.setSelection(new CellSelection(editorState.doc.resolve(location.cellPosition)))
    );
  }
  let transformedState = editorState;
  let didDispatch = false;
  const handled = executeRichTableRowReorder(
    editorState,
    target.fromRowIndex,
    target.toRowIndex,
    (transaction) => {
      transformedState = editorState.apply(transaction);
      didDispatch = true;
    }
  );
  if (!handled || !didDispatch) {
    return rejectedRichTableReorder(state, "command-rejected");
  }
  return {
    handled: true,
    reason: null,
    state: {
      ...state,
      editorState: transformedState
    }
  };
}

export function runRichTableColumnReorder(
  state: RichMarkdownState,
  options: RunRichTableColumnReorderOptions
): RichTableReorderResult {
  if (state.source !== state.parseResult.snapshot.content) {
    return rejectedRichTableReorder(state, "stale-source");
  }
  const target = resolveRichTableColumnReorderTarget(state.editorState, options);
  if ("reason" in target) {
    return rejectedRichTableReorder(state, target.reason);
  }
  const location = findRichTableCellLocation(state.editorState.doc, target.coordinates);
  if (!location) {
    return rejectedRichTableReorder(state, "cell-not-found");
  }
  let editorState = state.editorState;
  const currentCoordinates = richTableCellCoordinatesInEditorState(editorState);
  if (!sameRichTableCellCoordinates(currentCoordinates, target.coordinates)) {
    editorState = editorState.apply(
      editorState.tr.setSelection(new CellSelection(editorState.doc.resolve(location.cellPosition)))
    );
  }
  let transformedState = editorState;
  let didDispatch = false;
  const handled = executeRichTableColumnReorder(
    editorState,
    target.fromColumnIndex,
    target.toColumnIndex,
    (transaction) => {
      transformedState = editorState.apply(transaction);
      didDispatch = true;
    }
  );
  if (!handled || !didDispatch) {
    return rejectedRichTableReorder(state, "command-rejected");
  }
  return {
    handled: true,
    reason: null,
    state: {
      ...state,
      editorState: transformedState
    }
  };
}

export function runRichTableMatrixPaste(
  state: RichMarkdownState,
  options: RunRichTableMatrixPasteOptions
): RichTableMatrixPasteResult {
  if (state.source !== state.parseResult.snapshot.content) {
    return rejectedRichTableMatrixPaste(state, "stale-source");
  }
  const target = resolveRichTableMatrixPasteTarget(state.editorState, options);
  if ("reason" in target) {
    return rejectedRichTableMatrixPaste(state, target.reason);
  }
  const parsed = parseRichTableMatrix(options.text, options.format ?? "tsv");
  if ("reason" in parsed) {
    return rejectedRichTableMatrixPaste(state, parsed.reason);
  }
  let transformedState = state.editorState;
  let didDispatch = false;
  const handled = executeRichTableMatrixPaste(
    state.editorState,
    target.coordinates,
    parsed.matrix,
    (transaction) => {
      transformedState = state.editorState.apply(transaction);
      didDispatch = true;
    }
  );
  if (!handled || !didDispatch) {
    return rejectedRichTableMatrixPaste(state, "command-rejected");
  }
  return {
    columns: parsed.columns,
    handled: true,
    reason: null,
    rows: parsed.rows,
    state: {
      ...state,
      editorState: transformedState
    }
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

export function canRunRichMarkdownCommand(
  state: RichMarkdownState,
  commandId: RichCommandId,
  options: ApplyRichMarkdownCommandOptions = {}
): boolean {
  const tableReorder = richTableReorderForCommand(commandId);
  if (tableReorder) {
    if (state.source !== state.parseResult.snapshot.content) {
      return false;
    }
    const coordinates = richTableCellCoordinatesInEditorState(state.editorState);
    if (!coordinates) {
      return false;
    }
    return tableReorder.axis === "row"
      ? !("reason" in resolveRichTableRowReorderTarget(state.editorState, {
          toRowIndex: coordinates.rowIndex + tableReorder.delta
        }))
      : !("reason" in resolveRichTableColumnReorderTarget(state.editorState, {
          toColumnIndex: coordinates.columnIndex + tableReorder.delta
        }));
  }
  const tableColumnOperation = richTableColumnOperationForCommand(commandId);
  if (tableColumnOperation) {
    if (state.source !== state.parseResult.snapshot.content) {
      return false;
    }
    return !("reason" in resolveRichTableColumnTarget(state.editorState, { operation: tableColumnOperation }));
  }
  const tableOperation = richTableRowOperationForCommand(commandId);
  if (tableOperation) {
    if (state.source !== state.parseResult.snapshot.content) {
      return false;
    }
    return !("reason" in resolveRichTableRowTarget(state.editorState, { operation: tableOperation }));
  }
  if (commandId === "footnote") {
    return options.text !== undefined;
  }
  return executeRichMarkdownCommand(commandId, state.editorState, () => {}, options);
}

function createRichKeymapPlugins(preferences: NormalizedRichPreferences): Plugin[] {
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

  return executeRichTableRowOperation(state, "insert-after", dispatch, {
    allowHeaderTarget: true,
    selectionColumnIndex: 0
  });
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

interface ParsedRichTableMatrix {
  readonly columns: number;
  readonly matrix: readonly (readonly string[])[];
  readonly rows: number;
}

const RICH_TABLE_MATRIX_MAX_ROWS = 1_000;
const RICH_TABLE_MATRIX_MAX_COLUMNS = 256;
const RICH_TABLE_MATRIX_MAX_CELLS = 10_000;
const RICH_TABLE_MATRIX_MAX_CODE_UNITS = 1_000_000;

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
  if (["footnoteReference", "image"].includes(node.type) || isMomentariseLineBreakNode(node)) {
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
  if (["footnoteReference", "image"].includes(node.type) || isMomentariseLineBreakNode(node)) {
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
  doc.descendants((node, position) => {
    if (result) {
      return false;
    }
    if (node.type.name !== "table") {
      return true;
    }
    if (currentTableIndex === tableIndex) {
      result = { node, position, tableIndex };
      return false;
    }
    currentTableIndex += 1;
    return false;
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

function resolveRichTableMatrixPasteTarget(
  state: EditorState,
  options: Pick<RunRichTableMatrixPasteOptions, "columnIndex" | "rowIndex" | "tableIndex">
):
  | { readonly coordinates: RichTableCellCoordinates }
  | { readonly reason: RichTableMatrixPasteFailureReason } {
  const hasExplicitTarget =
    options.columnIndex !== undefined || options.rowIndex !== undefined || options.tableIndex !== undefined;
  let coordinates: RichTableCellCoordinates | null = null;
  if (hasExplicitTarget) {
    if (options.rowIndex === undefined) {
      return { reason: "row-not-found" };
    }
    if (options.columnIndex === undefined) {
      return { reason: "cell-not-found" };
    }
    coordinates = {
      columnIndex: options.columnIndex,
      rowIndex: options.rowIndex,
      tableIndex: options.tableIndex ?? 0
    };
  } else {
    coordinates = richTableCellCoordinatesInEditorState(state);
  }
  if (!coordinates) {
    return { reason: "selection-outside-table" };
  }
  const table = findRichTable(state.doc, coordinates.tableIndex);
  if (!table) {
    return { reason: "table-not-found" };
  }
  if (coordinates.rowIndex < 0 || coordinates.rowIndex >= table.node.childCount) {
    return { reason: "row-not-found" };
  }
  const row = table.node.child(coordinates.rowIndex);
  if (coordinates.columnIndex < 0 || coordinates.columnIndex >= row.childCount) {
    return { reason: "cell-not-found" };
  }
  return { coordinates };
}

function parseRichTableMatrix(
  text: string,
  format: "csv" | "tsv"
): ParsedRichTableMatrix | { readonly reason: RichTableMatrixPasteFailureReason } {
  if (text.length > RICH_TABLE_MATRIX_MAX_CODE_UNITS) {
    return { reason: "matrix-too-large" };
  }
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/.test(text) || /\r(?!\n)/.test(text)) {
    return { reason: "unsafe-control-character" };
  }
  if (format === "csv") {
    return parseRichTableCsvMatrix(text);
  }
  return parseRichTableTsvMatrix(text);
}

function parseRichTableTsvMatrix(
  text: string
): ParsedRichTableMatrix | { readonly reason: RichTableMatrixPasteFailureReason } {
  if (!text.includes("\t")) {
    return { reason: "invalid-tsv" };
  }
  const withoutTerminalLineEnding = text.endsWith("\r\n")
    ? text.slice(0, -2)
    : text.endsWith("\n")
      ? text.slice(0, -1)
      : text;
  if (!withoutTerminalLineEnding) {
    return { reason: "invalid-tsv" };
  }
  const lines = withoutTerminalLineEnding.replace(/\r\n/g, "\n").split("\n");
  if (lines.length === 0 || lines.length > RICH_TABLE_MATRIX_MAX_ROWS) {
    return { reason: lines.length > RICH_TABLE_MATRIX_MAX_ROWS ? "matrix-too-large" : "invalid-tsv" };
  }
  return validateRichTableMatrix(lines.map((line) => line.split("\t")), "invalid-tsv");
}

function parseRichTableCsvMatrix(
  text: string
): ParsedRichTableMatrix | { readonly reason: RichTableMatrixPasteFailureReason } {
  let matrix: string[][];
  try {
    matrix = parseCsv(text, {
      bom: true,
      cast: false,
      delimiter: ",",
      escape: "\"",
      max_record_size: RICH_TABLE_MATRIX_MAX_CODE_UNITS,
      quote: "\"",
      record_delimiter: ["\r\n", "\n"],
      relax_column_count: false,
      relax_quotes: false,
      skip_empty_lines: false,
      skip_records_with_error: false,
      trim: false
    });
  } catch {
    return { reason: "invalid-csv" };
  }
  if (
    matrix.some((row) =>
      row.some((cell) => typeof cell !== "string" || cell.includes("\n") || cell.includes("\r"))
    )
  ) {
    return { reason: "unsupported-multiline-cell" };
  }
  return validateRichTableMatrix(matrix, "invalid-csv");
}

function validateRichTableMatrix(
  matrix: readonly (readonly string[])[],
  invalidReason: "invalid-csv" | "invalid-tsv"
): ParsedRichTableMatrix | { readonly reason: RichTableMatrixPasteFailureReason } {
  if (matrix.length === 0 || matrix.length > RICH_TABLE_MATRIX_MAX_ROWS) {
    return { reason: matrix.length > RICH_TABLE_MATRIX_MAX_ROWS ? "matrix-too-large" : invalidReason };
  }
  const columns = matrix[0]?.length ?? 0;
  if (
    columns < 2 ||
    matrix.some((row) => row.length !== columns) ||
    !matrix.some((row) => row.some((cell) => cell.length > 0))
  ) {
    return { reason: invalidReason };
  }
  if (columns > RICH_TABLE_MATRIX_MAX_COLUMNS || matrix.length * columns > RICH_TABLE_MATRIX_MAX_CELLS) {
    return { reason: "matrix-too-large" };
  }
  return {
    columns,
    matrix,
    rows: matrix.length
  };
}

function rejectedRichTableMatrixPaste(
  state: RichMarkdownState,
  reason: RichTableMatrixPasteFailureReason
): RichTableMatrixPasteResult {
  return {
    columns: 0,
    handled: false,
    reason,
    rows: 0,
    state
  };
}

function executeRichTableMatrixPaste(
  state: EditorState,
  coordinates: RichTableCellCoordinates,
  matrix: readonly (readonly string[])[],
  dispatch: (transaction: Transaction) => void
): boolean {
  const table = findRichTable(state.doc, coordinates.tableIndex);
  const firstMatrixRow = matrix[0];
  if (!table || !firstMatrixRow || matrix.length === 0 || firstMatrixRow.length === 0) {
    return false;
  }
  const nextRowCount = Math.max(table.node.childCount, coordinates.rowIndex + matrix.length);
  const nextColumnCount = Math.max(
    table.node.firstChild?.childCount ?? 0,
    coordinates.columnIndex + firstMatrixRow.length
  );
  const headerRow = table.node.firstChild;
  const rows: ProseMirrorNode[] = [];
  for (let rowIndex = 0; rowIndex < nextRowCount; rowIndex += 1) {
    const existingRow = rowIndex < table.node.childCount ? table.node.child(rowIndex) : null;
    const cells: ProseMirrorNode[] = [];
    for (let columnIndex = 0; columnIndex < nextColumnCount; columnIndex += 1) {
      const existingCell = existingRow && columnIndex < existingRow.childCount
        ? existingRow.child(columnIndex)
        : null;
      const matrixRow = matrix[rowIndex - coordinates.rowIndex];
      const pastedText = matrixRow?.[columnIndex - coordinates.columnIndex];
      if (pastedText === undefined && existingCell) {
        cells.push(existingCell);
        continue;
      }
      const alignment = columnIndex < (headerRow?.childCount ?? 0)
        ? normalizeTableAlignment(headerRow!.child(columnIndex).attrs.alignment)
        : null;
      const cellType = existingCell?.type ??
        (rowIndex === 0 ? state.schema.nodes.table_header! : state.schema.nodes.table_cell!);
      const cellAttributes = existingCell?.attrs ?? { alignment };
      const paragraph = state.schema.nodes.paragraph!.create(
        null,
        pastedText ? state.schema.text(pastedText) : null
      );
      cells.push(cellType.create(cellAttributes, paragraph));
    }
    const rowType = existingRow?.type ?? table.node.firstChild!.type;
    rows.push(rowType.create(existingRow?.attrs ?? null, cells));
  }
  const nextTable = table.node.type.create(table.node.attrs, rows);
  let transaction = state.tr.replaceWith(
    table.position,
    table.position + table.node.nodeSize,
    nextTable
  );
  const finalLocation = findRichTableCellLocation(transaction.doc, {
    columnIndex: coordinates.columnIndex + firstMatrixRow.length - 1,
    rowIndex: coordinates.rowIndex + matrix.length - 1,
    tableIndex: coordinates.tableIndex
  });
  if (!finalLocation) {
    return false;
  }
  transaction = transaction
    .setSelection(TextSelection.near(transaction.doc.resolve(finalLocation.contentPosition)))
    .scrollIntoView();
  dispatch(transaction);
  return true;
}

function resolveRichTableRowReorderTarget(
  state: EditorState,
  options: RunRichTableRowReorderOptions
):
  | {
      readonly coordinates: RichTableCellCoordinates;
      readonly fromRowIndex: number;
      readonly toRowIndex: number;
    }
  | { readonly reason: RichTableReorderFailureReason } {
  const selectionCoordinates = richTableCellCoordinatesInEditorState(state);
  const hasExplicitTarget = options.columnIndex !== undefined || options.fromRowIndex !== undefined || options.tableIndex !== undefined;
  let coordinates: RichTableCellCoordinates | null = null;
  if (hasExplicitTarget) {
    if (options.fromRowIndex === undefined) {
      return { reason: "row-not-found" };
    }
    coordinates = {
      columnIndex: options.columnIndex ?? 0,
      rowIndex: options.fromRowIndex,
      tableIndex: options.tableIndex ?? 0
    };
  } else if (selectionCoordinates) {
    coordinates = selectionCoordinates;
  }
  if (!coordinates) {
    return { reason: "selection-outside-table" };
  }
  const table = findRichTable(state.doc, coordinates.tableIndex);
  if (!table) {
    return { reason: "table-not-found" };
  }
  if (
    coordinates.rowIndex < 0 ||
    coordinates.rowIndex >= table.node.childCount ||
    options.toRowIndex < 0 ||
    options.toRowIndex >= table.node.childCount
  ) {
    return { reason: "row-not-found" };
  }
  if (coordinates.rowIndex === 0 || options.toRowIndex === 0) {
    return { reason: "header-row-protected" };
  }
  if (coordinates.rowIndex === options.toRowIndex) {
    return { reason: "no-op" };
  }
  const row = table.node.child(coordinates.rowIndex);
  if (coordinates.columnIndex < 0 || coordinates.columnIndex >= row.childCount) {
    return { reason: "cell-not-found" };
  }
  return {
    coordinates,
    fromRowIndex: coordinates.rowIndex,
    toRowIndex: options.toRowIndex
  };
}

function resolveRichTableColumnReorderTarget(
  state: EditorState,
  options: RunRichTableColumnReorderOptions
):
  | {
      readonly coordinates: RichTableCellCoordinates;
      readonly fromColumnIndex: number;
      readonly toColumnIndex: number;
    }
  | { readonly reason: RichTableReorderFailureReason } {
  const selectionCoordinates = richTableCellCoordinatesInEditorState(state);
  const hasExplicitTarget = options.fromColumnIndex !== undefined || options.rowIndex !== undefined || options.tableIndex !== undefined;
  let coordinates: RichTableCellCoordinates | null = null;
  if (hasExplicitTarget) {
    if (options.fromColumnIndex === undefined) {
      return { reason: "column-not-found" };
    }
    const tableIndex = options.tableIndex ?? 0;
    const table = findRichTable(state.doc, tableIndex);
    if (!table) {
      return { reason: "table-not-found" };
    }
    coordinates = {
      columnIndex: options.fromColumnIndex,
      rowIndex: options.rowIndex ?? Math.min(1, table.node.childCount - 1),
      tableIndex
    };
  } else if (selectionCoordinates) {
    coordinates = selectionCoordinates;
  }
  if (!coordinates) {
    return { reason: "selection-outside-table" };
  }
  const table = findRichTable(state.doc, coordinates.tableIndex);
  if (!table) {
    return { reason: "table-not-found" };
  }
  if (coordinates.rowIndex < 0 || coordinates.rowIndex >= table.node.childCount) {
    return { reason: "row-not-found" };
  }
  const row = table.node.child(coordinates.rowIndex);
  if (
    coordinates.columnIndex < 0 ||
    coordinates.columnIndex >= row.childCount ||
    options.toColumnIndex < 0 ||
    options.toColumnIndex >= row.childCount
  ) {
    return { reason: "column-not-found" };
  }
  if (coordinates.columnIndex === options.toColumnIndex) {
    return { reason: "no-op" };
  }
  return {
    coordinates,
    fromColumnIndex: coordinates.columnIndex,
    toColumnIndex: options.toColumnIndex
  };
}

function rejectedRichTableReorder(
  state: RichMarkdownState,
  reason: RichTableReorderFailureReason
): RichTableReorderResult {
  return {
    handled: false,
    reason,
    state
  };
}

function executeRichTableRowReorder(
  state: EditorState,
  fromRowIndex: number,
  toRowIndex: number,
  dispatch: (transaction: Transaction) => void
): boolean {
  const coordinates = richTableCellCoordinatesInEditorState(state);
  if (!coordinates || coordinates.rowIndex !== fromRowIndex) {
    return false;
  }
  const table = findRichTable(state.doc, coordinates.tableIndex);
  if (
    !table ||
    fromRowIndex <= 0 ||
    toRowIndex <= 0 ||
    fromRowIndex >= table.node.childCount ||
    toRowIndex >= table.node.childCount ||
    fromRowIndex === toRowIndex
  ) {
    return false;
  }
  try {
    return moveTableRow({ from: fromRowIndex, select: false, to: toRowIndex })(state, (initialTransaction) => {
      let transaction = initialTransaction;
      const nextTable = findRichTable(transaction.doc, coordinates.tableIndex);
      const targetRow = nextTable?.node.maybeChild(toRowIndex);
      const targetColumnIndex = targetRow
        ? Math.min(coordinates.columnIndex, targetRow.childCount - 1)
        : 0;
      const selectionLocation = findRichTableCellLocation(transaction.doc, {
        columnIndex: targetColumnIndex,
        rowIndex: toRowIndex,
        tableIndex: coordinates.tableIndex
      });
      if (selectionLocation) {
        transaction = transaction
          .setSelection(TextSelection.near(transaction.doc.resolve(selectionLocation.contentPosition)))
          .scrollIntoView();
      }
      dispatch(transaction);
    });
  } catch {
    return false;
  }
}

function executeRichTableColumnReorder(
  state: EditorState,
  fromColumnIndex: number,
  toColumnIndex: number,
  dispatch: (transaction: Transaction) => void
): boolean {
  const coordinates = richTableCellCoordinatesInEditorState(state);
  if (!coordinates || coordinates.columnIndex !== fromColumnIndex) {
    return false;
  }
  const table = findRichTable(state.doc, coordinates.tableIndex);
  const row = table?.node.maybeChild(coordinates.rowIndex);
  if (
    !table ||
    !row ||
    fromColumnIndex < 0 ||
    toColumnIndex < 0 ||
    fromColumnIndex >= row.childCount ||
    toColumnIndex >= row.childCount ||
    fromColumnIndex === toColumnIndex
  ) {
    return false;
  }
  try {
    return moveTableColumn({ from: fromColumnIndex, select: false, to: toColumnIndex })(state, (initialTransaction) => {
      let transaction = initialTransaction;
      const nextTable = findRichTable(transaction.doc, coordinates.tableIndex);
      const targetRowIndex = nextTable
        ? Math.min(coordinates.rowIndex, nextTable.node.childCount - 1)
        : 0;
      const selectionLocation = findRichTableCellLocation(transaction.doc, {
        columnIndex: toColumnIndex,
        rowIndex: targetRowIndex,
        tableIndex: coordinates.tableIndex
      });
      if (selectionLocation) {
        transaction = transaction
          .setSelection(TextSelection.near(transaction.doc.resolve(selectionLocation.contentPosition)))
          .scrollIntoView();
      }
      dispatch(transaction);
    });
  } catch {
    return false;
  }
}

function resolveRichTableColumnTarget(
  state: EditorState,
  options: RunRichTableColumnOperationOptions
):
  | { readonly coordinates: RichTableCellCoordinates }
  | { readonly reason: RichTableColumnOperationFailureReason } {
  const selectionCoordinates = richTableCellCoordinatesInEditorState(state);
  const hasExplicitTarget = options.columnIndex !== undefined || options.rowIndex !== undefined || options.tableIndex !== undefined;
  let coordinates: RichTableCellCoordinates | null = null;
  if (hasExplicitTarget) {
    if (options.columnIndex === undefined) {
      return { reason: "cell-not-found" };
    }
    const tableIndex = options.tableIndex ?? 0;
    const table = findRichTable(state.doc, tableIndex);
    if (!table) {
      return { reason: "table-not-found" };
    }
    coordinates = {
      columnIndex: options.columnIndex,
      rowIndex: options.rowIndex ?? Math.min(1, table.node.childCount - 1),
      tableIndex
    };
  } else if (selectionCoordinates) {
    coordinates = selectionCoordinates;
  }
  if (!coordinates) {
    return { reason: "selection-outside-table" };
  }
  const table = findRichTable(state.doc, coordinates.tableIndex);
  if (!table) {
    return { reason: "table-not-found" };
  }
  if (coordinates.rowIndex < 0 || coordinates.rowIndex >= table.node.childCount) {
    return { reason: "row-not-found" };
  }
  const row = table.node.child(coordinates.rowIndex);
  if (coordinates.columnIndex < 0 || coordinates.columnIndex >= row.childCount) {
    return { reason: "cell-not-found" };
  }
  if (options.operation === "delete" && row.childCount === 1) {
    return { reason: "last-column-protected" };
  }
  return { coordinates };
}

function rejectedRichTableColumnOperation(
  state: RichMarkdownState,
  reason: RichTableColumnOperationFailureReason
): RichTableColumnOperationResult {
  return {
    handled: false,
    reason,
    state
  };
}

function executeRichTableColumnOperation(
  state: EditorState,
  operation: RichTableColumnOperation,
  dispatch: (transaction: Transaction) => void
): boolean {
  const coordinates = richTableCellCoordinatesInEditorState(state);
  if (!coordinates) {
    return false;
  }
  const table = findRichTable(state.doc, coordinates.tableIndex);
  const row = table?.node.child(coordinates.rowIndex);
  if (!table || !row || (operation === "delete" && row.childCount === 1)) {
    return false;
  }
  const command = operation === "insert-before"
    ? addColumnBefore
    : operation === "insert-after"
      ? addColumnAfter
      : deleteColumn;
  return command(state, (initialTransaction) => {
    let transaction = initialTransaction;
    const nextTable = findRichTable(transaction.doc, coordinates.tableIndex);
    if (!nextTable) {
      return;
    }
    const targetColumnIndex = operation === "insert-before"
      ? coordinates.columnIndex
      : operation === "insert-after"
        ? coordinates.columnIndex + 1
        : Math.min(coordinates.columnIndex, nextTable.node.firstChild!.childCount - 1);
    const targetRowIndex = Math.min(coordinates.rowIndex, nextTable.node.childCount - 1);
    const selectionLocation = findRichTableCellLocation(transaction.doc, {
      columnIndex: targetColumnIndex,
      rowIndex: targetRowIndex,
      tableIndex: coordinates.tableIndex
    });
    if (selectionLocation) {
      transaction = transaction
        .setSelection(TextSelection.near(transaction.doc.resolve(selectionLocation.contentPosition)))
        .scrollIntoView();
    }
    dispatch(transaction);
  });
}

function resolveRichTableRowTarget(
  state: EditorState,
  options: RunRichTableRowOperationOptions
):
  | { readonly coordinates: RichTableCellCoordinates }
  | { readonly reason: RichTableRowOperationFailureReason } {
  const selectionCoordinates = richTableCellCoordinatesInEditorState(state);
  const hasExplicitRowTarget = options.rowIndex !== undefined || options.tableIndex !== undefined;
  let coordinates: RichTableCellCoordinates | null = null;
  if (hasExplicitRowTarget) {
    if (options.rowIndex === undefined) {
      return { reason: "row-not-found" };
    }
    coordinates = {
      columnIndex: options.columnIndex ?? 0,
      rowIndex: options.rowIndex,
      tableIndex: options.tableIndex ?? 0
    };
  } else if (selectionCoordinates) {
    coordinates = {
      ...selectionCoordinates,
      ...(options.columnIndex === undefined ? {} : { columnIndex: options.columnIndex })
    };
  }
  if (!coordinates) {
    return { reason: "selection-outside-table" };
  }
  const table = findRichTable(state.doc, coordinates.tableIndex);
  if (!table) {
    return { reason: "table-not-found" };
  }
  if (coordinates.rowIndex < 0 || coordinates.rowIndex >= table.node.childCount) {
    return { reason: "row-not-found" };
  }
  if (coordinates.rowIndex === 0) {
    return { reason: "header-row-protected" };
  }
  const row = table.node.child(coordinates.rowIndex);
  if (coordinates.columnIndex < 0 || coordinates.columnIndex >= row.childCount) {
    return { reason: "cell-not-found" };
  }
  return { coordinates };
}

function rejectedRichTableRowOperation(
  state: RichMarkdownState,
  reason: RichTableRowOperationFailureReason
): RichTableRowOperationResult {
  return {
    handled: false,
    reason,
    state
  };
}

function sameRichTableCellCoordinates(
  first: RichTableCellCoordinates | null,
  second: RichTableCellCoordinates
): boolean {
  return Boolean(
    first &&
    first.columnIndex === second.columnIndex &&
    first.rowIndex === second.rowIndex &&
    first.tableIndex === second.tableIndex
  );
}

function executeRichTableRowOperation(
  state: EditorState,
  operation: RichTableRowOperation,
  dispatch: (transaction: Transaction) => void,
  options: {
    readonly allowHeaderTarget?: boolean;
    readonly selectionColumnIndex?: number;
  } = {}
): boolean {
  const coordinates = richTableCellCoordinatesInEditorState(state);
  if (!coordinates || (coordinates.rowIndex === 0 && !options.allowHeaderTarget)) {
    return false;
  }
  const command = operation === "insert-before"
    ? addRowBefore
    : operation === "insert-after"
      ? addRowAfter
      : deleteRow;
  return command(state, (initialTransaction) => {
    let transaction = initialTransaction;
    const nextTable = findRichTable(transaction.doc, coordinates.tableIndex);
    if (!nextTable) {
      return;
    }
    const targetRowIndex = operation === "insert-before"
      ? coordinates.rowIndex
      : operation === "insert-after"
        ? coordinates.rowIndex + 1
        : Math.min(coordinates.rowIndex, nextTable.node.childCount - 1);
    if (operation !== "delete") {
      transaction = normalizeInsertedRichTableRow(
        transaction,
        coordinates.tableIndex,
        targetRowIndex,
        state.schema.nodes.table_cell!
      );
    }
    const selectionTable = findRichTable(transaction.doc, coordinates.tableIndex);
    const selectionRow = selectionTable?.node.child(targetRowIndex);
    const requestedColumn = options.selectionColumnIndex ?? coordinates.columnIndex;
    const selectionColumnIndex = selectionRow
      ? Math.min(Math.max(0, requestedColumn), selectionRow.childCount - 1)
      : 0;
    const selectionLocation = findRichTableCellLocation(transaction.doc, {
      columnIndex: selectionColumnIndex,
      rowIndex: targetRowIndex,
      tableIndex: coordinates.tableIndex
    });
    if (selectionLocation) {
      transaction = transaction
        .setSelection(TextSelection.near(transaction.doc.resolve(selectionLocation.contentPosition)))
        .scrollIntoView();
    }
    dispatch(transaction);
  });
}

function normalizeInsertedRichTableRow(
  initialTransaction: Transaction,
  tableIndex: number,
  rowIndex: number,
  bodyCellType: NodeType
): Transaction {
  let transaction = initialTransaction;
  const table = findRichTable(transaction.doc, tableIndex);
  const headerRow = table?.node.firstChild;
  const insertedRow = table?.node.child(rowIndex);
  if (!headerRow || !insertedRow) {
    return transaction;
  }
  for (let columnIndex = 0; columnIndex < insertedRow.childCount; columnIndex += 1) {
    const location = findRichTableCellLocation(transaction.doc, {
      columnIndex,
      rowIndex,
      tableIndex
    });
    if (!location) {
      continue;
    }
    transaction = transaction.setNodeMarkup(location.cellPosition, bodyCellType, {
      ...location.cell.attrs,
      alignment: normalizeTableAlignment(headerRow.child(columnIndex).attrs.alignment)
    });
  }
  return transaction;
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
    doc.descendants((node, nodePosition) => {
      if (node.type.name === "table") {
        if (nodePosition < tablePosition) {
          tableIndex += 1;
        }
        return false;
      }
      return nodePosition < tablePosition;
    });
    return {
      columnIndex: position.index(depth - 1),
      rowIndex: position.index(depth - 2),
      tableIndex
    };
  }
  return null;
}

function richTableLocations(doc: ProseMirrorNode): readonly RichTableLocation[] {
  const tables: RichTableLocation[] = [];
  doc.descendants((node, position) => {
    if (node.type.name === "table") {
      tables.push({ node, position, tableIndex: tables.length });
      return false;
    }
    return true;
  });
  return tables;
}

function richTableCellCoordinatesAtPosition(
  doc: ProseMirrorNode,
  position: number
): RichTableCellCoordinates | null {
  let result: RichTableCellCoordinates | null = null;
  for (const table of richTableLocations(doc)) {
    let rowOffset = 0;
    table.node.forEach((row, _rowOffset, rowIndex) => {
      let cellOffset = 0;
      row.forEach((cell, _cellOffset, columnIndex) => {
        if (table.position + 2 + rowOffset + cellOffset === position) {
          result = { columnIndex, rowIndex, tableIndex: table.tableIndex };
        }
        cellOffset += cell.nodeSize;
      });
      rowOffset += row.nodeSize;
    });
    if (result) {
      break;
    }
  }
  return result;
}

function normalizeTableAlignment(value: unknown): TableAlignment {
  return value === "center" || value === "left" || value === "right" ? value : null;
}

function normalizeRichPreferences(preferences: MomentariseRichPreferences = {}): NormalizedRichPreferences {
  return {
    inputRules: {
      disable: preferences.inputRules?.disable ?? [],
      extend: preferences.inputRules?.extend ?? []
    },
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

/**
 * MME-0089 — may the formatting bubble open over this selection?
 *
 * The answer belongs to the package, not to each host. The demo, the React
 * binding, and any other consumer must all refuse the same two contexts, and
 * asking each of them to re-derive the rule is how a surface ends up offering
 * `**bold**` inside a fenced code block.
 *
 * Two refusals, for two different reasons:
 *
 * - **Code blocks.** The schema marks `code_block` as a `code` node whose text
 *   is content, not prose; ProseMirror's own `toggleMark` would refuse, and a
 *   bubble offering actions that cannot run is an inert control.
 * - **Opaque / unsupported blocks.** These carry raw source bytes verbatim
 *   (Gate 4.5). Applying an inline mark to them is the silent-corruption class
 *   the preservation gates exist to prevent, so the affordance never appears.
 *
 * An empty selection is also refused: the bubble is a *selection* surface, and
 * a caret with no range has nothing to format.
 */
export function richSelectionSupportsFormatting(state: RichMarkdownState): boolean {
  const selection = state.editorState.selection;
  if (selection.empty) {
    return false;
  }
  let supported = true;
  state.editorState.doc.nodesBetween(selection.from, selection.to, (node) => {
    if (!supported) {
      return false;
    }
    if (node.type.spec.code === true || node.type.name === "code_block" || node.type.name === "unsupported_block") {
      supported = false;
      return false;
    }
    return true;
  });
  return supported;
}

export function runRichMarkdownCommand(
  state: RichMarkdownState,
  commandId: RichCommandId,
  options: ApplyRichMarkdownCommandOptions = {}
): RichMarkdownCommandResult {
  const tableReorder = richTableReorderForCommand(commandId);
  if (tableReorder) {
    const coordinates = richTableCellCoordinatesInEditorState(state.editorState);
    if (!coordinates) {
      return { handled: false, reason: "selection-outside-table", state };
    }
    return tableReorder.axis === "row"
      ? runRichTableRowReorder(state, {
          toRowIndex: coordinates.rowIndex + tableReorder.delta
        })
      : runRichTableColumnReorder(state, {
          toColumnIndex: coordinates.columnIndex + tableReorder.delta
        });
  }
  const tableColumnOperation = richTableColumnOperationForCommand(commandId);
  if (tableColumnOperation) {
    return runRichTableColumnOperation(state, { operation: tableColumnOperation });
  }
  const tableOperation = richTableRowOperationForCommand(commandId);
  if (tableOperation) {
    return runRichTableRowOperation(state, { operation: tableOperation });
  }
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
  if (!range || range.node.attrs.syntax === "indented") {
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
  if (!range || range.node.attrs.syntax === "indented") {
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
  placeholder: "Write, or press '/' for commands"
};

/* --- MME-0088: where Markdown-ish triggers may fire ------------------------
 *
 * One answer, shared. The slash menu asked this question with a bare regex over
 * the text before the caret, so `/` opened the menu inside fenced code (while
 * also inserting the character), inside inline code, inside preserved raw HTML,
 * and mid-word in `a/b`. MME-0104's input rules need exactly the same judgement,
 * so it is a package contract rather than host wiring.
 */

export type RichTextInputContextReason =
  | "code-block"
  | "inline-code"
  | "not-text-block"
  | "opaque"
  | "raw-html"
  | "table-cell";

export interface RichTextInputContext {
  /** False when typing Markdown syntax here must stay literal. */
  readonly allowsMarkdownTriggers: boolean;
  readonly reason: RichTextInputContextReason | null;
}

export interface RichSlashTriggerMatch {
  /** Position of the `/` itself. */
  readonly from: number;
  readonly query: string;
  /** End of the query — `from`..`to` covers exactly `/` plus the query. */
  readonly to: number;
}

const RICH_OPAQUE_BLOCK_TYPES = new Set(["raw_html_block", "unsupported_block"]);

/**
 * Classifies the caret's context.
 *
 * Preservation-critical constructs (code, raw HTML, opaque blocks) must take
 * typed characters literally: turning `/` or `**` into an editor gesture there
 * would silently rewrite bytes the user meant to keep.
 */
export function richTextInputContext(state: EditorState): RichTextInputContext {
  const { $from } = state.selection;

  // A selected atom block (preserved raw HTML, an unsupported construct) never
  // takes typed Markdown: its bytes are carried verbatim.
  if (state.selection instanceof NodeSelection) {
    const name = state.selection.node.type.name;
    if (RICH_OPAQUE_BLOCK_TYPES.has(name)) {
      return { allowsMarkdownTriggers: false, reason: name === "raw_html_block" ? "raw-html" : "opaque" };
    }
    if (name === "code_block") {
      return { allowsMarkdownTriggers: false, reason: "code-block" };
    }
  }

  if (!$from.parent.isTextblock) {
    return { allowsMarkdownTriggers: false, reason: "not-text-block" };
  }

  for (let depth = $from.depth; depth >= 0; depth -= 1) {
    const name = $from.node(depth).type.name;
    if (name === "code_block") {
      return { allowsMarkdownTriggers: false, reason: "code-block" };
    }
    if (RICH_OPAQUE_BLOCK_TYPES.has(name)) {
      return { allowsMarkdownTriggers: false, reason: name === "raw_html_block" ? "raw-html" : "opaque" };
    }
    if (name === "table_cell" || name === "table_header") {
      return { allowsMarkdownTriggers: false, reason: "table-cell" };
    }
  }

  if ($from.parent.type.spec.code) {
    return { allowsMarkdownTriggers: false, reason: "code-block" };
  }

  /*
   * Inline marks, boundary-aware. A caret sitting at the *end* of a code span is
   * not inside it — `code` is non-inclusive, so the next character typed is plain
   * text and a trigger there is correct. Only a caret with the mark on both sides
   * (or an explicit stored mark) is strictly inside.
   */
  const before = $from.nodeBefore?.marks ?? [];
  const after = $from.nodeAfter?.marks ?? [];
  const marks =
    state.storedMarks ?? before.filter((mark) => after.some((candidate) => candidate.eq(mark)));
  for (const mark of marks) {
    if (mark.type.name === "code") {
      return { allowsMarkdownTriggers: false, reason: "inline-code" };
    }
    if (mark.type.name === "raw_html_source") {
      return { allowsMarkdownTriggers: false, reason: "raw-html" };
    }
  }

  return { allowsMarkdownTriggers: true, reason: null };
}

/**
 * The slash trigger, with Notion's placement rule: at the start of a block, or
 * after whitespace — never mid-word, so `a/b` and `and/or` stay literal.
 *
 * Returns `null` when the menu must not open. The `/` character is still typed
 * into the document either way; only the menu is suppressed.
 */
export function matchRichSlashTrigger(state: EditorState): RichSlashTriggerMatch | null {
  if (!state.selection.empty) {
    return null;
  }
  if (!richTextInputContext(state).allowsMarkdownTriggers) {
    return null;
  }
  const { $from } = state.selection;
  const textBefore = $from.parent.textBetween(0, $from.parentOffset, "\n", "\n");
  const match = textBefore.match(/\/([A-Za-z0-9_-]*)$/);
  if (!match) {
    return null;
  }
  const query = match[1] ?? "";
  const slashOffset = textBefore.length - query.length - 1;
  const characterBefore = slashOffset > 0 ? textBefore[slashOffset - 1] ?? null : null;
  if (characterBefore !== null && !/\s/.test(characterBefore)) {
    return null;
  }
  return { from: state.selection.from - query.length - 1, query, to: state.selection.from };
}

export function richTopLevelBlockRanges(state: EditorState): readonly RichTopLevelBlockRange[] {
  return topLevelRangesForDoc(state.doc);
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
        /*
         * Hover tracking, not a CSS descendant selector (MME-0087).
         *
         * A descendant rule (`.ProseMirror > *:hover .rich-block-affordance`)
         * covers most blocks, but not atom/leaf blocks such as raw HTML: their
         * widget decoration is emitted as a SIBLING of the block, so no
         * descendant selector can ever reach it and those blocks showed no
         * handles at all. Marking the hovered block's affordance directly works
         * for every block type.
         *
         * This mutates an attribute rather than dispatching a transaction:
         * re-running decorations on every mousemove would be far too expensive.
         */
        mousemove(view, event) {
          markHoveredRichBlockAffordance(view as unknown as RichBlockHoverViewLike, event as MouseEvent);
          return false;
        },
        mouseleave(view) {
          markHoveredRichBlockAffordance(view as unknown as RichBlockHoverViewLike, null);
          return false;
        },
        scroll(view) {
          refreshRichBlockHoverMarking(view as unknown as RichBlockHoverViewLike);
          return false;
        },
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
    },
    view(editorView) {
      return {
        update() {
          refreshRichBlockHoverMarking(editorView as unknown as RichBlockHoverViewLike);
        }
      };
    }
  });
}

/** The slice of the editor view hover tracking needs. */
interface RichBlockHoverViewLike extends RichEditorViewLike {
  readonly dom: HTMLElement;
}

interface RichBlockHoverMemory {
  index: number | null;
  x: number;
  y: number;
}

/**
 * Last pointer position and marked block, per view. Kept so the marking can be
 * re-applied after ProseMirror rebuilds the widget DOM (which it does on every
 * keystroke, because the widget key includes the block's text) and recomputed
 * after a scroll moves a different block under a stationary pointer.
 */
const richBlockHoverMemory = new WeakMap<object, RichBlockHoverMemory>();

function richBlockIndexAtCoords(view: RichBlockHoverViewLike, x: number, y: number): number | null {
  const found = view.posAtCoords?.({ left: x, top: y });
  if (!found) {
    return null;
  }
  const resolved = view.state.doc.resolve(Math.min(found.pos, view.state.doc.content.size));
  const index = resolved.depth === 0 ? resolved.index() : resolved.index(0);
  return index >= 0 && index < view.state.doc.childCount ? index : null;
}

/**
 * Places a sibling-emitted affordance against its block.
 *
 * ProseMirror emits the widget for an ATOM block (raw HTML, media) as a sibling
 * of that block rather than a child. `.rich-block-affordance` is absolutely
 * positioned, so a sibling resolves against the editor shell instead of the
 * block and landed at x = -48 — off the left edge of the viewport, clipped, and
 * hundreds of pixels from the block it belongs to. Descendant affordances need
 * none of this: their block is already `position: relative`.
 */
function positionSiblingRichBlockAffordance(
  view: RichBlockHoverViewLike,
  affordance: HTMLElement,
  index: number
): void {
  if (affordance.parentElement !== view.dom) {
    return;
  }
  const blocks = [...view.dom.children].filter((child) => !child.classList.contains("ProseMirror-widget"));
  const block = blocks[index];
  if (!(block instanceof HTMLElement)) {
    return;
  }
  affordance.style.top = `${Math.round(block.offsetTop)}px`;
  affordance.style.left = `${Math.round(block.offsetLeft)}px`;
  affordance.dataset.richBlockAffordanceDetached = "true";
}

/**
 * Marks the affordance belonging to the block under the pointer, and clears the
 * rest. `event === null` means the pointer left the editor.
 */
function markHoveredRichBlockAffordance(view: RichBlockHoverViewLike, event: MouseEvent | null): void {
  const memory = richBlockHoverMemory.get(view) ?? { index: null, x: 0, y: 0 };
  if (event) {
    memory.x = event.clientX;
    memory.y = event.clientY;
  }
  const hoveredIndex = event === null ? null : richBlockIndexAtCoords(view, memory.x, memory.y);
  const changed = memory.index !== hoveredIndex;
  memory.index = hoveredIndex;
  richBlockHoverMemory.set(view, memory);
  // mousemove fires constantly; only touch the DOM when the block actually changes.
  if (changed) {
    applyRichBlockHoverMarking(view, hoveredIndex);
  }
}

function applyRichBlockHoverMarking(view: RichBlockHoverViewLike, hoveredIndex: number | null): void {
  for (const affordance of view.dom.querySelectorAll<HTMLElement>("[data-rich-block-affordance]")) {
    const index = Number(affordance.dataset.richBlockIndex);
    if (hoveredIndex !== null && index === hoveredIndex) {
      affordance.dataset.richBlockHovered = "true";
      positionSiblingRichBlockAffordance(view, affordance, index);
    } else if (affordance.dataset.richBlockHovered) {
      delete affordance.dataset.richBlockHovered;
    }
  }
}

/**
 * Re-applies the marking after a doc/DOM update or a scroll. Without this the
 * handles vanish while you type with the pointer parked on the block: the widget
 * key includes the block's text, so every keystroke rebuilds the widget DOM and
 * the replacement carries no marking.
 */
function refreshRichBlockHoverMarking(view: RichBlockHoverViewLike): void {
  const memory = richBlockHoverMemory.get(view);
  if (!memory || memory.index === null) {
    return;
  }
  // Recompute from the last pointer position: a scroll can put a different block
  // under a stationary pointer.
  memory.index = richBlockIndexAtCoords(view, memory.x, memory.y);
  applyRichBlockHoverMarking(view, memory.index);
}

function createRichBlockAffordanceDecorations(
  state: EditorState,
  adapter: RichDecorationAdapter,
  options: RichBlockAffordancePluginOptions
): RichDecorationSetLike {
  const labels = richBlockAffordanceLabels(options);
  const decorations: unknown[] = [];
  const ranges = richTopLevelBlockRanges(state);

  /*
   * The placeholder follows the caret, not the document (MME-0087).
   *
   * It used to require a document consisting of exactly one empty paragraph, so
   * pressing Enter for a new block mid-document taught the user nothing. Notion
   * and BlockNote hint on whichever empty block you are actually in.
   *
   * A decoration only — it is never part of the document, so it cannot reach
   * Markdown.
   */
  if (options.placeholder !== null) {
    const { $from } = state.selection;
    const caretBlock = ranges.find(
      (range) =>
        range.type === "paragraph" &&
        range.node.content.size === 0 &&
        $from.pos >= range.from &&
        $from.pos <= range.to
    );
    // An untouched empty document has no caret in it yet, but should still greet
    // the writer.
    const emptyDocument =
      ranges.length === 1 && ranges[0]?.type === "paragraph" && ranges[0].node.content.size === 0
        ? ranges[0]
        : undefined;
    const target = caretBlock ?? emptyDocument;
    if (target) {
      decorations.push(
        adapter.Decoration.node(target.from, target.to, {
          class: "empty-rich-document",
          "data-placeholder": options.placeholder ?? labels.placeholder
        })
      );
    }
  }

  for (const range of ranges) {
    const widgetPosition =
      range.type === "bullet_list" || range.type === "ordered_list"
        ? range.from + 2
        : range.from + 1;
    decorations.push(
      adapter.Decoration.widget(widgetPosition, (view) => createRichBlockAffordanceWidget(view, range, options), {
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
    // Dragging a block selects it as an object, which also gives the table case
    // a selectable handle instead of a cell selection (MME-0103).
    selectRichBlockCommand(currentRange.index)(view.state, (transaction) => {
      view.dispatch(transaction);
    });
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

// ---------------------------------------------------------------------------
// Block selection model — MME-0103, benchmark contract 3
// ---------------------------------------------------------------------------

/**
 * A block selection is the state where blocks are selected as objects rather
 * than as a text range: `Esc` enters it, arrows move it, `Shift+Arrow` extends
 * it, `Cmd/Ctrl+A` escalates into it, and delete/duplicate/replace act on whole
 * blocks.
 *
 * Why the plugin state and not the ProseMirror selection is the source of truth
 * (the redesign after MME-0103 attempt 1 was reverted):
 *
 * - `NodeSelection` is not sovereign. `tableEditing()` normalises a table
 *   `NodeSelection` into a `CellSelection`, so `Esc` on a table produced an
 *   invisible cell selection and the next `Backspace` wiped every cell instead
 *   of deleting the block. `allowTableNodeSelection: true` stops the conversion,
 *   but the model must not depend on no other plugin ever reinterpreting a
 *   selection again.
 * - `TextSelection` is not private. A multi-block `TextSelection` is observed by
 *   the bubble toolbar and painted by the browser as a per-character highlight,
 *   which the acceptance criteria explicitly rule out. A depth-0 `TextSelection`
 *   avoids the highlight but makes ProseMirror warn that the endpoints do not
 *   point into inline content.
 *
 * So: the plugin state owns which blocks are selected, the ProseMirror selection
 * is a `NodeSelection` on the anchor block (a caret position, effectively), and
 * every operation reads block indices from the plugin state. Recorded decision:
 * `AllSelection` covers only the whole-document stage and `CellSelection` is the
 * thing to defend against rather than imitate, so neither replaces this; no
 * custom `Selection` subclass is introduced.
 */
export interface RichBlockSelectionInfo {
  /** Block the selection was anchored at; `Shift+Arrow` keeps it fixed. */
  readonly anchorIndex: number;
  readonly count: number;
  /** Document position before the first selected block. */
  readonly from: number;
  readonly fromIndex: number;
  /** Block the selection currently extends to. */
  readonly headIndex: number;
  /** Document position after the last selected block. */
  readonly to: number;
  readonly toIndex: number;
}

/**
 * Every string the block layer can announce. All host-supplied, all templated:
 * a screen-reader user needs to know *which* block is selected, not only how
 * many, and needs to hear what an operation did rather than only that the
 * selection went away.
 *
 * Placeholders: `{count}`, `{position}`, `{end}`, `{total}`, `{type}`,
 * `{excerpt}`. `blockTypes` maps schema node names to spoken names, with
 * `blockTypes.default` as the fallback.
 */
export interface RichBlockSelectionLabels {
  readonly blockTypes: Readonly<Record<string, string>>;
  readonly cleared: string;
  readonly deleted: string;
  readonly deletedOne: string;
  readonly duplicated: string;
  readonly duplicatedOne: string;
  /** Announced when several blocks are selected. */
  readonly multiple: string;
  readonly pasted: string;
  readonly pastedOne: string;
  readonly replaced: string;
  readonly replacedOne: string;
  /** Announced when one block is selected; carries its identity. */
  readonly single: string;
}

/** What an operation did, so the result is announced rather than inferred. */
export type RichBlockSelectionNoticeKind = "deleted" | "duplicated" | "pasted" | "replaced";

interface RichBlockSelectionNotice {
  readonly count: number;
  readonly kind: RichBlockSelectionNoticeKind;
}

export interface RichBlockSelectionPluginOptions {
  /** Set false when the host owns the keymap. Presentation still ships. */
  readonly keyboard?: boolean;
  readonly labels?: Partial<RichBlockSelectionLabels>;
  /** Set false when the host renders its own announcement surface. */
  readonly liveRegion?: boolean;
}

interface RichBlockSelectionRange {
  readonly anchorIndex: number;
  readonly headIndex: number;
}

interface RichBlockSelectionPluginState {
  /** One-shot result of the operation that produced this state. */
  readonly notice: RichBlockSelectionNotice | null;
  /** Null when no blocks are selected. */
  readonly range: RichBlockSelectionRange | null;
}

const emptyRichBlockSelectionState: RichBlockSelectionPluginState = { notice: null, range: null };

type RichEditorCommand = (
  state: EditorState,
  dispatch?: (transaction: Transaction) => void
) => boolean;

/** The slice of the editor view the block-selection handlers need. */
interface RichBlockSelectionViewLike {
  dispatch(transaction: Transaction): void;
  readonly state: EditorState;
}

export const richBlockSelectionPluginKey = new PluginKey<RichBlockSelectionPluginState>(
  "momentarise-rich-block-selection"
);

/*
 * Defaults live next to the model so a consumer on default plugins gets a
 * working, announced, visible block selection. Hosts override them through
 * `labels` for localization; nothing here is a hardcoded UI literal in a
 * surface component (Gate 13).
 */
const defaultRichBlockSelectionLabels: RichBlockSelectionLabels = {
  blockTypes: {
    blockquote: "Quote",
    bullet_list: "Bulleted list",
    code_block: "Code block",
    default: "Block",
    footnote_definition: "Footnote definition",
    heading: "Heading",
    horizontal_rule: "Divider",
    ordered_list: "Numbered list",
    paragraph: "Paragraph",
    raw_html_block: "Raw HTML block",
    table: "Table",
    todo_list: "Task list",
    unsupported_block: "Preserved block"
  },
  cleared: "Block selection cleared",
  deleted: "{count} blocks deleted",
  deletedOne: "Block deleted",
  duplicated: "{count} blocks duplicated",
  duplicatedOne: "Block duplicated",
  multiple: "{count} blocks selected, {position} to {end} of {total}",
  pasted: "{count} blocks pasted",
  pastedOne: "Block pasted",
  replaced: "{count} blocks replaced",
  replacedOne: "Block replaced",
  single: "{type}, block {position} of {total}{excerpt}"
};

export function richBlockSelection(state: EditorState): RichBlockSelectionInfo | null {
  const range = (richBlockSelectionPluginKey.getState(state) ?? emptyRichBlockSelectionState).range;
  if (!range) {
    return null;
  }
  const ranges = topLevelRangesForDoc(state.doc);
  if (ranges.length === 0) {
    return null;
  }
  const anchorIndex = clampRichBlockIndex(range.anchorIndex, ranges.length);
  const headIndex = clampRichBlockIndex(range.headIndex, ranges.length);
  const fromIndex = Math.min(anchorIndex, headIndex);
  const toIndex = Math.max(anchorIndex, headIndex);
  return {
    anchorIndex,
    count: toIndex - fromIndex + 1,
    from: ranges[fromIndex]!.from,
    fromIndex,
    headIndex,
    to: ranges[toIndex]!.to,
    toIndex
  };
}

/**
 * What the block layer would say right now.
 *
 * Carries identity, not just arithmetic: "Heading, block 1 of 7: Release notes"
 * rather than "Block selected". Arrow-moving between two single blocks does not
 * change the count, so an announcement built only from the count is silent for
 * the most common navigation there is — the user hears nothing and cannot tell
 * where the block cursor went.
 *
 * When an operation has just run, its result is announced instead of the state
 * it left behind: deleting three blocks says so, rather than saying only that
 * the selection was cleared.
 */
export function richBlockSelectionAnnouncement(
  state: EditorState,
  labels: Partial<RichBlockSelectionLabels> = {}
): string {
  const resolved: RichBlockSelectionLabels = {
    ...defaultRichBlockSelectionLabels,
    ...labels,
    blockTypes: { ...defaultRichBlockSelectionLabels.blockTypes, ...labels.blockTypes }
  };
  const notice = (richBlockSelectionPluginKey.getState(state) ?? emptyRichBlockSelectionState).notice;
  if (notice) {
    const singular = `${notice.kind}One` as const;
    return notice.count === 1
      ? resolved[singular]
      : resolved[notice.kind].replace("{count}", String(notice.count));
  }
  const info = richBlockSelection(state);
  if (!info) {
    return resolved.cleared;
  }
  const total = state.doc.childCount;
  if (info.count > 1) {
    return resolved.multiple
      .replace("{count}", String(info.count))
      .replace("{position}", String(info.fromIndex + 1))
      .replace("{end}", String(info.toIndex + 1))
      .replace("{total}", String(total));
  }
  const node = state.doc.maybeChild(info.fromIndex);
  const text = node?.textContent.trim() ?? "";
  return resolved.single
    .replace("{type}", resolved.blockTypes[node?.type.name ?? ""] ?? resolved.blockTypes.default ?? "Block")
    .replace("{position}", String(info.fromIndex + 1))
    .replace("{total}", String(total))
    .replace("{excerpt}", text ? `: ${text.length > 80 ? `${text.slice(0, 80)}…` : text}` : "");
}

/**
 * The selected blocks as canonical Markdown, for `text/plain` on copy.
 *
 * Reconstructed from the ProseMirror nodes rather than sliced out of the source:
 * a clipboard payload is a new document, not a preserved one, and the paste half
 * parses it back through the same Markdown parser the editor loads documents
 * with, so unknown syntax survives the round trip as opaque content.
 */
export function richBlockSelectionMarkdown(state: EditorState): string | null {
  const info = richBlockSelection(state);
  if (!info) {
    return null;
  }
  const blocks: string[] = [];
  state.doc.forEach((node, _offset, index) => {
    if (index >= info.fromIndex && index <= info.toIndex) {
      blocks.push(serializeReconstructedProseMirrorBlock(node));
    }
  });
  return blocks.length === 0 ? null : `${blocks.join("\n\n")}\n`;
}

export function selectRichBlockCommand(index: number): RichEditorCommand {
  return (state, dispatch) => {
    if (index < 0 || index >= state.doc.childCount) {
      return false;
    }
    if (dispatch) {
      dispatch(richBlockSelectionTransaction(state, index, index));
    }
    return true;
  };
}

export function enterRichBlockSelectionCommand(
  state: EditorState,
  dispatch?: (transaction: Transaction) => void
): boolean {
  if (richBlockSelection(state)) {
    return false;
  }
  const index = topLevelIndexForSelection(state);
  if (index === null) {
    return false;
  }
  if (dispatch) {
    dispatch(richBlockSelectionTransaction(state, index, index));
  }
  return true;
}

export function clearRichBlockSelectionCommand(
  state: EditorState,
  dispatch?: (transaction: Transaction) => void
): boolean {
  const info = richBlockSelection(state);
  if (!info) {
    return false;
  }
  if (dispatch) {
    const transaction = state.tr.setMeta(richBlockSelectionPluginKey, emptyRichBlockSelectionState);
    transaction.setSelection(Selection.near(transaction.doc.resolve(info.from), 1));
    dispatch(transaction.scrollIntoView());
  }
  return true;
}

export function moveRichBlockSelectionCommand(
  direction: -1 | 1,
  options: { readonly extend?: boolean } = {}
): RichEditorCommand {
  return (state, dispatch) => {
    const info = richBlockSelection(state);
    if (!info) {
      return false;
    }
    const nextHead = clampRichBlockIndex(info.headIndex + direction, state.doc.childCount);
    if (nextHead === info.headIndex) {
      // At the first or last block: consume the key rather than letting the
      // caret escape the block layer sideways.
      return true;
    }
    if (dispatch) {
      dispatch(
        options.extend
          ? richBlockSelectionTransaction(state, info.anchorIndex, nextHead)
          : richBlockSelectionTransaction(state, nextHead, nextHead)
      );
    }
    return true;
  };
}

/** `Cmd/Ctrl+A`: inline selection -> current block -> whole document. */
export function escalateRichSelectionCommand(
  state: EditorState,
  dispatch?: (transaction: Transaction) => void
): boolean {
  const blockCount = state.doc.childCount;
  if (blockCount === 0) {
    return false;
  }
  const info = richBlockSelection(state);
  if (info) {
    if (info.fromIndex === 0 && info.toIndex === blockCount - 1) {
      // Already the whole document; consume so the key does not fall through to
      // `selectAll` and drop the block layer.
      return true;
    }
    if (dispatch) {
      dispatch(richBlockSelectionTransaction(state, 0, blockCount - 1));
    }
    return true;
  }
  const index = topLevelIndexForSelection(state);
  if (index === null) {
    return false;
  }
  const { $from } = state.selection;
  if ($from.depth > 0 && $from.parent.inlineContent) {
    const contentFrom = $from.start();
    const contentTo = $from.end();
    const alreadyWholeBlock =
      contentTo > contentFrom && state.selection.from <= contentFrom && state.selection.to >= contentTo;
    if (!alreadyWholeBlock && contentTo > contentFrom) {
      if (dispatch) {
        dispatch(
          state.tr
            .setSelection(TextSelection.create(state.doc, contentFrom, contentTo))
            .setMeta(richBlockSelectionPluginKey, emptyRichBlockSelectionState)
        );
      }
      return true;
    }
  }
  if (dispatch) {
    dispatch(richBlockSelectionTransaction(state, index, index));
  }
  return true;
}

export function deleteRichBlockSelectionCommand(
  state: EditorState,
  dispatch?: (transaction: Transaction) => void
): boolean {
  const info = richBlockSelection(state);
  if (!info) {
    return false;
  }
  if (dispatch) {
    const transaction = state.tr;
    if (info.fromIndex === 0 && info.toIndex === state.doc.childCount - 1) {
      // `doc` requires `block+`; an emptied document keeps one empty paragraph,
      // which is also what every benchmark editor leaves behind.
      transaction.replaceWith(info.from, info.to, state.schema.nodes.paragraph!.create());
    } else {
      transaction.delete(info.from, info.to);
    }
    transaction.setMeta(richBlockSelectionPluginKey, {
      notice: { count: info.count, kind: "deleted" },
      range: null
    });
    transaction.setSelection(
      Selection.near(transaction.doc.resolve(Math.min(info.from, transaction.doc.content.size)), 1)
    );
    dispatch(transaction.scrollIntoView());
  }
  return true;
}

export function duplicateRichBlockSelectionCommand(
  state: EditorState,
  dispatch?: (transaction: Transaction) => void
): boolean {
  const info = richBlockSelection(state);
  if (!info) {
    return false;
  }
  if (dispatch) {
    const copies = state.doc.slice(info.from, info.to).content;
    const transaction = state.tr.insert(info.to, copies);
    applyRichBlockSelectionToTransaction(transaction, info.toIndex + 1, info.toIndex + info.count, {
      count: info.count,
      kind: "duplicated"
    });
    dispatch(transaction.scrollIntoView());
  }
  return true;
}

export function replaceRichBlockSelectionWithParagraphCommand(
  state: EditorState,
  dispatch?: (transaction: Transaction) => void
): boolean {
  const info = richBlockSelection(state);
  if (!info) {
    return false;
  }
  if (dispatch) {
    const transaction = state.tr.replaceWith(info.from, info.to, state.schema.nodes.paragraph!.create());
    transaction.setMeta(richBlockSelectionPluginKey, {
      notice: { count: info.count, kind: "replaced" },
      range: null
    });
    transaction.setSelection(TextSelection.create(transaction.doc, info.from + 1));
    dispatch(transaction.scrollIntoView());
  }
  return true;
}

export function replaceRichBlockSelectionWithTextCommand(text: string): RichEditorCommand {
  return (state, dispatch) => {
    const info = richBlockSelection(state);
    if (!info || text.length === 0) {
      return false;
    }
    if (dispatch) {
      const paragraph = state.schema.nodes.paragraph!.create(null, state.schema.text(text));
      const transaction = state.tr.replaceWith(info.from, info.to, paragraph);
      transaction.setMeta(richBlockSelectionPluginKey, {
        notice: { count: info.count, kind: "replaced" },
        range: null
      });
      transaction.setSelection(TextSelection.create(transaction.doc, info.from + 1 + text.length));
      dispatch(transaction.scrollIntoView());
    }
    return true;
  };
}

export function pasteRichBlockSelectionMarkdownCommand(markdown: string): RichEditorCommand {
  return (state, dispatch) => {
    const info = richBlockSelection(state);
    if (!info || markdown.length === 0) {
      return false;
    }
    const parseResult = createMarkdownAstFormatter().parse(markdown, { dialect: "momentarise-enhanced" });
    const parsed = markdownDocumentToProseMirror(parseResult, state.schema as MomentariseRichSchema);
    if (parsed.content.size === 0) {
      return false;
    }
    if (dispatch) {
      const transaction = state.tr.replaceWith(info.from, info.to, parsed.content);
      transaction.setMeta(richBlockSelectionPluginKey, {
        notice: { count: parsed.childCount, kind: "pasted" },
        range: null
      });
      transaction.setSelection(
        Selection.near(
          transaction.doc.resolve(Math.min(info.from + parsed.content.size, transaction.doc.content.size)),
          -1
        )
      );
      dispatch(transaction.scrollIntoView());
    }
    return true;
  };
}

/**
 * Replaces the selected blocks with an arbitrary pasted slice.
 *
 * The Markdown path above is the one that carries preservation; this is the
 * fallback for payloads that have no text/plain at all, and it exists so a
 * multi-block selection is never partially replaced.
 */
export function replaceRichBlockSelectionWithSliceCommand(slice: Slice): RichEditorCommand {
  return (state, dispatch) => {
    const info = richBlockSelection(state);
    if (!info || slice.content.size === 0) {
      return false;
    }
    if (dispatch) {
      const transaction = state.tr.replace(info.from, info.to, slice);
      transaction.setMeta(richBlockSelectionPluginKey, {
        notice: { count: info.count, kind: "pasted" },
        range: null
      });
      transaction.setSelection(
        Selection.near(transaction.doc.resolve(Math.min(info.from, transaction.doc.content.size)), 1)
      );
      dispatch(transaction.scrollIntoView());
    }
    return true;
  };
}

/*
 * MME-0115 — the composition guard.
 *
 * Two things live here, and they are one mechanism because they share one fact:
 * everything a composition does to the document is provisional until it drains.
 *
 *  1. **A cancelled composition over a block selection restores the blocks.**
 *     Chromium starts the composition over the block selection's own DOM range,
 *     which is why the COMMIT path needs no code at all — the browser's own
 *     replacement is what ProseMirror reads back. Cancelling wipes that range
 *     instead, and the selected blocks are gone. The restore cannot be timed to
 *     an event: measured telemetry shows Chromium still flushing DOM removals
 *     after `compositionend`, and attempt 1 lost three designs to that race. It
 *     is idempotent instead — re-assert the snapshot on every deviation once
 *     `view.composing` is false, which overrules late flushes rather than racing
 *     them.
 *  2. **No serialization baseline is adopted while a composition is in flight.**
 *     A host re-anchors its Markdown baseline whenever the document changes
 *     (`syncRichMarkdownToSource` in the demo, and in every host that copies it).
 *     Adopting a mid-composition document makes the transient state the baseline,
 *     and a byte-perfect restore then serializes against it: attempt 2 measured a
 *     leading blank block the writer never typed. `shouldAdoptRichSerializationBaseline`
 *     is that rule, and `finishRichComposition` is what makes deferral safe —
 *     it releases exactly one adoption when the composition has drained, so a
 *     host cannot be left holding pre-composition bytes and save them.
 *
 * `view.composing` alone is NOT the window, which is measured, not assumed:
 * ProseMirror's own `compositionstart` handler dispatches a document change
 * (`endComposition` -> `deleteSelection`) BEFORE it sets `input.composing`, so a
 * host gating on `view.composing` would still adopt that one. The guard is armed
 * by this plugin's own handler, which `runCustomHandler` runs first.
 */
const richCompositionReleaseMeta = "momentarise-rich-composition-release";
/** One frame. Fast enough that the restore is invisible, slow enough to be cheap. */
const richCompositionDrainIntervalMs = 16;
/** Long enough for Chromium's post-`compositionend` flushes; bounded so nothing spins. */
const richCompositionDrainWindowMs = 600;
const richCompositionStableFrames = 3;
/**
 * How often the guard checks whether ProseMirror is still composing. Coarser
 * than the drain: a composition can legitimately stay open for minutes, and
 * nothing can be done about it until it closes.
 */
const richCompositionIdleIntervalMs = 100;

interface RichCompositionSnapshot {
  readonly anchorIndex: number;
  readonly doc: ProseMirrorNode;
  readonly headIndex: number;
}

interface RichCompositionGuard {
  cancelled: boolean;
  deadline: number;
  ended: boolean;
  inFlight: boolean;
  snapshot: RichCompositionSnapshot | null;
  stableFrames: number;
  timer: ReturnType<typeof setTimeout> | null;
}

/** The slice of the editor view the composition guard drives. */
interface RichCompositionDriveViewLike extends RichCompositionViewLike {
  dispatch(transaction: Transaction): void;
  readonly state: EditorState;
}

/**
 * Per-view, not per-plugin: one plugin instance can be reconfigured into several
 * views, and the guard has to be armed from a DOM handler, before any
 * transaction exists to carry plugin state.
 */
const richCompositionGuards = new WeakMap<object, RichCompositionGuard>();

/** What a host needs from its editor view to apply the baseline rule. */
export interface RichCompositionViewLike {
  /** ProseMirror's `EditorView.composing`. */
  readonly composing: boolean;
}

export interface AdoptRichSerializationBaselineOptions {
  /** Whether this transaction changed the document, as the host determined it. */
  readonly documentChanged: boolean;
  readonly transaction: Transaction;
  readonly view: RichCompositionViewLike;
}

/**
 * Should the host re-anchor its Markdown serialization baseline to the current
 * document, for this transaction?
 *
 * Hosts that derive Markdown from the rich view keep a baseline — the source the
 * targeted serializer replays untouched blocks from — and re-anchor it whenever
 * the document changes. That is correct for edits and wrong for compositions:
 * every document a composition passes through is provisional, and adopting one
 * as the baseline outlives the composition that produced it.
 *
 * Call this in `dispatchTransaction` instead of testing "did the document
 * change" alone. It answers `true` for ordinary edits, `false` for anything
 * dispatched while a composition is in flight, and `true` once for the release
 * transaction this package dispatches when the composition has drained — so a
 * deferred baseline is always adopted, exactly once, on the settled document.
 */
export function shouldAdoptRichSerializationBaseline(
  options: AdoptRichSerializationBaselineOptions
): boolean {
  if (options.transaction.getMeta(richCompositionReleaseMeta) === true) {
    return true;
  }
  /*
   * Both, deliberately. The guard covers the whole window including the part
   * where ProseMirror has not set `composing` yet; `view.composing` covers a
   * host that assembled its own plugin set without this one, so the rule still
   * degrades to "not while ProseMirror says it is composing" rather than to
   * nothing.
   */
  if (isRichCompositionInFlight(options.view)) {
    return false;
  }
  return options.documentChanged;
}

/**
 * Is a composition in flight at this view?
 *
 * For hosts with a "flush now" path — a mode switch, a find/replace, an AI
 * request — that must read the derived Markdown outside `dispatchTransaction`.
 * The answer is `true` from `compositionstart` until the composition has fully
 * drained, which is wider than `view.composing` at both ends: ProseMirror
 * dispatches a document change at `compositionstart` before it sets that flag,
 * and the browser keeps flushing DOM work after `compositionend`. Reading the
 * bytes from before the composition is the honest thing to do in that window —
 * they are what the writer has committed to.
 *
 * `view.composing` is still consulted, so a host that assembled its own plugin
 * set without this package's block-selection plugin gets the weaker rule rather
 * than none.
 */
export function isRichCompositionInFlight(view: RichCompositionViewLike): boolean {
  return view.composing || richCompositionGuards.get(view)?.inFlight === true;
}

function beginRichComposition(view: RichCompositionDriveViewLike): void {
  let guard = richCompositionGuards.get(view);
  if (!guard) {
    guard = {
      cancelled: false,
      deadline: 0,
      ended: false,
      inFlight: false,
      snapshot: null,
      stableFrames: 0,
      timer: null
    };
    richCompositionGuards.set(view, guard);
  }
  /*
   * ProseMirror restarts compositions (`compositionstart` and
   * `compositionupdate` share a handler, and `endComposition(view, true)` starts
   * a new one). The first snapshot is the only one taken from a document the
   * writer authored; a later one would snapshot the transient state.
   */
  if (guard.inFlight) {
    return;
  }
  const info = richBlockSelection(view.state);
  guard.cancelled = false;
  guard.deadline = 0;
  guard.ended = false;
  guard.inFlight = true;
  guard.snapshot = info
    ? { anchorIndex: info.anchorIndex, doc: view.state.doc, headIndex: info.headIndex }
    : null;
  guard.stableFrames = 0;
  scheduleRichCompositionDrain(view, guard, richCompositionIdleIntervalMs);
}

function endRichComposition(view: RichCompositionDriveViewLike, cancelled: boolean): void {
  const guard = richCompositionGuards.get(view);
  if (!guard?.inFlight) {
    return;
  }
  guard.cancelled = cancelled;
  guard.deadline = Date.now() + richCompositionDrainWindowMs;
  guard.ended = true;
  guard.stableFrames = 0;
  scheduleRichCompositionDrain(view, guard, richCompositionDrainIntervalMs);
}

function scheduleRichCompositionDrain(
  view: RichCompositionDriveViewLike,
  guard: RichCompositionGuard,
  delayMs: number
): void {
  if (guard.timer !== null) {
    clearTimeout(guard.timer);
  }
  guard.timer = setTimeout(() => {
    stepRichCompositionDrain(view, guard);
  }, delayMs);
}

function stepRichCompositionDrain(view: RichCompositionDriveViewLike, guard: RichCompositionGuard): void {
  guard.timer = null;
  if (!guard.inFlight) {
    return;
  }
  if (view.composing) {
    /*
     * Wait, however long it takes. Acting inside a live composition is attempt
     * 1's failure mode: the restore lands and Chromium's remaining removals are
     * then mapped onto it. Dispatching here is also unsafe in its own right —
     * `prosemirror-view` aborts a live composition when a transaction arrives
     * while `storedMarks` is set — so there is no such thing as a timeout that
     * gives up on a slow composer. Someone pausing mid-word, hunting a
     * candidate, or using switch access is composing, not idle; the only exits
     * are `compositionend` and ProseMirror's own force-end, both of which clear
     * this flag.
     */
    scheduleRichCompositionDrain(view, guard, richCompositionIdleIntervalMs);
    return;
  }
  if (!guard.ended) {
    /*
     * ProseMirror force-ended the composition without a `compositionend` event —
     * a click elsewhere does exactly this (`mousedown` -> `endComposition`).
     * There is nothing to discriminate, so the guard releases the baseline and
     * restores nothing: a force-ended composition keeps what it typed.
     */
    finishRichComposition(view, guard);
    return;
  }
  if (guard.cancelled && guard.snapshot) {
    /*
     * A cancel defends the WHOLE window rather than stopping at the first few
     * quiet frames. Chromium's post-`compositionend` flushes do not arrive on a
     * schedule — one measured 80ms late, well past any "it has held still for
     * three frames" test — and a flush that lands after the guard stands down
     * destroys the blocks with nothing left to notice: no restore, and a live
     * region that says "Block selection cleared", which is exactly what a
     * deliberate Escape says. The window costs nothing: the document is already
     * the writer's, so the host's baseline is correct throughout it.
     */
    if (!view.state.doc.eq(guard.snapshot.doc)) {
      restoreRichCompositionSnapshot(view, guard.snapshot);
    }
    if (Date.now() < guard.deadline) {
      scheduleRichCompositionDrain(view, guard, richCompositionDrainIntervalMs);
      return;
    }
    finishRichComposition(view, guard);
    return;
  }
  /*
   * A committed composition has nothing to defend: a late flush after this point
   * is real content the writer typed, and the host adopts it the ordinary way.
   * Releasing as soon as the document holds still keeps the baseline current for
   * every accented character rather than half a second behind it.
   */
  guard.stableFrames += 1;
  if (guard.stableFrames >= richCompositionStableFrames || Date.now() >= guard.deadline) {
    finishRichComposition(view, guard);
    return;
  }
  scheduleRichCompositionDrain(view, guard, richCompositionDrainIntervalMs);
}

/**
 * One transaction restores both the document and the block selection: the
 * plugin's `apply` reads its own meta before it checks `docChanged`, so the
 * selection survives the replacement that would otherwise clear it.
 *
 * It is an ordinary in-history transaction, which is the part that is easy to
 * get wrong. `addToHistory: false` is the obvious choice for a gesture that
 * changed nothing, and it is wrong: `prosemirror-history` then merely maps its
 * stored inverse steps through the restore, so the composition's undo entry
 * survives with nothing left to undo, and the writer's next Cmd+Z replays it
 * onto the already-restored document — measured as a duplicated block. Left in
 * history, the restore lands in the composition's own event (it always follows
 * the transaction it undoes within `newGroupDelay`), and one undo steps back
 * past the whole non-event.
 */
function restoreRichCompositionSnapshot(
  view: RichCompositionDriveViewLike,
  snapshot: RichCompositionSnapshot
): void {
  const transaction = view.state.tr.replaceWith(0, view.state.doc.content.size, snapshot.doc.content);
  applyRichBlockSelectionToTransaction(transaction, snapshot.anchorIndex, snapshot.headIndex);
  view.dispatch(transaction);
}

function finishRichComposition(view: RichCompositionDriveViewLike, guard: RichCompositionGuard): void {
  if (guard.timer !== null) {
    clearTimeout(guard.timer);
    guard.timer = null;
  }
  const replaced = richCompositionReplacementCount(view, guard);
  guard.cancelled = false;
  guard.ended = false;
  guard.inFlight = false;
  guard.snapshot = null;
  guard.stableFrames = 0;
  // The release: one adoption, on the settled document. See
  // `shouldAdoptRichSerializationBaseline`.
  const transaction = view.state.tr.setMeta(richCompositionReleaseMeta, true).setMeta("addToHistory", false);
  if (replaced !== null) {
    /*
     * Say what happened, once, at the end.
     *
     * A plain keystroke over a block selection announces "2 blocks replaced"
     * (`replaceRichBlockSelectionWithTextCommand`). A composition doing the same
     * thing announced "Block selection cleared", because the browser's own
     * replacement clears the plugin state and nothing puts a notice back. That
     * left the accented-character path — the whole reason this issue exists —
     * telling a screen-reader user their selection was lost where the plain path
     * tells them their text landed. Announcements during the composition are
     * suppressed (see `paint`), so this is the one thing they hear.
     */
    transaction.setMeta(richBlockSelectionPluginKey, {
      notice: { count: replaced, kind: "replaced" },
      range: null
    });
  }
  view.dispatch(transaction);
}

/**
 * How many blocks a committed composition replaced, or `null` when it replaced
 * nothing worth announcing — no block selection, a cancel (whose whole point is
 * that nothing happened), or a document that came back unchanged anyway.
 */
function richCompositionReplacementCount(
  view: RichCompositionDriveViewLike,
  guard: RichCompositionGuard
): number | null {
  const { snapshot } = guard;
  if (guard.cancelled || !snapshot || view.state.doc.eq(snapshot.doc)) {
    return null;
  }
  return Math.abs(snapshot.headIndex - snapshot.anchorIndex) + 1;
}

/**
 * The view is going away. Drop the guard without releasing anything: a
 * `dispatch` into a destroyed view is an error, and there is no host left to
 * hand a baseline to.
 */
function abandonRichComposition(view: object): void {
  const guard = richCompositionGuards.get(view);
  if (guard && guard.timer !== null) {
    clearTimeout(guard.timer);
  }
  richCompositionGuards.delete(view);
}

export function createRichBlockSelectionPlugin(
  options: RichBlockSelectionPluginOptions = {}
): Plugin<RichBlockSelectionPluginState> {
  const keyboard = options.keyboard !== false;
  const labels: RichBlockSelectionLabels = { ...defaultRichBlockSelectionLabels, ...options.labels };
  return new Plugin<RichBlockSelectionPluginState>({
    key: richBlockSelectionPluginKey,
    props: {
      handleDOMEvents: {
        /*
         * MME-0115. These three return false without exception: composition must
         * keep reaching ProseMirror or IME breaks entirely. They arm and drain
         * the guard, they never handle the event.
         */
        compositionend(view, event) {
          endRichComposition(
            view as unknown as RichCompositionDriveViewLike,
            // Measured in Chrome: the composed text on commit, `""` on cancel.
            // The *drain* has no event to mark it; the *outcome* does.
            (event as CompositionEvent).data === ""
          );
          return false;
        },
        compositionstart(view) {
          beginRichComposition(view as unknown as RichCompositionDriveViewLike);
          return false;
        },
        copy(view, event) {
          return writeRichBlockSelectionClipboard(view as unknown as RichBlockSelectionViewLike, event as ClipboardEvent, false);
        },
        cut(view, event) {
          return writeRichBlockSelectionClipboard(view as unknown as RichBlockSelectionViewLike, event as ClipboardEvent, true);
        }
      },
      handleKeyDown(view, event) {
        return keyboard
          ? handleRichBlockSelectionKeyDown(view as unknown as RichBlockSelectionViewLike, event)
          : false;
      },
      handlePaste(view, event, slice) {
        const dispatch = (transaction: Transaction): void => {
          (view as unknown as RichBlockSelectionViewLike).dispatch(transaction);
        };
        const text = (event as ClipboardEvent).clipboardData?.getData("text/plain") ?? "";
        if (pasteRichBlockSelectionMarkdownCommand(text)(view.state, dispatch)) {
          return true;
        }
        /*
         * A payload with no usable text/plain — an image, an HTML-only clipboard
         * — would otherwise fall through to ProseMirror, which replaces only the
         * anchor `NodeSelection`: the other selected blocks were silently left
         * behind. The whole selected range is what the user asked to replace.
         */
        return replaceRichBlockSelectionWithSliceCommand(slice)(view.state, dispatch);
      },
      handleTextInput(view, _from, _to, text) {
        return replaceRichBlockSelectionWithTextCommand(text)(view.state, (transaction) => {
          (view as unknown as RichBlockSelectionViewLike).dispatch(transaction);
        });
      }
    },
    state: {
      apply(transaction, previous, _oldState, nextState) {
        const meta = transaction.getMeta(richBlockSelectionPluginKey) as
          | RichBlockSelectionPluginState
          | undefined;
        if (meta !== undefined) {
          return meta;
        }
        // A notice is one-shot: it is announced by the transaction that set it
        // and must not be repeated by the next unrelated update.
        const range = previous.range;
        if (!range) {
          return previous.notice ? emptyRichBlockSelectionState : previous;
        }
        // Any ordinary edit leaves the block layer. Every block-selection
        // transaction carries the meta above, so this cannot drop a selection
        // the model itself just made.
        if (transaction.docChanged) {
          return emptyRichBlockSelectionState;
        }
        if (!transaction.selectionSet) {
          return previous.notice ? { notice: null, range } : previous;
        }
        // A pointer-driven selection is the user leaving the block layer for the
        // caret, even when they clicked inside the selected block.
        if (transaction.getMeta("pointer")) {
          return emptyRichBlockSelectionState;
        }
        /*
         * The browser echo (MME-0103, found in the browser and invisible to
         * jsdom). A `NodeSelection` over a textblock is rendered as a DOM range
         * across that block's text; `DOMObserver` reads that range back and
         * `readDOMChange` dispatches a plain `setSelection` for it. Treating
         * that echo as "the user moved the caret" cleared block-selection mode
         * a few milliseconds after every single Escape — the feature worked
         * headlessly and did nothing at all in a real browser.
         *
         * An echo lands inside the selected blocks. A real caret move lands
         * outside them, and still leaves.
         */
        const ranges = topLevelRangesForDoc(nextState.doc);
        const start = ranges[Math.min(range.anchorIndex, range.headIndex)];
        const end = ranges[Math.max(range.anchorIndex, range.headIndex)];
        if (!start || !end) {
          return emptyRichBlockSelectionState;
        }
        return nextState.selection.from >= start.from && nextState.selection.to <= end.to
          ? { notice: null, range }
          : emptyRichBlockSelectionState;
      },
      init() {
        return emptyRichBlockSelectionState;
      }
    },
    view(editorView) {
      return createRichBlockSelectionView(
        editorView as unknown as RichBlockSelectionPaintViewLike,
        labels,
        options.liveRegion !== false
      );
    }
  });
}


/** The slice of the editor view the presentation needs. */
interface RichBlockSelectionPaintViewLike {
  /** ProseMirror's `EditorView.composing`; the live region defers to it. */
  readonly composing: boolean;
  readonly dom: HTMLElement;
  /**
   * ProseMirror's mutation observer. Marking a block it manages is a DOM
   * mutation like any other, and it reacts by re-reading that block — which
   * redraws, which re-marks, which re-reads. Measured in Chrome: the tab locked
   * up on the first Escape. Mutations to the editor root are exempt (the
   * observer ignores attribute changes on its own node), which is why
   * `data-mme-block-selection` needs no guard and the per-block marks do.
   *
   * This is NOT the technique the hover marking uses: that marks widget
   * elements, which ProseMirror never reads back. This marks block DOM
   * ProseMirror owns, which is exactly why the observer has to be paused.
   *
   * Known risk, recorded rather than hidden: `domObserver` is an internal field
   * of `EditorView` and appears nowhere in prosemirror-view's public types, so a
   * rename in a patch release would silently reintroduce the lock-up. The
   * optional call keeps it from throwing; `tests/rich-block-selection.test.mjs`
   * asserts the field still exists so an upgrade fails loudly instead.
   */
  readonly domObserver?: { start(): void; stop(): void };
  readonly state: EditorState;
}

/**
 * The presentation ships with the model.
 *
 * Attempt 1 put the selection decoration in `createRichBlockAffordancePlugin`,
 * which is not part of `createMomentariseRichPlugins`, so a consumer on the
 * default plugins would have got a fully functional, completely invisible block
 * selection. This lives in the block-selection plugin itself, and marks block
 * DOM directly rather than through a `Decoration` — the same technique the
 * hover marking already uses, and it keeps the package free of a
 * `prosemirror-view` dependency it does not otherwise need.
 *
 * Accessibility: a polite live region, never `aria-selected` (invalid on
 * paragraph/heading/list roles) and never `aria-label` on a block (it would
 * replace a heading's own accessible name with "Block selected").
 */
function createRichBlockSelectionView(
  editorView: RichBlockSelectionPaintViewLike,
  labels: RichBlockSelectionLabels,
  liveRegionEnabled: boolean
): { destroy(): void; update(): void } {
  const host = editorView.dom;
  let liveRegion: HTMLElement | null = null;
  if (liveRegionEnabled && host.parentElement) {
    liveRegion = document.createElement("div");
    liveRegion.className = "rich-block-selection-live-region";
    liveRegion.dataset.testid = "rich-block-selection-live-region";
    liveRegion.setAttribute("aria-live", "polite");
    liveRegion.setAttribute("role", "status");
    host.parentElement.insertBefore(liveRegion, host);
  }
  let announcedSelection = false;
  let lastAnnouncementKey = "none";
  let noticeSerial = 0;

  const paint = (): void => {
    const info = richBlockSelection(editorView.state);
    const blocks = [...host.children].filter((child) => !child.classList.contains("ProseMirror-widget"));
    const marks = blocks.map((block, index) => ({
      block,
      selected: info !== null && index >= info.fromIndex && index <= info.toIndex
    }));
    // Only touch the DOM when a mark actually changes, and never while the
    // observer is watching. Both matter: the first keeps ProseMirror from
    // re-reading blocks on every unrelated update, the second is what stops the
    // mark/re-read/redraw loop outright.
    const changed = marks.filter(
      ({ block, selected }) => (block.getAttribute("data-mme-block-selected") === "true") !== selected
    );
    if (changed.length > 0) {
      editorView.domObserver?.stop();
      try {
        for (const { block, selected } of changed) {
          if (selected) {
            block.setAttribute("data-mme-block-selected", "true");
          } else {
            block.removeAttribute("data-mme-block-selected");
          }
        }
      } finally {
        editorView.domObserver?.start();
      }
    }
    if (info) {
      host.setAttribute("data-mme-block-selection", String(info.count));
      announcedSelection = true;
    } else {
      host.removeAttribute("data-mme-block-selection");
    }
    if (!liveRegion) {
      return;
    }
    /*
     * MME-0115: say nothing while a composition is in flight.
     *
     * A composition passes through documents the writer has not committed to,
     * and the block selection is cleared by each of them. Announcing those
     * narrates states that may never have existed: cancelling a dead key over a
     * selected block would say "Block selection cleared" and then re-announce
     * the same selection a frame later, for a gesture whose entire meaning is
     * that nothing happened. The state the composition SETTLES on is announced
     * instead — the release transaction repaints — so a cancel that restores the
     * same range announces nothing at all, and a commit announces its real
     * outcome once.
     */
    if (isRichCompositionInFlight(editorView)) {
      return;
    }
    /*
     * Keyed on the state, not on the rendered string.
     *
     * Two adjacent paragraphs with the same text would otherwise produce the
     * same announcement and the live region would never be touched, so arrowing
     * between them would be silent. `notice` is one-shot, so it takes part in
     * the key too: deleting three blocks must announce even though the state it
     * leaves behind is the same "nothing selected" as an Escape.
     */
    const notice = (richBlockSelectionPluginKey.getState(editorView.state) ?? emptyRichBlockSelectionState).notice;
    const key = notice
      ? `notice:${notice.kind}:${notice.count}:${noticeSerial}`
      : info
        ? `range:${info.fromIndex}:${info.toIndex}`
        : "none";
    if (notice) {
      noticeSerial += 1;
    }
    if (key === lastAnnouncementKey) {
      return;
    }
    lastAnnouncementKey = key;
    // Nothing is announced before the first selection, so mounting the editor
    // never says "selection cleared" into a screen reader.
    liveRegion.textContent = notice || info || announcedSelection
      ? richBlockSelectionAnnouncement(editorView.state, labels)
      : "";
  };

  paint();
  return {
    destroy() {
      liveRegion?.remove();
      // MME-0115: a composition in flight when the view goes away must not keep
      // a timer alive holding a reference to a destroyed view.
      abandonRichComposition(editorView);
    },
    update() {
      paint();
    }
  };
}

function handleRichBlockSelectionKeyDown(
  view: RichBlockSelectionViewLike,
  event: KeyboardEvent
): boolean {
  const dispatch = (transaction: Transaction): void => {
    view.dispatch(transaction);
  };
  const mod = event.metaKey || event.ctrlKey;

  if (event.key === "Escape" && !mod && !event.altKey) {
    /*
     * MME-0086/0088 regression guard. `attachSurfaceOverlayDismissListeners`
     * binds Escape with `capture: true` on the document, so it runs before this
     * handler; when it actually dismissed an overlay it calls `preventDefault()`.
     * Without this check one press both closed the slash menu and entered block
     * selection.
     */
    if (event.defaultPrevented) {
      return false;
    }
    return (
      clearRichBlockSelectionCommand(view.state, dispatch) ||
      enterRichBlockSelectionCommand(view.state, dispatch)
    );
  }

  if (mod && !event.altKey && !event.shiftKey && (event.key === "a" || event.key === "A")) {
    return escalateRichSelectionCommand(view.state, dispatch);
  }

  if (!richBlockSelection(view.state)) {
    return false;
  }
  if (mod && !event.altKey && !event.shiftKey && (event.key === "d" || event.key === "D")) {
    return duplicateRichBlockSelectionCommand(view.state, dispatch);
  }
  if (event.key === "Backspace" || event.key === "Delete") {
    return deleteRichBlockSelectionCommand(view.state, dispatch);
  }
  if (event.key === "Enter") {
    return replaceRichBlockSelectionWithParagraphCommand(view.state, dispatch);
  }
  if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
    return moveRichBlockSelectionCommand(-1, { extend: event.shiftKey })(view.state, dispatch);
  }
  if (event.key === "ArrowDown" || event.key === "ArrowRight") {
    return moveRichBlockSelectionCommand(1, { extend: event.shiftKey })(view.state, dispatch);
  }
  if (event.key === "Tab") {
    /*
     * Tab belongs to whatever it belonged to before — the table cell walk, list
     * indentation, or the browser's own focus order. The block layer only steps
     * out of the way first, so the selection is not left painted around a block
     * whose caret has moved into a cell, or around a block while focus sits on a
     * handle somewhere else entirely.
     */
    clearRichBlockSelectionCommand(view.state, dispatch);
    return false;
  }
  return false;
}

function writeRichBlockSelectionClipboard(
  view: RichBlockSelectionViewLike,
  event: ClipboardEvent,
  cut: boolean
): boolean {
  const markdown = richBlockSelectionMarkdown(view.state);
  if (markdown === null || !event.clipboardData) {
    return false;
  }
  event.clipboardData.setData("text/plain", markdown);
  event.clipboardData.setData("text/html", richBlockSelectionHtml(view.state));
  event.preventDefault();
  if (cut) {
    deleteRichBlockSelectionCommand(view.state, (transaction) => {
      view.dispatch(transaction);
    });
  }
  return true;
}

function richBlockSelectionHtml(state: EditorState): string {
  const info = richBlockSelection(state);
  if (!info) {
    return "";
  }
  const container = document.createElement("div");
  container.appendChild(
    DOMSerializer.fromSchema(state.schema).serializeFragment(state.doc.slice(info.from, info.to).content)
  );
  return container.innerHTML;
}

/**
 * Builds the transaction that puts the editor into block-selection mode.
 *
 * The ProseMirror selection becomes a `NodeSelection` on the anchor block even
 * when several blocks are selected: the plugin state carries the range, so the
 * selection never has to be a multi-block `TextSelection` and the browser never
 * paints a per-character highlight over the selected blocks.
 */
function richBlockSelectionTransaction(
  state: EditorState,
  anchorIndex: number,
  headIndex: number
): Transaction {
  const transaction = state.tr;
  applyRichBlockSelectionToTransaction(transaction, anchorIndex, headIndex);
  return transaction.scrollIntoView();
}

function applyRichBlockSelectionToTransaction(
  transaction: Transaction,
  anchorIndex: number,
  headIndex: number,
  notice: RichBlockSelectionNotice | null = null
): void {
  const ranges = topLevelRangesForDoc(transaction.doc);
  if (ranges.length === 0) {
    transaction.setMeta(richBlockSelectionPluginKey, emptyRichBlockSelectionState);
    return;
  }
  const anchor = clampRichBlockIndex(anchorIndex, ranges.length);
  const head = clampRichBlockIndex(headIndex, ranges.length);
  transaction.setMeta(richBlockSelectionPluginKey, {
    notice,
    range: { anchorIndex: anchor, headIndex: head }
  });
  const anchorRange = ranges[anchor]!;
  transaction.setSelection(
    NodeSelection.isSelectable(anchorRange.node)
      ? NodeSelection.create(transaction.doc, anchorRange.from)
      : Selection.near(transaction.doc.resolve(anchorRange.from), 1)
  );
}

/**
 * The top-level block the current selection belongs to.
 *
 * A `CellSelection` resolves through here to its owning table, which is what
 * makes `Esc` inside a table select the table as a block instead of leaving an
 * invisible cell selection behind.
 */
function topLevelIndexForSelection(state: EditorState): number | null {
  if (state.doc.childCount === 0) {
    return null;
  }
  const { $from } = state.selection;
  const index = $from.depth === 0 ? $from.index() : $from.index(0);
  return index >= 0 && index < state.doc.childCount ? index : null;
}

function topLevelRangesForDoc(doc: ProseMirrorNode): readonly RichTopLevelBlockRange[] {
  const ranges: RichTopLevelBlockRange[] = [];
  doc.forEach((node, offset, index) => {
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

function clampRichBlockIndex(index: number, blockCount: number): number {
  return Math.max(0, Math.min(index, blockCount - 1));
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

  const segments: string[] = [];
  const alignedBlocks = alignRichBlocks(blocks, pairs);
  let lastOriginalIndex = -1;

  /*
   * Separators are bytes too (MME-0103).
   *
   * The gap between two top-level blocks is authored content: a CRLF document's
   * "\r\n\r\n", a deliberate multi-blank-line break, the blank line a writer put
   * after frontmatter. Emitting a literal "\n\n" whenever the surviving
   * neighbours were not consecutive in the original silently rewrote those bytes.
   * Measured before this fix, with a purely targeted `tr.delete` transaction:
   *
   *   delete block 1 of "A.\r\n\r\nB.\r\n\r\nC.\r\n"  ->  "A.\n\nC.\r\n"
   *   delete block 1 of "A.\n\n\n\nB.\n\n\n\nC.\n"    ->  "A.\n\nC.\n"
   *   delete block 2 of "A.\r\n\r\nB.\r\n\r\nC.\r\n"  ->  "A.\r\n\r\nB.\n"
   *
   * That is silent Markdown corruption, and it is the reason MME-0103 attempt 1
   * was reverted. Note the transaction shape did not cause it and cannot fix it:
   * every separator has to be sliced out of the source instead of invented, so
   * each one below comes from the bytes the author actually wrote.
   */
  const firstPairRange = pairs[0]!.model.sourceRange!;
  const lastPairRange = pairs[pairs.length - 1]!.model.sourceRange!;
  const leadingPrefix = source.slice(0, firstPairRange.start.offset);
  const documentTail = source.slice(lastPairRange.end.offset);
  const gapAfterPair = (pairIndex: number): string | null =>
    pairIndex >= 0 && pairIndex + 1 < pairs.length
      ? source.slice(
          pairs[pairIndex]!.model.sourceRange!.end.offset,
          pairs[pairIndex + 1]!.model.sourceRange!.start.offset
        )
      : null;
  /*
   * Last resort: a block with no authored gap on either side (the document's
   * first block moved out of position, or a one-block document that gained a
   * second). Reuse the document's own first block gap so its spacing rhythm —
   * and its line ending — survive; only a document with no gap at all falls
   * through to inventing one.
   */
  const documentGap = (): string => {
    for (let pairIndex = 0; pairIndex + 1 < pairs.length; pairIndex += 1) {
      const gap = gapAfterPair(pairIndex);
      if (gap !== null && gap.length > 0) {
        return gap;
      }
    }
    return source.includes("\r\n") ? "\r\n\r\n" : "\n\n";
  };
  const separatorBefore = (originalIndex: number): string => {
    if (segments.length === 0) {
      // Whatever preceded the original first block: frontmatter and its own gap,
      // or leading blank lines. Correct even when block 0 itself was deleted.
      return leadingPrefix;
    }
    if (originalIndex >= 0 && lastOriginalIndex >= 0 && originalIndex === lastOriginalIndex + 1) {
      return source.slice(
        pairs[lastOriginalIndex]!.model.sourceRange!.end.offset,
        pairs[originalIndex]!.model.sourceRange!.start.offset
      );
    }
    // The neighbours are no longer consecutive (a block between them was
    // deleted, duplicated or moved). The surviving previous block keeps the gap
    // its author wrote after it; failing that, the gap written before this one.
    return gapAfterPair(lastOriginalIndex) ?? gapAfterPair(originalIndex - 1) ?? documentGap();
  };

  for (const aligned of alignedBlocks) {
    if (aligned.kind === "matched") {
      const originalIndex = aligned.pairIndex;
      const range = pairs[originalIndex]!.model.sourceRange!;
      segments.push(separatorBefore(originalIndex) + source.slice(range.start.offset, range.end.offset));
      lastOriginalIndex = originalIndex;
    } else {
      const originalIndex = aligned.kind === "replaced" ? aligned.pairIndex : -1;
      let text = serializeReconstructedProseMirrorBlock(aligned.block);
      if (originalIndex >= 0) {
        const range = pairs[originalIndex]!.model.sourceRange!;
        text = applySourceLineEnding(text, source.slice(range.start.offset, range.end.offset));
        segments.push(separatorBefore(originalIndex) + text);
        // A reconstructed replacement still occupies the original pair slot,
        // so the next untouched neighbor can reuse the original gap-after.
        lastOriginalIndex = originalIndex;
      } else {
        text = applySourceLineEnding(text, source);
        segments.push(separatorBefore(-1) + text);
      }
    }
  }

  let content = segments.join("");
  if (lastOriginalIndex === pairs.length - 1) {
    content += source.slice(pairs[lastOriginalIndex]!.model.sourceRange!.end.offset);
    content = restoreFinalLineEndingSwallowedByRange(
      content,
      source,
      pairs[lastOriginalIndex]!.model.sourceRange!
    );
  } else {
    // The final original block is gone. The document's own trailing bytes are
    // still the truth — trimming to a bare "\n" injected an LF into every CRLF
    // document whose last block was deleted.
    content = content.replace(/(?:\r?\n)+$/, "") + documentTail;
    content = restoreFinalLineEndingSwallowedByRange(content, source, lastPairRange);
  }
  return content;
}

/*
 * MME-0122 — an unclosed fence at EOF swallows the document's final line
 * ending into its own range: mdast gives the code node every byte up to EOF,
 * so the tail slice after the last pair is empty and a reconstructed
 * replacement — which is trimmed — dropped the newline the author's file ended
 * with. The same swallow emptied `documentTail` when the final block was
 * deleted. Re-append exactly the line ending the original range carried at its
 * end: bytes from the file, never invented, so a file without a final newline
 * stays without one and CRLF stays CRLF.
 */
function restoreFinalLineEndingSwallowedByRange(
  content: string,
  source: string,
  range: SourceRange
): string {
  if (range.end.offset < source.length || /\r?\n$/.test(content)) {
    // Either real tail bytes followed the range (they carry the ending
    // themselves) or the content already ends with one.
    return content;
  }
  const rangeText = source.slice(range.start.offset, range.end.offset);
  if (!/\r?\n$/.test(rangeText)) {
    return content;
  }
  return content + (rangeText.endsWith("\r\n") ? "\r\n" : "\n");
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
  if (block.type.name === "table") {
    return serializeRichTable(block);
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
    case "callout":
      return proseMirrorCalloutToMomentariseNode(node, nextId);
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

function proseMirrorCalloutToMomentariseNode(
  node: ProseMirrorNode,
  nextId: () => ReturnType<typeof createNodeId>
): KnownNode {
  const calloutType = normalizeCalloutType(node.attrs.calloutType) ?? "NOTE";
  const fold = normalizeCalloutFold(node.attrs.fold) ?? "";
  const title = normalizeCalloutTitle(node.attrs.title);
  const header = `[!${calloutType}]${fold}${title ? ` ${title}` : ""}\n`;
  const body = proseMirrorBlockChildrenToMomentariseNodes(node, nextId);
  const first = body[0];
  if (!first || first.kind === "opaque" || first.type !== "paragraph") {
    return knownNode(nextId, "block", "blockquote", body);
  }
  const firstWithHeader = knownNode(
    nextId,
    "block",
    "paragraph",
    [knownNode(nextId, "inline", "text", [], { value: header }), ...(first.children ?? [])]
  );
  return knownNode(nextId, "block", "blockquote", [firstWithHeader, ...body.slice(1)]);
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
  const inlineNodes: ProseMirrorNode[] = [];
  node.forEach((child) => {
    inlineNodes.push(child);
  });
  return proseMirrorInlineRunToMomentariseNodes(inlineNodes, nextId, []);
}

/*
 * MME-0121 — one delimiter pair per mark run.
 *
 * ProseMirror stores marks per inline node, so `bold` over `` a `x` b `` yields
 * three nodes each carrying `strong`. Wrapping each node independently
 * serialized ``**a ****`x`**** b**`` — corruption reachable from the bold
 * command alone, with no input rule involved. Instead: among the current node's
 * unconsumed marks, wrap the one that spans the longest run of adjacent nodes,
 * then recurse into the run with that mark consumed. Marks compare by
 * `Mark.eq` (type and attrs), so two adjacent links with different
 * destinations stay separate runs.
 */
function proseMirrorInlineRunToMomentariseNodes(
  nodes: readonly ProseMirrorNode[],
  nextId: () => ReturnType<typeof createNodeId>,
  consumedMarks: readonly Mark[]
): readonly MomentariseNode[] {
  const result: MomentariseNode[] = [];
  let index = 0;
  while (index < nodes.length) {
    const node = nodes[index]!;
    const remaining = groupableInlineMarks(node, consumedMarks);
    if (remaining.length === 0) {
      result.push(...proseMirrorInlineNodeToMomentariseNodes(node, nextId));
      index += 1;
      continue;
    }
    const run = selectInlineRun(nodes, index, remaining, consumedMarks);
    if (run.end <= index) {
      // Structurally unreachable: a groupable mark always spans its own node.
      // Guarded because the failing mode is an infinite loop, and a mutation
      // round measured that as an OOM crash rather than a test failure.
      throw new Error("Inline run selection must advance past the node it started on.");
    }
    const runChildren = proseMirrorInlineRunToMomentariseNodes(nodes.slice(index, run.end), nextId, [
      ...consumedMarks,
      run.mark
    ]);
    result.push(...momentariseNodesForMark(run.mark, runChildren, nextId));
    index = run.end;
  }
  return result;
}

/**
 * A node's marks that a run may still group, in the node's own mark order
 * (ProseMirror sorts by schema rank). A `code` mark on a non-text node is
 * excluded: a code span cannot hold an image, a hard break, or a footnote
 * reference, so wrapping would delete the node from the file while the screen
 * still showed it — the node survives bare instead, exactly as the old
 * per-node wrapper treated non-text marks.
 */
function groupableInlineMarks(node: ProseMirrorNode, consumedMarks: readonly Mark[]): readonly Mark[] {
  if (node.type.name === "hard_break") {
    // A run may CONTAIN a hard break — `selectInlineRun` reads the break's own
    // marks to extend across it — but it may never open on one. An opening
    // delimiter immediately before a line ending is not left-flanking, so
    // CommonMark reads it as literal text: bolding `alpha⏎bravo` from the
    // break onward wrote `alpha**  \nbravo**`, which reopens with two literal
    // `**` and the bold gone. Unreachable before MME-0123, because the break
    // itself was being dropped at mount (measured; the closing half is trimmed
    // in `selectInlineRun`).
    return [];
  }
  return node.marks.filter(
    (mark) =>
      !consumedMarks.some((consumed) => consumed.eq(mark)) &&
      (mark.type.name !== "code" || node.isText)
  );
}

/**
 * Longest run wins, so `strong` wraps all of `` a `x` b `` once while `code`
 * is applied inside it, on its own node only. Two rules keep `code` honest,
 * because a code span's content is flattened to plain text when it wraps:
 *
 *  - a code run may not cross a non-text node or a change in the OTHER marks
 *    its nodes carry — `` `ab` `` with only `a` bolded must serialize
 *    ``**`a`**`b` ``, never one span that silently drops the bold;
 *  - on equal run lengths any other mark outranks `code`, so code is always
 *    the innermost wrapper and its children are plain text by construction.
 *
 * Other ties keep the node's own mark order.
 */
function selectInlineRun(
  nodes: readonly ProseMirrorNode[],
  index: number,
  remaining: readonly Mark[],
  consumedMarks: readonly Mark[]
): { readonly end: number; readonly mark: Mark } {
  const first = nodes[index]!;
  let best = { end: index, mark: remaining[0]!, score: -1 };
  for (const candidate of remaining) {
    let end = index;
    while (end < nodes.length && candidate.isInSet(nodes[end]!.marks)) {
      if (
        candidate.type.name === "code" &&
        (!nodes[end]!.isText ||
          !sameResidualMarks(first, nodes[end]!, consumedMarks, candidate))
      ) {
        break;
      }
      end += 1;
    }
    // The closing half of the flanking rule: a run must not END on a hard
    // break either, or the closing delimiter lands after the break's trailing
    // spaces and stops being right-flanking (`**alpha  \n**bravo`). Trimming
    // can never empty the run, because `groupableInlineMarks` has already
    // refused to open one on a break.
    while (end > index && nodes[end - 1]!.type.name === "hard_break") {
      end -= 1;
    }
    const score = end * 2 + (candidate.type.name === "code" ? 0 : 1);
    if (score > best.score) {
      best = { end, mark: candidate, score };
    }
  }
  return { end: best.end, mark: best.mark };
}

function sameResidualMarks(
  first: ProseMirrorNode,
  node: ProseMirrorNode,
  consumedMarks: readonly Mark[],
  runMark: Mark
): boolean {
  const residual = (candidate: ProseMirrorNode): readonly Mark[] =>
    candidate.marks.filter(
      (mark) => !mark.eq(runMark) && !consumedMarks.some((consumed) => consumed.eq(mark))
    );
  const firstResidual = residual(first);
  const nodeResidual = residual(node);
  return (
    firstResidual.length === nodeResidual.length &&
    firstResidual.every((mark, markIndex) => mark.eq(nodeResidual[markIndex]!))
  );
}

function momentariseNodesForMark(
  mark: Mark,
  children: readonly MomentariseNode[],
  nextId: () => ReturnType<typeof createNodeId>
): readonly MomentariseNode[] {
  if (mark.type.name === "code") {
    return [
      knownNode(nextId, "inline", "inlineCode", [], {
        value: children.map((child) => inlineTextContent(child)).join("")
      })
    ];
  }
  if (mark.type.name === "strong") {
    return [knownNode(nextId, "inline", "strong", children)];
  }
  if (mark.type.name === "em") {
    return [knownNode(nextId, "inline", "emphasis", children)];
  }
  if (mark.type.name === "strike") {
    return [knownNode(nextId, "inline", "strikethrough", children)];
  }
  if (mark.type.name === "link") {
    return [
      knownNode(nextId, "inline", "link", children, {
        title: stringAttribute(mark.attrs.title),
        url: stringAttribute(mark.attrs.href) ?? ""
      })
    ];
  }
  // A mark with no Markdown syntax contributes nothing; its children stand
  // alone, exactly as the per-node wrapper used to skip it.
  return children;
}

function proseMirrorInlineNodeToMomentariseNodes(
  node: ProseMirrorNode,
  nextId: () => ReturnType<typeof createNodeId>
): readonly MomentariseNode[] {
  if (node.isText) {
    // Marks are the run grouper's job; by the time a text node reaches here
    // every mark it carries has been consumed by an enclosing run.
    return [knownNode(nextId, "inline", "text", [], { value: node.text ?? "" })];
  }
  if (node.type.name === "hard_break") {
    return [knownNode(nextId, "inline", MOMENTARISE_LINE_BREAK_TYPE, [])];
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
  const alignment: (RichBlockAlignment | null)[] = blocks.map(() => null);
  const consumedPairIndexes = new Set<number>();

  /*
   * A block that still equals the pair at its OWN index keeps that pair
   * (MME-0103).
   *
   * The greedy pass below matches against the first unconsumed equivalent pair
   * anywhere in the document, which is wrong as soon as an edit makes a block
   * equal to a LATER one. Pasting "B." over "A." in "A.\n\n\n\nB.\n\nC.\n" made
   * the new first block claim B's pair, so the untouched B was re-slotted into
   * A's vacated pair — and both then drew the wrong gap:
   *
   *   actual   "B.\n\nB.\n\n\n\nC.\n"
   *   expected "B.\n\n\n\nB.\n\nC.\n"
   *
   * The blank-line run between B and C changed, and the user never touched
   * either of them. Gate 4.5 names blank-line runs explicitly. Anchoring the
   * blocks that did not move before resolving the ones that did fixes it, and
   * leaves reordering untouched, because a reordered block never equals the pair
   * at its new index.
   */
  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex += 1) {
    const pair = pairs[blockIndex];
    const block = blocks[blockIndex]!;
    if (pair?.pm && richNodesEquivalent(pair.pm, block)) {
      alignment[blockIndex] = { block, kind: "matched", pairIndex: blockIndex };
      consumedPairIndexes.add(blockIndex);
    }
  }

  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex += 1) {
    if (alignment[blockIndex]) {
      continue;
    }
    const block = blocks[blockIndex]!;
    const exactMatchIndex = findExactRichPairIndex(block, pairs, consumedPairIndexes);
    if (exactMatchIndex >= 0) {
      alignment[blockIndex] = {
        block,
        kind: "matched",
        pairIndex: exactMatchIndex
      };
      consumedPairIndexes.add(exactMatchIndex);
      continue;
    }

    const replacementIndex = findReplacementRichPairIndex(blockIndex, blocks, pairs, consumedPairIndexes);
    if (replacementIndex >= 0) {
      alignment[blockIndex] = {
        block,
        kind: "replaced",
        pairIndex: replacementIndex
      };
      consumedPairIndexes.add(replacementIndex);
    } else {
      alignment[blockIndex] = {
        block,
        kind: "inserted"
      };
    }
  }

  return alignment as readonly RichBlockAlignment[];
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
        schema.nodes.bullet_list!.create(null, [
          schema.nodes.todo_item!.create({ checked: false }, [paragraphFromCurrentBlock(state)])
        ])
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
    case "tableRowBefore":
      return executeRichTableRowOperation(state, "insert-before", dispatch);
    case "tableRowAfter":
      return executeRichTableRowOperation(state, "insert-after", dispatch);
    case "tableRowDelete":
      return executeRichTableRowOperation(state, "delete", dispatch);
    case "tableColumnBefore":
      return executeRichTableColumnOperation(state, "insert-before", dispatch);
    case "tableColumnAfter":
      return executeRichTableColumnOperation(state, "insert-after", dispatch);
    case "tableColumnDelete":
      return executeRichTableColumnOperation(state, "delete", dispatch);
    case "tableRowUp": {
      const coordinates = richTableCellCoordinatesInEditorState(state);
      return coordinates
        ? executeRichTableRowReorder(state, coordinates.rowIndex, coordinates.rowIndex - 1, dispatch)
        : false;
    }
    case "tableRowDown": {
      const coordinates = richTableCellCoordinatesInEditorState(state);
      return coordinates
        ? executeRichTableRowReorder(state, coordinates.rowIndex, coordinates.rowIndex + 1, dispatch)
        : false;
    }
    case "tableColumnLeft": {
      const coordinates = richTableCellCoordinatesInEditorState(state);
      return coordinates
        ? executeRichTableColumnReorder(state, coordinates.columnIndex, coordinates.columnIndex - 1, dispatch)
        : false;
    }
    case "tableColumnRight": {
      const coordinates = richTableCellCoordinatesInEditorState(state);
      return coordinates
        ? executeRichTableColumnReorder(state, coordinates.columnIndex, coordinates.columnIndex + 1, dispatch)
        : false;
    }
    case "bold":
      return toggleMark(schema.marks.strong!)(state, dispatch);
    case "italic":
      return toggleMark(schema.marks.em!)(state, dispatch);
    case "inlineCode":
      return toggleMark(schema.marks.code!)(state, dispatch);
    case "strikethrough":
      return toggleMark(schema.marks.strike!)(state, dispatch);
    case "link":
      return toggleMark(schema.marks.link!, {
        href: options.href ?? "https://example.invalid",
        title: options.title ?? null
      })(state, dispatch);
  }
}

const richInputRulesPluginKey = new PluginKey("momentarise-rich-input-rules");

interface RichInputRulesPluginState {
  /** The node a block rule converted, or null for an inline conversion. */
  readonly undoRange: { readonly from: number; readonly to: number } | null;
  readonly undoText: string;
}

/** Marks the undo itself, so the rule cannot immediately re-fire on the restored text. */
const RICH_INPUT_RULE_UNDONE = "undone";

/**
 * Lets a transaction that changes no text ask the input rules to look again.
 *
 * Stepping over an auto-inserted closing character moves only the selection, and
 * `appendTransaction` ignores transactions that do not change the document. Without
 * this, pairing would silently break the shipped inline-code rule: with a closing
 * backtick already sitting ahead of the caret, `` `code` `` never presents a closing
 * delimiter *before* the caret until the step-over happens.
 */
const richInputRuleTriggerKey = new PluginKey("momentarise-rich-input-rule-trigger");

const richPairingPluginKey = new PluginKey<RichPairingPluginState>("momentarise-rich-pairing");

interface RichPairingClosure {
  /** Document position of the auto-inserted closing character. */
  readonly at: number;
  readonly character: string;
}

interface RichPairingPluginState {
  /** Innermost last, so nested pairs step over in the order they were opened. */
  readonly closures: readonly RichPairingClosure[];
}

const emptyRichPairingState: RichPairingPluginState = { closures: [] };

/** More than this many open pairs is a runaway, not a document. */
const RICH_PAIRING_DEPTH_LIMIT = 32;

const RICH_PAIRS = new Map([
  ["(", ")"],
  ["[", "]"],
  ["{", "}"],
  ['"', '"'],
  ["'", "'"],
  ["`", "`"]
]);

/**
 * Symmetric delimiters. They get two extra restrictions the brackets do not
 * need: they never pair in code, where they are content rather than syntax, and
 * they never pair straight after a word character, or typing `don't` would
 * produce `don''t`.
 */
const RICH_SYMMETRIC_PAIRS = new Set(['"', "'", "`"]);

const RICH_WORD_CHARACTER = /[\p{L}\p{N}]/u;

interface NormalizedRichPreferences {
  readonly inputRules: {
    readonly disable: readonly string[];
    readonly extend: readonly RichInputRuleDefinition[];
  };
  readonly keymapDelegateToHost: boolean;
  readonly keymapProfile: "default" | "delegate" | "minimal";
}

/** Ids of the built-in Markdown-as-you-type rules, in evaluation order. */
export const richInputRuleIds = [
  "listTodo",
  "inlineCode",
  "link",
  "strong",
  "strikethrough",
  "emphasis",
  "heading",
  "todo",
  "bulletList",
  "orderedList",
  "blockquote",
  "horizontalRule",
  "codeFence"
] as const;

export type RichInputRuleId = (typeof richInputRuleIds)[number];

type RichMarkdownInputRule =
  | { readonly kind: "blockquote"; readonly prefixLength: number }
  | { readonly kind: "bullet_list"; readonly prefixLength: number }
  | { readonly kind: "code_block"; readonly language: string | null; readonly prefixLength: number }
  | { readonly kind: "heading"; readonly level: number; readonly prefixLength: number }
  | { readonly kind: "horizontal_rule"; readonly prefixLength: number }
  | { readonly kind: "ordered_list"; readonly order: number; readonly prefixLength: number }
  | { readonly checked: boolean; readonly kind: "todo_item"; readonly prefixLength: number };

function createRichPasteSanitizerPlugin(): Plugin {
  return new Plugin({
    props: {
      handlePaste(view, event) {
        const payload = richTableMatrixClipboardPayload(event.clipboardData);
        if (!payload) {
          return false;
        }
        const coordinates = richTableCellCoordinatesInEditorState(view.state);
        if (!coordinates) {
          return false;
        }
        const parsed = parseRichTableMatrix(payload.text, payload.format);
        if ("reason" in parsed) {
          return false;
        }
        let didDispatch = false;
        const handled = executeRichTableMatrixPaste(
          view.state,
          coordinates,
          parsed.matrix,
          (transaction) => {
            view.dispatch(transaction);
            didDispatch = true;
          }
        );
        if (!handled || !didDispatch) {
          return false;
        }
        event.preventDefault();
        return true;
      },
      transformPastedHTML(html) {
        return sanitizePastedHtml(html);
      }
    }
  });
}

function richTableMatrixClipboardPayload(
  clipboardData: DataTransfer | null
): { readonly format: "csv" | "tsv"; readonly text: string } | null {
  if (!clipboardData) {
    return null;
  }
  if (
    clipboardData.files.length > 0 ||
    Array.from(clipboardData.items).some((item) => item.kind === "file")
  ) {
    return null;
  }
  const types = Array.from(clipboardData.types);
  if (types.includes("text/tab-separated-values")) {
    return {
      format: "tsv",
      text: clipboardData.getData("text/tab-separated-values")
    };
  }
  if (types.includes("text/csv")) {
    return {
      format: "csv",
      text: clipboardData.getData("text/csv")
    };
  }
  if (!types.includes("text/plain")) {
    return null;
  }
  const plainText = clipboardData.getData("text/plain");
  return plainText.includes("\t") ? { format: "tsv", text: plainText } : null;
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

/**
 * Smart pairing for brackets, quotes and backticks (MME-0104b).
 *
 * It lives in `handleTextInput` because that is the only hook that sees a typed
 * character before it reaches the document. That placement is also why the
 * previous attempt's harness could not see it at all: driving `tr.insertText`
 * bypasses this entirely, and an empty implementation passed every assertion.
 */
function createRichPairingPlugin(): Plugin<RichPairingPluginState> {
  return new Plugin<RichPairingPluginState>({
    key: richPairingPluginKey,
    props: {
      handleKeyDown(view, event) {
        // A modified Backspace is delete-word or delete-to-line-start. This
        // plugin runs ahead of every keymap and calls `preventDefault`, so
        // without this guard it would quietly steal all three.
        if (event.key !== "Backspace" || event.metaKey || event.ctrlKey || event.altKey) {
          return false;
        }
        const { state } = view;
        if (!(state.selection instanceof TextSelection) || !state.selection.empty) {
          return false;
        }
        const { $from } = state.selection;
        const text = $from.parent.textBetween(0, $from.parent.content.size, "\n", "\n");
        const before = text[$from.parentOffset - 1] ?? "";
        const after = text[$from.parentOffset] ?? "";
        // Only an *empty* pair collapses. `(ab|)` is ordinary text by now.
        if (!before || RICH_PAIRS.get(before) !== after) {
          return false;
        }
        // Collapsing a pair the plugin would never have created deletes a
        // character the user typed by hand: quotes do not pair inside code, so
        // Backspace must not treat them as a pair there either.
        if (!allowsRichPairing(state, before)) {
          return false;
        }
        event.preventDefault();
        view.dispatch(state.tr.delete($from.pos - 1, $from.pos + 1));
        return true;
      },
      handleTextInput(view, from, to, text) {
        // A pair is opened around a caret, never around a selection: wrapping a
        // selection would rewrite bytes the user did not type.
        if (from !== to) {
          return false;
        }
        const { state } = view;
        const $from = state.doc.resolve(from);
        if (!$from.parent.isTextblock) {
          return false;
        }
        const blockText = $from.parent.textBetween(0, $from.parent.content.size, "\n", "\n");
        const nextCharacter = blockText[$from.parentOffset] ?? "";
        const previousCharacter = $from.parentOffset > 0 ? blockText[$from.parentOffset - 1] ?? "" : "";

        const pending = richPairingPluginKey.getState(state)?.closures ?? [];
        const innermost = pending[pending.length - 1];
        if (innermost && innermost.at === from && innermost.character === text && nextCharacter === text) {
          const transaction = state.tr
            .setSelection(TextSelection.create(state.doc, from + 1))
            .setMeta(richPairingPluginKey, { closures: pending.slice(0, -1) })
            // Nothing changed in the document, so the input rules must be told
            // to look again or `` `code` `` never converts.
            .setMeta(richInputRuleTriggerKey, true);
          view.dispatch(transaction);
          return true;
        }

        const closing = RICH_PAIRS.get(text);
        if (!closing || !allowsRichPairing(state, text) || pending.length >= RICH_PAIRING_DEPTH_LIMIT) {
          return false;
        }
        // Typing `(` immediately before a word means "wrap this", not "open an
        // empty pair"; inserting a closer there would split the word.
        if (RICH_WORD_CHARACTER.test(nextCharacter)) {
          return false;
        }
        /*
         * A symmetric delimiter never pairs straight after a word character
         * (`don't` would become `don''t`) nor after the same delimiter. The
         * second rule is what keeps a code fence typeable: without it ``` opens
         * a pair, steps over it, then opens another, so the user gets ```` and
         * the fence rule never matches.
         */
        if (
          RICH_SYMMETRIC_PAIRS.has(text) &&
          (RICH_WORD_CHARACTER.test(previousCharacter) || previousCharacter === text)
        ) {
          return false;
        }
        const transaction = state.tr.insertText(`${text}${closing}`, from, to);
        transaction.setSelection(TextSelection.create(transaction.doc, from + 1));
        transaction.setMeta(richPairingPluginKey, {
          // Setting the state explicitly skips the mapping in `apply`, so the
          // already-open closers must be mapped through *this* insertion here —
          // otherwise the outer `)` of `([a])` is remembered at a stale position
          // and never steps over.
          closures: [
            ...pending.map((closure) => ({ ...closure, at: transaction.mapping.map(closure.at) })),
            { at: from + 1, character: closing }
          ]
        });
        view.dispatch(transaction);
        return true;
      }
    },
    state: {
      apply(transaction, previous) {
        const meta = transaction.getMeta(richPairingPluginKey) as RichPairingPluginState | undefined;
        if (meta) {
          return meta;
        }
        if (previous.closures.length === 0 || !transaction.docChanged) {
          return previous;
        }
        /*
         * Map every recorded position through the edit rather than clearing it.
         * Clearing on any document change is the recorded trap: the position is
         * lost on the very next keystroke, so `(x)` becomes `(x))`.
         */
        // Default association: text typed *at* the recorded position pushes the
        // closing character to the right, which is exactly what happens on screen.
        const closures = previous.closures
          .map((closure) => ({ ...closure, at: transaction.mapping.map(closure.at) }))
          .filter((closure) => closure.at >= 0 && closure.at <= transaction.doc.content.size);
        return { closures };
      },
      init() {
        return emptyRichPairingState;
      }
    }
  });
}

function allowsRichPairing(state: EditorState, opener: string): boolean {
  const { reason } = richTextInputContext(state);
  // Opaque and raw-HTML content is carried verbatim; nothing may be inserted.
  if (reason === "not-text-block" || reason === "opaque" || reason === "raw-html") {
    return false;
  }
  // In code, a quote or a backtick is content, not syntax.
  if (RICH_SYMMETRIC_PAIRS.has(opener) && (reason === "code-block" || reason === "inline-code")) {
    return false;
  }
  return true;
}

/**
 * Pasting a URL over a selection makes a Markdown link (MME-0104b).
 *
 * Settled and recorded here because the issue asks for it explicitly:
 *
 *  - **URL definition:** a single whitespace-free token with an explicit scheme
 *    that passes `isSafeUrl` — the same `http`/`https`/`mailto` allowlist that
 *    already governs rendered and pasted hrefs. A permissive definition would
 *    turn `javascript:` and bare words into links.
 *  - **Selection already containing a link:** not wrapped. Nesting a link inside
 *    a link has no Markdown representation, so the paste falls through.
 *  - **Selection spanning blocks:** not wrapped, for the same reason — a link
 *    cannot span two blocks.
 *  - **Anything that is not a URL:** falls through to the default replace.
 */
function createRichPasteLinkPlugin(): Plugin {
  return new Plugin({
    props: {
      handlePaste(view, event) {
        const { state } = view;
        const linkMark = state.schema.marks.link;
        const pasted = (event as ClipboardEvent).clipboardData?.getData("text/plain")?.trim() ?? "";
        if (!linkMark || !isPastedLinkUrl(pasted) || !(state.selection instanceof TextSelection)) {
          return false;
        }
        const { $from, $to, empty, from, to } = state.selection;
        const mark = linkMark.create({ href: pasted, title: null });
        if (empty) {
          /*
           * Inserting a link where a link cannot live splits what is there: with
           * the caret inside `` `x y` ``, one code span became three inline
           * nodes. The context contract is the same answer MME-0104a uses, and
           * an existing link at the caret is the empty-selection form of the
           * "already linked" decision recorded below.
           */
          if (!richTextInputContext(state).allowsMarkdownTriggers || linkMark.isInSet($from.marks())) {
            return false;
          }
          const transaction = state.tr.replaceSelectionWith(state.schema.text(pasted, [mark]), false);
          transaction.removeStoredMark(linkMark);
          view.dispatch(transaction);
          event.preventDefault();
          return true;
        }
        if ($from.parent !== $to.parent || state.doc.rangeHasMark(from, to, linkMark)) {
          return false;
        }
        /*
         * Code is refused before the mark is applied, not after. `addMark`
         * succeeds on a code span in the model, but the serializer emits the
         * code span alone — so the pasted URL would be accepted on screen and
         * absent from the file. A code block refuses the mark outright. Both
         * fall through to the default paste, so the clipboard still lands.
         * Table cells are deliberately *not* excluded: `| [a](b) |` is
         * representable, so a link there is real.
         */
        const codeMark = state.schema.marks.code;
        if ($from.parent.type.spec.code || (codeMark && state.doc.rangeHasMark(from, to, codeMark))) {
          return false;
        }
        const transaction = state.tr.addMark(from, to, mark);
        /*
         * Belt and braces behind the code gate above: `addMark` is a silent
         * no-op wherever the mark cannot apply, and dispatching anyway swallows
         * the paste — `preventDefault` called, nothing inserted. The code gate
         * catches every case reachable today, so no mutant of this line fails a
         * test; it is kept because the failure it prevents is silent data loss
         * and the cost is one comparison. Recorded as unproven in the build log
         * rather than claimed as covered.
         */
        if (!transaction.doc.rangeHasMark(from, to, linkMark)) {
          return false;
        }
        transaction.setSelection(TextSelection.create(transaction.doc, to));
        transaction.removeStoredMark(linkMark);
        view.dispatch(transaction);
        event.preventDefault();
        return true;
      }
    }
  });
}

function isPastedLinkUrl(value: string): boolean {
  if (!value || /\s/u.test(value) || !/^[a-z][a-z0-9+.-]*:/iu.test(value)) {
    return false;
  }
  /*
   * Representability is part of the URL definition, not a separate concern. An
   * unbalanced parenthesis cannot survive `[text](destination)`:
   * `https://x.example/#a)b` serializes to `[docs](https://x.example/#a)b)`,
   * which re-parses with the href truncated at the first `)` and `b)` left as
   * stray text. The bytes are stable; the document is not. Balanced pairs — the
   * `…/Foo_(bar)` shape — round-trip correctly and are allowed. A destination we
   * cannot represent falls through to the plain paste, which is exactly what it
   * did before this issue, so nothing regresses.
   */
  let depth = 0;
  for (const character of value) {
    if (character === "(") {
      depth += 1;
    } else if (character === ")") {
      depth -= 1;
      if (depth < 0) {
        return false;
      }
    }
  }
  if (depth !== 0) {
    return false;
  }
  return isSafeUrl(value);
}

function createRichInputRulesPlugin(preferences: NormalizedRichPreferences): Plugin {
  const rules = resolveRichInputRules(preferences.inputRules);
  return new Plugin<RichInputRulesPluginState | null>({
    appendTransaction(transactions, _oldState, state) {
      if (transactions.some((transaction) => transaction.getMeta(richInputRulesPluginKey))) {
        return null;
      }
      if (
        !transactions.some(
          (transaction) => transaction.docChanged || transaction.getMeta(richInputRuleTriggerKey)
        )
      ) {
        return null;
      }
      if (!(state.selection instanceof TextSelection) || !state.selection.empty) {
        return null;
      }
      /*
       * MME-0088's context contract is the single answer to "is typing Markdown
       * safe here" for slash triggers and input rules alike. Before this gate,
       * `> ` typed at the start of a table cell pulled the cell's paragraph out
       * of the table and left two broken tables behind, and `# ` there deleted
       * itself silently.
       */
      if (!richTextInputContext(state).allowsMarkdownTriggers) {
        return null;
      }
      const { $from } = state.selection;
      if (!$from.parent.isTextblock) {
        return null;
      }
      const isParagraph = $from.parent.type === state.schema.nodes.paragraph;
      const literalText = $from.parent.textBetween(0, $from.parent.content.size, "\n", "\n");
      const textBeforeCaret = $from.parent.textBetween(0, $from.parentOffset, "\n", "\n");
      const blockStart = $from.start();

      for (const rule of rules) {
        if (rule.requiresParagraph && !isParagraph) {
          continue;
        }
        const match = textBeforeCaret.match(rule.match);
        if (!match || match.index === undefined) {
          continue;
        }
        if (
          rule.wordBoundary &&
          match.index > 0 &&
          !/\s/u.test(textBeforeCaret[match.index - 1] ?? "")
        ) {
          continue;
        }
        const transaction = rule.run({
          blockStart,
          from: $from.pos - (textBeforeCaret.length - match.index),
          literalText,
          match,
          state,
          to: $from.pos
        });
        // A rule that cannot apply here falls through to the next one. Returning
        // early instead once made every later rule unreachable behind `[x] `.
        if (!transaction) {
          continue;
        }
        /*
         * The rule owns the undo *range* (a block rule records the node it
         * produced; an inline rule records nothing and restores its textblock's
         * content). The plugin owns the undo *text*, which only it has.
         */
        const declared = transaction.getMeta(richInputRulesPluginKey);
        if (declared === undefined) {
          transaction.setMeta(richInputRulesPluginKey, { undoRange: null, undoText: literalText });
        } else if (declared !== null && typeof declared === "object" && "undoRange" in declared) {
          transaction.setMeta(richInputRulesPluginKey, { ...declared, undoText: literalText });
        }
        return transaction;
      }
      return null;
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
        // The undo itself clears the state, so a second Mod-z reaches history
        // instead of replaying the same restore.
        if (meta === RICH_INPUT_RULE_UNDONE) {
          return null;
        }
        if (meta && typeof meta === "object" && typeof meta.undoText === "string") {
          return {
            undoRange: meta.undoRange ?? null,
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

/**
 * Restores the literal characters a rule converted, in one step.
 *
 * Two shapes, because a block conversion and an inline one own different
 * amounts of the document:
 *
 *  - A block rule records the node it produced, and that exact node is replaced
 *    by a paragraph. Recording the range matters: the converted block may sit
 *    inside a blockquote or a list item, so a fixed depth is wrong.
 *  - An inline rule records nothing and only its textblock's *content* is
 *    restored, leaving the block itself alone. This is the fix for a data-loss
 *    defect: replacing `$from.before(1)`..`$from.after(1)` meant one undo after
 *    typing `**bold**` in the second item of a list replaced the whole list
 *    with a single paragraph, destroying every sibling item.
 */
function undoRichInputRuleCommand(state: EditorState, dispatch?: (transaction: Transaction) => void): boolean {
  const pluginState = richInputRulesPluginKey.getState(state) as RichInputRulesPluginState | null;
  if (!pluginState || !(state.selection instanceof TextSelection)) {
    return false;
  }
  const { $from } = state.selection;
  if ($from.depth < 1) {
    return false;
  }
  const { undoRange, undoText } = pluginState;
  const from = undoRange ? undoRange.from : $from.start();
  const to = undoRange ? undoRange.to : $from.end();
  if (from < 0 || to > state.doc.content.size || from > to) {
    return false;
  }
  const replacement = undoRange
    ? state.schema.nodes.paragraph!.create(null, undoText ? state.schema.text(undoText) : undefined)
    : undoText
      ? state.schema.text(undoText)
      : null;
  const transaction = state.tr;
  if (replacement) {
    transaction.replaceWith(from, to, replacement);
  } else {
    transaction.delete(from, to);
  }
  // A distinct marker, not `true`: it clears the plugin state so the *next*
  // Mod-z reaches the history, instead of replaying this same restore forever.
  transaction.setMeta(richInputRulesPluginKey, RICH_INPUT_RULE_UNDONE);
  const caret = Math.min(from + (undoRange ? 1 : 0) + undoText.length, transaction.doc.content.size);
  dispatch?.(transaction.setSelection(TextSelection.near(transaction.doc.resolve(caret))));
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

/**
 * The Markdown-as-you-type table, in evaluation order.
 *
 * Order is load-bearing for `listTodo`, which runs before the paragraph-level
 * `todo` rule because inside a list item the conversion is item-to-item, and
 * falls through rather than ending the pass when the caret is not in a list.
 *
 * `strong` is listed before `emphasis` for readability, but the ordering is NOT
 * what stops `*italic*` swallowing `**bold**` — measured, not assumed: the
 * emphasis pattern never matches the finished `**bold**` at all. The real guard
 * is `wordBoundary` at the *intermediate* keystroke `**bold*`, where the
 * character before the match is `*`. Removing the boundary check fails nine
 * cases; reordering these two fails none.
 */
function defaultRichInputRules(): readonly RichInputRuleDefinition[] {
  return [
    {
      id: "listTodo",
      match: /^\[([ xX]?)\] $/u,
      requiresParagraph: true,
      run: ({ match, state }) =>
        createListTodoInputRuleTransaction(state, {
          checked: /[xX]/u.test(match[1] ?? ""),
          prefixLength: match[0].length
        })
    },
    {
      id: "inlineCode",
      match: /`([^`\n]+)`$/u,
      run: createMarkedTextInputRuleRunner("code", (match, state) =>
        state.schema.marks.code ? { mark: state.schema.marks.code.create(), text: match[1]! } : null
      ),
      wordBoundary: true
    },
    {
      id: "link",
      match: /(?<!!)\[([^\]\n]+)\]\((.*)\)$/u,
      run: createMarkedTextInputRuleRunner("link", (match, state) => {
        const parsed = parseMarkdownLinkDestinationAndTitle(match[2]!);
        if (!parsed || !isSafeUrl(parsed.href) || !state.schema.marks.link) {
          return null;
        }
        return {
          mark: state.schema.marks.link.create({ href: parsed.href, title: parsed.title }),
          text: match[1]!
        };
      }),
      wordBoundary: true
    },
    {
      id: "strong",
      match: /\*\*([^\s*][^*]*?)\*\*$/u,
      run: createMarkInputRuleRunner("strong"),
      wordBoundary: true
    },
    {
      id: "strikethrough",
      match: /~~([^\s~][^~]*?)~~$/u,
      run: createMarkInputRuleRunner("strike"),
      wordBoundary: true
    },
    {
      id: "emphasis",
      match: /(?:\*([^\s*][^*]*?)\*|_([^\s_][^_]*?)_)$/u,
      run: createMarkInputRuleRunner("em"),
      wordBoundary: true
    },
    {
      id: "heading",
      match: /^(#{1,6}) $/u,
      requiresParagraph: true,
      run: ({ match, state }) =>
        applyBlockInputRule(state, {
          kind: "heading",
          level: match[1]!.length,
          prefixLength: match[0].length
        })
    },
    {
      // The trailing space is the trigger, not the `]`: converting on the
      // bracket leaves the space the user then types as list content.
      id: "todo",
      match: /^(?:- )?\[([ xX]?)\] $/u,
      requiresParagraph: true,
      run: ({ match, state }) =>
        applyBlockInputRule(state, {
          checked: /[xX]/u.test(match[1] ?? ""),
          kind: "todo_item",
          prefixLength: match[0].length
        })
    },
    {
      id: "bulletList",
      match: /^[-*+] $/u,
      requiresParagraph: true,
      run: ({ match, state }) =>
        applyBlockInputRule(state, { kind: "bullet_list", prefixLength: match[0].length })
    },
    {
      id: "orderedList",
      match: /^(\d{1,9})\. $/u,
      requiresParagraph: true,
      run: ({ match, state }) =>
        applyBlockInputRule(state, {
          kind: "ordered_list",
          order: Number.parseInt(match[1]!, 10),
          prefixLength: match[0].length
        })
    },
    {
      id: "blockquote",
      match: /^> $/u,
      requiresParagraph: true,
      run: ({ match, state }) =>
        applyBlockInputRule(state, { kind: "blockquote", prefixLength: match[0].length })
    },
    {
      id: "horizontalRule",
      match: /^(?:---|\*\*\*|___)$/u,
      requiresParagraph: true,
      run: ({ match, state }) =>
        applyBlockInputRule(state, { kind: "horizontal_rule", prefixLength: match[0].length })
    },
    {
      id: "codeFence",
      match: /^```([A-Za-z0-9_-]*) $/u,
      requiresParagraph: true,
      run: ({ match, state }) =>
        applyBlockInputRule(state, {
          kind: "code_block",
          language: normalizeOptionalString(match[1] ?? ""),
          prefixLength: match[0].length
        })
    }
  ];
}

function resolveRichInputRules(
  preference: NormalizedRichPreferences["inputRules"]
): readonly RichInputRuleDefinition[] {
  const disabled = new Set(preference.disable);
  return [...preference.extend, ...defaultRichInputRules()].filter((rule) => !disabled.has(rule.id));
}

/**
 * Deletes the delimiters and marks what is left, rather than replacing the range
 * with fresh text: `**a `x` b**` must keep the code span the inline-code rule
 * already produced inside it.
 */
function createMarkInputRuleRunner(
  markName: "em" | "strike" | "strong"
): (context: RichInputRuleContext) => Transaction | null {
  return ({ from, match, state, to }) => {
    const markType = state.schema.marks[markName];
    const text = match[1] ?? match[2] ?? "";
    if (!markType || !text) {
      return null;
    }
    const delimiterLength = (match[0].length - text.length) / 2;
    if (!Number.isInteger(delimiterLength) || delimiterLength < 1) {
      return null;
    }
    const transaction = state.tr;
    transaction.delete(to - delimiterLength, to);
    transaction.delete(from, from + delimiterLength);
    const markTo = to - delimiterLength * 2;
    transaction.addMark(from, markTo, markType.create());
    // Before `removeStoredMark`: `setSelection` resets stored marks to null.
    transaction.setSelection(TextSelection.create(transaction.doc, Math.min(markTo, transaction.doc.content.size)));
    transaction.removeStoredMark(markType);
    return transaction;
  };
}

/** Replaces the whole match with its inner text carrying one mark. */
function createMarkedTextInputRuleRunner(
  markName: "code" | "link",
  resolve: (
    match: RegExpMatchArray,
    state: EditorState
  ) => { readonly mark: Mark; readonly text: string } | null
): (context: RichInputRuleContext) => Transaction | null {
  return ({ from, match, state, to }) => {
    const markType = state.schema.marks[markName];
    const resolved = resolve(match, state);
    if (!markType || !resolved) {
      return null;
    }
    const transaction = state.tr.replaceWith(from, to, state.schema.text(resolved.text, [resolved.mark]));
    transaction.setSelection(
      TextSelection.create(transaction.doc, Math.min(from + resolved.text.length, transaction.doc.content.size))
    );
    transaction.removeStoredMark(markType);
    return transaction;
  };
}

function applyBlockInputRule(state: EditorState, rule: RichMarkdownInputRule): Transaction | null {
  const { $from } = state.selection;
  if ($from.parent.type !== state.schema.nodes.paragraph) {
    return null;
  }
  const from = $from.before();
  const to = $from.after();
  const prefixFrom = $from.start();
  const prefixTo = prefixFrom + rule.prefixLength;
  const transaction = state.tr.delete(prefixFrom, prefixTo);
  const mappedFrom = transaction.mapping.map(from);
  const mappedTo = transaction.mapping.map(to);

  /*
   * `setBlockType` and `replaceWith` are both silent no-ops where the parent
   * forbids the target node — a callout accepts paragraphs only. Without the
   * conversion checks below, the prefix delete would stand on its own and eat
   * the characters the user typed.
   */
  if (rule.kind === "heading") {
    transaction.setBlockType(mappedFrom, mappedTo, state.schema.nodes.heading!, {
      level: rule.level
    });
    const heading = transaction.doc.nodeAt(mappedFrom);
    if (!heading || heading.type !== state.schema.nodes.heading) {
      return null;
    }
    return transaction.setMeta(richInputRulesPluginKey, {
      undoRange: { from: mappedFrom, to: mappedFrom + heading.nodeSize }
    });
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
  const converted = transaction.doc.nodeAt(mappedFrom);
  if (converted?.type !== replacement.type) {
    return null;
  }
  transaction.setMeta(richInputRulesPluginKey, {
    undoRange: { from: mappedFrom, to: mappedFrom + converted.nodeSize }
  });
  const selectionPosition = Math.min(mappedFrom + selectionOffsetForInputRule(rule), transaction.doc.content.size);
  return transaction.setSelection(TextSelection.near(transaction.doc.resolve(selectionPosition)));
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
      return schema.nodes.ordered_list!.create({ order: rule.order }, [
        schema.nodes.list_item!.create(null, [paragraph])
      ]);
    case "todo_item":
      return schema.nodes.bullet_list!.create(null, [
        schema.nodes.todo_item!.create({ checked: rule.checked }, [paragraph])
      ]);
  }
}

function selectionOffsetForInputRule(rule: Exclude<RichMarkdownInputRule, { readonly kind: "heading" }>): number {
  switch (rule.kind) {
    case "blockquote":
      return 2;
    case "bullet_list":
    case "ordered_list":
    case "todo_item":
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

function richTableColumnOperationForCommand(commandId: RichCommandId): RichTableColumnOperation | null {
  if (commandId === "tableColumnBefore") {
    return "insert-before";
  }
  if (commandId === "tableColumnAfter") {
    return "insert-after";
  }
  if (commandId === "tableColumnDelete") {
    return "delete";
  }
  return null;
}

function richTableRowOperationForCommand(commandId: RichCommandId): RichTableRowOperation | null {
  if (commandId === "tableRowBefore") {
    return "insert-before";
  }
  if (commandId === "tableRowAfter") {
    return "insert-after";
  }
  if (commandId === "tableRowDelete") {
    return "delete";
  }
  return null;
}

function richTableReorderForCommand(
  commandId: RichCommandId
): { readonly axis: "column" | "row"; readonly delta: -1 | 1 } | null {
  if (commandId === "tableRowUp") {
    return { axis: "row", delta: -1 };
  }
  if (commandId === "tableRowDown") {
    return { axis: "row", delta: 1 };
  }
  if (commandId === "tableColumnLeft") {
    return { axis: "column", delta: -1 };
  }
  if (commandId === "tableColumnRight") {
    return { axis: "column", delta: 1 };
  }
  return null;
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
  // A NodeSelection on a top-level block resolves to depth 0, so the ancestor
  // walk below never sees it. Without this, selecting a code block as an object —
  // via the block handle or the block menu — reports "no code block", and any
  // affordance keyed on that selection silently disappears (MME-0086).
  const { selection } = state;
  if (selection instanceof NodeSelection && selection.node.type.name === typeName) {
    return {
      from: selection.from,
      node: selection.node,
      parent: selection.$from.parent,
      to: selection.to
    };
  }
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
  callout: {
    attrs: {
      calloutType: { default: "NOTE" },
      fold: { default: null },
      title: { default: null }
    },
    content: "paragraph+",
    defining: true,
    group: "block",
    parseDOM: [
      {
        contentElement: '[data-mme-callout-body="true"]',
        tag: '[data-mme-callout="true"]',
        getAttrs: (element) =>
          element instanceof HTMLElement
            ? {
                calloutType: normalizeCalloutType(element.dataset.mmeCalloutType) ?? "NOTE",
                fold: normalizeCalloutFold(element.dataset.mmeCalloutFold),
                title: normalizeCalloutTitle(element.dataset.mmeCalloutTitle)
              }
            : false
      }
    ],
    toDOM: (node) => {
      const calloutType = normalizeCalloutType(node.attrs.calloutType) ?? "NOTE";
      const fold = normalizeCalloutFold(node.attrs.fold);
      const title = normalizeCalloutTitle(node.attrs.title);
      const visibleTitle = title ?? calloutType;
      return [
        "aside",
        {
          "aria-label": `${calloutType} callout${title ? `: ${title}` : ""}`,
          "data-mme-callout": "true",
          "data-mme-callout-fold": fold ?? "none",
          "data-mme-callout-title": title ?? "",
          "data-mme-callout-type": calloutType,
          role: "note"
        },
        [
          "div",
          {
            "aria-hidden": "true",
            contenteditable: "false",
            "data-mme-callout-header": "true"
          },
          ["span", { "data-mme-callout-marker": "true" }, `[!${calloutType}]${fold ?? ""}`],
          ["span", { "data-mme-callout-title-label": "true" }, visibleTitle]
        ],
        ["div", { "data-mme-callout-body": "true" }, 0]
      ];
    }
  },
  raw_html_block: {
    code: true,
    content: "text*",
    defining: true,
    group: "block",
    marks: "",
    parseDOM: [
      {
        contentElement: '[data-mme-raw-html-source="true"]',
        preserveWhitespace: "full",
        tag: 'pre[data-mme-raw-html-block="true"]'
      }
    ],
    toDOM: () => [
      "pre",
      {
        "aria-label": "Raw HTML source block",
        "data-mme-raw-html-block": "true",
        role: "region"
      },
      ["code", { "data-mme-raw-html-source": "true" }, 0]
    ]
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
      meta: { default: null },
      syntax: { default: "fenced" }
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
    attrs: {
      loose: { default: false }
    },
    content: "(list_item | todo_item)+",
    group: "block",
    parseDOM: [{ tag: "ul" }],
    toDOM: () => ["ul", 0]
  },
  ordered_list: {
    attrs: {
      loose: { default: false },
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
    attrs: {
      loose: { default: false }
    },
    content: "paragraph block*",
    defining: true,
    parseDOM: [{ tag: "li" }],
    toDOM: () => ["li", 0]
  },
  todo_item: {
    attrs: {
      checked: { default: false },
      loose: { default: false }
    },
    content: "paragraph block*",
    defining: true,
    parseDOM: [
      {
        tag: 'li[data-type="todo-item"]',
        priority: 60,
        contentElement: '[data-todo-content="true"]',
        getAttrs: (element) => ({
          checked: element instanceof HTMLElement ? element.dataset.checked === "true" : false
        })
      },
      {
        tag: 'div[data-type="todo-item"]',
        priority: 60,
        contentElement: '[data-todo-content="true"]',
        getAttrs: (element) => ({
          checked: element instanceof HTMLElement ? element.dataset.checked === "true" : false
        })
      }
    ],
    toDOM: (node) => {
      const checked = Boolean(node.attrs.checked);
      return [
        "li",
        { "data-checked": String(checked), "data-type": "todo-item" },
        [
          "div",
          { "data-todo-row": "true" },
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
        ]
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
    content: "paragraph (paragraph | bullet_list | ordered_list | blockquote | callout | code_block | raw_html_block | table)*",
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
  raw_html_source: {
    code: true,
    excludes: "_",
    inclusive: false,
    parseDOM: [{ tag: 'code[data-mme-raw-html-inline="true"]' }],
    toDOM: () => [
      "code",
      {
        "aria-label": "Raw HTML source",
        "data-mme-raw-html-inline": "true"
      },
      0
    ]
  },
  code: {
    code: true,
    inclusive: false,
    parseDOM: [{ tag: 'code:not([data-mme-raw-html-inline="true"])' }],
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
    blocks.some((block) => !isRepresentableRichFootnoteBlock(block, source))
  ) {
    return null;
  }
  const blockNodes = blocks.map((block) => richFootnoteBlockToProseMirror(block, schema, source));
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
    if (block?.kind === "opaque") {
      return richFootnoteRawHtml(block, source)?.continuationIndent ?? null;
    }
    if (block?.type === "list" && index > 0) {
      const containerIndent = richFootnoteBlockSeparatorIndent(blockSeparators[index - 1]!);
      return containerIndent && richFootnoteListBlockHasContainerIndent(raw, containerIndent)
        ? containerIndent
        : null;
    }
    if (block?.type === "codeFence") {
      return richFootnoteCodeBlockContinuationIndent(block, source);
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

function richFootnoteCodeFenceContinuationIndent(raw: string): string | null {
  const lines = raw.split(/\r?\n/);
  const opening = lines[0]?.match(/^([`~]{3,})[^\r\n]*$/);
  const closing = lines.at(-1)?.match(/^([ \t]+)([`~]{3,})[ \t]*$/);
  const continuationIndent = closing?.[1] ?? "";
  const openingFence = opening?.[1] ?? "";
  const closingFence = closing?.[2] ?? "";
  if (
    !openingFence ||
    !closingFence ||
    openingFence[0] !== closingFence[0] ||
    closingFence.length < openingFence.length ||
    !isSafeRichFootnoteContinuationIndent(continuationIndent)
  ) {
    return null;
  }
  return lines.slice(1, -1).every(
    (line) => !/\S/.test(line) || line.startsWith(continuationIndent)
  )
    ? continuationIndent
    : null;
}

function richFootnoteCodeBlockContinuationIndent(node: MomentariseNode, source: string): string | null {
  const raw = rawFromRange(node, source);
  return richFootnoteCodeFenceContinuationIndent(raw) ??
    richFootnoteIndentedCodeContinuationIndent(node, source);
}

function richFootnoteIndentedCodeContinuationIndent(
  node: MomentariseNode,
  source: string
): string | null {
  if (node.kind === "opaque" || node.type !== "codeFence" || !node.sourceRange) {
    return null;
  }
  if (node.attributes?.language !== undefined || node.attributes?.meta !== undefined) {
    return null;
  }
  const value = node.attributes?.value;
  if (typeof value !== "string") {
    return null;
  }
  const rawLines = rawFromRange(node, source).split(/\r?\n/);
  const valueLines = value.split(/\r?\n/);
  if (rawLines.length !== valueLines.length || rawLines.length === 0) {
    return null;
  }
  const outerWidth = node.sourceRange.start.column - 1;
  if (!Number.isSafeInteger(outerWidth) || outerWidth < 0) {
    return null;
  }
  const outerIndent = " ".repeat(outerWidth);
  const codeIndent = "    ";
  if (rawLines[0] !== `${codeIndent}${valueLines[0] ?? ""}`) {
    return null;
  }
  for (let index = 1; index < rawLines.length; index += 1) {
    const rawLine = rawLines[index] ?? "";
    const valueLine = valueLines[index] ?? "";
    if (valueLine.length === 0) {
      if (!["", outerIndent, `${outerIndent}${codeIndent}`].includes(rawLine)) {
        return null;
      }
      continue;
    }
    if (rawLine !== `${outerIndent}${codeIndent}${valueLine}`) {
      return null;
    }
  }
  return outerIndent;
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
    lines.slice(1).every(
      (line) => !/\S/.test(line) || (line.startsWith(containerIndent) && /\S/.test(line.slice(containerIndent.length)))
    )
  );
}

function isSafeRichFootnoteContinuationIndent(value: string): boolean {
  return /^(?: {4,}|\t+)$/.test(value);
}

function richFootnoteBlockFingerprint(node: ProseMirrorNode): string {
  return JSON.stringify(node.toJSON());
}

function richFootnoteBlockToProseMirror(
  node: MomentariseNode,
  schema: MomentariseRichSchema,
  source: string
): ProseMirrorNode {
  if (node.kind === "opaque") {
    const html = richFootnoteRawHtml(node, source);
    if (!html) {
      throw new Error("Unsupported opaque footnote blocks must be rejected before rich conversion.");
    }
    return schema.nodes.raw_html_block!.create(null, textNode(schema, html.value));
  }
  if (node.type === "paragraph") {
    return schema.nodes.paragraph!.create(
      null,
      inlineChildrenToProseMirror(node.children ?? [], schema, source, [], true)
    );
  }
  if (node.type === "list") {
    return richFootnoteListToProseMirror(node, schema, source);
  }
  if (node.type === "blockquote") {
    const callout = richFootnoteCallout(node, source);
    if (callout) {
      const paragraphs = (node.children ?? []).map((child) => {
        if (child.kind === "opaque" || child.type !== "paragraph") {
          throw new Error("Non-paragraph callout children must be rejected before rich conversion.");
        }
        return schema.nodes.paragraph!.create(
          null,
          inlineChildrenToProseMirror(child.children ?? [], schema, source, [], true)
        );
      });
      const first = paragraphs[0]!;
      const firstBody = first.content.cut(callout.bodyOffset);
      if (firstBody.size === 0) {
        throw new Error("Header-only callouts must be rejected before rich conversion.");
      }
      return schema.nodes.callout!.create(
        {
          calloutType: callout.calloutType,
          fold: callout.fold,
          title: callout.title
        },
        [schema.nodes.paragraph!.create(null, firstBody), ...paragraphs.slice(1)]
      );
    }
    return schema.nodes.blockquote!.create(
      null,
      (node.children ?? []).map((child) => {
        if (child.kind === "opaque" || child.type !== "paragraph") {
          throw new Error("Non-paragraph quote children must be rejected before rich conversion.");
        }
        return schema.nodes.paragraph!.create(
          null,
          inlineChildrenToProseMirror(child.children ?? [], schema, source, [], true)
        );
      })
    );
  }
  if (node.type === "codeFence") {
    const syntax = richFootnoteCodeSyntax(node, source);
    if (!syntax) {
      throw new Error("Unmappable footnote code must be rejected before rich conversion.");
    }
    return schema.nodes.code_block!.create(
      {
        language: stringAttribute(node.attributes?.language),
        meta: stringAttribute(node.attributes?.meta),
        syntax
      },
      textNode(schema, stringAttribute(node.attributes?.value) ?? "")
    );
  }
  if (node.type === "table") {
    const table = tableNodeToProseMirror(node, schema, source);
    if (!table) {
      throw new Error("Unmappable footnote table must be rejected before rich conversion.");
    }
    return table;
  }
  throw new Error(`Unsupported rich footnote block reached conversion: ${node.type}.`);
}

function richFootnoteListToProseMirror(
  node: MomentariseNode,
  schema: MomentariseRichSchema,
  source: string
): ProseMirrorNode {
  if (node.kind === "opaque" || node.type !== "list") {
    throw new Error("Non-list footnote nodes must be rejected before list conversion.");
  }
  const items = (node.children ?? []).map((item) =>
    richFootnoteListItemToProseMirror(item, schema, source)
  );
  const loose = richListNodeIsLoose(node, source);
  return node.attributes?.ordered === true
    ? schema.nodes.ordered_list!.create({ loose, order: Number(node.attributes.start) || 1 }, items)
    : schema.nodes.bullet_list!.create({ loose }, items);
}

function richFootnoteListItemToProseMirror(
  node: MomentariseNode,
  schema: MomentariseRichSchema,
  source: string
): ProseMirrorNode {
  if (node.kind === "opaque" || node.type !== "listItem") {
    throw new Error("Non-list-item footnote nodes must be rejected before item conversion.");
  }
  const children = (node.children ?? []).map((child) => richFootnoteBlockToProseMirror(child, schema, source));
  const attrs = { loose: richListNodeIsLoose(node, source) };
  return typeof node.attributes?.checked === "boolean"
    ? schema.nodes.todo_item!.create({ ...attrs, checked: node.attributes.checked }, children)
    : schema.nodes.list_item!.create(attrs, children);
}

function isRepresentableRichFootnoteBlock(node: MomentariseNode, source: string): boolean {
  if (node.kind === "opaque") {
    return richFootnoteRawHtml(node, source) !== null;
  }
  if (node.type === "paragraph") {
    return isRepresentableRichFootnoteParagraph(node, source);
  }
  if (node.type === "list") {
    return isRepresentableRichFootnoteList(node, source);
  }
  if (node.type === "blockquote") {
    return isRepresentableRichFootnoteBlockquote(node, source);
  }
  if (node.type === "table") {
    return isRepresentableRichFootnoteTable(node);
  }
  return node.type === "codeFence" && isRepresentableRichFootnoteCodeFence(node, source);
}

function isRepresentableRichFootnoteCodeFence(node: MomentariseNode, source: string): boolean {
  if (node.kind === "opaque" || node.type !== "codeFence" || !node.sourceRange) {
    return false;
  }
  const value = node.attributes?.value;
  const language = node.attributes?.language;
  const meta = node.attributes?.meta;
  if (
    typeof value !== "string" ||
    (language !== undefined && typeof language !== "string") ||
    (meta !== undefined && typeof meta !== "string")
  ) {
    return false;
  }
  return richFootnoteCodeSyntax(node, source) !== null;
}

function richFootnoteCodeSyntax(node: MomentariseNode, source: string): "fenced" | "indented" | null {
  if (richFootnoteCodeFenceContinuationIndent(rawFromRange(node, source)) !== null) {
    return "fenced";
  }
  return richFootnoteIndentedCodeContinuationIndent(node, source) !== null ? "indented" : null;
}

function isRepresentableRichFootnoteBlockquote(node: MomentariseNode, source: string): boolean {
  if (node.kind === "opaque" || node.type !== "blockquote" || !node.sourceRange) {
    return false;
  }
  if (richFootnoteCallout(node, source)) {
    return true;
  }
  const blocks = node.children ?? [];
  const raw = rawFromRange(node, source);
  if (/^[ \t]*>[ \t]*\[!/i.test(raw)) {
    return false;
  }
  return blocks.length > 0 && blocks.every(
    (block) =>
      block.kind !== "opaque" &&
      block.type === "paragraph" &&
      isRepresentableRichFootnoteParagraph(block, source)
  );
}

interface RichFootnoteCallout {
  readonly bodyOffset: number;
  readonly calloutType: string;
  readonly fold: "+" | "-" | null;
  readonly title: string | null;
}

function richFootnoteCallout(node: MomentariseNode, source: string): RichFootnoteCallout | null {
  if (node.kind === "opaque" || node.type !== "blockquote" || !node.sourceRange) {
    return null;
  }
  const blocks = node.children ?? [];
  if (
    blocks.length === 0 ||
    !blocks.every(
      (block) =>
        block.kind !== "opaque" &&
        block.type === "paragraph" &&
        isRepresentableRichFootnoteParagraph(block, source)
    )
  ) {
    return null;
  }
  const first = blocks[0];
  if (!first || first.kind === "opaque" || first.type !== "paragraph") {
    return null;
  }
  const text = inlineTextContent(first);
  const lineBreakMatch = /\r?\n/.exec(text);
  const lineBreak = lineBreakMatch?.index ?? -1;
  const bodyOffset = lineBreak + (lineBreakMatch?.[0].length ?? 0);
  if (lineBreak < 0 || !/\S/.test(text.slice(bodyOffset))) {
    return null;
  }
  const header = text.slice(0, lineBreak);
  const match = header.match(/^\[!([A-Z][A-Z0-9_-]{0,63})\]([+-]?)(?: ([^\r\n]+))?$/);
  if (!match) {
    return null;
  }
  const calloutType = normalizeCalloutType(match[1]);
  const fold = normalizeCalloutFold(match[2]);
  const title = normalizeCalloutTitle(match[3]);
  if (!calloutType || (match[3] !== undefined && title !== match[3])) {
    return null;
  }
  const firstInline = first.children?.[0];
  const firstInlineText = firstInline?.kind !== "opaque" && firstInline?.type === "text"
    ? stringAttribute(firstInline.attributes?.value)
    : null;
  if (!firstInlineText?.startsWith(`${header}${lineBreakMatch![0]}`)) {
    return null;
  }
  const firstRawLine = rawFromRange(node, source).split(/\r?\n/, 1)[0];
  if (firstRawLine !== `> ${header}`) {
    return null;
  }
  return {
    bodyOffset,
    calloutType,
    fold,
    title
  };
}

function isRepresentableRichFootnoteList(node: MomentariseNode, source: string): boolean {
  if (node.kind === "opaque" || node.type !== "list") {
    return false;
  }
  const items = node.children ?? [];
  return items.length > 0 && items.every((item) => isRepresentableRichFootnoteListItem(item, source));
}

function isRepresentableRichFootnoteListItem(item: MomentariseNode, source: string): boolean {
  if (item.kind === "opaque" || item.type !== "listItem") {
    return false;
  }
  const checked = item.attributes?.checked;
  if (checked !== undefined && typeof checked !== "boolean") {
    return false;
  }
  const itemBlocks = item.children ?? [];
  const paragraph = itemBlocks[0];
  if (
    paragraph?.kind === "opaque" ||
    paragraph?.type !== "paragraph" ||
    !isRepresentableRichFootnoteParagraph(paragraph, source)
  ) {
    return false;
  }
  let containerCount = 0;
  return itemBlocks.slice(1).every((block) => {
    if (block.kind === "opaque") {
      containerCount += 1;
      return containerCount <= 1 && richFootnoteRawHtml(block, source) !== null;
    }
    if (block.type === "paragraph") {
      return isRepresentableRichFootnoteParagraph(block, source);
    }
    if (block.type === "list") {
      containerCount += 1;
      return containerCount <= 1 && isRepresentableRichFootnoteList(block, source);
    }
    if (block.type === "blockquote") {
      containerCount += 1;
      return containerCount <= 1 && isRepresentableRichFootnoteBlockquote(block, source);
    }
    if (block.type === "codeFence") {
      containerCount += 1;
      return containerCount <= 1 && isRepresentableRichFootnoteCodeFence(block, source);
    }
    if (block.type === "table") {
      containerCount += 1;
      return containerCount <= 1 && isRepresentableRichFootnoteTable(block);
    }
    return false;
  });
}

interface RichFootnoteRawHtml {
  readonly continuationIndent: string;
  readonly value: string;
}

interface ParsedHtmlNodeLocation {
  readonly endOffset: number;
  readonly endTag?: unknown;
  readonly startOffset: number;
}

interface ParsedHtmlNode {
  readonly nodeName: string;
  readonly sourceCodeLocation?: ParsedHtmlNodeLocation;
  readonly tagName?: string;
  readonly value?: string;
}

function richFootnoteRawHtml(node: MomentariseNode, source: string): RichFootnoteRawHtml | null {
  if (
    node.kind !== "opaque" ||
    node.reason !== "raw HTML" ||
    !node.sourceRange ||
    node.raw !== source.slice(node.sourceRange.start.offset, node.sourceRange.end.offset)
  ) {
    return null;
  }
  const outerWidth = node.sourceRange.start.column - 1;
  if (!Number.isSafeInteger(outerWidth) || outerWidth < 4) {
    return null;
  }
  const continuationIndent = " ".repeat(outerWidth);
  const lines = node.raw.split(/\r?\n/);
  if (!lines[0]?.startsWith("<")) {
    return null;
  }
  const deindented = [lines[0]];
  for (const line of lines.slice(1)) {
    if (!line.startsWith(continuationIndent)) {
      return null;
    }
    deindented.push(line.slice(continuationIndent.length));
  }
  const value = deindented.join("\n");
  return isSingleClosedHtmlRoot(value) ? { continuationIndent, value } : null;
}

function isSingleClosedHtmlRoot(value: string): boolean {
  const fragment = parseFragment(value, {
    sourceCodeLocationInfo: true
  }) as unknown as { readonly childNodes: readonly ParsedHtmlNode[] };
  const roots = fragment.childNodes.filter(
    (node) => node.nodeName !== "#text" || /\S/.test(node.value ?? "")
  );
  if (roots.length !== 1) {
    return false;
  }
  const root = roots[0];
  const location = root?.sourceCodeLocation;
  return Boolean(
    root?.tagName &&
    location?.endTag &&
    location.startOffset === 0 &&
    location.endOffset === value.length
  );
}

function isRepresentableRichFootnoteTable(node: MomentariseNode): node is KnownNode {
  return node.kind !== "opaque" && Boolean(node.sourceRange) && isRepresentableRichTable(node);
}

function richFootnoteInlineRawHtml(node: MomentariseNode, source: string): string | null {
  if (
    node.kind !== "opaque" ||
    node.reason !== "raw HTML" ||
    !node.sourceRange ||
    node.raw !== source.slice(node.sourceRange.start.offset, node.sourceRange.end.offset) ||
    node.sourceRange.start.line !== node.sourceRange.end.line ||
    /[\r\n]/.test(node.raw) ||
    !node.raw.startsWith("<") ||
    !node.raw.endsWith(">")
  ) {
    return null;
  }
  return node.raw;
}

function isRepresentableRichFootnoteInlineNode(
  node: MomentariseNode,
  source: string,
  allowRawHtml = true
): boolean {
  if (node.kind === "opaque") {
    return allowRawHtml && richFootnoteInlineRawHtml(node, source) !== null;
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
  return (node.children ?? []).every((child) =>
    isRepresentableRichFootnoteInlineNode(child, source, false)
  );
}

function isRepresentableRichFootnoteParagraph(node: MomentariseNode, source: string): boolean {
  if (node.kind === "opaque" || node.type !== "paragraph") {
    return false;
  }
  return (node.children ?? []).every((child) =>
    isRepresentableRichFootnoteInlineNode(child, source)
  ) &&
    !looksLikeUnsupportedRichFootnoteTable(node);
}

function looksLikeUnsupportedRichFootnoteTable(node: KnownNode): boolean {
  const lines = (node.children ?? [])
    .map((child) => inlineTextContent(child))
    .join("")
    .split(/\r?\n/);
  return lines.length >= 2 && lines.every((line) => {
    const trimmed = line.trim();
    return trimmed.startsWith("|") && trimmed.slice(1).includes("|");
  });
}

type TableAlignment = "center" | "left" | "right" | null;

function tableNodeToProseMirror(
  node: KnownNode,
  schema: MomentariseRichSchema,
  source: string
): ProseMirrorNode | null {
  if (!isRepresentableRichTable(node)) {
    return null;
  }
  const rows = (node.children ?? []).filter(
    (child): child is KnownNode => child.kind !== "opaque" && child.type === "tableRow"
  );
  const width = richTableCells(rows[0]!).length;
  const alignments = modelTableAlignments(node, width);
  const tableRows: ProseMirrorNode[] = [];
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const cells = richTableCells(rows[rowIndex]!);
    const tableCells: ProseMirrorNode[] = [];
    for (let columnIndex = 0; columnIndex < cells.length; columnIndex += 1) {
      const cell = cells[columnIndex]!;
      const paragraph = schema.nodes.paragraph.create(
        null,
        tableInlineChildrenToProseMirror(cell.children ?? [], schema, source)
      );
      const cellType = rowIndex === 0 ? schema.nodes.table_header : schema.nodes.table_cell;
      tableCells.push(cellType.create({ alignment: alignments[columnIndex] }, paragraph));
    }
    tableRows.push(schema.nodes.table_row.create(null, tableCells));
  }
  return schema.nodes.table.create(null, tableRows);
}

function isRepresentableRichTable(node: MomentariseNode): node is KnownNode {
  if (node.kind === "opaque" || node.type !== "table") {
    return false;
  }
  const rows = (node.children ?? []).filter(
    (child): child is KnownNode => child.kind !== "opaque" && child.type === "tableRow"
  );
  const width = rows[0] ? richTableCells(rows[0]).length : 0;
  return Boolean(
    rows.length > 0 &&
    width > 0 &&
    rows.length === (node.children ?? []).length &&
    rows.every((row) => {
      const cells = richTableCells(row);
      return cells.length === width &&
        cells.length === (row.children ?? []).length &&
        cells.every((cell) => (cell.children ?? []).every(isRepresentableRichTableInlineNode));
    })
  );
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
  if (["text", "inlineCode", "image"].includes(node.type) || isMomentariseLineBreakNode(node)) {
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
  const loose = richListNodeIsLoose(node, source);
  if (node.attributes?.ordered === true) {
    return schema.nodes.ordered_list.create({ loose, order: Number(node.attributes.start) || 1 }, items);
  }
  return schema.nodes.bullet_list.create({ loose }, items);
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
  const loose = richListNodeIsLoose(node, source);
  if (typeof node.attributes?.checked === "boolean") {
    return schema.nodes.todo_item.create({ checked: node.attributes.checked, loose }, safeChildren);
  }
  return schema.nodes.list_item.create({ loose }, safeChildren);
}

function richListNodeIsLoose(node: MomentariseNode, source: string): boolean {
  if (!node.sourceRange) {
    return false;
  }
  return /(?:^|\r?\n)[\t ]*(?:\r?\n|$)/.test(rawFromRange(node, source));
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
  marks: readonly Mark[] = [],
  markRawHtmlSource = false
): readonly ProseMirrorNode[] {
  const inlineNodes: ProseMirrorNode[] = [];
  for (const child of children) {
    inlineNodes.push(...inlineNodeToProseMirror(child, schema, source, marks, markRawHtmlSource));
  }
  return inlineNodes;
}

function tableInlineChildrenToProseMirror(
  children: readonly MomentariseNode[],
  schema: MomentariseRichSchema,
  source: string
): readonly ProseMirrorNode[] {
  const inlineNodes: ProseMirrorNode[] = [];
  for (const child of children) {
    if (child.kind !== "opaque" && child.type === "link" && !child.sourceRange) {
      const text = inlineTextContent(child);
      if (text) {
        inlineNodes.push(schema.text(text));
      }
      continue;
    }
    inlineNodes.push(...inlineNodeToProseMirror(child, schema, source, [], false));
  }
  return inlineNodes;
}

function inlineNodeToProseMirror(
  node: MomentariseNode,
  schema: MomentariseRichSchema,
  source: string,
  marks: readonly Mark[],
  markRawHtmlSource: boolean
): readonly ProseMirrorNode[] {
  if (node.kind === "opaque") {
    const rawHtml = markRawHtmlSource ? richFootnoteInlineRawHtml(node, source) : null;
    return [
      schema.text(
        node.raw,
        rawHtml ? [...marks, schema.marks.raw_html_source!.create()] : marks
      )
    ];
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
    return inlineChildrenToProseMirror(
      node.children ?? [],
      schema,
      source,
      [...marks, schema.marks.em.create()],
      markRawHtmlSource
    );
  }
  if (node.type === "strong") {
    return inlineChildrenToProseMirror(
      node.children ?? [],
      schema,
      source,
      [...marks, schema.marks.strong.create()],
      markRawHtmlSource
    );
  }
  if (node.type === "strikethrough") {
    return inlineChildrenToProseMirror(
      node.children ?? [],
      schema,
      source,
      [...marks, schema.marks.strike.create()],
      markRawHtmlSource
    );
  }
  if (node.type === "link") {
    return inlineChildrenToProseMirror(
      node.children ?? [],
      schema,
      source,
      [
        ...marks,
        schema.marks.link.create({
          href: safeUrlAttribute(stringAttribute(node.attributes?.url)),
          title: stringAttribute(node.attributes?.title)
        })
      ],
      markRawHtmlSource
    );
  }
  if (node.type === "image") {
    // The marks argument is not optional decoration: an unmarked image inside a
    // strong run splits it at both boundaries, so a loaded `**a ![i](x) b**`
    // saved back as `**a **![i](x)** b**` — MME-0121's one-pair guarantee
    // undone by the mount (MME-0123).
    return [
      schema.nodes.image.create(
        {
          alt: stringAttribute(node.attributes?.alt) ?? "",
          src: safeUrlAttribute(stringAttribute(node.attributes?.url), {
            allowDataImage: true
          }),
          title: stringAttribute(node.attributes?.title)
        },
        null,
        marks
      )
    ];
  }
  if (isMomentariseLineBreakNode(node)) {
    return [schema.nodes.hard_break.create(null, null, marks)];
  }
  return inlineChildrenToProseMirror(node.children ?? [], schema, source, marks, markRawHtmlSource);
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
      return serializeBlockquote(node, indentLevel);
    case "callout":
      return serializeCallout(node);
    case "raw_html_block":
      return node.textContent;
    case "code_block": {
      return serializeCodeBlock(node);
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

function serializeCodeBlock(node: ProseMirrorNode): string {
  if (node.attrs.syntax === "indented") {
    return node.textContent
      .split(/\r?\n/)
      .map((line) => (line.length > 0 ? `    ${line}` : ""))
      .join("\n");
  }
  const language = stringAttribute(node.attrs.language) ?? "";
  const meta = stringAttribute(node.attrs.meta);
  const info = [language, meta].filter(Boolean).join(" ").replace(/\r?\n/g, " ");
  const marker = info.includes("`") ? "~" : "`";
  const fenceLength = Math.max(3, longestCodeFenceRun(node.textContent, marker) + 1);
  const fence = marker.repeat(fenceLength);
  const bodyEnding = node.textContent.endsWith("\n") ? "" : "\n";
  return `${fence}${info}\n${node.textContent}${bodyEnding}${fence}`;
}

function longestCodeFenceRun(value: string, marker: string): number {
  let longest = 0;
  for (const line of value.split(/\r?\n/)) {
    const match = line.match(new RegExp(`^[ \\t]{0,3}(${escapeRegExp(marker)}+)`));
    longest = Math.max(longest, match?.[1]?.length ?? 0);
  }
  return longest;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function serializeBlockquote(node: ProseMirrorNode, indentLevel: number): string {
  const blocks: string[] = [];
  node.forEach((child) => {
    blocks.push(
      serializeBlock(child, indentLevel)
        .split("\n")
        .map((line) => (line.trim() ? `> ${line}` : ">"))
        .join("\n")
    );
  });
  return blocks.join("\n>\n");
}

function serializeCallout(node: ProseMirrorNode): string {
  const calloutType = normalizeCalloutType(node.attrs.calloutType) ?? "NOTE";
  const fold = normalizeCalloutFold(node.attrs.fold) ?? "";
  const title = normalizeCalloutTitle(node.attrs.title);
  const header = `> [!${calloutType}]${fold}${title ? ` ${title}` : ""}`;
  const blocks: string[] = [];
  node.forEach((child) => {
    blocks.push(
      serializeBlock(child, 0)
        .split("\n")
        .map((line) => (line.trim() ? `> ${line}` : ">"))
        .join("\n")
    );
  });
  return [header, blocks.join("\n>\n")].filter(Boolean).join("\n");
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
    const body = unchangedSource ?? indentRichFootnoteBlock(reconstructed, continuationIndent);
    const separator = index === 0
      ? prefix
      : hasCompleteSourceLayout
        ? separators[index - 1]!
        : "\n\n    ";
    parts.push(`${separator}${body}`);
  });

  return parts.join("");
}

function indentRichFootnoteBlock(value: string, continuationIndent: string): string {
  return value
    .split(/\r?\n/)
    .map((line, index) => (index === 0 || !/\S/.test(line) ? line : `${continuationIndent}${line}`))
    .join("\n");
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
      cells.push(
        escapeRichTableCellMarkdown(
          cell.firstChild ? serializeInline(cell.firstChild, { escapeUnmarkedText: true }) : ""
        )
      );
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

function escapeRichTablePlainText(value: string): string {
  const escaped = value
    .replace(/\\/g, "\\\\")
    .replace(/([*_[\]\x60<>~&^])/g, "\\$1");
  const safeText = escaped
    .replace(/\b(https?):(?=\/\/)/gi, "$1&#58;")
    .replace(/\bwww\.(?=[a-z0-9])/gi, "www&#46;")
    .replace(/([a-z0-9._%+-]+)@(?=[a-z0-9.-]+\.[a-z]{2,})/gi, "$1&#64;");
  // Encode leading/trailing whitespace as numeric character references so `escapeRichTableCellMarkdown`'s
  // `.trim()` cannot silently drop literal edge whitespace. This applies to every serialized table cell
  // (MME-0080 quoted-CSV paste can legitimately produce cells like `"  padded  "`), not only CSV-pasted
  // ones, because the prior behavior was a preservation defect for any cell with literal edge whitespace.
  return safeText.replace(/^[^\S\r\n]+|[^\S\r\n]+$/gu, (whitespace) =>
    Array.from(whitespace, (character) => `&#${character.codePointAt(0)};`).join("")
  );
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
  return lines.join(node.attrs.loose === true ? "\n\n" : "\n");
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
    const childIndentation = `${indentation}${" ".repeat(structuralMarker.length + 1)}`;
    const serializedChild = serializeBlock(child, childIsList ? 0 : indentLevel + 1)
      .split("\n")
      .map((line) => `${childIndentation}${line}`)
      .join("\n");
    if (node.attrs.loose === true) {
      lines.push("");
    }
    lines.push(serializedChild);
  }
  return lines.join("\n");
}

function serializeInline(
  node: ProseMirrorNode,
  options: { readonly escapeUnmarkedText?: boolean } = {}
): string {
  const inlineNodes: ProseMirrorNode[] = [];
  node.forEach((child) => {
    inlineNodes.push(child);
  });
  return serializeInlineRun(inlineNodes, [], options);
}

/*
 * MME-0121 — this serializer is the one table cells and footnote definitions
 * actually reach (`serializeReconstructedProseMirrorBlock` short-circuits both
 * before the momentarise-model path), and it wrapped each node's marks
 * independently with the FIRST mark innermost, so a bolded cell wrote
 * `| **a **`**x**`** b** |` — per-node pairs plus literal `**` injected into
 * the code span's content. It now groups runs with the same selection rules as
 * `proseMirrorInlineRunToMomentariseNodes`.
 */
function serializeInlineRun(
  nodes: readonly ProseMirrorNode[],
  consumedMarks: readonly Mark[],
  options: { readonly escapeUnmarkedText?: boolean }
): string {
  let content = "";
  let index = 0;
  while (index < nodes.length) {
    const node = nodes[index]!;
    const remaining = groupableInlineMarks(node, consumedMarks);
    if (remaining.length === 0) {
      content += serializeInlineLeaf(node, options);
      index += 1;
      continue;
    }
    const run = selectInlineRun(nodes, index, remaining, consumedMarks);
    if (run.end <= index) {
      // Same invariant as the momentarise-side grouper, same reason.
      throw new Error("Inline run selection must advance past the node it started on.");
    }
    const inner = serializeInlineRun(nodes.slice(index, run.end), [...consumedMarks, run.mark], options);
    content += wrapSerializedInlineRun(run.mark, inner);
    index = run.end;
  }
  return content;
}

function serializeInlineLeaf(
  node: ProseMirrorNode,
  options: { readonly escapeUnmarkedText?: boolean }
): string {
  if (node.isText) {
    // Escaping applies to genuinely unmarked text only, as before the run
    // grouper: marked text is emitted verbatim inside its delimiters.
    return options.escapeUnmarkedText && node.marks.length === 0
      ? escapeRichTablePlainText(node.text ?? "")
      : node.text ?? "";
  }
  if (node.type.name === "hard_break") {
    return "  \n";
  }
  if (node.type.name === "image") {
    const alt = escapeMarkdownImageAlt(stringAttribute(node.attrs.alt) ?? "");
    const src = stringAttribute(node.attrs.src) ?? "";
    const title = escapeMarkdownTitle(stringAttribute(node.attrs.title));
    return title ? `![${alt}](${src} "${title}")` : `![${alt}](${src})`;
  }
  if (node.type.name === "footnote_reference") {
    const label = stringAttribute(node.attrs.label) ?? stringAttribute(node.attrs.identifier) ?? "";
    return stringAttribute(node.attrs.raw) ?? `[^${label}]`;
  }
  return "";
}

function wrapSerializedInlineRun(mark: Mark, inner: string): string {
  if (mark.type.name === "code") {
    return `\`${inner}\``;
  }
  if (mark.type.name === "strong") {
    return `**${inner}**`;
  }
  if (mark.type.name === "em") {
    return `*${inner}*`;
  }
  if (mark.type.name === "strike") {
    return `~~${inner}~~`;
  }
  if (mark.type.name === "link") {
    const href = stringAttribute(mark.attrs.href) ?? "";
    const title = stringAttribute(mark.attrs.title);
    return title ? `[${inner}](${href} "${title}")` : `[${inner}](${href})`;
  }
  // `raw_html_source` and any unknown mark contribute no syntax.
  return inner;
}

function escapeMarkdownImageAlt(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\[/g, "\\[").replace(/\]/g, "\\]").replace(/\r?\n/g, " ");
}

function escapeMarkdownTitle(value: string | null): string {
  return value ? value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r?\n/g, " ") : "";
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

function normalizeCalloutType(value: unknown): string | null {
  return typeof value === "string" && /^[A-Z][A-Z0-9_-]{0,63}$/.test(value) ? value : null;
}

function normalizeCalloutFold(value: unknown): "+" | "-" | null {
  return value === "+" || value === "-" ? value : null;
}

function normalizeCalloutTitle(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const title = value.trim();
  return title && !/[\r\n]/.test(title) ? title : null;
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
