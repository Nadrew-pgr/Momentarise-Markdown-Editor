import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const rich = await import("../packages/md-rich-prosemirror/dist/index.js");
const save = await import("../packages/md-save/dist/index.js");
const history = await import("prosemirror-history");

assert.equal(typeof rich.runRichTableMatrixPaste, "function", "MME-0075 public matrix-paste API");

const source = await readFile("fixtures/039-table-spreadsheet-paste/input.md", "utf8");
const state = rich.createRichMarkdownState(source, { dialect: "momentarise-enhanced" });
assert.equal(rich.serializeRichMarkdownState(state).content, source, "untouched fixture identity");
assert.equal(tableCount(state), 5, "supported root/direct/ordered/task/wide tables");

const expanded = rich.runRichTableMatrixPaste(state, {
  columnIndex: 3,
  rowIndex: 2,
  tableIndex: 0,
  text: "north\t\tsouth\r\n10\t20\t30\r\n40\t50\t60\r\n"
});
assert.equal(expanded.handled, true);
assert.equal(expanded.reason, null);
assert.equal(expanded.rows, 3);
assert.equal(expanded.columns, 3);
assert.deepEqual(rich.richTableCellCoordinates(expanded.state), { columnIndex: 5, rowIndex: 4, tableIndex: 0 });
assert.deepEqual(tableShape(tableAt(expanded.state, 0)), [6, 6, 6, 6, 6]);
assert.deepEqual(columnTypes(tableAt(expanded.state, 0), 4), ["table_header", "table_cell", "table_cell", "table_cell", "table_cell"]);
assert.deepEqual(columnAlignments(tableAt(expanded.state, 0)), ["left", "right", "center", null, null, null]);
const expandedOutput = rich.serializeRichMarkdownState(expanded.state).content;
includes(expandedOutput, "| beta | 2 | **ready** | north |  | south |", "empty cells retained");
includes(expandedOutput, "|  |  |  | 40 | 50 | 60 |", "appended body row");
assertOutsideRootTableExact(source, expandedOutput);

const undone = applyEditorCommand(expanded.state, history.undo);
assert.equal(rich.serializeRichMarkdownState(undone).content, source, "one undo restores exact source");
const redone = applyEditorCommand(undone, history.redo);
assert.equal(rich.serializeRichMarkdownState(redone).content, expandedOutput, "redo restores matrix");

const selected = rich.selectRichTableCell(state, { columnIndex: 1, rowIndex: 1, tableIndex: 0 });
const literalValues = [
  "A|B",
  "*literal*",
  "[link](https://example.invalid)",
  "<script>alert(1)</script>",
  "`code`",
  "~~strike~~",
  "back\\slash",
  "[^note] &amp; _plain_"
];
const literal = rich.runRichTableMatrixPaste(selected, { text: literalValues.join("\t") });
assert.equal(literal.handled, true);
assert.deepEqual(rich.richTableCellCoordinates(literal.state), { columnIndex: 8, rowIndex: 1, tableIndex: 0 });
const literalModelTable = rich
  .proseMirrorDocToMomentariseNodes(literal.state.editorState.doc)
  .find((node) => node.type === "table");
assert.ok(literalModelTable, "public document model table");
assert.deepEqual(
  literalModelTable.children[1].children.map(momentariseText),
  ["alpha", ...literalValues],
  "public document model retains literal cell values"
);
const literalOutput = rich.serializeRichMarkdownState(literal.state).content;
for (const expected of [
  "A\\|B",
  "\\*literal\\*",
  "\\[link\\](https&#58;//example.invalid)",
  "\\<script\\>alert(1)\\</script\\>",
  "\\`code\\`",
  "\\~\\~strike\\~\\~",
  "back\\\\slash",
  "\\[\\^note\\] \\&amp; \\_plain\\_"
]) {
  includes(literalOutput, expected, `literal escape ${expected}`);
}
const remounted = rich.createRichMarkdownState(literalOutput, { dialect: "momentarise-enhanced" });
const literalRow = tableAt(remounted, 0).child(1);
assert.deepEqual(literalRow.content.content.map((cell) => cell.textContent), ["alpha", ...literalValues]);
for (let columnIndex = 1; columnIndex < literalRow.childCount; columnIndex += 1) {
  const paragraph = literalRow.child(columnIndex).firstChild;
  assert.equal(paragraph?.type.name, "paragraph");
  paragraph?.forEach((child) => {
    assert.equal(child.isText, true, `literal cell ${columnIndex} text child`);
    assert.equal(child.marks.length, 0, `literal cell ${columnIndex} unmarked`);
  });
}

const authoredLinks = rich.createRichMarkdownState(
  "| Label | URL |\n| --- | --- |\n| [safe](https://example.com) | https://example.com |\n"
);
const authoredLinkRow = tableAt(authoredLinks, 0).child(1);
assert.deepEqual(
  authoredLinkRow.content.content.map((cell) => cell.firstChild.firstChild.marks.map((mark) => mark.type.name)),
  [["link"], ["link"]],
  "authored explicit and autolink Markdown remain semantic links"
);

const headerPaste = rich.runRichTableMatrixPaste(state, {
  columnIndex: 1,
  rowIndex: 0,
  tableIndex: 0,
  text: "Header A\tHeader B\nBody A\tBody B"
});
assert.equal(headerPaste.handled, true);
assert.deepEqual(columnTypes(tableAt(headerPaste.state, 0), 1), ["table_header", "table_cell", "table_cell", "table_cell"]);

for (const [text, reason, label] of [
  ["plain text", "invalid-tsv", "missing tab"],
  ["a\tb\nc", "invalid-tsv", "ragged"],
  ["a\tb\n\n", "invalid-tsv", "multiple terminal lines"],
  ["\t", "invalid-tsv", "all empty"],
  ["a\u0000\tb", "unsafe-control-character", "NUL"],
  ["a\rb\tc", "unsafe-control-character", "bare CR"],
  [`a\t${"x".repeat(1_000_000)}`, "matrix-too-large", "payload bytes"],
  [Array.from({ length: 257 }, (_, index) => String(index)).join("\t"), "matrix-too-large", "columns"],
  [Array.from({ length: 1001 }, () => "a\tb").join("\n"), "matrix-too-large", "rows"],
  [Array.from({ length: 101 }, () => Array.from({ length: 100 }, () => "x").join("\t")).join("\n"), "matrix-too-large", "cells"]
]) {
  rejected(rich.runRichTableMatrixPaste(selected, { text }), selected, reason, label);
}
rejected(rich.runRichTableMatrixPaste(state, { columnIndex: 0, rowIndex: 99, tableIndex: 0, text: "a\tb" }), state, "row-not-found", "row");
rejected(rich.runRichTableMatrixPaste(state, { columnIndex: 99, rowIndex: 1, tableIndex: 0, text: "a\tb" }), state, "cell-not-found", "column");
rejected(rich.runRichTableMatrixPaste(state, { columnIndex: 0, rowIndex: 1, tableIndex: 99, text: "a\tb" }), state, "table-not-found", "table");
const stale = { ...state, source: source.replace("alpha", "external alpha") };
rejected(rich.runRichTableMatrixPaste(stale, { columnIndex: 0, rowIndex: 1, text: "a\tb" }), stale, "stale-source", "stale");
const paragraphState = rich.createRichMarkdownState("Outside table.\n");
rejected(rich.runRichTableMatrixPaste(paragraphState, { text: "a\tb" }), paragraphState, "selection-outside-table", "outside");

for (const [tableIndex, prefix, expected] of [
  [1, "D", "    | direct one | D1 | D2 |"],
  [2, "O", "       | ordered one | O1 | O2 |"],
  [3, "T", "      | task one | T1 | T2 |"]
]) {
  const result = rich.runRichTableMatrixPaste(state, {
    columnIndex: 1,
    rowIndex: 1,
    tableIndex,
    text: `${prefix}1\t${prefix}2`
  });
  assert.equal(result.handled, true, `nested paste ${tableIndex}`);
  const output = rich.serializeRichMarkdownState(result.state).content;
  includes(output, expected, `nested output ${tableIndex}`);
  for (const exact of [
    "Neighbor <x-unknown keep=\"exact\">syntax</x-unknown> stays byte-exact.",
    "    Direct closing paragraph stays exact.",
    "    4. Ordered sibling stays exact.",
    "    - [x] Completed sibling stays exact.",
    "Final paragraph stays byte-exact."
  ]) includes(output, exact, `context ${exact}`);
}

const crlfSource = source.replaceAll("\n", "\r\n");
const crlfState = rich.createRichMarkdownState(crlfSource, { dialect: "momentarise-enhanced" });
const crlfPaste = rich.runRichTableMatrixPaste(crlfState, {
  columnIndex: 1,
  rowIndex: 1,
  tableIndex: 3,
  text: "left\tright\r\nnext\tlast\r\n"
});
assert.equal(crlfPaste.handled, true);
const crlfOutput = rich.serializeRichMarkdownState(crlfPaste.state).content;
assert.doesNotMatch(crlfOutput, /(^|[^\r])\n/, "CRLF output has no lone LF");
includes(crlfOutput, "      | task one | left | right |\r\n      | task two | next | last |", "CRLF matrix");

const nativeAccepted = invokeNativePaste(
  rich.selectRichTableCell(state, { columnIndex: 1, rowIndex: 1, tableIndex: 0 }),
  { "text/plain": "plugin A\tplugin B" }
);
assert.equal(nativeAccepted.handled, true);
assert.equal(nativeAccepted.prevented, true);
includes(rich.serializeRichMarkdownState(nativeAccepted.state).content, "| alpha | plugin A | plugin B | Ada |", "native transaction");
const nativeMime = invokeNativePaste(
  rich.selectRichTableCell(state, { columnIndex: 1, rowIndex: 2, tableIndex: 0 }),
  { "text/plain": "fallback", "text/tab-separated-values": "mime A\tmime B" }
);
assert.equal(nativeMime.handled, true);
includes(rich.serializeRichMarkdownState(nativeMime.state).content, "| beta | mime A | mime B | Ben |", "TSV MIME preferred");
for (const [nextState, payload, options, label] of [
  [selected, { "text/plain": "ordinary text" }, {}, "ordinary text"],
  [selected, { "text/html": "<strong>safe</strong>", "text/plain": "safe" }, {}, "HTML"],
  [selected, { "text/plain": "image\tmetadata" }, { file: true }, "image"],
  [paragraphState, { "text/plain": "outside\ttable" }, {}, "outside table"]
]) {
  const result = invokeNativePaste(nextState, payload, options);
  assert.equal(result.handled, false, `${label} pass-through`);
  assert.equal(result.prevented, false, `${label} default preserved`);
  assert.equal(result.state.editorState, nextState.editorState, `${label} state identity`);
}

assert.equal(rich.runRichTableRowOperation(expanded.state, { operation: "insert-after" }).handled, true, "row op after paste");
assert.equal(rich.runRichTableColumnOperation(expanded.state, { operation: "insert-after" }).handled, true, "column op after paste");
assert.equal(rich.runRichTableColumnReorder(expanded.state, { toColumnIndex: 4 }).handled, true, "reorder after paste");
const finalCell = rich.selectRichTableCell(expanded.state, { columnIndex: 5, rowIndex: 4, tableIndex: 0 });
assert.deepEqual(tableShape(tableAt(rich.moveRichTableCell(finalCell, "next"), 0)), [6, 6, 6, 6, 6, 6], "Tab append after paste");

const saveTarget = save.createMemorySaveTarget({ initialContent: source });
const saveEngine = save.createSaveEngine({ content: source, target: saveTarget });
saveEngine.updateContent(expandedOutput, { now: new Date("2026-07-22T00:00:00.000Z") });
assert.equal(saveEngine.getState().status, "dirty");
assert.equal((await saveEngine.flush({ reason: "autosave" })).status, "saved");
assert.equal(saveTarget.readContent(), expandedOutput);

function invokeNativePaste(nextState, payload, options = {}) {
  let editorState = nextState.editorState;
  const plugin = editorState.plugins.find((candidate) => typeof candidate.props.handlePaste === "function");
  assert.ok(plugin, "native paste plugin");
  let prevented = false;
  const file = options.file ? { name: "pasted.png", type: "image/png" } : null;
  const clipboardData = {
    files: file ? [file] : [],
    items: file ? [{ kind: "file", type: file.type }] : [],
    types: Object.keys(payload),
    getData: (type) => payload[type] ?? ""
  };
  const handled = plugin.props.handlePaste(
    { get state() { return editorState; }, dispatch(transaction) { editorState = editorState.apply(transaction); } },
    { clipboardData, preventDefault() { prevented = true; } }
  );
  return { handled: Boolean(handled), prevented, state: { ...nextState, editorState } };
}

function applyEditorCommand(nextState, command) {
  let editorState = nextState.editorState;
  assert.equal(command(editorState, (transaction) => { editorState = editorState.apply(transaction); }), true);
  return { ...nextState, editorState };
}

function rejected(result, originalState, reason, label) {
  assert.equal(result.handled, false, `${label} handled`);
  assert.equal(result.reason, reason, `${label} reason`);
  assert.equal(result.rows, 0, `${label} rows`);
  assert.equal(result.columns, 0, `${label} columns`);
  assert.equal(result.state, originalState, `${label} state identity`);
}

function tableAt(nextState, tableIndex) {
  let index = 0;
  let result = null;
  nextState.editorState.doc.descendants((node) => {
    if (result || node.type.name !== "table") return !result;
    if (index === tableIndex) { result = node; return false; }
    index += 1;
    return false;
  });
  assert.ok(result, `table ${tableIndex}`);
  return result;
}

function tableCount(nextState) {
  let count = 0;
  nextState.editorState.doc.descendants((node) => {
    if (node.type.name === "table") count += 1;
    return true;
  });
  return count;
}

function tableShape(table) {
  return table.content.content.map((row) => row.childCount);
}

function columnTypes(table, columnIndex) {
  return table.content.content.map((row) => row.child(columnIndex).type.name);
}

function columnAlignments(table) {
  return table.firstChild.content.content.map((cell) => cell.attrs.alignment);
}

function assertOutsideRootTableExact(before, after) {
  const beforeStart = before.indexOf("| Name | Count | Status | Owner |");
  const beforeEnd = before.indexOf("\n\nBetween root", beforeStart);
  const afterStart = after.indexOf("|", before.indexOf("Before root"));
  const afterEnd = after.indexOf("\n\nBetween root", afterStart);
  assert.equal(after.slice(0, afterStart), before.slice(0, beforeStart));
  assert.equal(after.slice(afterEnd), before.slice(beforeEnd));
}

function includes(value, expected, label) {
  assert.ok(value.includes(expected), `${label}: missing ${JSON.stringify(expected)}\n${value}`);
}

function momentariseText(node) {
  if (node.type === "text") return node.attributes?.value ?? "";
  return (node.children ?? []).map(momentariseText).join("");
}
