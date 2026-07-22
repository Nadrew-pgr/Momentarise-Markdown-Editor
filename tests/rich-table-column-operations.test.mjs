import { readFile } from "node:fs/promises";

const rich = await import("../packages/md-rich-prosemirror/dist/index.js");
const save = await import("../packages/md-save/dist/index.js");
const history = await import("prosemirror-history");

if (typeof rich.runRichTableColumnOperation !== "function") {
  throw new Error("Missing MME-0073 rich table-column export: runRichTableColumnOperation");
}

const expectedCommands = ["tableColumnBefore", "tableColumnAfter", "tableColumnDelete"];
for (const commandId of expectedCommands) {
  if (!rich.richCommandRegistry.some((command) => command.id === commandId)) {
    throw new Error(`Missing MME-0073 rich command: ${commandId}`);
  }
}
assertEqual(
  JSON.stringify(rich.filterRichMarkdownCommands("column").map((command) => command.id)),
  JSON.stringify(expectedCommands),
  "column command search order"
);

const source = await readFile("fixtures/037-table-column-operations/input.md", "utf8");
const state = rich.createRichMarkdownState(source, { dialect: "momentarise-enhanced" });
assertEqual(rich.serializeRichMarkdownState(state).content, source, "untouched fixture identity");
assertTableCount(state, 6, "supported root/direct/ordered/task/single/wide tables");

const insertedBefore = rich.runRichTableColumnOperation(state, {
  columnIndex: 1,
  operation: "insert-before",
  rowIndex: 1,
  tableIndex: 0
});
assertEqual(insertedBefore.handled, true, "insert before handled");
assertEqual(insertedBefore.reason, null, "insert before reason");
assertCoordinates(insertedBefore.state, { columnIndex: 1, rowIndex: 1, tableIndex: 0 }, "inserted-before selection");
assertTableShape(findTable(insertedBefore.state, 0), [4, 4, 4], "insert before rectangular shape");
assertColumnTypes(findTable(insertedBefore.state, 0), 1, ["table_header", "table_cell", "table_cell"], "insert-before cell types");
assertColumnAlignments(findTable(insertedBefore.state, 0), 1, [null, null, null], "insert-before neutral alignment");
const beforeOutput = rich.serializeRichMarkdownState(insertedBefore.state).content;
assertIncludes(beforeOutput, "| Name |  | Count | Status |\n| :--- | --- | ---: | :---: |", "insert-before Markdown");
assertIncludes(beforeOutput, "| alpha |  | 1 | draft |", "insert-before body cells");
assertOutsideRootTableExact(source, beforeOutput);

const beforeUndone = applyEditorCommand(insertedBefore.state, history.undo);
assertEqual(rich.serializeRichMarkdownState(beforeUndone).content, source, "one undo restores exact pre-insert source");
const beforeRedone = applyEditorCommand(beforeUndone, history.redo);
assertEqual(rich.serializeRichMarkdownState(beforeRedone).content, beforeOutput, "redo restores insert-before output");

const insertedAfter = rich.runRichTableColumnOperation(state, {
  columnIndex: 1,
  operation: "insert-after",
  rowIndex: 2,
  tableIndex: 0
});
assertEqual(insertedAfter.handled, true, "insert after handled");
assertCoordinates(insertedAfter.state, { columnIndex: 2, rowIndex: 2, tableIndex: 0 }, "inserted-after selection");
assertIncludes(
  rich.serializeRichMarkdownState(insertedAfter.state).content,
  "| Name | Count |  | Status |\n| :--- | ---: | --- | :---: |",
  "insert-after Markdown"
);

const deleted = rich.runRichTableColumnOperation(state, {
  columnIndex: 1,
  operation: "delete",
  rowIndex: 1,
  tableIndex: 0
});
assertEqual(deleted.handled, true, "delete handled");
assertCoordinates(deleted.state, { columnIndex: 1, rowIndex: 1, tableIndex: 0 }, "delete nearest selection on same row");
const deletedOutput = rich.serializeRichMarkdownState(deleted.state).content;
assertIncludes(deletedOutput, "| Name | Status |\n| :--- | :---: |", "deleted middle column Markdown");
assertNotIncludes(deletedOutput, "| alpha | 1 | draft |", "deleted middle body value removed");
assertIncludes(deletedOutput, "| beta | **ready** |", "untouched marked cell retained");
assertOutsideRootTableExact(source, deletedOutput);

const deletedLast = rich.runRichTableColumnOperation(state, {
  columnIndex: 2,
  operation: "delete",
  rowIndex: 2,
  tableIndex: 0
});
assertEqual(deletedLast.handled, true, "delete final column handled");
assertCoordinates(deletedLast.state, { columnIndex: 1, rowIndex: 2, tableIndex: 0 }, "delete final column selects nearest surviving column");

const oneColumnDelete = rich.runRichTableColumnOperation(state, {
  columnIndex: 0,
  operation: "delete",
  rowIndex: 1,
  tableIndex: 4
});
assertRejected(oneColumnDelete, state, "last-column-protected", "only-column refusal");
const oneColumnSelected = rich.selectRichTableCell(state, { columnIndex: 0, rowIndex: 1, tableIndex: 4 });
assertEqual(rich.canRunRichMarkdownCommand(oneColumnSelected, "tableColumnDelete"), false, "delete unavailable in one-column table");
assertEqual(rich.canRunRichMarkdownCommand(oneColumnSelected, "tableColumnAfter"), true, "insert available in one-column table");

assertRejected(
  rich.runRichTableColumnOperation(state, { columnIndex: 50, operation: "delete", rowIndex: 1, tableIndex: 0 }),
  state,
  "cell-not-found",
  "missing column refusal"
);
assertRejected(
  rich.runRichTableColumnOperation(state, { columnIndex: 0, operation: "delete", rowIndex: 50, tableIndex: 0 }),
  state,
  "row-not-found",
  "missing row refusal"
);
assertRejected(
  rich.runRichTableColumnOperation(state, { columnIndex: 0, operation: "delete", rowIndex: 1, tableIndex: 50 }),
  state,
  "table-not-found",
  "missing table refusal"
);
const stale = { ...state, source: source.replace("alpha", "external alpha") };
assertRejected(
  rich.runRichTableColumnOperation(stale, { columnIndex: 0, operation: "delete", rowIndex: 1, tableIndex: 0 }),
  stale,
  "stale-source",
  "stale source refusal"
);

const paragraphState = rich.createRichMarkdownState("Outside table.\n");
assertEqual(rich.canRunRichMarkdownCommand(paragraphState, "tableColumnAfter"), false, "column command unavailable outside table");
const outsideCommand = rich.runRichMarkdownCommand(paragraphState, "tableColumnAfter");
assertEqual(outsideCommand.handled, false, "column command unhandled outside table");
assertEqual(outsideCommand.state, paragraphState, "outside-table command preserves state identity");

const selectedBody = rich.selectRichTableCell(state, { columnIndex: 1, rowIndex: 1, tableIndex: 0 });
assertEqual(rich.canRunRichMarkdownCommand(selectedBody, "tableColumnBefore"), true, "column command available in body cell");
const registryInsert = rich.runRichMarkdownCommand(selectedBody, "tableColumnAfter");
assertEqual(registryInsert.handled, true, "registry insert command handled");
assertCoordinates(registryInsert.state, { columnIndex: 2, rowIndex: 1, tableIndex: 0 }, "registry command selection");
const selectedHeader = rich.selectRichTableCell(state, { columnIndex: 1, rowIndex: 0, tableIndex: 0 });
assertEqual(rich.canRunRichMarkdownCommand(selectedHeader, "tableColumnDelete"), true, "column command available in header cell");
assertEqual(rich.runRichMarkdownCommand(selectedHeader, "tableColumnDelete").handled, true, "header-selected column command handled");

for (const [tableIndex, headerText, expectedIndent] of [
  [1, "Item", "    | Item |  | Value |"],
  [2, "Key", "       | Key |  | State |"],
  [3, "Action", "      | Action |  | Status |"]
]) {
  const nested = rich.runRichTableColumnOperation(state, {
    columnIndex: 0,
    operation: "insert-after",
    rowIndex: 1,
    tableIndex
  });
  assertEqual(nested.handled, true, `nested insert handled for table ${tableIndex}`);
  assertCoordinates(nested.state, { columnIndex: 1, rowIndex: 1, tableIndex }, `nested selection ${tableIndex}`);
  const output = rich.serializeRichMarkdownState(nested.state).content;
  assertIncludes(output, expectedIndent, `nested empty column indentation ${tableIndex}`);
  assertIncludes(output, headerText, `nested header retained ${tableIndex}`);
  assertPreservedContext(output);
}

const crlfSource = source.replaceAll("\n", "\r\n");
const crlfState = rich.createRichMarkdownState(crlfSource, { dialect: "momentarise-enhanced" });
const crlfInserted = rich.runRichTableColumnOperation(crlfState, {
  columnIndex: 0,
  operation: "insert-before",
  rowIndex: 1,
  tableIndex: 3
});
assertEqual(crlfInserted.handled, true, "CRLF nested insertion handled");
const crlfOutput = rich.serializeRichMarkdownState(crlfInserted.state).content;
if (/(^|[^\r])\n/.test(crlfOutput)) {
  throw new Error(`CRLF column operation introduced lone LF bytes.\n${JSON.stringify(crlfOutput)}`);
}
assertIncludes(crlfOutput, "      |  | Action | Status |\r\n      | --- | --- | ---: |", "CRLF nested column position");

const rowAfterColumn = rich.runRichTableRowOperation(insertedBefore.state, {
  columnIndex: 1,
  operation: "insert-after",
  rowIndex: 1,
  tableIndex: 0
});
assertEqual(rowAfterColumn.handled, true, "row operation remains compatible after column insert");
assertTableShape(findTable(rowAfterColumn.state, 0), [4, 4, 4, 4], "row after column remains rectangular");
const finalCell = rich.selectRichTableCell(insertedBefore.state, { columnIndex: 3, rowIndex: 2, tableIndex: 0 });
const tabAppended = rich.moveRichTableCell(finalCell, "next");
assertTableShape(findTable(tabAppended, 0), [4, 4, 4, 4], "final-cell Tab remains compatible after column insert");

const saveTarget = save.createMemorySaveTarget({ initialContent: source });
const saveEngine = save.createSaveEngine({ content: source, target: saveTarget });
saveEngine.updateContent(beforeOutput, { now: new Date("2026-07-22T00:00:00.000Z") });
assertEqual(saveEngine.getState().status, "dirty", "column operation marks save dirty");
const saved = await saveEngine.flush({ reason: "autosave" });
assertEqual(saved.status, "saved", "column operation autosave succeeds");
assertEqual(saveTarget.readContent(), beforeOutput, "saved bytes equal Source Markdown");

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

function assertColumnTypes(table, columnIndex, expected, label) {
  const actual = table?.content.content.map((row) => row.child(columnIndex).type.name) ?? [];
  assertEqual(JSON.stringify(actual), JSON.stringify(expected), label);
}

function assertColumnAlignments(table, columnIndex, expected, label) {
  const actual = table?.content.content.map((row) => row.child(columnIndex).attrs.alignment) ?? [];
  assertEqual(JSON.stringify(actual), JSON.stringify(expected), label);
}

function assertOutsideRootTableExact(before, after) {
  const beforeStart = before.indexOf("| Name | Count | Status |");
  const beforeEnd = before.indexOf("\n\nBetween root", beforeStart);
  const afterStart = after.indexOf("| Name");
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

function assertNotIncludes(value, unexpected, label) {
  if (value.includes(unexpected)) throw new Error(`${label}: found ${JSON.stringify(unexpected)}`);
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
}
