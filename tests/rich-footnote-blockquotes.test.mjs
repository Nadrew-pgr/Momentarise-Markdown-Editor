import { readFile } from "node:fs/promises";

const rich = await import("../packages/md-rich-prosemirror/dist/index.js");
const save = await import("../packages/md-save/dist/index.js");
const history = await import("prosemirror-history");

const source = await readFile("fixtures/029-blockquote-footnote-editing/input.md", "utf8");
const state = rich.createRichMarkdownState(source, { dialect: "momentarise-enhanced" });
const definitions = topLevelNodes(state).filter((node) => node.type.name === "footnote_definition");

assertEqual(definitions.length, 4, "safe top-level, ordered-item, task-item quotes, and callout must be editable");
const topDefinition = definitions.find((node) => node.attrs.identifier === "quote-top");
const listDefinition = definitions.find((node) => node.attrs.identifier === "quote-list");
const taskDefinition = definitions.find((node) => node.attrs.identifier === "quote-task");
const calloutDefinition = definitions.find((node) => node.attrs.identifier === "callout");

assertEqual(topDefinition?.child(1).type.name, "blockquote", "top-level quote is semantic");
assertEqual(topDefinition?.child(1).childCount, 2, "top-level quote exposes both paragraphs");
assertEqual(topDefinition?.child(1).child(1).type.name, "paragraph", "second quoted paragraph is editable");

const orderedList = listDefinition?.child(1);
const orderedItem = orderedList?.child(0);
assertEqual(orderedList?.type.name, "ordered_list", "ordered quote list is semantic");
assertEqual(orderedList?.attrs.order, 3, "ordered start remains semantic");
assertEqual(orderedItem?.attrs.loose, true, "ordered quote item remains loose");
assertEqual(orderedItem?.child(1).type.name, "blockquote", "ordered item quote is semantic");
assertEqual(orderedItem?.child(1).childCount, 2, "ordered item quote exposes both paragraphs");

const taskList = taskDefinition?.child(1);
const taskItem = taskList?.child(0);
assertEqual(taskItem?.type.name, "todo_item", "task quote item is semantic");
assertEqual(taskItem?.attrs.checked, false, "task checked state remains semantic");
assertEqual(taskItem?.attrs.loose, true, "task quote item remains loose");
assertEqual(taskItem?.child(1).type.name, "blockquote", "task item quote is semantic");
assertEqual(calloutDefinition?.child(1).type.name, "callout", "safe callout remains semantic");
assertEqual(rich.serializeRichMarkdownState(state).content, source, "untouched blockquote document identity");
assertNoExactSourceMetadataInDom(topDefinition);

const topEdited = rich.replaceFirstRichText(
  state,
  "Edit second quoted paragraph",
  "Edited second quoted paragraph"
);
const expectedTopEdit = source.replace("Edit second quoted paragraph", "Edited second quoted paragraph");
const topOutput = rich.serializeRichMarkdownState(topEdited).content;
assertEqual(topOutput, expectedTopEdit, "top-level quote edit changes only bounded quote source");
assertIncludes(
  topOutput,
  "> First quoted paragraph keeps **bold source**.\n    >\n    > Edited second quoted paragraph.",
  "changed top-level quote keeps quoted paragraph separator"
);
assertStableQuoteShape(topOutput, "Edited second quoted paragraph", ["footnote_definition", "blockquote", "paragraph"]);

const listEdited = rich.replaceFirstRichText(
  state,
  "Edit ordered-item second quote",
  "Edited ordered-item second quote"
);
const expectedListEdit = source.replace("Edit ordered-item second quote", "Edited ordered-item second quote");
const listOutput = rich.serializeRichMarkdownState(listEdited).content;
assertEqual(listOutput, expectedListEdit, "ordered-item quote edit changes only bounded list child");
assertIncludes(
  listOutput,
  "       > First ordered-item quote.\n       >\n       > Edited ordered-item second quote.",
  "changed ordered-item quote keeps hierarchy and separator"
);
assertStableQuoteShape(listOutput, "Edited ordered-item second quote", [
  "footnote_definition",
  "ordered_list",
  "list_item",
  "blockquote",
  "paragraph"
]);

const taskEdited = rich.replaceFirstRichText(
  state,
  "Edit task-item first quote",
  "Edited task-item first quote"
);
const expectedTaskEdit = source.replace("Edit task-item first quote", "Edited task-item first quote");
const taskOutput = rich.serializeRichMarkdownState(taskEdited).content;
assertEqual(taskOutput, expectedTaskEdit, "task-item quote edit changes only bounded list child");
assertStableQuoteShape(taskOutput, "Edited task-item first quote", [
  "footnote_definition",
  "bullet_list",
  "todo_item",
  "blockquote",
  "paragraph"
]);

for (const preserved of [
  "    Closing top-level paragraph stays byte-exact.",
  "    4. Keep ordered sibling.",
  "    - [x] Keep completed task sibling.",
  'Neighbor <x-unknown keep="exact">syntax</x-unknown> stays byte-exact.',
  "Final paragraph stays byte-exact."
]) {
  assertIncludes(topOutput, preserved, `preserved source ${preserved}`);
}

const fallbacks = collectNodesByType(state.editorState.doc, "unsupported_block");
for (const marker of [
  "[^nested-quote]:",
  "[^quote-list-child]:",
  "[^quote-code-child]:",
  "[^quote-table-child]:",
  "[^quote-raw-child]:",
  "[^mixed-containers]:",
  "[^nested-container]:"
]) {
  const fallback = fallbacks.find((node) => String(node.attrs.raw ?? "").includes(marker));
  if (!fallback || !/footnote/i.test(String(fallback.attrs.reason ?? ""))) {
    throw new Error(`Expected explicit source-only footnote fallback for ${marker}.`);
  }
}
for (const fallbackText of ["Outer quote paragraph"]) {
  let rejected = false;
  try {
    rich.replaceFirstRichText(state, fallbackText, `Edited ${fallbackText}`);
  } catch (error) {
    rejected = error instanceof Error && error.message.includes("Could not find rich text");
  }
  assertEqual(rejected, true, `source-only fallback rejects partial Rich edit for ${fallbackText}`);
  assertEqual(rich.serializeRichMarkdownState(state).content, source, "rejected fallback edit leaves source exact");
}

const topUndone = applyEditorCommand(topEdited, history.undo);
assertEqual(rich.serializeRichMarkdownState(topUndone).content, source, "one undo restores quote source");
const topRedone = applyEditorCommand(topUndone, history.redo);
assertEqual(rich.serializeRichMarkdownState(topRedone).content, expectedTopEdit, "one redo restores quote edit");

const selected = rich.selectRichFootnoteDefinition(state, { identifier: "quote-list" });
assertEqual(selected.editorState.selection.empty, false, "quote definition selection remains available");
const replaced = rich.replaceRichFootnoteDefinitionText(state, {
  identifier: "quote-top",
  text: "Whole quote definition replaced"
});
assertIncludes(
  rich.serializeRichMarkdownState(replaced).content,
  "[^quote-top]: Whole quote definition replaced",
  "whole-definition replacement remains compatible"
);
const renamed = rich.renameRichFootnoteIdentifier(state, {
  identifier: "quote-task",
  nextIdentifier: "release-quote"
});
assertEqual(renamed.handled, true, "quote definition rename handled");
assertEqual(
  rich.serializeRichMarkdownState(renamed.state).content,
  source.replaceAll("[^quote-task]", "[^release-quote]"),
  "quote definition rename changes identifier tokens only"
);

const crlfSource = [
  "Before[^note].",
  "",
  "  [^note]:   Quoted guidance.",
  "",
  "     > First quote paragraph.",
  "     >",
  "     > Edit second quote paragraph.",
  "",
  "After.",
  ""
].join("\r\n");
const crlfState = rich.createRichMarkdownState(crlfSource, { dialect: "momentarise-enhanced" });
const crlfDefinition = topLevelNodes(crlfState).find((node) => node.type.name === "footnote_definition");
assertEqual(crlfDefinition?.child(1).type.name, "blockquote", "CRLF quote mounts semantically");
const crlfEdited = rich.replaceFirstRichText(crlfState, "Edit second quote", "Edited second quote");
assertEqual(
  rich.serializeRichMarkdownState(crlfEdited).content,
  crlfSource.replace("Edit second quote", "Edited second quote"),
  "CRLF, prefix spacing, five-space outer indentation, and quote separators survive"
);

const duplicateSource = [
  "Before[^dup].",
  "",
  "[^dup]: First.",
  "",
  "    > First quote.",
  "",
  "[^dup]: Duplicate.",
  "",
  "    > Second quote.",
  ""
].join("\n");
const duplicateState = rich.createRichMarkdownState(duplicateSource, { dialect: "momentarise-enhanced" });
assertEqual(
  topLevelNodes(duplicateState).filter((node) => node.type.name === "footnote_definition").length,
  0,
  "duplicate quote definitions remain source-only"
);
assertEqual(rich.serializeRichMarkdownState(duplicateState).content, duplicateSource, "duplicate quote source identity");

const invalidIndentSource = [
  "Before[^bad].",
  "",
  "[^bad]: First.",
  "",
  "    > First quote.",
  "     >",
  "      > Inconsistent outer indentation.",
  ""
].join("\n");
const invalidIndentState = rich.createRichMarkdownState(invalidIndentSource, { dialect: "momentarise-enhanced" });
assertEqual(
  topLevelNodes(invalidIndentState).filter((node) => node.type.name === "footnote_definition").length,
  0,
  "inconsistent quote indentation remains source-only"
);
assertEqual(
  rich.serializeRichMarkdownState(invalidIndentState).content,
  invalidIndentSource,
  "invalid-indent quote source identity"
);

const staleState = { ...state, source: "Externally changed source.\n" };
const staleRename = rich.renameRichFootnoteIdentifier(staleState, {
  identifier: "quote-top",
  nextIdentifier: "stale-quote"
});
assertEqual(staleRename.handled, false, "stale quote rename rejected");
assertEqual(staleRename.reason, "stale-source", "stale quote rejection reason");
assertEqual(staleRename.state, staleState, "stale quote rejection does not mutate state");

const saveTarget = save.createMemorySaveTarget({ initialContent: source });
const saveEngine = save.createSaveEngine({ content: source, target: saveTarget });
saveEngine.updateContent(taskOutput, { now: new Date("2026-07-21T00:00:00.000Z") });
assertEqual(saveEngine.getState().status, "dirty", "quote edit marks save state dirty");
assertEqual(saveEngine.getState().currentHash, save.hashMarkdownContent(taskOutput), "quote edit save hash");
const saved = await saveEngine.flush({ reason: "autosave" });
assertEqual(saved.status, "saved", "quote edit autosave status");
assertEqual(saveTarget.readContent(), expectedTaskEdit, "quote edit autosave content");

function assertStableQuoteShape(markdown, text, expectedAncestors) {
  const reparsed = rich.createRichMarkdownState(markdown, { dialect: "momentarise-enhanced" });
  assertEqual(rich.serializeRichMarkdownState(reparsed).content, markdown, "reconstructed quote source is stable");
  assertEqual(
    JSON.stringify(textAncestorNames(reparsed, text)),
    JSON.stringify(expectedAncestors),
    `quote hierarchy survives reparse for ${JSON.stringify(text)}`
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
