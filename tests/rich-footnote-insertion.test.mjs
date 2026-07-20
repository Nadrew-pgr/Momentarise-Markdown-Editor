import { readFile } from "node:fs/promises";

const rich = await import("../packages/md-rich-prosemirror/dist/index.js");
const save = await import("../packages/md-save/dist/index.js");
const history = await import("prosemirror-history");
const { TextSelection } = await import("prosemirror-state");

for (const exportName of ["insertRichFootnote"]) {
  if (typeof rich[exportName] !== "function") {
    throw new Error(`Missing MME-0057 rich footnote insertion export: ${exportName}`);
  }
}

const source = [
  "# Footnote insertion",
  "",
  "Paragraph keeps **bold source** and _emphasis_ around the insertion point.",
  "",
  "Tail stays byte-exact.",
  ""
].join("\n");
const selected = collapseAfterText(
  rich.createRichMarkdownState(source, { dialect: "momentarise-enhanced" }),
  "Paragraph keeps "
);
const inserted = rich.insertRichFootnote(selected, { text: "Inserted footnote body" });
assertEqual(inserted.handled, true, "default footnote insertion handled");
assertEqual(inserted.identifier, "note", "default identifier");
const insertedOutput = rich.serializeRichMarkdownState(inserted.state).content;
const expected = source.replace("Paragraph keeps ", "Paragraph keeps [^note]") + "\n[^note]: Inserted footnote body\n";
assertEqual(insertedOutput, expected, "reference and definition targeted insertion");
assertEqual(countNodeType(inserted.state.editorState.doc, "footnote_reference"), 1, "inserted semantic reference");
assertEqual(countNodeType(inserted.state.editorState.doc, "footnote_definition"), 1, "inserted editable definition");

const undone = applyEditorCommand(inserted.state, history.undo);
assertEqual(rich.serializeRichMarkdownState(undone).content, source, "one undo removes reference and definition");
const redone = applyEditorCommand(undone, history.redo);
assertEqual(rich.serializeRichMarkdownState(redone).content, expected, "one redo restores reference and definition");

const secondSelected = collapseAfterText(inserted.state, "and ");
const secondInserted = rich.insertRichFootnote(secondSelected, { text: "Second inserted body" });
assertEqual(secondInserted.handled, true, "second same-paragraph insertion handled");
assertEqual(secondInserted.identifier, "note-2", "second same-paragraph identifier");
assertEqual(
  rich.serializeRichMarkdownState(secondInserted.state).content,
  source
    .replace("Paragraph keeps ", "Paragraph keeps [^note]")
    .replace("and _emphasis_", "and [^note-2]_emphasis_") +
    "\n[^note]: Inserted footnote body\n\n[^note-2]: Second inserted body\n",
  "multiple same-paragraph references preserve exact source"
);

const staleSecondState = collapseAfterText(
  { ...inserted.state, source: "Externally changed source.\n" },
  "and "
);
const staleSecond = rich.insertRichFootnote(staleSecondState, { text: "Must not insert" });
assertEqual(staleSecond.handled, false, "stale source insertion rejected");
assertEqual(staleSecond.reason, "stale-source", "stale source reason");
assertEqual(staleSecond.state, staleSecondState, "stale source returns original state");

const escapedSource = "Keep a\\*b byte-exact beside insertion.\n";
const escapedInserted = rich.insertRichFootnote(
  collapseAfterText(rich.createRichMarkdownState(escapedSource), "Keep a*"),
  { text: "Escaped source body" }
);
assertEqual(escapedInserted.handled, true, "escaped inline text insertion handled");
assertEqual(
  rich.serializeRichMarkdownState(escapedInserted.state).content,
  "Keep a\\*[^note]b byte-exact beside insertion.\n\n[^note]: Escaped source body\n",
  "escaped inline source remains byte-exact"
);

const unmappableSource = "Keep &amp; entity source exact.\n";
const unmappable = rich.insertRichFootnote(
  collapseAfterText(rich.createRichMarkdownState(unmappableSource), "Keep &"),
  { text: "Must not insert" }
);
assertEqual(unmappable.handled, false, "unmappable entity source rejected");
assertEqual(unmappable.reason, "mapping-unavailable", "unmappable source reason");

const emptyInserted = rich.insertRichFootnote(rich.createRichMarkdownState(""), { text: "Empty document body" });
assertEqual(emptyInserted.handled, true, "empty document insertion handled");
assertEqual(
  rich.serializeRichMarkdownState(emptyInserted.state).content,
  "[^note]\n\n[^note]: Empty document body\n",
  "empty document receives unambiguous reference and definition"
);

const preservationSource = [
  "---",
  "custom: keep-byte-exact",
  "---",
  "",
  "<x-unknown data-contract=\"preserve\">raw</x-unknown>",
  "",
  "Insert beside **known rich syntax** here.",
  "",
  ":::future-directive untouched",
  "payload: [a, b, c]",
  ":::",
  ""
].join("\n");
const preservationInserted = rich.insertRichFootnote(
  collapseAfterText(rich.createRichMarkdownState(preservationSource), "Insert beside "),
  { text: "Bounded patch" }
);
assertEqual(preservationInserted.handled, true, "insertion beside unknown syntax handled");
assertEqual(
  rich.serializeRichMarkdownState(preservationInserted.state).content,
  preservationSource.replace("Insert beside ", "Insert beside [^note]") + "\n[^note]: Bounded patch\n",
  "unknown syntax and unrelated bytes remain exact"
);

const existingSource = [
  "Existing reference[^note] and another[^NOTE-2].",
  "",
  "Insert here.",
  "",
  "[^note]: Existing note.",
  "",
  "[^NOTE-2]: Existing second note.",
  ""
].join("\n");
const allocated = rich.insertRichFootnote(
  collapseAfterText(rich.createRichMarkdownState(existingSource), "Insert "),
  { text: "Third note" }
);
assertEqual(allocated.handled, true, "collision-safe generated insertion");
assertEqual(allocated.identifier, "note-3", "deterministic normalized identifier allocation");
assertIncludes(rich.serializeRichMarkdownState(allocated.state).content, "Insert [^note-3]here.", "allocated reference");
assertIncludes(rich.serializeRichMarkdownState(allocated.state).content, "[^note-3]: Third note", "allocated definition");

const preferred = rich.insertRichFootnote(
  collapseAfterText(rich.createRichMarkdownState("Insert here.\n"), "Insert "),
  { preferredIdentifier: "release-note", text: "Release detail" }
);
assertEqual(preferred.handled, true, "preferred identifier insertion");
assertEqual(preferred.identifier, "release-note", "preferred identifier retained");

const conflictState = collapseAfterText(rich.createRichMarkdownState(existingSource), "Insert ");
const conflict = rich.insertRichFootnote(conflictState, {
  preferredIdentifier: " NOTE ",
  text: "Must not insert"
});
assertEqual(conflict.handled, false, "normalized preferred identifier conflict rejected");
assertEqual(conflict.reason, "identifier-conflict", "conflict reason");
assertEqual(conflict.state, conflictState, "conflict returns original state object");
assertEqual(rich.serializeRichMarkdownState(conflict.state).content, existingSource, "conflict source non-mutation");

const invalid = rich.insertRichFootnote(conflictState, {
  preferredIdentifier: "bad]identifier",
  text: "Must not insert"
});
assertEqual(invalid.handled, false, "invalid preferred identifier rejected");
assertEqual(invalid.reason, "invalid-identifier", "invalid identifier reason");
assertEqual(invalid.state, conflictState, "invalid identifier returns original state object");

const multiline = rich.insertRichFootnote(conflictState, { text: "Unsafe\nbody" });
assertEqual(multiline.handled, false, "multiline initial body rejected");
assertEqual(multiline.reason, "invalid-body", "multiline body reason");
assertEqual(multiline.state, conflictState, "invalid body returns original state object");

const nonEmptySelection = rich.selectFirstRichText(rich.createRichMarkdownState("Select this text.\n"), "this");
const selectionRejected = rich.insertRichFootnote(nonEmptySelection, { text: "No mutation" });
assertEqual(selectionRejected.handled, false, "non-empty selection rejected");
assertEqual(selectionRejected.reason, "selection-not-collapsed", "selection rejection reason");
assertEqual(selectionRejected.state, nonEmptySelection, "selection rejection returns original state");

const codeState = collapseAfterText(rich.createRichMarkdownState("```ts\nconst value = 1;\n```\n"), "const ");
const codeRejected = rich.insertRichFootnote(codeState, { text: "No code footnote" });
assertEqual(codeRejected.handled, false, "code-block insertion rejected");
assertEqual(codeRejected.reason, "unsupported-selection", "code-block rejection reason");
assertEqual(codeRejected.state, codeState, "code-block rejection returns original state");

const crlfSource = "Before insertion.\r\n\r\nTail.\r\n";
const crlfInserted = rich.insertRichFootnote(
  collapseAfterText(rich.createRichMarkdownState(crlfSource), "Before "),
  { text: "CRLF body" }
);
const crlfOutput = rich.serializeRichMarkdownState(crlfInserted.state).content;
assertEqual(crlfOutput, "Before [^note]insertion.\r\n\r\nTail.\r\n\r\n[^note]: CRLF body\r\n", "CRLF insertion output");
if (/(^|[^\r])\n/.test(crlfOutput)) {
  throw new Error(`Footnote insertion must not introduce lone LF bytes.\n${JSON.stringify(crlfOutput)}`);
}

const commandState = collapseAfterText(rich.createRichMarkdownState("Command here.\n"), "Command ");
const commandResult = rich.runRichMarkdownCommand(commandState, "footnote", { text: "Command body" });
assertEqual(commandResult.handled, true, "footnote rich command handled");
assertEqual(commandResult.identifier, "note", "footnote command exposes generated identifier");
assertEqual(commandResult.reason, null, "successful footnote command exposes null reason");
assertIncludes(rich.serializeRichMarkdownState(commandResult.state).content, "Command [^note]here.", "command reference");
assertIncludes(rich.serializeRichMarkdownState(commandResult.state).content, "[^note]: Command body", "command definition");
assertEqual(rich.filterRichMarkdownCommands("foot").some((command) => command.id === "footnote"), true, "footnote slash search");
const unavailableCommand = rich.runRichMarkdownCommand(commandState, "footnote");
assertEqual(unavailableCommand.handled, false, "missing footnote command body rejected");
assertEqual(unavailableCommand.identifier, null, "rejected footnote command exposes null identifier");
assertEqual(unavailableCommand.reason, "invalid-body", "rejected footnote command exposes reason");

const saveTarget = save.createMemorySaveTarget({ initialContent: source });
const saveEngine = save.createSaveEngine({ content: source, target: saveTarget });
saveEngine.updateContent(insertedOutput, { now: new Date("2026-07-20T00:00:00.000Z") });
assertEqual(saveEngine.getState().status, "dirty", "footnote insertion marks save state dirty");
assertEqual(saveEngine.getState().currentHash, save.hashMarkdownContent(insertedOutput), "footnote insertion save hash");
const saved = await saveEngine.flush({ reason: "autosave" });
assertEqual(saved.status, "saved", "footnote insertion autosave status");
assertEqual(saveTarget.readContent(), insertedOutput, "footnote insertion autosave content");

const surfaceSource = await readFile("packages/md-surface/src/index.ts", "utf8");
const demoSource = await readFile("apps/md-demo/src/main.ts", "utf8");
for (const snippet of [
  'footnote: "Footnote"',
  'id: "mme:footnote"',
  'richCommand: "footnote"',
  'title: "footnote"'
]) {
  assertIncludes(surfaceSource, snippet, `localized accessible footnote surface ${snippet}`);
}
for (const snippet of [
  'footnote: "link"',
  "defaultMmeStrings.footnote.initialBody",
  'commandId === "footnote"'
]) {
  assertIncludes(demoSource, snippet, `demo footnote command integration ${snippet}`);
}

function collapseAfterText(state, text) {
  let position = null;
  state.editorState.doc.descendants((node, offset) => {
    if (!node.isText || typeof node.text !== "string") {
      return true;
    }
    const index = node.text.indexOf(text);
    if (index < 0) {
      return true;
    }
    position = offset + index + text.length;
    return false;
  });
  if (position === null) {
    throw new Error(`Cannot place footnote insertion cursor after ${JSON.stringify(text)}.`);
  }
  return {
    ...state,
    editorState: state.editorState.apply(
      state.editorState.tr.setSelection(TextSelection.create(state.editorState.doc, position))
    )
  };
}

function applyEditorCommand(state, command) {
  let editorState = state.editorState;
  if (!command(editorState, (transaction) => {
    editorState = editorState.apply(transaction);
  })) {
    throw new Error("Expected editor command to be handled.");
  }
  return { ...state, editorState };
}

function countNodeType(node, typeName) {
  let count = node.type.name === typeName ? 1 : 0;
  node.forEach((child) => {
    count += countNodeType(child, typeName);
  });
  return count;
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
