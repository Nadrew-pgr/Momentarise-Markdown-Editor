import { readFile } from "node:fs/promises";

const rich = await import("../packages/md-rich-prosemirror/dist/index.js");
const save = await import("../packages/md-save/dist/index.js");
const history = await import("prosemirror-history");

const source = await readFile("fixtures/032-table-footnote-editing/input.md", "utf8");
const state = rich.createRichMarkdownState(source, { dialect: "momentarise-enhanced" });
const definitions = topLevelNodes(state).filter((node) => node.type.name === "footnote_definition");
const calloutDefinition = definitions.find((node) => node.attrs.identifier === "callout-child");
assertEqual(calloutDefinition?.child(1).type.name, "callout", "safe callout remains semantic");

for (const identifier of ["table-top", "table-list", "table-task", "table-wide"]) {
  if (!definitions.some((node) => node.attrs.identifier === identifier)) {
    throw new Error(`Safe table definition must be editable: ${identifier}.`);
  }
}
const topDefinition = definitions.find((node) => node.attrs.identifier === "table-top");
const listDefinition = definitions.find((node) => node.attrs.identifier === "table-list");
const taskDefinition = definitions.find((node) => node.attrs.identifier === "table-task");
const wideDefinition = definitions.find((node) => node.attrs.identifier === "table-wide");
const fencedDefinition = definitions.find((node) => node.attrs.identifier === "fenced-existing");

const topTable = topDefinition?.child(1);
assertEqual(topTable?.type.name, "table", "top-level table is semantic");
assertTableShape(topTable, [2, 2, 2], "top-level table shape");
assertTableAlignments(topTable, [["left", "right"], ["left", "right"], ["left", "right"]]);
assertEqual(topTable?.child(2).child(1).firstChild?.child(0).marks[0]?.type.name, "strong", "marked cell stays semantic");

const orderedList = listDefinition?.child(1);
const orderedItem = orderedList?.child(0);
const listTable = orderedItem?.child(1);
assertEqual(orderedList?.type.name, "ordered_list", "ordered table list is semantic");
assertEqual(orderedList?.attrs.order, 3, "ordered table start remains semantic");
assertEqual(orderedItem?.attrs.loose, true, "ordered table item remains loose");
assertEqual(listTable?.type.name, "table", "ordered-item table is semantic");
assertTableShape(listTable, [2, 2, 2], "ordered-item table shape");

const taskList = taskDefinition?.child(1);
const taskItem = taskList?.child(0);
const taskTable = taskItem?.child(1);
assertEqual(taskItem?.type.name, "todo_item", "task table item is semantic");
assertEqual(taskItem?.attrs.checked, false, "task table checked state remains semantic");
assertEqual(taskItem?.attrs.loose, true, "task table item remains loose");
assertEqual(taskTable?.type.name, "table", "task-item table is semantic");
assertTableShape(taskTable, [2, 2, 2], "task-item table shape");
assertTableShape(wideDefinition?.child(1), [8, 8], "wide table shape");

assertEqual(fencedDefinition?.child(1).type.name, "code_block", "existing fenced code remains semantic");
assertEqual(rich.serializeRichMarkdownState(state).content, source, "untouched table-footnote identity");
assertNoExactSourceMetadataInDom(topDefinition);

const topEdited = rich.replaceRichTableCellText(state, {
  columnIndex: 0,
  rowIndex: 1,
  tableIndex: 0,
  text: "edited top"
});
const expectedTopEdit = source.replace("edit top", "edited top");
const topOutput = rich.serializeRichMarkdownState(topEdited).content;
assertEqual(topOutput, expectedTopEdit, "top-level cell edit changes only bounded table source");
assertIncludes(topOutput, "| escaped \\| pipe | **bold stays** |", "escaped and marked sibling cells survive");
assertStableTableShape(topOutput, "edited top", ["footnote_definition", "table", "table_row", "table_cell", "paragraph"]);

const listEdited = rich.replaceRichTableCellText(state, {
  columnIndex: 0,
  rowIndex: 1,
  tableIndex: 1,
  text: "edited list"
});
const expectedListEdit = source.replace("edit list", "edited list");
const listOutput = rich.serializeRichMarkdownState(listEdited).content;
assertEqual(listOutput, expectedListEdit, "ordered-item cell edit changes only bounded list source");
assertStableTableShape(listOutput, "edited list", [
  "footnote_definition",
  "ordered_list",
  "list_item",
  "table",
  "table_row",
  "table_cell",
  "paragraph"
]);

const taskEdited = rich.replaceRichTableCellText(state, {
  columnIndex: 0,
  rowIndex: 1,
  tableIndex: 2,
  text: "edited task"
});
const expectedTaskEdit = source.replace("edit task", "edited task");
const taskOutput = rich.serializeRichMarkdownState(taskEdited).content;
assertEqual(taskOutput, expectedTaskEdit, "task-item cell edit changes only bounded list source");
assertStableTableShape(taskOutput, "edited task", [
  "footnote_definition",
  "bullet_list",
  "todo_item",
  "table",
  "table_row",
  "table_cell",
  "paragraph"
]);

for (const preserved of [
  "    Closing top-level paragraph stays byte-exact.",
  "       Ordered item after table stays exact.",
  "    4. Keep ordered sibling.",
  "      Task item after table stays exact.",
  "    - [x] Keep completed task sibling.",
  'Neighbor <x-unknown keep="exact">syntax</x-unknown> stays byte-exact.',
  "Final paragraph stays byte-exact."
]) {
  assertIncludes(topOutput, preserved, `preserved source ${preserved}`);
}

const selected = rich.selectRichTableCell(state, { columnIndex: 0, rowIndex: 1, tableIndex: 1 });
assertCoordinates(selected, { columnIndex: 0, rowIndex: 1, tableIndex: 1 }, "selected nested table cell");
const tabbed = rich.moveRichTableCell(selected, "next");
assertCoordinates(tabbed, { columnIndex: 1, rowIndex: 1, tableIndex: 1 }, "nested Tab navigation");
const shiftedBack = rich.moveRichTableCell(tabbed, "previous");
assertCoordinates(shiftedBack, { columnIndex: 0, rowIndex: 1, tableIndex: 1 }, "nested Shift+Tab navigation");

const finalCell = rich.selectRichTableCell(state, { columnIndex: 1, rowIndex: 2, tableIndex: 2 });
const appendedRow = rich.moveRichTableCell(finalCell, "next");
assertCoordinates(appendedRow, { columnIndex: 0, rowIndex: 3, tableIndex: 2 }, "nested final-cell Tab target");
const appendedTaskTable = findTableByIndex(appendedRow, 2);
assertTableShape(appendedTaskTable, [2, 2, 2, 2], "nested final-cell Tab appends rectangular row");
const appendedOutput = rich.serializeRichMarkdownState(appendedRow).content;
assertIncludes(appendedOutput, "      |  |  |", "nested appended row serializes with task-item indentation");
assertStableTableShape(appendedOutput, "edit task", [
  "footnote_definition",
  "bullet_list",
  "todo_item",
  "table",
  "table_row",
  "table_cell",
  "paragraph"
]);

const topUndone = applyEditorCommand(topEdited, history.undo);
assertEqual(rich.serializeRichMarkdownState(topUndone).content, source, "one undo restores exact table source");
const topRedone = applyEditorCommand(topUndone, history.redo);
assertEqual(rich.serializeRichMarkdownState(topRedone).content, expectedTopEdit, "one redo restores table edit");
const rowUndone = applyEditorCommand(appendedRow, history.undo);
assertTableShape(findTableByIndex(rowUndone, 2), [2, 2, 2], "one undo removes nested appended row");

const selectedDefinition = rich.selectRichFootnoteDefinition(state, { identifier: "table-list" });
assertEqual(selectedDefinition.editorState.selection.empty, false, "table definition selection remains available");
const replacedDefinition = rich.replaceRichFootnoteDefinitionText(state, {
  identifier: "table-top",
  text: "Whole table definition replaced"
});
assertIncludes(
  rich.serializeRichMarkdownState(replacedDefinition).content,
  "[^table-top]: Whole table definition replaced",
  "whole-definition replacement remains compatible"
);
const renamed = rich.renameRichFootnoteIdentifier(state, {
  identifier: "table-task",
  nextIdentifier: "release-table"
});
assertEqual(renamed.handled, true, "table definition rename handled");
assertEqual(
  rich.serializeRichMarkdownState(renamed.state).content,
  source.replaceAll("[^table-task]", "[^release-table]"),
  "table definition rename changes identifier tokens only"
);

const crlfSource = [
  "Before[^note].",
  "",
  "  [^note]:   Table guidance.",
  "",
  "       | A | B |",
  "       | :--- | ---: |",
  "       | edit | keep |",
  "",
  "After.",
  ""
].join("\r\n");
const crlfState = rich.createRichMarkdownState(crlfSource, { dialect: "momentarise-enhanced" });
const crlfDefinition = topLevelNodes(crlfState).find((node) => node.type.name === "footnote_definition");
assertEqual(crlfDefinition?.child(1).type.name, "table", "CRLF table mounts semantically");
const crlfEdited = rich.replaceRichTableCellText(crlfState, {
  columnIndex: 0,
  rowIndex: 1,
  tableIndex: 0,
  text: "edited"
});
assertEqual(
  rich.serializeRichMarkdownState(crlfEdited).content,
  crlfSource.replace("edit", "edited"),
  "CRLF, prefix spacing, seven-space indentation, and alignments survive"
);

const duplicateSource = [
  "Before[^dup].",
  "",
  "[^dup]: First.",
  "",
  "    | A | B |",
  "    | --- | --- |",
  "    | first | exact |",
  "",
  "[^dup]: Duplicate.",
  "",
  "    | A | B |",
  "    | --- | --- |",
  "    | second | exact |",
  ""
].join("\n");
const duplicateState = rich.createRichMarkdownState(duplicateSource, { dialect: "momentarise-enhanced" });
assertEqual(
  topLevelNodes(duplicateState).filter((node) => node.type.name === "footnote_definition").length,
  0,
  "duplicate table definitions remain source-only"
);
assertEqual(rich.serializeRichMarkdownState(duplicateState).content, duplicateSource, "duplicate table source identity");

const malformedSource = [
  "Before[^bad].",
  "",
  "[^bad]: Intro.",
  "",
  "    | A | B |",
  "    | --- |",
  "    | one | two |",
  ""
].join("\n");
const malformedState = rich.createRichMarkdownState(malformedSource, { dialect: "momentarise-enhanced" });
assertEqual(
  topLevelNodes(malformedState).filter((node) => node.type.name === "footnote_definition").length,
  0,
  "malformed table definition remains whole-definition source-only"
);
assertEqual(
  rich.serializeRichMarkdownState(malformedState).content,
  malformedSource,
  "malformed table definition remains byte-identical without duplicate opaque output"
);

const fallbacks = collectNodesByType(state.editorState.doc, "unsupported_block");
for (const marker of [
  "[^quote-table]:",
  "[^mixed-containers]:",
  "[^unsafe-cell]:",
  "[^raw-child]:",
  "[^nested-container]:"
]) {
  const fallback = fallbacks.find((node) => String(node.attrs.raw ?? "").includes(marker));
  if (!fallback || !/footnote/i.test(String(fallback.attrs.reason ?? ""))) {
    throw new Error(`Expected explicit source-only footnote fallback for ${marker}.`);
  }
}
for (const fallbackText of ["first container", "window.__MME_TABLE_FOOTNOTE_RAN__"]) {
  let rejected = false;
  try {
    rich.replaceFirstRichText(state, fallbackText, `Edited ${fallbackText}`);
  } catch (error) {
    rejected = error instanceof Error && error.message.includes("Could not find rich text");
  }
  assertEqual(rejected, true, `source-only fallback rejects partial Rich edit for ${fallbackText}`);
  assertEqual(rich.serializeRichMarkdownState(state).content, source, "rejected fallback edit leaves source exact");
}

const saveTarget = save.createMemorySaveTarget({ initialContent: source });
const saveEngine = save.createSaveEngine({ content: source, target: saveTarget });
saveEngine.updateContent(listOutput, { now: new Date("2026-07-21T00:00:00.000Z") });
assertEqual(saveEngine.getState().status, "dirty", "table-footnote edit marks save state dirty");
assertEqual(saveEngine.getState().currentHash, save.hashMarkdownContent(listOutput), "table-footnote save hash");
const saved = await saveEngine.flush({ reason: "autosave" });
assertEqual(saved.status, "saved", "table-footnote autosave status");
assertEqual(saveTarget.readContent(), expectedListEdit, "table-footnote autosave content");

function assertStableTableShape(markdown, text, expectedAncestors) {
  const reparsed = rich.createRichMarkdownState(markdown, { dialect: "momentarise-enhanced" });
  assertEqual(rich.serializeRichMarkdownState(reparsed).content, markdown, "reconstructed table source is stable");
  assertEqual(
    JSON.stringify(textAncestorNames(reparsed, text)),
    JSON.stringify(expectedAncestors),
    `table hierarchy survives reparse for ${JSON.stringify(text)}`
  );
}

function textAncestorNames(stateValue, text) {
  let names = null;
  stateValue.editorState.doc.descendants((node, position) => {
    if (!node.isText || typeof node.text !== "string" || !node.text.includes(text)) {
      return true;
    }
    const $position = stateValue.editorState.doc.resolve(position);
    names = [];
    for (let depth = 1; depth <= $position.depth; depth += 1) {
      names.push($position.node(depth).type.name);
    }
    return false;
  });
  if (!names) {
    throw new Error(`Cannot find text ancestors for ${JSON.stringify(text)}.`);
  }
  return names;
}

function applyEditorCommand(stateValue, command) {
  let editorState = stateValue.editorState;
  if (!command(editorState, (transaction) => {
    editorState = editorState.apply(transaction);
  })) {
    throw new Error("Expected editor command to be handled.");
  }
  return { ...stateValue, editorState };
}

function findTableByIndex(stateValue, tableIndex) {
  const tables = collectNodesByType(stateValue.editorState.doc, "table");
  return tables[tableIndex];
}

function topLevelNodes(stateValue) {
  const nodes = [];
  stateValue.editorState.doc.forEach((node) => nodes.push(node));
  return nodes;
}

function collectNodesByType(node, typeName) {
  const nodes = node.type.name === typeName ? [node] : [];
  node.forEach((child) => {
    nodes.push(...collectNodesByType(child, typeName));
  });
  return nodes;
}

function assertTableShape(table, expectedCellCounts, label) {
  const actual = table?.content.content.map((row) => row.childCount) ?? [];
  assertEqual(JSON.stringify(actual), JSON.stringify(expectedCellCounts), label);
}

function assertTableAlignments(table, expected) {
  const actual = table?.content.content.map((row) => row.content.content.map((cell) => cell.attrs.alignment)) ?? [];
  assertEqual(JSON.stringify(actual), JSON.stringify(expected), "table cell alignments");
}

function assertCoordinates(stateValue, expected, label) {
  assertEqual(JSON.stringify(rich.richTableCellCoordinates(stateValue)), JSON.stringify(expected), label);
}

function assertNoExactSourceMetadataInDom(node) {
  const dom = node?.type.spec.toDOM?.(node);
  const serialized = JSON.stringify(dom);
  for (const forbidden of ["blockSources", "blockFingerprints", "paragraphSources", "paragraphFingerprints"]) {
    if (serialized.includes(forbidden)) {
      throw new Error(`Exact source metadata must remain out of rendered DOM: ${forbidden}.`);
    }
  }
}

function assertIncludes(value, expected, label) {
  if (!value.includes(expected)) {
    throw new Error(`${label}: missing ${JSON.stringify(expected)}.\n${value}`);
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}.`);
  }
}
