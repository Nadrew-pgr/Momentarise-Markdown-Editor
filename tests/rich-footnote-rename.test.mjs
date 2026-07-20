import { readFile } from "node:fs/promises";

const rich = await import("../packages/md-rich-prosemirror/dist/index.js");
const save = await import("../packages/md-save/dist/index.js");
const history = await import("prosemirror-history");
const { TextSelection } = await import("prosemirror-state");

if (typeof rich.renameRichFootnoteIdentifier !== "function") {
  throw new Error("Missing MME-0058 rich footnote rename export: renameRichFootnoteIdentifier");
}

const source = await readFile("fixtures/022-simple-footnote-editing/input.md", "utf8");
const state = rich.createRichMarkdownState(source, { dialect: "momentarise-enhanced" });
const renamed = rich.renameRichFootnoteIdentifier(state, {
  identifier: " SIMPLE ",
  nextIdentifier: "release-note"
});
assertEqual(renamed.handled, true, "normalized footnote rename handled");
assertEqual(renamed.identifier, "release-note", "successful rename identifier");
assertEqual(renamed.previousIdentifier, "simple", "successful previous identifier");
assertEqual(renamed.reason, null, "successful rename reason");

const output = rich.serializeRichMarkdownState(renamed.state).content;
const expected = source.replaceAll("[^simple]", "[^release-note]");
assertEqual(output, expected, "rename patches every matching token only");
assertIncludes(output, "[^complex]: Complex definition starts here.", "unrelated complex definition preserved");
assertIncludes(output, "[^duplicate]: Second duplicate definition stays source-only.", "unrelated duplicate preserved");

const undone = applyEditorCommand(renamed.state, history.undo);
assertEqual(rich.serializeRichMarkdownState(undone).content, source, "one undo restores every identifier token");
const redone = applyEditorCommand(undone, history.redo);
assertEqual(rich.serializeRichMarkdownState(redone).content, expected, "one redo restores complete rename");

const renamedAgain = rich.renameRichFootnoteIdentifier(renamed.state, {
  identifier: "release-note",
  nextIdentifier: "final-note"
});
assertEqual(renamedAgain.handled, true, "successive rename handled");
assertEqual(
  rich.serializeRichMarkdownState(renamedAgain.state).content,
  source.replaceAll("[^simple]", "[^final-note]"),
  "successive rename reuses original source-token mapping"
);

const reuseOldIdentifier = rich.insertRichFootnote(collapseAfterText(renamed.state, "Neighbor paragraph "), {
  preferredIdentifier: "simple",
  text: "The old identifier is available again"
});
assertEqual(reuseOldIdentifier.handled, true, "insertion may reuse identifier renamed away");
assertEqual(reuseOldIdentifier.identifier, "simple", "reused identifier remains truthful");
assertIncludes(
  rich.serializeRichMarkdownState(reuseOldIdentifier.state).content,
  "Neighbor paragraph [^simple]stays byte-exact.",
  "reused identifier reference"
);

const collision = rich.renameRichFootnoteIdentifier(state, {
  identifier: "simple",
  nextIdentifier: " COMPLEX "
});
assertRejected(collision, state, "identifier-conflict", source, "normalized collision");

const missing = rich.renameRichFootnoteIdentifier(state, {
  identifier: "missing-definition",
  nextIdentifier: "available"
});
assertRejected(missing, state, "identifier-not-found", source, "missing identifier");

const invalid = rich.renameRichFootnoteIdentifier(state, {
  identifier: "simple",
  nextIdentifier: "bad]identifier"
});
assertRejected(invalid, state, "invalid-identifier", source, "invalid identifier");

const duplicate = rich.renameRichFootnoteIdentifier(state, {
  identifier: "duplicate",
  nextIdentifier: "deduplicated"
});
assertRejected(duplicate, state, "ambiguous-identifier", source, "duplicate definition");

const complex = rich.renameRichFootnoteIdentifier(state, {
  identifier: "complex",
  nextIdentifier: "complex-renamed"
});
assertRejected(complex, state, "mapping-unavailable", source, "complex source-only definition");

let matchingReferenceIndex = 0;
let corruptedTransaction = state.editorState.tr;
state.editorState.doc.descendants((node, position) => {
  if (node.type.name !== "footnote_reference" || node.attrs.identifier !== "simple") {
    return true;
  }
  matchingReferenceIndex += 1;
  if (matchingReferenceIndex === 2) {
    corruptedTransaction = corruptedTransaction.setNodeMarkup(position, undefined, {
      ...node.attrs,
      sourceIdentifier: null,
      sourceIdentifierFrom: null,
      sourceIdentifierTo: null
    });
  }
  return true;
});
const partiallyUnmappableState = {
  ...state,
  editorState: state.editorState.apply(corruptedTransaction)
};
const partiallyUnmappable = rich.renameRichFootnoteIdentifier(partiallyUnmappableState, {
  identifier: "simple",
  nextIdentifier: "must-not-partially-apply"
});
assertRejected(
  partiallyUnmappable,
  partiallyUnmappableState,
  "mapping-unavailable",
  source,
  "partially unmappable references"
);

const nestedSource = "Use[^nested].\n\n> [^nested]: Nested definition stays source-only.\n";
const nestedState = rich.createRichMarkdownState(nestedSource, { dialect: "momentarise-enhanced" });
const nested = rich.renameRichFootnoteIdentifier(nestedState, {
  identifier: "nested",
  nextIdentifier: "nested-renamed"
});
assertRejected(nested, nestedState, "mapping-unavailable", nestedSource, "nested source-only definition");

const staleState = { ...state, source: "Externally changed source.\n" };
const stale = rich.renameRichFootnoteIdentifier(staleState, {
  identifier: "simple",
  nextIdentifier: "stale-rename"
});
assertRejected(stale, staleState, "stale-source", "Externally changed source.\n", "stale source");

const crlfSource = "Before[^Mixed] and again[^Mixed].\r\n\r\n  [^Mixed]:   Original body.\r\n";
const crlfState = rich.createRichMarkdownState(crlfSource, { dialect: "momentarise-enhanced" });
const crlfRenamed = rich.renameRichFootnoteIdentifier(crlfState, {
  identifier: "mixed",
  nextIdentifier: "Release Note"
});
assertEqual(crlfRenamed.handled, true, "CRLF rename handled");
assertEqual(
  rich.serializeRichMarkdownState(crlfRenamed.state).content,
  "Before[^Release Note] and again[^Release Note].\r\n\r\n  [^Release Note]:   Original body.\r\n",
  "CRLF and definition prefix bytes preserved"
);

const insertionSource = "Insert here.\n";
const inserted = rich.insertRichFootnote(rich.createRichMarkdownState(insertionSource), {
  text: "Inserted body"
});
assertEqual(inserted.handled, true, "insertion prerequisite handled");
const insertedRenamed = rich.renameRichFootnoteIdentifier(inserted.state, {
  identifier: "note",
  nextIdentifier: "inserted-note"
});
assertEqual(insertedRenamed.handled, true, "inserted footnote rename handled");
assertEqual(
  rich.serializeRichMarkdownState(insertedRenamed.state).content,
  "[^inserted-note]Insert here.\n\n[^inserted-note]: Inserted body\n",
  "inserted reference and definition rename together"
);

const saveTarget = save.createMemorySaveTarget({ initialContent: source });
const saveEngine = save.createSaveEngine({ content: source, target: saveTarget });
saveEngine.updateContent(output, { now: new Date("2026-07-20T00:00:00.000Z") });
assertEqual(saveEngine.getState().status, "dirty", "rename marks save state dirty");
const saved = await saveEngine.flush({ reason: "autosave" });
assertEqual(saved.status, "saved", "rename autosave status");
assertEqual(saveTarget.readContent(), expected, "rename autosave content");

function applyEditorCommand(stateValue, command) {
  let editorState = stateValue.editorState;
  if (!command(editorState, (transaction) => {
    editorState = editorState.apply(transaction);
  })) {
    throw new Error("Expected editor command to be handled.");
  }
  return { ...stateValue, editorState };
}

function collapseAfterText(stateValue, text) {
  let position = null;
  stateValue.editorState.doc.descendants((node, offset) => {
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
    throw new Error(`Cannot place cursor after ${JSON.stringify(text)}.`);
  }
  return {
    ...stateValue,
    editorState: stateValue.editorState.apply(
      stateValue.editorState.tr.setSelection(TextSelection.create(stateValue.editorState.doc, position))
    )
  };
}

function assertRejected(result, originalState, reason, expectedSource, label) {
  assertEqual(result.handled, false, `${label} rejected`);
  assertEqual(result.identifier, null, `${label} identifier`);
  assertEqual(result.previousIdentifier, null, `${label} previous identifier`);
  assertEqual(result.reason, reason, `${label} reason`);
  assertEqual(result.state, originalState, `${label} state identity`);
  assertEqual(rich.serializeRichMarkdownState(result.state).content, expectedSource, `${label} source non-mutation`);
}

function assertIncludes(value, expectedValue, label) {
  if (!value.includes(expectedValue)) {
    throw new Error(`${label}: missing ${JSON.stringify(expectedValue)}.\n${value}`);
  }
}

function assertEqual(actual, expectedValue, label) {
  if (actual !== expectedValue) {
    throw new Error(`${label}: expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actual)}.`);
  }
}
