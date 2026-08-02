import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const rich = await import("../packages/md-rich-prosemirror/dist/index.js");
const save = await import("../packages/md-save/dist/index.js");
const history = await import("prosemirror-history");

const source = await readFile("fixtures/039-table-spreadsheet-paste/input.md", "utf8");
const state = rich.createRichMarkdownState(source, { dialect: "momentarise-enhanced" });
const selected = rich.selectRichTableCell(state, { columnIndex: 1, rowIndex: 1, tableIndex: 0 });
const csvText = [
  "\uFEFF\"North, Inc.\",\"He said \"\"go\"\"\",,\"=SUM(A1:A2)\"",
  "\"South\",\"plain\",\"A|B\",\"<script>alert(1)</script>\""
].join("\r\n") + "\r\n";

const pasted = rich.runRichTableMatrixPaste(selected, { format: "csv", text: csvText });
assert.equal(pasted.handled, true, "explicit quoted CSV must be accepted");
assert.equal(pasted.reason, null);
assert.equal(pasted.rows, 2);
assert.equal(pasted.columns, 4);
assert.deepEqual(rich.richTableCellCoordinates(pasted.state), { columnIndex: 4, rowIndex: 2, tableIndex: 0 });
assert.deepEqual(tableShape(tableAt(pasted.state, 0)), [5, 5, 5, 5]);
assert.deepEqual(columnAlignments(tableAt(pasted.state, 0)), ["left", "right", "center", null, null]);

const pastedOutput = rich.serializeRichMarkdownState(pasted.state).content;
includes(pastedOutput, "| alpha | North, Inc. | He said \"go\" |  | =SUM(A1:A2) |", "quoted values and empty cell");
includes(
  pastedOutput,
  "| beta | South | plain | A\\|B | \\<script\\>alert(1)\\</script\\> |",
  "literal Markdown and HTML-shaped values"
);
assertOutsideRootTableExact(source, pastedOutput);

const remounted = rich.createRichMarkdownState(pastedOutput, { dialect: "momentarise-enhanced" });
const firstPastedRow = tableAt(remounted, 0).child(1);
assert.deepEqual(
  firstPastedRow.content.content.map((cell) => cell.textContent),
  ["alpha", "North, Inc.", "He said \"go\"", "", "=SUM(A1:A2)"],
  "CSV values remount literally"
);
for (let columnIndex = 1; columnIndex < firstPastedRow.childCount; columnIndex += 1) {
  const paragraph = firstPastedRow.child(columnIndex).firstChild;
  assert.equal(paragraph?.type.name, "paragraph");
  paragraph?.forEach((child) => {
    assert.equal(child.isText, true, `literal CSV cell ${columnIndex} text child`);
    assert.equal(child.marks.length, 0, `literal CSV cell ${columnIndex} remains unmarked`);
  });
}

const undone = applyEditorCommand(pasted.state, history.undo);
assert.equal(rich.serializeRichMarkdownState(undone).content, source, "one undo restores exact source");
const redone = applyEditorCommand(undone, history.redo);
assert.equal(rich.serializeRichMarkdownState(redone).content, pastedOutput, "redo restores deterministic CSV paste");

const explicit = rich.runRichTableMatrixPaste(state, {
  columnIndex: 1,
  format: "csv",
  rowIndex: 1,
  tableIndex: 0,
  text: "\"Explicit, A\",B\nC,D"
});
assert.equal(explicit.handled, true, "explicit coordinate CSV target");
assert.deepEqual(rich.richTableCellCoordinates(explicit.state), { columnIndex: 2, rowIndex: 2, tableIndex: 0 });

const defaultTsv = rich.runRichTableMatrixPaste(selected, { text: "TSV A\tTSV B" });
assert.equal(defaultTsv.handled, true, "existing default TSV contract remains compatible");
includes(rich.serializeRichMarkdownState(defaultTsv.state).content, "| alpha | TSV A | TSV B | Ada |", "default TSV output");

const edgeWhitespaceValues = ["  padded  ", "\tTabbed\t"];
const edgeWhitespace = rich.runRichTableMatrixPaste(selected, {
  format: "csv",
  text: edgeWhitespaceValues.map((value) => `"${value}"`).join(",")
});
assert.equal(edgeWhitespace.handled, true, "quoted edge whitespace");
const edgeWhitespaceOutput = rich.serializeRichMarkdownState(edgeWhitespace.state).content;
includes(edgeWhitespaceOutput, "&#32;&#32;padded&#32;&#32;", "edge spaces encoded for GFM preservation");
includes(edgeWhitespaceOutput, "&#9;Tabbed&#9;", "edge tabs encoded for GFM preservation");
const edgeWhitespaceRemount = rich.createRichMarkdownState(edgeWhitespaceOutput, {
  dialect: "momentarise-enhanced"
});
assert.deepEqual(
  tableAt(edgeWhitespaceRemount, 0).child(1).content.content.slice(1, 3).map((cell) => cell.textContent),
  edgeWhitespaceValues,
  "quoted edge whitespace remounts exactly"
);

for (const [text, reason, label] of [
  ["\"unclosed,value\nnext,row", "invalid-csv", "malformed quote"],
  ["a,b\nc", "invalid-csv", "ragged rows"],
  ["", "invalid-csv", "empty"],
  [",", "invalid-csv", "all empty"],
  ["one", "invalid-csv", "single column"],
  ["\"line one\nline two\",value", "unsupported-multiline-cell", "multiline cell"],
  ["a\u0000,b", "unsafe-control-character", "NUL"],
  [`a,${"x".repeat(1_000_000)}`, "matrix-too-large", "payload size"],
  [Array.from({ length: 257 }, (_, index) => String(index)).join(","), "matrix-too-large", "columns"],
  [Array.from({ length: 1001 }, () => "a,b").join("\n"), "matrix-too-large", "rows"],
  [Array.from({ length: 101 }, () => Array.from({ length: 100 }, () => "x").join(",")).join("\n"), "matrix-too-large", "cells"]
]) {
  rejected(rich.runRichTableMatrixPaste(selected, { format: "csv", text }), selected, reason, label);
}

const stale = { ...state, source: source.replace("alpha", "external alpha") };
rejected(
  rich.runRichTableMatrixPaste(stale, { format: "csv", text: "a,b" }),
  stale,
  "stale-source",
  "stale"
);
const paragraphState = rich.createRichMarkdownState("Outside table.\n");
rejected(
  rich.runRichTableMatrixPaste(paragraphState, { format: "csv", text: "a,b" }),
  paragraphState,
  "selection-outside-table",
  "outside"
);

for (const [tableIndex, prefix, expected] of [
  [1, "D", "    | direct one | D,1 | D2 |"],
  [2, "O", "       | ordered one | O,1 | O2 |"],
  [3, "T", "      | task one | T,1 | T2 |"]
]) {
  const result = rich.runRichTableMatrixPaste(state, {
    columnIndex: 1,
    format: "csv",
    rowIndex: 1,
    tableIndex,
    text: `"${prefix},1",${prefix}2`
  });
  assert.equal(result.handled, true, `nested CSV paste ${tableIndex}`);
  const output = rich.serializeRichMarkdownState(result.state).content;
  includes(output, expected, `nested CSV output ${tableIndex}`);
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
  format: "csv",
  rowIndex: 1,
  tableIndex: 3,
  text: "\"left, quoted\",right\r\nnext,last\r\n"
});
assert.equal(crlfPaste.handled, true);
const crlfOutput = rich.serializeRichMarkdownState(crlfPaste.state).content;
assert.doesNotMatch(crlfOutput, /(^|[^\r])\n/, "CRLF output has no lone LF");
includes(
  crlfOutput,
  "      | task one | left, quoted | right |\r\n      | task two | next | last |",
  "CRLF CSV matrix"
);

const nativeCsv = invokeNativePaste(
  rich.selectRichTableCell(state, { columnIndex: 1, rowIndex: 1, tableIndex: 0 }),
  { "text/csv": "\"Native, A\",Native B" }
);
assert.equal(nativeCsv.handled, true);
assert.equal(nativeCsv.prevented, true);
includes(
  rich.serializeRichMarkdownState(nativeCsv.state).content,
  "| alpha | Native, A | Native B | Ada |",
  "native CSV transaction"
);

const nativeTsvPriority = invokeNativePaste(
  rich.selectRichTableCell(state, { columnIndex: 1, rowIndex: 2, tableIndex: 0 }),
  {
    "text/csv": "CSV A,CSV B",
    "text/plain": "plain fallback",
    "text/tab-separated-values": "TSV A\tTSV B"
  }
);
assert.equal(nativeTsvPriority.handled, true);
includes(
  rich.serializeRichMarkdownState(nativeTsvPriority.state).content,
  "| beta | TSV A | TSV B | Ben |",
  "explicit TSV MIME wins over CSV"
);

for (const [nextState, payload, options, label] of [
  [selected, { "text/plain": "ordinary, comma prose" }, {}, "plain comma text"],
  [selected, { "text/html": "<table><tr><td>A</td><td>B</td></tr></table>", "text/plain": "A B" }, {}, "HTML table"],
  [selected, { "text/csv": "image,metadata" }, { file: true }, "image/file"],
  [selected, { "text/csv": "\"broken,value" }, {}, "invalid CSV"],
  [paragraphState, { "text/csv": "outside,table" }, {}, "outside table"]
]) {
  const result = invokeNativePaste(nextState, payload, options);
  assert.equal(result.handled, false, `${label} pass-through`);
  assert.equal(result.prevented, false, `${label} default preserved`);
  assert.equal(result.state.editorState, nextState.editorState, `${label} state identity`);
}

assert.equal(rich.runRichTableRowOperation(pasted.state, { operation: "insert-after" }).handled, true, "row op after CSV");
assert.equal(rich.runRichTableColumnOperation(pasted.state, { operation: "insert-after" }).handled, true, "column op after CSV");
assert.equal(rich.runRichTableColumnReorder(pasted.state, { toColumnIndex: 3 }).handled, true, "reorder after CSV");
const finalCell = rich.selectRichTableCell(pasted.state, { columnIndex: 4, rowIndex: 3, tableIndex: 0 });
assert.deepEqual(tableShape(tableAt(rich.moveRichTableCell(finalCell, "next"), 0)), [5, 5, 5, 5, 5], "Tab append after CSV");

const saveTarget = save.createMemorySaveTarget({ initialContent: source });
const saveEngine = save.createSaveEngine({ content: source, target: saveTarget });
saveEngine.updateContent(pastedOutput, { now: new Date("2026-07-28T00:00:00.000Z") });
assert.equal(saveEngine.getState().status, "dirty");
assert.equal((await saveEngine.flush({ reason: "autosave" })).status, "saved");
assert.equal(saveTarget.readContent(), pastedOutput);

function invokeNativePaste(nextState, payload, options = {}) {
  let editorState = nextState.editorState;
  // The subject here is the package's own matrix-paste handler. MME-0103 added a
  // block-selection plugin ahead of it that also declares `handlePaste` (and
  // declines whenever no block is selected), so this names the handler under
  // test instead of taking whichever one happens to come first.
  const plugin = editorState.plugins.find(
    (candidate) =>
      typeof candidate.props.handlePaste === "function" && candidate.spec.key !== rich.richBlockSelectionPluginKey
  );
  assert.ok(plugin, "native paste plugin");
  let prevented = false;
  const file = options.file ? { name: "pasted.png", type: "image/png" } : null;
  const clipboardData = {
    files: file ? [file] : [],
    items: file ? [{ kind: "file", type: file.type }] : [],
    types: Object.keys(payload),
    getData: (type) => payload[type] ?? ""
  };
  const view = {
    get state() {
      return editorState;
    },
    dispatch(transaction) {
      editorState = editorState.apply(transaction);
    }
  };
  const event = {
    clipboardData,
    preventDefault() {
      prevented = true;
    }
  };
  const handled = plugin.props.handlePaste(view, event);
  return { handled: Boolean(handled), prevented, state: { ...nextState, editorState } };
}

function applyEditorCommand(nextState, command) {
  let editorState = nextState.editorState;
  assert.equal(
    command(editorState, (transaction) => {
      editorState = editorState.apply(transaction);
    }),
    true
  );
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
    if (index === tableIndex) {
      result = node;
      return false;
    }
    index += 1;
    return false;
  });
  assert.ok(result, `table ${tableIndex}`);
  return result;
}

function tableShape(table) {
  return table.content.content.map((row) => row.childCount);
}

function columnAlignments(table) {
  return table.firstChild.content.content.map((cell) => cell.attrs.alignment);
}

function assertOutsideRootTableExact(before, after) {
  const beforeStart = before.indexOf("| Name | Count |");
  const beforeEnd = before.indexOf("\n\nBetween root", beforeStart);
  const afterStart = after.indexOf("| Name | Count |");
  const afterEnd = after.indexOf("\n\nBetween root", afterStart);
  assert.equal(after.slice(0, afterStart), before.slice(0, beforeStart), "bytes before root table");
  assert.equal(after.slice(afterEnd), before.slice(beforeEnd), "bytes after root table");
}

function includes(value, expected, label) {
  assert.ok(value.includes(expected), `${label}: missing ${JSON.stringify(expected)}\n${value}`);
}
