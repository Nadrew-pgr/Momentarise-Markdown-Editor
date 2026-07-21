import { readFile } from "node:fs/promises";

const rich = await import("../packages/md-rich-prosemirror/dist/index.js");
const save = await import("../packages/md-save/dist/index.js");
const history = await import("prosemirror-history");
const { TextSelection } = await import("prosemirror-state");

const source = await readFile("fixtures/025-list-block-footnote-editing/input.md", "utf8");
const state = rich.createRichMarkdownState(source, { dialect: "momentarise-enhanced" });
const definitions = topLevelNodes(state).filter((node) => node.type.name === "footnote_definition");

assertEqual(definitions.length, 2, "safe bullet and ordered-list definitions must be editable");
const stepsDefinition = definitions.find((node) => node.attrs.identifier === "steps");
const orderedDefinition = definitions.find((node) => node.attrs.identifier === "ordered");
assertEqual(stepsDefinition?.childCount, 3, "paragraph, bullet list, and closing paragraph child blocks");
assertEqual(stepsDefinition?.child(1).type.name, "bullet_list", "safe bullet list uses semantic list node");
assertEqual(stepsDefinition?.child(1).childCount, 3, "all bullet items remain editable");
assertEqual(stepsDefinition?.child(1).child(1).childCount, 1, "safe bullet item has one paragraph");
assertEqual(orderedDefinition?.child(1).type.name, "ordered_list", "safe ordered list uses semantic list node");
assertEqual(orderedDefinition?.child(1).attrs.order, 3, "ordered-list start value remains semantic");
assertEqual(rich.serializeRichMarkdownState(state).content, source, "untouched list-footnote document identity");
assertNoExactSourceMetadataInDom(stepsDefinition);

const edited = rich.replaceFirstRichText(state, "Edit this list item", "Edited list item");
const editedOutput = rich.serializeRichMarkdownState(edited).content;
const expected = source.replace("Edit this list item", "Edited list item");
assertEqual(editedOutput, expected, "bullet-item edit changes only its bounded definition child");
for (const preserved of [
  "[^steps]: Follow these steps.",
  "    - Keep **bold source**",
  "    - Preserve `inline code`",
  "    Closing paragraph stays byte-exact.",
  "[^ordered]: Ordered instructions begin.",
  "    3. Third-numbered item",
  'Neighbor <x-unknown keep="exact">syntax</x-unknown> stays byte-exact.',
  "Final paragraph stays byte-exact."
]) {
  assertIncludes(editedOutput, preserved, `preserved source ${preserved}`);
}

const orderedEdited = rich.replaceFirstRichText(state, "Fourth-numbered item", "Edited fourth item");
assertEqual(
  rich.serializeRichMarkdownState(orderedEdited).content,
  source.replace("Fourth-numbered item", "Edited fourth item"),
  "ordered-item edit preserves start value and bounded source"
);

const fallbacks = collectNodesByType(state.editorState.doc, "unsupported_block");
for (const marker of [
  "[^nested-list]:",
  "[^task-list]:",
  "[^loose-item]:",
  "[^quoted]:",
  "[^unsafe-list]:",
  "[^nested-container]:"
]) {
  const fallback = fallbacks.find((node) => String(node.attrs.raw ?? "").includes(marker));
  if (!fallback || !/footnote/i.test(String(fallback.attrs.reason ?? ""))) {
    throw new Error(`Expected explicit source-only footnote fallback for ${marker}.`);
  }
}

const undone = applyEditorCommand(edited, history.undo);
assertEqual(rich.serializeRichMarkdownState(undone).content, source, "one undo restores list-footnote source");
const redone = applyEditorCommand(undone, history.redo);
assertEqual(rich.serializeRichMarkdownState(redone).content, expected, "one redo restores list-item edit");

const selected = rich.selectRichFootnoteDefinition(state, { identifier: "steps" });
assertEqual(selected.editorState.selection.empty, false, "list-footnote definition selection remains available");
const wholeBody = rich.replaceRichFootnoteDefinitionText(state, {
  identifier: "steps",
  text: "Whole definition replaced"
});
assertEqual(
  rich.serializeRichMarkdownState(wholeBody).content,
  source.replace(
    [
      "[^steps]: Follow these steps.",
      "",
      "    - Keep **bold source**",
      "    - Edit this list item",
      "    - Preserve `inline code`",
      "",
      "    Closing paragraph stays byte-exact."
    ].join("\n"),
    "[^steps]: Whole definition replaced"
  ),
  "whole-definition replacement remains compatible"
);

const renamed = rich.renameRichFootnoteIdentifier(state, {
  identifier: "steps",
  nextIdentifier: "release-steps"
});
assertEqual(renamed.handled, true, "list-footnote rename handled");
assertEqual(
  rich.serializeRichMarkdownState(renamed.state).content,
  source.replaceAll("[^steps]", "[^release-steps]"),
  "list-footnote rename changes identifier tokens only"
);

const inserted = rich.insertRichFootnote(collapseAfterText(state, "Before uses steps"), {
  preferredIdentifier: "new-note",
  text: "Inserted body"
});
assertEqual(inserted.handled, true, "insertion remains compatible with list-footnote definitions");
assertIncludes(
  rich.serializeRichMarkdownState(inserted.state).content,
  "Before uses steps[^new-note][^steps] and ordered guidance[^ordered].",
  "inserted reference remains targeted"
);

const crlfSource = [
  "Before[^note].",
  "",
  "  [^note]:   Intro paragraph.",
  "",
  "     - First item.",
  "     - Second item.",
  "",
  "After.",
  ""
].join("\r\n");
const crlfState = rich.createRichMarkdownState(crlfSource, { dialect: "momentarise-enhanced" });
const crlfDefinition = topLevelNodes(crlfState).find((node) => node.type.name === "footnote_definition");
assertEqual(crlfDefinition?.child(1).type.name, "bullet_list", "CRLF five-space list mounts semantically");
const crlfEdited = rich.replaceFirstRichText(crlfState, "Second item", "Edited second item");
assertEqual(
  rich.serializeRichMarkdownState(crlfEdited).content,
  crlfSource.replace("Second item", "Edited second item"),
  "CRLF, prefix spacing, and five-space container indentation survive"
);

const duplicateSource = [
  "Before[^dup].",
  "",
  "[^dup]: First.",
  "",
  "    - First item",
  "",
  "[^dup]: Duplicate.",
  "",
  "    - Second item",
  ""
].join("\n");
const duplicateState = rich.createRichMarkdownState(duplicateSource, { dialect: "momentarise-enhanced" });
assertEqual(
  topLevelNodes(duplicateState).filter((node) => node.type.name === "footnote_definition").length,
  0,
  "duplicate list definitions remain source-only"
);
assertEqual(rich.serializeRichMarkdownState(duplicateState).content, duplicateSource, "duplicate source identity");

const staleState = { ...state, source: "Externally changed source.\n" };
const staleRename = rich.renameRichFootnoteIdentifier(staleState, {
  identifier: "steps",
  nextIdentifier: "stale-steps"
});
assertEqual(staleRename.handled, false, "stale list-footnote rename rejected");
assertEqual(staleRename.reason, "stale-source", "stale list-footnote rejection reason");
assertEqual(staleRename.state, staleState, "stale rejection does not mutate state");

const saveTarget = save.createMemorySaveTarget({ initialContent: source });
const saveEngine = save.createSaveEngine({ content: source, target: saveTarget });
saveEngine.updateContent(editedOutput, { now: new Date("2026-07-21T00:00:00.000Z") });
assertEqual(saveEngine.getState().status, "dirty", "list-item edit marks save state dirty");
assertEqual(saveEngine.getState().currentHash, save.hashMarkdownContent(editedOutput), "list-item edit save hash");
const saved = await saveEngine.flush({ reason: "autosave" });
assertEqual(saved.status, "saved", "list-item edit autosave status");
assertEqual(saveTarget.readContent(), expected, "list-item edit autosave content");

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

function assertNoExactSourceMetadataInDom(node) {
  const dom = node?.type.spec.toDOM?.(node);
  const serialized = JSON.stringify(dom);
  for (const forbidden of ["blockSources", "blockFingerprints", "paragraphSources", "paragraphFingerprints"]) {
    if (serialized.includes(forbidden)) {
      throw new Error(`Exact source metadata must remain out of rendered DOM: ${forbidden}.`);
    }
  }
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
