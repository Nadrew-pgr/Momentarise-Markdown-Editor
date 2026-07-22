import { readFile } from "node:fs/promises";

const rich = await import("../packages/md-rich-prosemirror/dist/index.js");
const save = await import("../packages/md-save/dist/index.js");
const history = await import("prosemirror-history");

for (const exportName of ["runRichTableRowReorder", "runRichTableColumnReorder"]) {
  if (typeof rich[exportName] !== "function") {
    throw new Error(`Missing MME-0074 rich table-reorder export: ${exportName}`);
  }
}

const expectedCommands = ["tableRowUp", "tableRowDown", "tableColumnLeft", "tableColumnRight"];
for (const commandId of expectedCommands) {
  if (!rich.richCommandRegistry.some((command) => command.id === commandId)) {
    throw new Error(`Missing MME-0074 rich command: ${commandId}`);
  }
}
assertEqual(
  JSON.stringify(rich.filterRichMarkdownCommands("move table").map((command) => command.id)),
  JSON.stringify(expectedCommands),
  "move command search order"
);

const source = await readFile("fixtures/038-table-reorder/input.md", "utf8");
const state = rich.createRichMarkdownState(source, { dialect: "momentarise-enhanced" });
assertEqual(rich.serializeRichMarkdownState(state).content, source, "untouched fixture identity");
assertTableCount(state, 5, "supported root/direct/ordered/task/wide tables");

const movedRow = rich.runRichTableRowReorder(state, {
  columnIndex: 2,
  fromRowIndex: 1,
  tableIndex: 0,
  toRowIndex: 3
});
assertEqual(movedRow.handled, true, "arbitrary row move handled");
assertEqual(movedRow.reason, null, "arbitrary row move reason");
assertCoordinates(movedRow.state, { columnIndex: 2, rowIndex: 3, tableIndex: 0 }, "moved-row selection");
assertTableShape(findTable(movedRow.state, 0), [4, 4, 4, 4], "row move shape");
const movedRowOutput = rich.serializeRichMarkdownState(movedRow.state).content;
assertIncludes(
  movedRowOutput,
  "| beta | 2 | **ready** | Ben |\n| gamma | 3 | hold | Cy |\n| alpha | 1 | draft | Ada |",
  "row move Markdown"
);
assertOutsideRootTableExact(source, movedRowOutput);

const rowUndone = applyEditorCommand(movedRow.state, history.undo);
assertEqual(rich.serializeRichMarkdownState(rowUndone).content, source, "one undo restores exact pre-row-move source");
const rowRedone = applyEditorCommand(rowUndone, history.redo);
assertEqual(rich.serializeRichMarkdownState(rowRedone).content, movedRowOutput, "redo restores row move");

for (const [options, reason, label] of [
  [{ fromRowIndex: 0, tableIndex: 0, toRowIndex: 1 }, "header-row-protected", "header origin"],
  [{ fromRowIndex: 1, tableIndex: 0, toRowIndex: 0 }, "header-row-protected", "header destination"],
  [{ fromRowIndex: 1, tableIndex: 0, toRowIndex: 1 }, "no-op", "row no-op"],
  [{ fromRowIndex: 99, tableIndex: 0, toRowIndex: 1 }, "row-not-found", "missing row origin"],
  [{ fromRowIndex: 1, tableIndex: 0, toRowIndex: 99 }, "row-not-found", "missing row destination"]
]) {
  assertRejected(rich.runRichTableRowReorder(state, options), state, reason, label);
}

const selectedMiddleRow = rich.selectRichTableCell(state, { columnIndex: 1, rowIndex: 2, tableIndex: 0 });
const selectionRowMove = rich.runRichTableRowReorder(selectedMiddleRow, { toRowIndex: 1 });
assertEqual(selectionRowMove.handled, true, "selection-derived row move handled");
assertCoordinates(selectionRowMove.state, { columnIndex: 1, rowIndex: 1, tableIndex: 0 }, "selection-derived row move selection");

const firstBody = rich.selectRichTableCell(state, { columnIndex: 0, rowIndex: 1, tableIndex: 0 });
assertEqual(rich.canRunRichMarkdownCommand(firstBody, "tableRowUp"), false, "first body row cannot move up");
assertEqual(rich.canRunRichMarkdownCommand(firstBody, "tableRowDown"), true, "first body row can move down");
const finalBody = rich.selectRichTableCell(state, { columnIndex: 0, rowIndex: 3, tableIndex: 0 });
assertEqual(rich.canRunRichMarkdownCommand(finalBody, "tableRowDown"), false, "final body row cannot move down");
assertEqual(rich.runRichMarkdownCommand(finalBody, "tableRowDown").handled, false, "boundary row command unhandled");
const registryRowMove = rich.runRichMarkdownCommand(firstBody, "tableRowDown");
assertEqual(registryRowMove.handled, true, "registry row-down command handled");
assertCoordinates(registryRowMove.state, { columnIndex: 0, rowIndex: 2, tableIndex: 0 }, "registry row-down selection");

const movedColumn = rich.runRichTableColumnReorder(state, {
  fromColumnIndex: 0,
  rowIndex: 2,
  tableIndex: 0,
  toColumnIndex: 3
});
assertEqual(movedColumn.handled, true, "arbitrary column move handled");
assertCoordinates(movedColumn.state, { columnIndex: 3, rowIndex: 2, tableIndex: 0 }, "moved-column selection");
assertTableShape(findTable(movedColumn.state, 0), [4, 4, 4, 4], "column move shape");
assertColumnAlignments(findTable(movedColumn.state, 0), ["right", "center", null, "left"], "column alignment moves with column");
const movedColumnOutput = rich.serializeRichMarkdownState(movedColumn.state).content;
assertIncludes(movedColumnOutput, "| Count | Status | Owner | Name |\n| ---: | :---: | --- | :--- |", "column move Markdown");
assertIncludes(movedColumnOutput, "| 2 | **ready** | Ben | beta |", "column move inline mark/content");
assertOutsideRootTableExact(source, movedColumnOutput);

const columnUndone = applyEditorCommand(movedColumn.state, history.undo);
assertEqual(rich.serializeRichMarkdownState(columnUndone).content, source, "one undo restores exact pre-column-move source");
const columnRedone = applyEditorCommand(columnUndone, history.redo);
assertEqual(rich.serializeRichMarkdownState(columnRedone).content, movedColumnOutput, "redo restores column move");

for (const [options, reason, label] of [
  [{ fromColumnIndex: 1, tableIndex: 0, toColumnIndex: 1 }, "no-op", "column no-op"],
  [{ fromColumnIndex: 99, tableIndex: 0, toColumnIndex: 1 }, "column-not-found", "missing column origin"],
  [{ fromColumnIndex: 1, tableIndex: 0, toColumnIndex: 99 }, "column-not-found", "missing column destination"]
]) {
  assertRejected(rich.runRichTableColumnReorder(state, options), state, reason, label);
}

const firstColumn = rich.selectRichTableCell(state, { columnIndex: 0, rowIndex: 2, tableIndex: 0 });
assertEqual(rich.canRunRichMarkdownCommand(firstColumn, "tableColumnLeft"), false, "first column cannot move left");
assertEqual(rich.canRunRichMarkdownCommand(firstColumn, "tableColumnRight"), true, "first column can move right");
const finalColumn = rich.selectRichTableCell(state, { columnIndex: 3, rowIndex: 2, tableIndex: 0 });
assertEqual(rich.canRunRichMarkdownCommand(finalColumn, "tableColumnRight"), false, "final column cannot move right");
assertEqual(rich.runRichMarkdownCommand(finalColumn, "tableColumnRight").handled, false, "boundary column command unhandled");
const registryColumnMove = rich.runRichMarkdownCommand(firstColumn, "tableColumnRight");
assertEqual(registryColumnMove.handled, true, "registry column-right command handled");
assertCoordinates(registryColumnMove.state, { columnIndex: 1, rowIndex: 2, tableIndex: 0 }, "registry column-right selection");

for (const [tableIndex, operation, expected] of [
  [1, "row", "    | direct two | 2 | **marked** |\n    | direct one | 1 | exact |"],
  [2, "row", "       | ordered two | 2 | exact |\n       | ordered one | 1 | ready |"],
  [3, "column", "      | Rank | Action | Status |\n      | ---: | --- | :---: |"]
]) {
  const result = operation === "row"
    ? rich.runRichTableRowReorder(state, { fromRowIndex: 1, tableIndex, toRowIndex: 2 })
    : rich.runRichTableColumnReorder(state, { fromColumnIndex: 0, tableIndex, toColumnIndex: 1 });
  assertEqual(result.handled, true, `nested ${operation} move handled for table ${tableIndex}`);
  const output = rich.serializeRichMarkdownState(result.state).content;
  assertIncludes(output, expected, `nested ${operation} Markdown ${tableIndex}`);
  assertPreservedContext(output);
}

const crlfSource = source.replaceAll("\n", "\r\n");
const crlfState = rich.createRichMarkdownState(crlfSource, { dialect: "momentarise-enhanced" });
const crlfMoved = rich.runRichTableColumnReorder(crlfState, {
  fromColumnIndex: 2,
  tableIndex: 3,
  toColumnIndex: 0
});
assertEqual(crlfMoved.handled, true, "CRLF nested column move handled");
const crlfOutput = rich.serializeRichMarkdownState(crlfMoved.state).content;
if (/(^|[^\r])\n/.test(crlfOutput)) {
  throw new Error(`CRLF reorder introduced lone LF bytes.\n${JSON.stringify(crlfOutput)}`);
}
assertIncludes(crlfOutput, "      | Status | Action | Rank |\r\n      | :---: | --- | ---: |", "CRLF nested column order");

const stale = { ...state, source: source.replace("alpha", "external alpha") };
assertRejected(
  rich.runRichTableRowReorder(stale, { fromRowIndex: 1, tableIndex: 0, toRowIndex: 2 }),
  stale,
  "stale-source",
  "stale row reorder"
);
assertRejected(
  rich.runRichTableColumnReorder(stale, { fromColumnIndex: 0, tableIndex: 0, toColumnIndex: 1 }),
  stale,
  "stale-source",
  "stale column reorder"
);
const paragraphState = rich.createRichMarkdownState("Outside table.\n");
for (const commandId of expectedCommands) {
  assertEqual(rich.canRunRichMarkdownCommand(paragraphState, commandId), false, `${commandId} unavailable outside table`);
  const result = rich.runRichMarkdownCommand(paragraphState, commandId);
  assertEqual(result.handled, false, `${commandId} unhandled outside table`);
  assertEqual(result.state, paragraphState, `${commandId} outside state identity`);
}

const columnAfterRow = rich.runRichTableColumnOperation(movedRow.state, {
  columnIndex: 1,
  operation: "insert-after",
  rowIndex: 2,
  tableIndex: 0
});
assertEqual(columnAfterRow.handled, true, "column insertion remains compatible after row reorder");
assertTableShape(findTable(columnAfterRow.state, 0), [5, 5, 5, 5], "column insert after row reorder shape");
const rowAfterColumn = rich.runRichTableRowOperation(movedColumn.state, {
  columnIndex: 1,
  operation: "insert-after",
  rowIndex: 2,
  tableIndex: 0
});
assertEqual(rowAfterColumn.handled, true, "row insertion remains compatible after column reorder");
assertTableShape(findTable(rowAfterColumn.state, 0), [4, 4, 4, 4, 4], "row insert after column reorder shape");
const finalCell = rich.selectRichTableCell(movedColumn.state, { columnIndex: 3, rowIndex: 3, tableIndex: 0 });
const tabAppended = rich.moveRichTableCell(finalCell, "next");
assertTableShape(findTable(tabAppended, 0), [4, 4, 4, 4, 4], "final-cell Tab remains compatible after reorder");

const saveTarget = save.createMemorySaveTarget({ initialContent: source });
const saveEngine = save.createSaveEngine({ content: source, target: saveTarget });
saveEngine.updateContent(movedRowOutput, { now: new Date("2026-07-22T00:00:00.000Z") });
assertEqual(saveEngine.getState().status, "dirty", "reorder marks save dirty");
const saved = await saveEngine.flush({ reason: "autosave" });
assertEqual(saved.status, "saved", "reorder autosave succeeds");
assertEqual(saveTarget.readContent(), movedRowOutput, "saved bytes equal Source Markdown");

function applyEditorCommand(nextState, command) {
  let editorState = nextState.editorState;
  if (!command(editorState, (transaction) => {
    editorState = editorState.apply(transaction);
  })) {
    throw new Error("Expected editor command to be handled.");
  }
  return { ...nextState, editorState };
}

function assertRejected(result, originalState, reason, label) {
  assertEqual(result.handled, false, `${label}: handled`);
  assertEqual(result.reason, reason, `${label}: reason`);
  assertEqual(result.state, originalState, `${label}: state identity`);
}

function assertCoordinates(nextState, expected, label) {
  const actual = rich.richTableCellCoordinates(nextState);
  assertEqual(JSON.stringify(actual), JSON.stringify(expected), label);
}

function assertTableCount(nextState, expected, label) {
  let count = 0;
  nextState.editorState.doc.descendants((node) => {
    if (node.type.name === "table") count += 1;
    return true;
  });
  assertEqual(count, expected, label);
}

function findTable(nextState, tableIndex) {
  let currentIndex = 0;
  let found = null;
  nextState.editorState.doc.descendants((node) => {
    if (found) return false;
    if (node.type.name !== "table") return true;
    if (currentIndex === tableIndex) {
      found = node;
      return false;
    }
    currentIndex += 1;
    return true;
  });
  return found;
}

function assertTableShape(table, expected, label) {
  const actual = table?.content.content.map((row) => row.childCount) ?? [];
  assertEqual(JSON.stringify(actual), JSON.stringify(expected), label);
}

function assertColumnAlignments(table, expected, label) {
  const header = table?.firstChild;
  const actual = header?.content.content.map((cell) => cell.attrs.alignment) ?? [];
  assertEqual(JSON.stringify(actual), JSON.stringify(expected), label);
}

function assertOutsideRootTableExact(before, after) {
  const beforeStart = before.indexOf("| Name | Count | Status | Owner |");
  const beforeEnd = before.indexOf("\n\nBetween root", beforeStart);
  const afterStart = after.indexOf("|", before.indexOf("Before root"));
  const afterEnd = after.indexOf("\n\nBetween root", afterStart);
  assertEqual(after.slice(0, afterStart), before.slice(0, beforeStart), "bytes before root table");
  assertEqual(after.slice(afterEnd), before.slice(beforeEnd), "bytes after root table");
}

function assertPreservedContext(output) {
  for (const exact of [
    "Neighbor <x-unknown keep=\"exact\">syntax</x-unknown> stays byte-exact.",
    "       Ordered item after table stays exact.",
    "    4. Ordered sibling stays exact.",
    "      Task item after table stays exact.",
    "    - [x] Completed sibling stays exact.",
    "> | Column | Value |",
    "    | missing delimiter |",
    "Final paragraph stays byte-exact."
  ]) {
    assertIncludes(output, exact, `preserved context: ${exact}`);
  }
}

function assertIncludes(value, expected, label) {
  if (!value.includes(expected)) throw new Error(`${label}: missing ${JSON.stringify(expected)}`);
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
}
