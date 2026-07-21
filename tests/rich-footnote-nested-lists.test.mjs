import { readFile } from "node:fs/promises";

const rich = await import("../packages/md-rich-prosemirror/dist/index.js");
const save = await import("../packages/md-save/dist/index.js");
const history = await import("prosemirror-history");
const { TextSelection } = await import("prosemirror-state");

const source = await readFile("fixtures/026-nested-list-footnote-editing/input.md", "utf8");
const state = rich.createRichMarkdownState(source, { dialect: "momentarise-enhanced" });
const definitions = topLevelNodes(state).filter((node) => node.type.name === "footnote_definition");

assertEqual(definitions.length, 3, "safe nested bullet, ordered, and task definitions must be editable");
const bulletDefinition = definitions.find((node) => node.attrs.identifier === "nested-bullets");
const orderedDefinition = definitions.find((node) => node.attrs.identifier === "nested-ordered");
const taskDefinition = definitions.find((node) => node.attrs.identifier === "task-nested");
const bulletList = bulletDefinition?.child(1);
const bulletChildList = bulletList?.child(0).child(1);
const bulletGrandchildList = bulletChildList?.child(0).child(1);
assertEqual(bulletList?.type.name, "bullet_list", "top-level bullet child is semantic");
assertEqual(bulletChildList?.type.name, "bullet_list", "nested bullet child is semantic");
assertEqual(bulletGrandchildList?.type.name, "bullet_list", "deep bullet child is semantic");
assertEqual(bulletGrandchildList?.childCount, 2, "deep bullet siblings remain editable");

const orderedList = orderedDefinition?.child(1);
const orderedChildList = orderedList?.child(0).child(1);
const orderedGrandchildList = orderedChildList?.child(0).child(1);
assertEqual(orderedList?.type.name, "ordered_list", "top-level ordered child is semantic");
assertEqual(orderedList?.attrs.order, 3, "top-level ordered start remains semantic");
assertEqual(orderedChildList?.type.name, "ordered_list", "nested ordered child is semantic");
assertEqual(orderedChildList?.attrs.order, 1, "nested ordered start remains semantic");
assertEqual(orderedGrandchildList?.attrs.order, 1, "deep ordered start remains semantic");
assertEqual(
  taskDefinition?.child(1).child(0).child(1).child(0).type.name,
  "todo_item",
  "safe nested task now uses semantic todo node"
);
assertEqual(
  taskDefinition?.child(1).child(0).child(1).child(0).attrs.checked,
  false,
  "nested unchecked task state is semantic"
);
assertEqual(rich.serializeRichMarkdownState(state).content, source, "untouched nested-list document identity");
assertNoExactSourceMetadataInDom(bulletDefinition);

const bulletEdited = rich.replaceFirstRichText(state, "Edit deepest bullet", "Edited deepest bullet");
const bulletOutput = rich.serializeRichMarkdownState(bulletEdited).content;
const expectedBullet = source.replace("Edit deepest bullet", "Edited deepest bullet");
assertEqual(bulletOutput, expectedBullet, "deep bullet edit changes only its bounded top-level list child");

const orderedEdited = rich.replaceFirstRichText(state, "Edit deepest ordered item", "Edited deepest ordered item");
assertEqual(
  rich.serializeRichMarkdownState(orderedEdited).content,
  source.replace("Edit deepest ordered item", "Edited deepest ordered item"),
  "deep ordered edit preserves hierarchy, starts, and unrelated bytes"
);

for (const preserved of [
  "[^nested-bullets]: Bullet hierarchy starts here.",
  "        - Keep deep bullet sibling",
  "      - Keep child bullet sibling",
  "    - Keep outer bullet sibling",
  "    Closing bullet paragraph stays byte-exact.",
  "[^nested-ordered]: Ordered hierarchy starts here.",
  "          2. Keep deep ordered sibling",
  'Neighbor <x-unknown keep="exact">syntax</x-unknown> stays byte-exact.',
  "Final paragraph stays byte-exact."
]) {
  assertIncludes(bulletOutput, preserved, `preserved source ${preserved}`);
}

const fallbacks = collectNodesByType(state.editorState.doc, "unsupported_block");
for (const marker of [
  "[^loose-nested]:",
  "[^multiple-nested]:",
  "[^quoted-nested]:",
  "[^unsafe-nested]:",
  "[^nested-container]:"
]) {
  const fallback = fallbacks.find((node) => String(node.attrs.raw ?? "").includes(marker));
  if (!fallback || !/footnote/i.test(String(fallback.attrs.reason ?? ""))) {
    throw new Error(`Expected explicit source-only footnote fallback for ${marker}.`);
  }
}

const undone = applyEditorCommand(bulletEdited, history.undo);
assertEqual(rich.serializeRichMarkdownState(undone).content, source, "one undo restores nested-list source");
const redone = applyEditorCommand(undone, history.redo);
assertEqual(rich.serializeRichMarkdownState(redone).content, expectedBullet, "one redo restores deep nested edit");

const selected = rich.selectRichFootnoteDefinition(state, { identifier: "nested-bullets" });
assertEqual(selected.editorState.selection.empty, false, "nested-list definition selection remains available");
const wholeBody = rich.replaceRichFootnoteDefinitionText(state, {
  identifier: "nested-bullets",
  text: "Whole nested definition replaced"
});
assertIncludes(
  rich.serializeRichMarkdownState(wholeBody).content,
  "[^nested-bullets]: Whole nested definition replaced",
  "whole-definition replacement remains compatible"
);

const renamed = rich.renameRichFootnoteIdentifier(state, {
  identifier: "nested-bullets",
  nextIdentifier: "nested-plan"
});
assertEqual(renamed.handled, true, "nested-list definition rename handled");
assertEqual(
  rich.serializeRichMarkdownState(renamed.state).content,
  source.replaceAll("[^nested-bullets]", "[^nested-plan]"),
  "nested-list rename changes identifier tokens only"
);

const inserted = rich.insertRichFootnote(collapseAfterText(state, "Before uses nested bullets"), {
  preferredIdentifier: "new-note",
  text: "Inserted body"
});
assertEqual(inserted.handled, true, "insertion remains compatible with nested-list definitions");
assertIncludes(
  rich.serializeRichMarkdownState(inserted.state).content,
  "Before uses nested bullets[^new-note][^nested-bullets]",
  "inserted reference remains targeted"
);

const crlfSource = [
  "Before[^note].",
  "",
  "  [^note]:   Intro paragraph.",
  "",
  "     - Parent item.",
  "       - Edit nested item.",
  "       - Keep nested sibling.",
  "     - Keep outer sibling.",
  "",
  "After.",
  ""
].join("\r\n");
const crlfState = rich.createRichMarkdownState(crlfSource, { dialect: "momentarise-enhanced" });
const crlfDefinition = topLevelNodes(crlfState).find((node) => node.type.name === "footnote_definition");
assertEqual(
  crlfDefinition?.child(1).child(0).child(1).type.name,
  "bullet_list",
  "CRLF five-space nested list mounts semantically"
);
const crlfEdited = rich.replaceFirstRichText(crlfState, "Edit nested item", "Edited nested item");
assertEqual(
  rich.serializeRichMarkdownState(crlfEdited).content,
  crlfSource.replace("Edit nested item", "Edited nested item"),
  "CRLF, prefix spacing, five-space container indent, and nested indent survive"
);

const duplicateSource = [
  "Before[^dup].",
  "",
  "[^dup]: First.",
  "",
  "    - Parent",
  "      - First nested item",
  "",
  "[^dup]: Duplicate.",
  "",
  "    - Parent",
  "      - Second nested item",
  ""
].join("\n");
const duplicateState = rich.createRichMarkdownState(duplicateSource, { dialect: "momentarise-enhanced" });
assertEqual(
  topLevelNodes(duplicateState).filter((node) => node.type.name === "footnote_definition").length,
  0,
  "duplicate nested-list definitions remain source-only"
);
assertEqual(rich.serializeRichMarkdownState(duplicateState).content, duplicateSource, "duplicate source identity");

const staleState = { ...state, source: "Externally changed source.\n" };
const staleRename = rich.renameRichFootnoteIdentifier(staleState, {
  identifier: "nested-bullets",
  nextIdentifier: "stale-nested"
});
assertEqual(staleRename.handled, false, "stale nested-list rename rejected");
assertEqual(staleRename.reason, "stale-source", "stale nested-list rejection reason");
assertEqual(staleRename.state, staleState, "stale rejection does not mutate state");

const saveTarget = save.createMemorySaveTarget({ initialContent: source });
const saveEngine = save.createSaveEngine({ content: source, target: saveTarget });
saveEngine.updateContent(bulletOutput, { now: new Date("2026-07-21T00:00:00.000Z") });
assertEqual(saveEngine.getState().status, "dirty", "deep nested edit marks save state dirty");
assertEqual(saveEngine.getState().currentHash, save.hashMarkdownContent(bulletOutput), "deep nested edit save hash");
const saved = await saveEngine.flush({ reason: "autosave" });
assertEqual(saved.status, "saved", "deep nested edit autosave status");
assertEqual(saveTarget.readContent(), expectedBullet, "deep nested edit autosave content");

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
