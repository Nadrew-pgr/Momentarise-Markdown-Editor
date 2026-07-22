import { readFile } from "node:fs/promises";

const rich = await import("../packages/md-rich-prosemirror/dist/index.js");
const save = await import("../packages/md-save/dist/index.js");
const history = await import("prosemirror-history");

for (const exportName of ["canRunRichMarkdownCommand", "runRichTableRowOperation"]) {
  if (typeof rich[exportName] !== "function") {
    throw new Error(`Missing MME-0072 rich table-row export: ${exportName}`);
  }
}

const expectedCommands = ["tableRowBefore", "tableRowAfter", "tableRowDelete"];
for (const commandId of expectedCommands) {
  if (!rich.richCommandRegistry.some((command) => command.id === commandId)) {
    throw new Error(`Missing MME-0072 rich command: ${commandId}`);
  }
}
assertEqual(
  JSON.stringify(rich.filterRichMarkdownCommands("row").map((command) => command.id)),
  JSON.stringify([...expectedCommands, "tableRowUp", "tableRowDown"]),
  "row command search order"
);

const source = await readFile("fixtures/036-table-row-operations/input.md", "utf8");
const state = rich.createRichMarkdownState(source, { dialect: "momentarise-enhanced" });
assertEqual(rich.serializeRichMarkdownState(state).content, source, "untouched fixture identity");
assertTableCount(state, 5, "supported top/direct/ordered/task/wide tables");

const insertedBefore = rich.runRichTableRowOperation(state, {
  columnIndex: 1,
  operation: "insert-before",
  rowIndex: 1,
  tableIndex: 0
});
assertEqual(insertedBefore.handled, true, "insert before handled");
assertEqual(insertedBefore.reason, null, "insert before reason");
assertCoordinates(insertedBefore.state, { columnIndex: 1, rowIndex: 1, tableIndex: 0 }, "inserted-before selection");
assertTableShape(findTable(insertedBefore.state, 0), [2, 2, 2, 2], "insert before rectangular shape");
assertBodyRow(findTable(insertedBefore.state, 0), 1, ["left", "right"], "insert-before body/alignment");
const beforeOutput = rich.serializeRichMarkdownState(insertedBefore.state).content;
assertIncludes(beforeOutput, "| :--- | ---: |\n|  |  |\n| alpha | draft |", "insert-before Markdown");
assertOutsideRootTableExact(source, beforeOutput);

const beforeUndone = applyEditorCommand(insertedBefore.state, history.undo);
assertEqual(rich.serializeRichMarkdownState(beforeUndone).content, source, "one undo restores exact pre-insert source");
const beforeRedone = applyEditorCommand(beforeUndone, history.redo);
assertEqual(rich.serializeRichMarkdownState(beforeRedone).content, beforeOutput, "redo restores insert-before output");

const insertedAfter = rich.runRichTableRowOperation(state, {
  columnIndex: 1,
  operation: "insert-after",
  rowIndex: 1,
  tableIndex: 0
});
assertEqual(insertedAfter.handled, true, "insert after handled");
assertCoordinates(insertedAfter.state, { columnIndex: 1, rowIndex: 2, tableIndex: 0 }, "inserted-after selection");
assertIncludes(
  rich.serializeRichMarkdownState(insertedAfter.state).content,
  "| alpha | draft |\n|  |  |\n| beta | **ready** |",
  "insert-after Markdown"
);

const deleted = rich.runRichTableRowOperation(state, {
  columnIndex: 1,
  operation: "delete",
  rowIndex: 1,
  tableIndex: 0
});
assertEqual(deleted.handled, true, "delete handled");
assertCoordinates(deleted.state, { columnIndex: 1, rowIndex: 1, tableIndex: 0 }, "delete nearest selection");
const deletedOutput = rich.serializeRichMarkdownState(deleted.state).content;
assertNotIncludes(deletedOutput, "| alpha | draft |", "deleted row removed");
assertIncludes(deletedOutput, "| beta | **ready** |", "untouched marked row retained");
assertOutsideRootTableExact(source, deletedOutput);

const deletedLast = rich.runRichTableRowOperation(state, {
  columnIndex: 1,
  operation: "delete",
  rowIndex: 2,
  tableIndex: 0
});
assertEqual(deletedLast.handled, true, "delete final body row handled");
assertCoordinates(deletedLast.state, { columnIndex: 1, rowIndex: 1, tableIndex: 0 }, "delete final body row selects nearest surviving cell");
assertIncludes(rich.serializeRichMarkdownState(deletedLast.state).content, "| alpha | draft |", "preceding row retained after final-row delete");
assertNotIncludes(rich.serializeRichMarkdownState(deletedLast.state).content, "| beta | **ready** |", "final row removed");

const oneBodySource = "| Head | Value |\n| :--- | ---: |\n| only | row |\n";
const oneBodyState = rich.createRichMarkdownState(oneBodySource, { dialect: "momentarise-enhanced" });
const headerOnly = rich.runRichTableRowOperation(oneBodyState, {
  operation: "delete",
  rowIndex: 1,
  tableIndex: 0
});
assertEqual(headerOnly.handled, true, "sole body row deletion handled");
assertTableShape(findTable(headerOnly.state, 0), [2], "header-only table remains valid");
assertCoordinates(headerOnly.state, { columnIndex: 0, rowIndex: 0, tableIndex: 0 }, "header-only selection");
assertEqual(
  rich.serializeRichMarkdownState(headerOnly.state).content,
  "| Head | Value |\n| :--- | ---: |\n",
  "header-only deterministic Markdown"
);

for (const operation of ["insert-before", "insert-after", "delete"]) {
  const refused = rich.runRichTableRowOperation(state, { operation, rowIndex: 0, tableIndex: 0 });
  assertRejected(refused, state, "header-row-protected", `${operation} header refusal`);
}
assertRejected(
  rich.runRichTableRowOperation(state, { operation: "delete", rowIndex: 50, tableIndex: 0 }),
  state,
  "row-not-found",
  "missing row refusal"
);
assertRejected(
  rich.runRichTableRowOperation(state, { operation: "delete", rowIndex: 1, tableIndex: 50 }),
  state,
  "table-not-found",
  "missing table refusal"
);
const stale = { ...state, source: source.replace("alpha", "external alpha") };
assertRejected(
  rich.runRichTableRowOperation(stale, { operation: "delete", rowIndex: 1, tableIndex: 0 }),
  stale,
  "stale-source",
  "stale source refusal"
);

const paragraphState = rich.createRichMarkdownState("Outside table.\n");
assertEqual(rich.canRunRichMarkdownCommand(paragraphState, "tableRowAfter"), false, "row command unavailable outside table");
const outsideCommand = rich.runRichMarkdownCommand(paragraphState, "tableRowAfter");
assertEqual(outsideCommand.handled, false, "row command unhandled outside table");
assertEqual(outsideCommand.state, paragraphState, "outside-table command preserves state identity");

const selectedBody = rich.selectRichTableCell(state, { columnIndex: 0, rowIndex: 1, tableIndex: 0 });
assertEqual(rich.canRunRichMarkdownCommand(selectedBody, "tableRowBefore"), true, "row command available in body cell");
const registryInsert = rich.runRichMarkdownCommand(selectedBody, "tableRowAfter");
assertEqual(registryInsert.handled, true, "registry insert command handled");
assertCoordinates(registryInsert.state, { columnIndex: 0, rowIndex: 2, tableIndex: 0 }, "registry command selection");
const selectedHeader = rich.selectRichTableCell(state, { columnIndex: 0, rowIndex: 0, tableIndex: 0 });
assertEqual(rich.canRunRichMarkdownCommand(selectedHeader, "tableRowDelete"), false, "row command unavailable in header");
assertEqual(rich.runRichMarkdownCommand(selectedHeader, "tableRowDelete").handled, false, "header command unhandled");

for (const [tableIndex, rowText, expectedIndent] of [
  [1, "direct one", "    |  |  |"],
  [2, "ordered one", "       |  |  |"],
  [3, "task one", "      |  |  |"]
]) {
  const nested = rich.runRichTableRowOperation(state, {
    columnIndex: 0,
    operation: "insert-after",
    rowIndex: 1,
    tableIndex
  });
  assertEqual(nested.handled, true, `nested insert handled for table ${tableIndex}`);
  assertCoordinates(nested.state, { columnIndex: 0, rowIndex: 2, tableIndex }, `nested selection ${tableIndex}`);
  const output = rich.serializeRichMarkdownState(nested.state).content;
  assertIncludes(output, `${rowText.includes("ordered") ? "       " : rowText.includes("task") ? "      " : "    "}| ${rowText} |`, `original nested row ${tableIndex}`);
  assertIncludes(output, expectedIndent, `nested empty row indentation ${tableIndex}`);
  assertPreservedContext(output);
}

const crlfSource = source.replaceAll("\n", "\r\n");
const crlfState = rich.createRichMarkdownState(crlfSource, { dialect: "momentarise-enhanced" });
const crlfInserted = rich.runRichTableRowOperation(crlfState, {
  operation: "insert-before",
  rowIndex: 2,
  tableIndex: 3
});
assertEqual(crlfInserted.handled, true, "CRLF nested insertion handled");
const crlfOutput = rich.serializeRichMarkdownState(crlfInserted.state).content;
if (/(^|[^\r])\n/.test(crlfOutput)) {
  throw new Error(`CRLF row operation introduced lone LF bytes.\n${JSON.stringify(crlfOutput)}`);
}
assertIncludes(crlfOutput, "      |  |  |\r\n      | task two | exact |", "CRLF nested row position");

const finalCell = rich.selectRichTableCell(state, { columnIndex: 1, rowIndex: 2, tableIndex: 0 });
const tabAppended = rich.moveRichTableCell(finalCell, "next");
assertTableShape(findTable(tabAppended, 0), [2, 2, 2, 2], "final-cell Tab remains compatible");
assertBodyRow(findTable(tabAppended, 0), 3, ["left", "right"], "Tab append body/alignment");

const saveTarget = save.createMemorySaveTarget({ initialContent: source });
const saveEngine = save.createSaveEngine({ content: source, target: saveTarget });
saveEngine.updateContent(beforeOutput, { now: new Date("2026-07-22T00:00:00.000Z") });
assertEqual(saveEngine.getState().status, "dirty", "row operation marks save dirty");
const saved = await saveEngine.flush({ reason: "autosave" });
assertEqual(saved.status, "saved", "row operation autosave succeeds");
assertEqual(saveTarget.readContent(), beforeOutput, "saved bytes equal Source Markdown");

function applyEditorCommand(state, command) {
  let editorState = state.editorState;
  if (!command(editorState, (transaction) => {
    editorState = editorState.apply(transaction);
  })) {
    throw new Error("Expected editor command to be handled.");
  }
  return { ...state, editorState };
}

function assertRejected(result, originalState, reason, label) {
  assertEqual(result.handled, false, `${label}: handled`);
  assertEqual(result.reason, reason, `${label}: reason`);
  assertEqual(result.state, originalState, `${label}: state identity`);
}

function assertCoordinates(state, expected, label) {
  const actual = rich.richTableCellCoordinates(state);
  assertEqual(JSON.stringify(actual), JSON.stringify(expected), label);
}

function assertTableCount(state, expected, label) {
  let count = 0;
  state.editorState.doc.descendants((node) => {
    if (node.type.name === "table") count += 1;
    return true;
  });
  assertEqual(count, expected, label);
}

function findTable(state, tableIndex) {
  let currentIndex = 0;
  let found = null;
  state.editorState.doc.descendants((node) => {
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

function assertBodyRow(table, rowIndex, expectedAlignments, label) {
  const row = table?.child(rowIndex);
  const types = row?.content.content.map((cell) => cell.type.name) ?? [];
  const alignments = row?.content.content.map((cell) => cell.attrs.alignment) ?? [];
  assertEqual(JSON.stringify(types), JSON.stringify(expectedAlignments.map(() => "table_cell")), `${label}: types`);
  assertEqual(JSON.stringify(alignments), JSON.stringify(expectedAlignments), `${label}: alignments`);
}

function assertOutsideRootTableExact(before, after) {
  const beforeStart = before.indexOf("| Name | Status |");
  const beforeEnd = before.indexOf("\n\nBetween root", beforeStart);
  const afterStart = after.indexOf("| Name | Status |");
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
