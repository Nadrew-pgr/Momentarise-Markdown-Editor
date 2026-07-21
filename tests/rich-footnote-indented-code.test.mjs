import { readFile } from "node:fs/promises";

const rich = await import("../packages/md-rich-prosemirror/dist/index.js");
const save = await import("../packages/md-save/dist/index.js");
const history = await import("prosemirror-history");

const source = await readFile("fixtures/031-indented-code-footnote-editing/input.md", "utf8");
const state = rich.createRichMarkdownState(source, { dialect: "momentarise-enhanced" });
const definitions = topLevelNodes(state).filter((node) => node.type.name === "footnote_definition");

for (const identifier of ["indent-top", "indent-list", "indent-task"]) {
  if (!definitions.some((node) => node.attrs.identifier === identifier)) {
    throw new Error(`Safe indented-code definition must be editable: ${identifier}.`);
  }
}
const topDefinition = definitions.find((node) => node.attrs.identifier === "indent-top");
const listDefinition = definitions.find((node) => node.attrs.identifier === "indent-list");
const taskDefinition = definitions.find((node) => node.attrs.identifier === "indent-task");
const fencedDefinition = definitions.find((node) => node.attrs.identifier === "fenced-existing");
const tableDefinition = definitions.find((node) => node.attrs.identifier === "table-child");
const calloutDefinition = definitions.find((node) => node.attrs.identifier === "callout-child");
const rawHtmlDefinition = definitions.find((node) => node.attrs.identifier === "raw-child");

const topCode = topDefinition?.child(1);
assertEqual(topCode?.type.name, "code_block", "top-level indented code is semantic");
assertEqual(topCode?.attrs.language, null, "indented code has no language");
assertEqual(topCode?.attrs.meta, null, "indented code has no meta");
assertIncludes(topCode?.textContent ?? "", "    const nestedIndent = true;", "internal code indentation remains text");
assertIncludes(topCode?.textContent ?? "", "\n\nconst afterBlank = true;", "blank code line remains semantic");

const orderedList = listDefinition?.child(1);
const orderedItem = orderedList?.child(0);
assertEqual(orderedList?.type.name, "ordered_list", "ordered indented-code list is semantic");
assertEqual(orderedList?.attrs.order, 3, "ordered start remains semantic");
assertEqual(orderedItem?.attrs.loose, true, "ordered indented-code item remains loose");
assertEqual(orderedItem?.child(1).type.name, "code_block", "ordered item indented code is semantic");

const taskList = taskDefinition?.child(1);
const taskItem = taskList?.child(0);
assertEqual(taskItem?.type.name, "todo_item", "task indented-code item is semantic");
assertEqual(taskItem?.attrs.checked, false, "task checked state remains semantic");
assertEqual(taskItem?.attrs.loose, true, "task indented-code item remains loose");
assertEqual(taskItem?.child(1).type.name, "code_block", "task item indented code is semantic");
assertIncludes(taskItem?.child(1).textContent ?? "", "<script>", "script syntax remains inert code text");

assertEqual(fencedDefinition?.child(1).type.name, "code_block", "existing fenced code remains semantic");
assertEqual(fencedDefinition?.child(1).attrs.language, "js", "existing fenced code language remains semantic");
assertEqual(tableDefinition?.child(1).type.name, "table", "safe table now mounts semantically");
assertEqual(calloutDefinition?.child(1).type.name, "callout", "safe callout now mounts semantically");
assertEqual(rawHtmlDefinition?.child(1).type.name, "raw_html_block", "safe raw HTML now mounts as inert source");
assertEqual(rich.serializeRichMarkdownState(state).content, source, "untouched indented-code document identity");
assertNoExactSourceMetadataInDom(topDefinition);

const selectedIndentedInfo = rich.selectFirstRichText(state, "const editTop = true;");
assertEqual(rich.getCurrentCodeBlockInfo(selectedIndentedInfo), null, "indented code exposes no fence info controls");
assertEqual(
  rich.serializeRichMarkdownState(
    rich.setCurrentCodeBlockInfo(selectedIndentedInfo, { language: "js", meta: 'title="ignored"' })
  ).content,
  source,
  "indented code rejects non-persistable language/meta changes"
);

const topEdited = rich.replaceFirstRichText(state, "const editTop = true;", "const editedTop = true;");
const expectedTopEdit = source.replace("const editTop = true;", "const editedTop = true;");
const topOutput = rich.serializeRichMarkdownState(topEdited).content;
assertEqual(topOutput, expectedTopEdit, "top-level code edit changes only bounded indented source");
assertNotIncludes(topOutput, "```", "changed top-level indented code is not converted to a fence before existing fence");
assertStableCodeShape(topOutput, "const editedTop = true;", ["footnote_definition", "code_block"]);

const multilineEdited = rich.replaceFirstRichText(
  state,
  "const editTop = true;",
  "const editedTop = true;\n  const keepsLeadingSpaces = true;\n\nconst addedAfterBlank = true;"
);
const multilineOutput = rich.serializeRichMarkdownState(multilineEdited).content;
assertIncludes(
  multilineOutput,
  "        const editedTop = true;\n          const keepsLeadingSpaces = true;\n\n        const addedAfterBlank = true;",
  "changed top-level code uses deterministic block indentation and retains internal whitespace"
);
assertStableCodeShape(multilineOutput, "const addedAfterBlank = true;", ["footnote_definition", "code_block"]);

const listEdited = rich.replaceFirstRichText(state, "const editList = 1;", "const editedList = 2;");
const expectedListEdit = source.replace("const editList = 1;", "const editedList = 2;");
const listOutput = rich.serializeRichMarkdownState(listEdited).content;
assertEqual(listOutput, expectedListEdit, "ordered-item code edit changes only bounded list child");
assertStableCodeShape(listOutput, "const editedList = 2;", [
  "footnote_definition",
  "ordered_list",
  "list_item",
  "code_block"
]);

const taskEdited = rich.replaceFirstRichText(state, 'echo "edit task"', 'echo "edited task"');
const expectedTaskEdit = source.replace('echo "edit task"', 'echo "edited task"');
const taskOutput = rich.serializeRichMarkdownState(taskEdited).content;
assertEqual(taskOutput, expectedTaskEdit, "task-item code edit changes only bounded list child");
assertStableCodeShape(taskOutput, 'echo "edited task"', [
  "footnote_definition",
  "bullet_list",
  "todo_item",
  "code_block"
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
  "[^quote-code]:",
  "[^mixed-containers]:",
  "[^nested-container]:"
]) {
  const fallback = fallbacks.find((node) => String(node.attrs.raw ?? "").includes(marker));
  if (!fallback || !/footnote/i.test(String(fallback.attrs.reason ?? ""))) {
    throw new Error(`Expected explicit source-only footnote fallback for ${marker}.`);
  }
}
for (const fallbackText of ["const quoted = true;", "const firstContainer = true;"]) {
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
assertEqual(rich.serializeRichMarkdownState(topUndone).content, source, "one undo restores indented-code source");
const topRedone = applyEditorCommand(topUndone, history.redo);
assertEqual(rich.serializeRichMarkdownState(topRedone).content, expectedTopEdit, "one redo restores code edit");

const selected = rich.selectRichFootnoteDefinition(state, { identifier: "indent-list" });
assertEqual(selected.editorState.selection.empty, false, "indented-code definition selection remains available");
const replaced = rich.replaceRichFootnoteDefinitionText(state, {
  identifier: "indent-top",
  text: "Whole indented-code definition replaced"
});
assertIncludes(
  rich.serializeRichMarkdownState(replaced).content,
  "[^indent-top]: Whole indented-code definition replaced",
  "whole-definition replacement remains compatible"
);
const renamed = rich.renameRichFootnoteIdentifier(state, {
  identifier: "indent-task",
  nextIdentifier: "release-indent"
});
assertEqual(renamed.handled, true, "indented-code definition rename handled");
assertEqual(
  rich.serializeRichMarkdownState(renamed.state).content,
  source.replaceAll("[^indent-task]", "[^release-indent]"),
  "indented-code definition rename changes identifier tokens only"
);

const crlfSource = [
  "Before[^note].",
  "",
  "  [^note]:   Code guidance.",
  "",
  "         const edit = true;",
  "         const keep = true;",
  "",
  "After.",
  ""
].join("\r\n");
const crlfState = rich.createRichMarkdownState(crlfSource, { dialect: "momentarise-enhanced" });
const crlfDefinition = topLevelNodes(crlfState).find((node) => node.type.name === "footnote_definition");
assertEqual(crlfDefinition?.child(1).type.name, "code_block", "CRLF indented code mounts semantically");
const crlfEdited = rich.replaceFirstRichText(crlfState, "const edit = true;", "const edited = true;");
assertEqual(
  rich.serializeRichMarkdownState(crlfEdited).content,
  crlfSource.replace("const edit = true;", "const edited = true;"),
  "CRLF, prefix spacing, five-space outer indentation, and code indentation survive"
);

const duplicateSource = [
  "Before[^dup].",
  "",
  "[^dup]: First.",
  "",
  "        const first = true;",
  "",
  "[^dup]: Duplicate.",
  "",
  "        const second = true;",
  ""
].join("\n");
const duplicateState = rich.createRichMarkdownState(duplicateSource, { dialect: "momentarise-enhanced" });
assertEqual(
  topLevelNodes(duplicateState).filter((node) => node.type.name === "footnote_definition").length,
  0,
  "duplicate indented-code definitions remain source-only"
);
assertEqual(rich.serializeRichMarkdownState(duplicateState).content, duplicateSource, "duplicate code source identity");

const invalidIndentSource = [
  "Before[^bad].",
  "",
  "[^bad]: First.",
  "",
  "        const first = true;",
  "\t    const mixedOuterIndent = true;",
  ""
].join("\n");
const invalidIndentState = rich.createRichMarkdownState(invalidIndentSource, { dialect: "momentarise-enhanced" });
assertEqual(
  topLevelNodes(invalidIndentState).filter((node) => node.type.name === "footnote_definition").length,
  0,
  "mixed outer indentation remains source-only"
);
assertEqual(
  rich.serializeRichMarkdownState(invalidIndentState).content,
  invalidIndentSource,
  "invalid-indent code source identity"
);

const staleState = { ...state, source: "Externally changed source.\n" };
const staleRename = rich.renameRichFootnoteIdentifier(staleState, {
  identifier: "indent-top",
  nextIdentifier: "stale-indent"
});
assertEqual(staleRename.handled, false, "stale indented-code rename rejected");
assertEqual(staleRename.reason, "stale-source", "stale indented-code rejection reason");
assertEqual(staleRename.state, staleState, "stale indented-code rejection does not mutate state");

const saveTarget = save.createMemorySaveTarget({ initialContent: source });
const saveEngine = save.createSaveEngine({ content: source, target: saveTarget });
saveEngine.updateContent(listOutput, { now: new Date("2026-07-21T00:00:00.000Z") });
assertEqual(saveEngine.getState().status, "dirty", "indented-code edit marks save state dirty");
assertEqual(saveEngine.getState().currentHash, save.hashMarkdownContent(listOutput), "indented-code edit save hash");
const saved = await saveEngine.flush({ reason: "autosave" });
assertEqual(saved.status, "saved", "indented-code edit autosave status");
assertEqual(saveTarget.readContent(), expectedListEdit, "indented-code edit autosave content");

function assertStableCodeShape(markdown, text, expectedAncestors) {
  const reparsed = rich.createRichMarkdownState(markdown, { dialect: "momentarise-enhanced" });
  assertEqual(rich.serializeRichMarkdownState(reparsed).content, markdown, "reconstructed indented-code source is stable");
  assertEqual(
    JSON.stringify(textAncestorNames(reparsed, text)),
    JSON.stringify(expectedAncestors),
    `code hierarchy survives reparse for ${JSON.stringify(text)}`
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

function assertNotIncludes(value, unexpectedValue, label) {
  const beforeExistingFence = value.slice(0, value.indexOf("[^fenced-existing]:"));
  if (beforeExistingFence.includes(unexpectedValue)) {
    throw new Error(`${label}: found ${JSON.stringify(unexpectedValue)}.\n${beforeExistingFence}`);
  }
}

function assertEqual(actual, expectedValue, label) {
  if (actual !== expectedValue) {
    throw new Error(`${label}: expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actual)}.`);
  }
}
