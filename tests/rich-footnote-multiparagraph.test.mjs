import { readFile } from "node:fs/promises";

const rich = await import("../packages/md-rich-prosemirror/dist/index.js");
const save = await import("../packages/md-save/dist/index.js");
const history = await import("prosemirror-history");
const { TextSelection } = await import("prosemirror-state");

const source = await readFile("fixtures/024-multiparagraph-footnote-editing/input.md", "utf8");
const state = rich.createRichMarkdownState(source, { dialect: "momentarise-enhanced" });
const definitions = topLevelNodes(state).filter((node) => node.type.name === "footnote_definition");
assertEqual(definitions.length, 2, "safe multi-paragraph and simple-list definitions must be editable");
const detailDefinition = definitions.find((node) => node.attrs.identifier === "detail");
const listDefinition = definitions.find((node) => node.attrs.identifier === "nested-block");
assertEqual(detailDefinition?.childCount, 3, "definition exposes three paragraph children");
assertEqual(detailDefinition?.child(1).type.name, "paragraph", "second child is an editable paragraph");
assertIncludes(detailDefinition?.child(1).textContent ?? "", "Second paragraph", "second paragraph content");
assertEqual(listDefinition?.child(1).type.name, "bullet_list", "simple list child now mounts semantically");
assertEqual(rich.serializeRichMarkdownState(state).content, source, "untouched multi-paragraph document identity");

const edited = rich.replaceFirstRichText(state, "Second paragraph", "Edited second paragraph");
const editedOutput = rich.serializeRichMarkdownState(edited).content;
const expected = source.replace("Second paragraph", "Edited second paragraph");
assertEqual(editedOutput, expected, "only selected definition paragraph text changes");
for (const preserved of [
  '[^detail]: First **paragraph** keeps `inline code`.',
  "    Its continuation line stays indented.",
  "    Third paragraph stays byte-exact.",
  'Neighbor <x-unknown keep="exact">syntax</x-unknown> stays byte-exact.',
  "[^nested-block]: Nested content stays source-only.\n\n    - list item stays source-only",
  "> [^nested-container]: Container definition stays source-only.",
  '[^unsafe]: Unsafe paragraph starts here.\n\n    Raw HTML <span onclick="boom()">stays source-only</span>.',
  "Final paragraph stays byte-exact."
]) {
  assertIncludes(editedOutput, preserved, `preserved source ${preserved}`);
}

const fallbacks = collectNodesByType(state.editorState.doc, "unsupported_block");
for (const preserved of ["[^nested-container]:", "[^unsafe]:"]) {
  if (!fallbacks.some((node) => String(node.attrs.raw ?? "").includes(preserved))) {
    throw new Error(`Expected source-only fallback for ${preserved}.`);
  }
}

const undone = applyEditorCommand(edited, history.undo);
assertEqual(rich.serializeRichMarkdownState(undone).content, source, "one undo restores multi-paragraph source");
const redone = applyEditorCommand(undone, history.redo);
assertEqual(rich.serializeRichMarkdownState(redone).content, expected, "one redo restores multi-paragraph edit");

const renamed = rich.renameRichFootnoteIdentifier(state, {
  identifier: "detail",
  nextIdentifier: "release-note"
});
assertEqual(renamed.handled, true, "multi-paragraph definition rename handled");
assertEqual(
  rich.serializeRichMarkdownState(renamed.state).content,
  source.replaceAll("[^detail]", "[^release-note]"),
  "multi-paragraph rename changes identifier tokens only"
);

const inserted = rich.insertRichFootnote(collapseAfterText(state, "Before uses a detailed note"), {
  preferredIdentifier: "new-note",
  text: "Inserted body"
});
assertEqual(inserted.handled, true, "insertion remains compatible with multi-paragraph definition");
assertIncludes(
  rich.serializeRichMarkdownState(inserted.state).content,
  "Before uses a detailed note[^new-note][^detail] twice[^detail].",
  "inserted reference remains targeted"
);

const crlfSource = [
  "Before[^note].",
  "",
  "  [^note]:   First paragraph.",
  "",
  "     Second paragraph.",
  "     Its continuation line.",
  "",
  "After.",
  ""
].join("\r\n");
const crlfState = rich.createRichMarkdownState(crlfSource, { dialect: "momentarise-enhanced" });
const crlfDefinition = topLevelNodes(crlfState).find((node) => node.type.name === "footnote_definition");
assertEqual(crlfDefinition?.childCount, 2, "CRLF definition exposes both paragraphs");
const crlfEdited = rich.replaceFirstRichText(crlfState, "Second paragraph", "Edited second paragraph");
assertEqual(
  rich.serializeRichMarkdownState(crlfEdited).content,
  crlfSource.replace("Second paragraph", "Edited second paragraph"),
  "CRLF, separator, and five-space continuation indentation survive"
);

const duplicateSource = "Before[^dup].\n\n[^dup]: First paragraph.\n\n    Second paragraph.\n\n[^dup]: Duplicate stays source-only.\n";
const duplicateState = rich.createRichMarkdownState(duplicateSource, { dialect: "momentarise-enhanced" });
assertEqual(
  topLevelNodes(duplicateState).filter((node) => node.type.name === "footnote_definition").length,
  0,
  "duplicate definitions remain source-only"
);
assertEqual(rich.serializeRichMarkdownState(duplicateState).content, duplicateSource, "duplicate source identity");

const staleState = { ...state, source: "Externally changed source.\n" };
const staleRename = rich.renameRichFootnoteIdentifier(staleState, {
  identifier: "detail",
  nextIdentifier: "stale-detail"
});
assertEqual(staleRename.handled, false, "stale multi-paragraph rename rejected");
assertEqual(staleRename.reason, "stale-source", "stale multi-paragraph rejection reason");
assertEqual(staleRename.state, staleState, "stale multi-paragraph rejection does not mutate state");

const nestedRename = rich.renameRichFootnoteIdentifier(state, {
  identifier: "nested-block",
  nextIdentifier: "nested-renamed"
});
assertEqual(nestedRename.handled, true, "simple-list definition rename handled");
assertEqual(
  rich.serializeRichMarkdownState(nestedRename.state).content,
  source.replaceAll("[^nested-block]", "[^nested-renamed]"),
  "simple-list definition rename changes identifier tokens only"
);

const saveTarget = save.createMemorySaveTarget({ initialContent: source });
const saveEngine = save.createSaveEngine({ content: source, target: saveTarget });
saveEngine.updateContent(editedOutput, { now: new Date("2026-07-21T00:00:00.000Z") });
assertEqual(saveEngine.getState().status, "dirty", "multi-paragraph edit marks save state dirty");
const saved = await saveEngine.flush({ reason: "autosave" });
assertEqual(saved.status, "saved", "multi-paragraph edit autosave status");
assertEqual(saveTarget.readContent(), expected, "multi-paragraph edit autosave content");

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
    throw new Error(`Cannot place insertion cursor after ${JSON.stringify(text)}.`);
  }
  return {
    ...stateValue,
    editorState: stateValue.editorState.apply(
      stateValue.editorState.tr.setSelection(TextSelection.create(stateValue.editorState.doc, position))
    )
  };
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
