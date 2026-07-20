const rich = await import("../packages/md-rich-prosemirror/dist/index.js");
const save = await import("../packages/md-save/dist/index.js");
const history = await import("prosemirror-history");

for (const exportName of ["moveRichTableCell", "replaceRichTableCellText", "richTableCellCoordinates", "selectRichTableCell"]) {
  if (typeof rich[exportName] !== "function") {
    throw new Error(`Missing MME-0055 rich table export: ${exportName}`);
  }
}

const source = [
  "# Rich table",
  "",
  "Before table stays exact.",
  "",
  "| Name | Status |",
  "| :-- | --: |",
  "| Alpha | draft |",
  "| Beta | **done** |",
  "",
  "After table stays exact.",
  ""
].join("\n");

const state = rich.createRichMarkdownState(source, { dialect: "momentarise-enhanced" });
assertRootTypes(state, ["heading", "paragraph", "table", "paragraph"], "supported GFM table must mount as editable table");
assertTableShape(state, [2, 2, 2], "supported table shape");
assertTableCellTypes(state, [["table_header", "table_header"], ["table_cell", "table_cell"], ["table_cell", "table_cell"]]);
assertEqual(rich.serializeRichMarkdownState(state).content, source, "untouched supported table must remain byte-identical");

const edited = rich.replaceRichTableCellText(state, {
  columnIndex: 1,
  rowIndex: 1,
  text: "ready | reviewed"
});
const editedOutput = rich.serializeRichMarkdownState(edited).content;
assertIncludes(editedOutput, "| Alpha | ready \\| reviewed |", "edited table cell must escape Markdown pipe syntax");
assertIncludes(editedOutput, "| Beta | **done** |", "unrelated marked table cell must preserve inline Markdown");
assertIncludes(editedOutput, "| :--- | ---: |", "edited table must preserve left/right alignment semantics");
assertOutsideTableUnchanged(source, editedOutput);
const undoneEdit = applyEditorCommand(edited, history.undo);
assertEqual(rich.serializeRichMarkdownState(undoneEdit).content, source, "undo must restore the exact original table bytes");
const redoneEdit = applyEditorCommand(undoneEdit, history.redo);
assertEqual(rich.serializeRichMarkdownState(redoneEdit).content, editedOutput, "redo must restore the edited table Markdown");

const remounted = rich.createRichMarkdownState(editedOutput, { dialect: "momentarise-enhanced" });
assertRootTypes(remounted, ["heading", "paragraph", "table", "paragraph"], "edited Markdown must remount as a supported table");
assertTableShape(remounted, [2, 2, 2], "edited table must keep its rectangular shape");

const selected = rich.selectRichTableCell(state, { columnIndex: 0, rowIndex: 1 });
assertCoordinates(selected, { columnIndex: 0, rowIndex: 1 }, "selected body cell");
const tabbed = rich.moveRichTableCell(selected, "next");
assertCoordinates(tabbed, { columnIndex: 1, rowIndex: 1 }, "Tab must move to the next cell");
const shiftedBack = rich.moveRichTableCell(tabbed, "previous");
assertCoordinates(shiftedBack, { columnIndex: 0, rowIndex: 1 }, "Shift+Tab must move to the previous cell");

const finalCell = rich.selectRichTableCell(state, { columnIndex: 1, rowIndex: 2 });
const appendedRow = rich.moveRichTableCell(finalCell, "next");
assertCoordinates(appendedRow, { columnIndex: 0, rowIndex: 3 }, "Tab from final cell must move into one appended row");
assertTableShape(appendedRow, [2, 2, 2, 2], "final-cell Tab must append one rectangular row");
const appendedOutput = rich.serializeRichMarkdownState(appendedRow).content;
assertIncludes(appendedOutput, "|  |  |", "appended row must serialize as a Markdown-representable row");
assertOutsideTableUnchanged(source, appendedOutput);
const undoneRow = applyEditorCommand(appendedRow, history.undo);
assertTableShape(undoneRow, [2, 2, 2], "undo must remove the appended row");
const redoneRow = applyEditorCommand(undoneRow, history.redo);
assertTableShape(redoneRow, [2, 2, 2, 2], "redo must restore the appended row");

const multiTableSource = [
  "| First | Keep |",
  "| --- | --- |",
  "| one | exact |",
  "",
  "Bridge stays exact.",
  "",
  "| Second | Edit |",
  "| :--- | ---: |",
  "| two | now |",
  ""
].join("\r\n");
const multiTableEdited = rich.replaceRichTableCellText(
  rich.createRichMarkdownState(multiTableSource, { dialect: "momentarise-enhanced" }),
  { columnIndex: 1, rowIndex: 1, tableIndex: 1, text: "later" }
);
const multiTableOutput = rich.serializeRichMarkdownState(multiTableEdited).content;
assertIncludes(multiTableOutput, "| First | Keep |\r\n| --- | --- |\r\n| one | exact |", "first table must stay exact");
assertIncludes(multiTableOutput, "\r\n\r\nBridge stays exact.\r\n\r\n", "bytes between tables must stay exact");
assertIncludes(multiTableOutput, "| Second | Edit |\r\n| :--- | ---: |\r\n| two | later |", "second table edit must keep CRLF");
if (/(^|[^\r])\n/.test(multiTableOutput)) {
  throw new Error(`CRLF table edit must not introduce lone LF bytes.\n${JSON.stringify(multiTableOutput)}`);
}

const headerOnly = rich.selectRichTableCell(
  rich.createRichMarkdownState("| Name |\n| :--- |\n", { dialect: "momentarise-enhanced" }),
  { columnIndex: 0, rowIndex: 0 }
);
const headerOnlyAppended = rich.moveRichTableCell(headerOnly, "next");
assertTableShape(headerOnlyAppended, [1, 1], "final-cell Tab must append a body row to a header-only table");
assertTableCellTypes(headerOnlyAppended, [["table_header"], ["table_cell"]]);
assertTableCellAlignments(headerOnlyAppended, [["left"], ["left"]]);

const malformedSource = [
  "# Malformed table",
  "",
  "| broken | table-like |",
  "| missing delimiter |",
  "| too | many | cells |",
  ""
].join("\n");
const malformed = rich.createRichMarkdownState(malformedSource, { dialect: "momentarise-enhanced" });
assertRootTypes(malformed, ["heading", "unsupported_block"], "malformed table must remain source-only");
assertEqual(rich.serializeRichMarkdownState(malformed).content, malformedSource, "malformed table must remain byte-identical");

const nestedTableSource = [
  "> Before nested table.",
  ">",
  "> | Nested | Table |",
  "> | --- | --- |",
  "> | stays | source-only |",
  ">",
  "> After nested table.",
  ""
].join("\n");
const nestedTable = rich.createRichMarkdownState(nestedTableSource, { dialect: "momentarise-enhanced" });
const nestedBlockquote = nestedTable.editorState.doc.firstChild;
assertEqual(
  JSON.stringify(nestedBlockquote?.content.content.map((node) => node.type.name)),
  JSON.stringify(["paragraph", "unsupported_block", "paragraph"]),
  "nested table must stay explicit source-only until nested-range serialization is available"
);
assertEqual(rich.serializeRichMarkdownState(nestedTable).content, nestedTableSource, "nested table fallback must remain byte-identical");

const saveTarget = save.createMemorySaveTarget({ initialContent: source });
const saveEngine = save.createSaveEngine({ content: source, target: saveTarget });
saveEngine.updateContent(editedOutput, { now: new Date("2026-07-20T00:00:00.000Z") });
assertEqual(saveEngine.getState().status, "dirty", "rich table edit must mark save state dirty");
assertEqual(saveEngine.getState().currentHash, save.hashMarkdownContent(editedOutput), "dirty save hash must match edited Markdown");
const saved = await saveEngine.flush({ reason: "autosave" });
assertEqual(saved.status, "saved", "rich table autosave must persist successfully");
assertEqual(saveTarget.readContent(), editedOutput, "autosave must persist the serialized Markdown table");

function applyEditorCommand(state, command) {
  let editorState = state.editorState;
  if (!command(editorState, (transaction) => {
    editorState = editorState.apply(transaction);
  })) {
    throw new Error("Expected editor command to be handled.");
  }
  return { ...state, editorState };
}

function assertCoordinates(state, expected, label) {
  assertEqual(rich.richTableCellCoordinates(state)?.rowIndex, expected.rowIndex, `${label}: row`);
  assertEqual(rich.richTableCellCoordinates(state)?.columnIndex, expected.columnIndex, `${label}: column`);
}

function assertOutsideTableUnchanged(before, after) {
  const beforeStart = before.indexOf("| Name | Status |");
  const beforeEnd = before.indexOf("\n\nAfter table stays exact.", beforeStart);
  const afterStart = after.indexOf("| Name | Status |");
  const afterEnd = after.indexOf("\n\nAfter table stays exact.", afterStart);
  assertEqual(after.slice(0, afterStart), before.slice(0, beforeStart), "bytes before edited table must stay exact");
  assertEqual(after.slice(afterEnd), before.slice(beforeEnd), "bytes after edited table must stay exact");
}

function assertRootTypes(state, expected, label) {
  const actual = [];
  state.editorState.doc.forEach((node) => actual.push(node.type.name));
  assertEqual(JSON.stringify(actual), JSON.stringify(expected), label);
}

function assertTableShape(state, expectedCellCounts, label) {
  const table = state.editorState.doc.content.content.find((node) => node.type.name === "table");
  if (!table) {
    throw new Error(`${label}: missing table node.\n${JSON.stringify(state.editorState.doc.toJSON(), null, 2)}`);
  }
  const actual = table.content.content.map((row) => row.childCount);
  assertEqual(JSON.stringify(actual), JSON.stringify(expectedCellCounts), label);
}

function assertTableCellTypes(state, expected) {
  const table = state.editorState.doc.content.content.find((node) => node.type.name === "table");
  const actual = table?.content.content.map((row) => row.content.content.map((cell) => cell.type.name)) ?? [];
  assertEqual(JSON.stringify(actual), JSON.stringify(expected), "table header/body cell types");
}

function assertTableCellAlignments(state, expected) {
  const table = state.editorState.doc.content.content.find((node) => node.type.name === "table");
  const actual = table?.content.content.map((row) => row.content.content.map((cell) => cell.attrs.alignment)) ?? [];
  assertEqual(JSON.stringify(actual), JSON.stringify(expected), "table cell alignments");
}

function assertIncludes(content, expected, label) {
  if (!content.includes(expected)) {
    throw new Error(`${label}: missing ${JSON.stringify(expected)}.\n${content}`);
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}.`);
  }
}
