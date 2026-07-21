import { readFile } from "node:fs/promises";

const rich = await import("../packages/md-rich-prosemirror/dist/index.js");
const save = await import("../packages/md-save/dist/index.js");
const history = await import("prosemirror-history");
const { TextSelection } = await import("prosemirror-state");

const source = await readFile("fixtures/028-loose-list-footnote-editing/input.md", "utf8");
const state = rich.createRichMarkdownState(source, { dialect: "momentarise-enhanced" });
const definitions = topLevelNodes(state).filter((node) => node.type.name === "footnote_definition");

assertEqual(definitions.length, 7, "safe loose bullet, task, ordered, quoted, code, table, and callout definitions must be editable");
const bulletDefinition = definitions.find((node) => node.attrs.identifier === "loose-bullets");
const taskDefinition = definitions.find((node) => node.attrs.identifier === "loose-task");
const orderedDefinition = definitions.find((node) => node.attrs.identifier === "loose-ordered");
const quoteDefinition = definitions.find((node) => node.attrs.identifier === "quoted-child");
const codeDefinition = definitions.find((node) => node.attrs.identifier === "code-child");
const tableDefinition = definitions.find((node) => node.attrs.identifier === "table-child");
const calloutDefinition = definitions.find((node) => node.attrs.identifier === "callout-child");

const bulletList = bulletDefinition?.child(1);
assertEqual(bulletList?.type.name, "bullet_list", "loose bullet list is semantic");
assertEqual(bulletList?.attrs.loose, true, "list-level spread is semantic");
assertEqual(bulletList?.child(0).attrs.loose, true, "multi-paragraph bullet item is semantic");
assertEqual(bulletList?.child(0).childCount, 2, "bullet item exposes both paragraphs");
assertEqual(bulletList?.child(0).child(1).type.name, "paragraph", "second bullet paragraph is editable");

const taskList = taskDefinition?.child(1);
assertEqual(taskList?.child(0).type.name, "todo_item", "loose task item is semantic");
assertEqual(taskList?.child(0).attrs.loose, true, "task item loose state is semantic");
assertEqual(taskList?.child(0).attrs.checked, false, "unchecked task state is semantic");
assertEqual(taskList?.child(0).childCount, 2, "task item exposes both paragraphs");

const orderedList = orderedDefinition?.child(1);
const orderedParent = orderedList?.child(0);
assertEqual(orderedList?.type.name, "ordered_list", "loose ordered list is semantic");
assertEqual(orderedList?.attrs.order, 3, "outer ordered start remains semantic");
assertEqual(orderedList?.attrs.loose, true, "ordered spread is semantic");
assertEqual(orderedParent?.childCount, 3, "ordered item exposes two paragraphs and one nested list");
assertEqual(orderedParent?.child(2).type.name, "ordered_list", "safe nested list remains semantic");
assertEqual(orderedParent?.child(2).attrs.order, 7, "nested ordered start remains semantic");
assertEqual(
  quoteDefinition?.child(1).child(0).child(1).type.name,
  "blockquote",
  "safe loose-item quote now mounts semantically"
);
assertEqual(
  tableDefinition?.child(1).child(0).child(1).type.name,
  "table",
  "safe loose-item table now mounts semantically"
);
assertEqual(
  codeDefinition?.child(1).child(0).child(1).type.name,
  "code_block",
  "safe loose-item indented code now mounts semantically"
);
assertEqual(
  calloutDefinition?.child(1).child(0).child(1).type.name,
  "callout",
  "safe loose-item callout now mounts semantically"
);
assertEqual(rich.serializeRichMarkdownState(state).content, source, "untouched loose-list document identity");
assertNoExactSourceMetadataInDom(orderedDefinition);

const paragraphEdited = rich.replaceFirstRichText(
  state,
  "Edit second paragraph in first item",
  "Edited second paragraph in first item"
);
const expectedParagraphEdit = source.replace(
  "Edit second paragraph in first item",
  "Edited second paragraph in first item"
);
const paragraphOutput = rich.serializeRichMarkdownState(paragraphEdited).content;
assertEqual(paragraphOutput, expectedParagraphEdit, "second paragraph edit changes only bounded list child");
assertStableLooseShape(paragraphOutput, "Edited second paragraph in first item", "list_item", true);

const nestedEdited = rich.replaceFirstRichText(state, "Edit nested seventh item", "Edited nested seventh item");
const expectedNestedEdit = source.replace("Edit nested seventh item", "Edited nested seventh item");
const nestedOutput = rich.serializeRichMarkdownState(nestedEdited).content;
assertEqual(nestedOutput, expectedNestedEdit, "nested loose-list edit preserves hierarchy and starts");
assertStableLooseShape(nestedOutput, "Edited nested seventh item", "list_item", false);

const selectedTask = setCursorInText(state, "Edit task second paragraph");
const toggled = rich.toggleCurrentTodoItem(selectedTask);
const expectedToggle = source.replace("- [ ] Task first paragraph.", "- [x] Task first paragraph.");
const toggleOutput = rich.serializeRichMarkdownState(toggled).content;
assertEqual(toggleOutput, expectedToggle, "loose task toggle changes only bounded list child");
assertEqual(findTextAncestor(toggled, "Task first paragraph", "todo_item")?.attrs.checked, true, "task toggled");
assertStableLooseShape(toggleOutput, "Edit task second paragraph", "todo_item", true);

for (const preserved of [
  "    Closing bullet paragraph stays byte-exact.",
  "      Keep sibling second paragraph.",
  "       8. Keep nested eighth item.",
  "[^multiple-nested]: Multiple nested lists stay source-only.",
  'Neighbor <x-unknown keep="exact">syntax</x-unknown> stays byte-exact.',
  "Final paragraph stays byte-exact."
]) {
  assertIncludes(paragraphOutput, preserved, `preserved source ${preserved}`);
}

const fallbacks = collectNodesByType(state.editorState.doc, "unsupported_block");
for (const marker of [
  "[^multiple-nested]:",
  "[^raw-child]:",
  "[^nested-container]:"
]) {
  const fallback = fallbacks.find((node) => String(node.attrs.raw ?? "").includes(marker));
  if (!fallback || !/footnote/i.test(String(fallback.attrs.reason ?? ""))) {
    throw new Error(`Expected explicit source-only footnote fallback for ${marker}.`);
  }
}

const paragraphUndone = applyEditorCommand(paragraphEdited, history.undo);
assertEqual(rich.serializeRichMarkdownState(paragraphUndone).content, source, "one undo restores loose paragraph source");
const paragraphRedone = applyEditorCommand(paragraphUndone, history.redo);
assertEqual(
  rich.serializeRichMarkdownState(paragraphRedone).content,
  expectedParagraphEdit,
  "one redo restores loose paragraph edit"
);
const toggleUndone = applyEditorCommand(toggled, history.undo);
assertEqual(rich.serializeRichMarkdownState(toggleUndone).content, source, "one undo restores loose task state");
const toggleRedone = applyEditorCommand(toggleUndone, history.redo);
assertEqual(rich.serializeRichMarkdownState(toggleRedone).content, expectedToggle, "one redo restores loose task state");

const selected = rich.selectRichFootnoteDefinition(state, { identifier: "loose-ordered" });
assertEqual(selected.editorState.selection.empty, false, "loose definition selection remains available");
const replaced = rich.replaceRichFootnoteDefinitionText(state, {
  identifier: "loose-bullets",
  text: "Whole loose definition replaced"
});
assertIncludes(
  rich.serializeRichMarkdownState(replaced).content,
  "[^loose-bullets]: Whole loose definition replaced",
  "whole-definition replacement remains compatible"
);
const renamed = rich.renameRichFootnoteIdentifier(state, {
  identifier: "loose-task",
  nextIdentifier: "release-checklist"
});
assertEqual(renamed.handled, true, "loose definition rename handled");
assertEqual(
  rich.serializeRichMarkdownState(renamed.state).content,
  source.replaceAll("[^loose-task]", "[^release-checklist]"),
  "loose definition rename changes identifier tokens only"
);
const inserted = rich.insertRichFootnote(collapseAfterText(state, "Before uses loose bullets"), {
  preferredIdentifier: "new-loose-note",
  text: "Inserted body"
});
assertEqual(inserted.handled, true, "footnote insertion remains compatible with loose definitions");
assertIncludes(
  rich.serializeRichMarkdownState(inserted.state).content,
  "Before uses loose bullets[^new-loose-note][^loose-bullets]",
  "inserted reference remains targeted"
);

const crlfSource = [
  "Before[^note].",
  "",
  "  [^note]:   Loose checklist.",
  "",
  "     - [ ] First paragraph.",
  "",
  "       Edit second paragraph.",
  "",
  "     - [x] Keep sibling.",
  "",
  "After.",
  ""
].join("\r\n");
const crlfState = rich.createRichMarkdownState(crlfSource, { dialect: "momentarise-enhanced" });
const crlfDefinition = topLevelNodes(crlfState).find((node) => node.type.name === "footnote_definition");
assertEqual(crlfDefinition?.child(1).child(0).childCount, 2, "CRLF loose task mounts semantically");
const crlfEdited = rich.replaceFirstRichText(crlfState, "Edit second paragraph", "Edited second paragraph");
assertEqual(
  rich.serializeRichMarkdownState(crlfEdited).content,
  crlfSource.replace("Edit second paragraph", "Edited second paragraph"),
  "CRLF, prefix spacing, five-space container indent, and blank lines survive"
);

const duplicateSource = [
  "Before[^dup].",
  "",
  "[^dup]: First.",
  "",
  "    - First paragraph.",
  "",
  "      Second paragraph.",
  "",
  "[^dup]: Duplicate.",
  "",
  "    - Other paragraph.",
  "",
  "      Other detail.",
  ""
].join("\n");
const duplicateState = rich.createRichMarkdownState(duplicateSource, { dialect: "momentarise-enhanced" });
assertEqual(
  topLevelNodes(duplicateState).filter((node) => node.type.name === "footnote_definition").length,
  0,
  "duplicate loose definitions remain source-only"
);
assertEqual(rich.serializeRichMarkdownState(duplicateState).content, duplicateSource, "duplicate source identity");

const staleState = { ...state, source: "Externally changed source.\n" };
const staleRename = rich.renameRichFootnoteIdentifier(staleState, {
  identifier: "loose-bullets",
  nextIdentifier: "stale-loose"
});
assertEqual(staleRename.handled, false, "stale loose definition rename rejected");
assertEqual(staleRename.reason, "stale-source", "stale loose rejection reason");
assertEqual(staleRename.state, staleState, "stale rejection does not mutate state");

const saveTarget = save.createMemorySaveTarget({ initialContent: source });
const saveEngine = save.createSaveEngine({ content: source, target: saveTarget });
saveEngine.updateContent(toggleOutput, { now: new Date("2026-07-21T00:00:00.000Z") });
assertEqual(saveEngine.getState().status, "dirty", "loose task toggle marks save state dirty");
assertEqual(saveEngine.getState().currentHash, save.hashMarkdownContent(toggleOutput), "loose task save hash");
const saved = await saveEngine.flush({ reason: "autosave" });
assertEqual(saved.status, "saved", "loose task autosave status");
assertEqual(saveTarget.readContent(), expectedToggle, "loose task autosave content");

function assertStableLooseShape(markdown, text, ancestorType, expectedLoose) {
  const reparsed = rich.createRichMarkdownState(markdown, { dialect: "momentarise-enhanced" });
  assertEqual(rich.serializeRichMarkdownState(reparsed).content, markdown, "reconstructed loose source is stable");
  const ancestor = findTextAncestor(reparsed, text, ancestorType);
  if (!ancestor) {
    throw new Error(`Expected ${ancestorType} ancestor for ${JSON.stringify(text)} after reparse.`);
  }
  assertEqual(ancestor.attrs.loose, expectedLoose, `${ancestorType} loose state survives reparse`);
}

function setCursorInText(stateValue, text) {
  let position = null;
  stateValue.editorState.doc.descendants((node, offset) => {
    if (!node.isText || typeof node.text !== "string") {
      return true;
    }
    const index = node.text.indexOf(text);
    if (index < 0) {
      return true;
    }
    position = offset + index + 1;
    return false;
  });
  if (position === null) {
    throw new Error(`Cannot place cursor inside ${JSON.stringify(text)}.`);
  }
  return {
    ...stateValue,
    editorState: stateValue.editorState.apply(
      stateValue.editorState.tr.setSelection(TextSelection.create(stateValue.editorState.doc, position))
    )
  };
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

function findTextAncestor(stateValue, text, typeName) {
  let result = null;
  stateValue.editorState.doc.descendants((node, position) => {
    if (!node.isText || typeof node.text !== "string" || !node.text.includes(text)) {
      return true;
    }
    const $position = stateValue.editorState.doc.resolve(position);
    for (let depth = $position.depth; depth > 0; depth -= 1) {
      if ($position.node(depth).type.name === typeName) {
        result = $position.node(depth);
        return false;
      }
    }
    return false;
  });
  return result;
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
