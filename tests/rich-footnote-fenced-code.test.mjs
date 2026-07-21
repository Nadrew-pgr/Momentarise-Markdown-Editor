import { readFile } from "node:fs/promises";

const rich = await import("../packages/md-rich-prosemirror/dist/index.js");
const save = await import("../packages/md-save/dist/index.js");
const history = await import("prosemirror-history");

const source = await readFile("fixtures/030-fenced-code-footnote-editing/input.md", "utf8");
const state = rich.createRichMarkdownState(source, { dialect: "momentarise-enhanced" });
const definitions = topLevelNodes(state).filter((node) => node.type.name === "footnote_definition");

assertEqual(definitions.length, 5, "safe fenced, indented-code, and table definitions must be editable");
const topDefinition = definitions.find((node) => node.attrs.identifier === "code-top");
const listDefinition = definitions.find((node) => node.attrs.identifier === "code-list");
const taskDefinition = definitions.find((node) => node.attrs.identifier === "code-task");
const indentedDefinition = definitions.find((node) => node.attrs.identifier === "indented-code");
const tableDefinition = definitions.find((node) => node.attrs.identifier === "table-child");

const topCode = topDefinition?.child(1);
assertEqual(topCode?.type.name, "code_block", "top-level fence is semantic");
assertEqual(topCode?.attrs.language, "ts", "top-level fence language remains semantic");
assertEqual(topCode?.attrs.meta, 'title="demo"', "top-level fence meta remains semantic");
assertIncludes(topCode?.textContent ?? "", "```inner", "shorter body fence run remains code text");

const orderedList = listDefinition?.child(1);
const orderedItem = orderedList?.child(0);
assertEqual(orderedList?.type.name, "ordered_list", "ordered code list is semantic");
assertEqual(orderedList?.attrs.order, 3, "ordered start remains semantic");
assertEqual(orderedItem?.attrs.loose, true, "ordered code item remains loose");
assertEqual(orderedItem?.child(1).type.name, "code_block", "ordered item fence is semantic");
assertEqual(orderedItem?.child(1).attrs.meta, 'title="list"', "ordered fence meta remains semantic");

const taskList = taskDefinition?.child(1);
const taskItem = taskList?.child(0);
assertEqual(taskItem?.type.name, "todo_item", "task code item is semantic");
assertEqual(taskItem?.attrs.checked, false, "task checked state remains semantic");
assertEqual(taskItem?.attrs.loose, true, "task code item remains loose");
assertEqual(taskItem?.child(1).type.name, "code_block", "task item fence is semantic");
assertEqual(taskItem?.child(1).attrs.language, "bash", "tilde fence language remains semantic");
assertEqual(taskItem?.child(1).attrs.meta, "title=`task`", "tilde fence backtick meta remains semantic");
assertIncludes(taskItem?.child(1).textContent ?? "", "<script>", "script syntax remains inert code text");
assertEqual(indentedDefinition?.child(1).type.name, "code_block", "safe indented code now mounts semantically");
assertEqual(tableDefinition?.child(1).type.name, "table", "safe table now mounts semantically");
assertEqual(rich.serializeRichMarkdownState(state).content, source, "untouched fenced-code document identity");
assertNoExactSourceMetadataInDom(topDefinition);

const topEdited = rich.replaceFirstRichText(state, "const editTop = true;", "const editedTop = true;");
const expectedTopEdit = source.replace("const editTop = true;", "const editedTop = true;");
const topOutput = rich.serializeRichMarkdownState(topEdited).content;
assertEqual(topOutput, expectedTopEdit, "top-level code edit changes only bounded fence source");
assertStableCodeShape(topOutput, "const editedTop = true;", ["footnote_definition", "code_block"]);

const collisionEdited = rich.replaceFirstRichText(
  state,
  "const editTop = true;",
  "const editedTop = true;\n````\nconst afterFenceRun = true;"
);
const collisionOutput = rich.serializeRichMarkdownState(collisionEdited).content;
assertIncludes(
  collisionOutput,
  '`````ts title="demo"\n    const keep = "exact";\n    ```inner\n    const editedTop = true;\n    ````\n    const afterFenceRun = true;\n    `````',
  "changed code selects fence longer than body marker run"
);
assertStableCodeShape(collisionOutput, "const afterFenceRun = true;", ["footnote_definition", "code_block"]);

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
const taskOutput = rich.serializeRichMarkdownState(taskEdited).content;
assertIncludes(
  taskOutput,
  "      ~~~bash title=`task`\n      echo \"edited task\"\n      <script>window.__MME_CODE_RAN__ = true;</script>\n      ~~~",
  "changed task code uses deterministic tilde fence when info contains backticks"
);
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
  "[^callout-child]:",
  "[^raw-child]:",
  "[^nested-container]:"
]) {
  const fallback = fallbacks.find((node) => String(node.attrs.raw ?? "").includes(marker));
  if (!fallback || !/footnote/i.test(String(fallback.attrs.reason ?? ""))) {
    throw new Error(`Expected explicit source-only footnote fallback for ${marker}.`);
  }
}
for (const fallbackText of ["const quoted = true;"]) {
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
assertEqual(rich.serializeRichMarkdownState(topUndone).content, source, "one undo restores fenced-code source");
const topRedone = applyEditorCommand(topUndone, history.redo);
assertEqual(rich.serializeRichMarkdownState(topRedone).content, expectedTopEdit, "one redo restores code edit");

const selected = rich.selectRichFootnoteDefinition(state, { identifier: "code-list" });
assertEqual(selected.editorState.selection.empty, false, "code definition selection remains available");
const replaced = rich.replaceRichFootnoteDefinitionText(state, {
  identifier: "code-top",
  text: "Whole code definition replaced"
});
assertIncludes(
  rich.serializeRichMarkdownState(replaced).content,
  "[^code-top]: Whole code definition replaced",
  "whole-definition replacement remains compatible"
);
const renamed = rich.renameRichFootnoteIdentifier(state, {
  identifier: "code-task",
  nextIdentifier: "release-code"
});
assertEqual(renamed.handled, true, "code definition rename handled");
assertEqual(
  rich.serializeRichMarkdownState(renamed.state).content,
  source.replaceAll("[^code-task]", "[^release-code]"),
  "code definition rename changes identifier tokens only"
);

const crlfSource = [
  "Before[^note].",
  "",
  "  [^note]:   Code guidance.",
  "",
  "     ```ts title=crlf",
  "     const edit = true;",
  "     ```",
  "",
  "After.",
  ""
].join("\r\n");
const crlfState = rich.createRichMarkdownState(crlfSource, { dialect: "momentarise-enhanced" });
const crlfDefinition = topLevelNodes(crlfState).find((node) => node.type.name === "footnote_definition");
assertEqual(crlfDefinition?.child(1).type.name, "code_block", "CRLF code fence mounts semantically");
const crlfEdited = rich.replaceFirstRichText(crlfState, "const edit = true;", "const edited = true;");
assertEqual(
  rich.serializeRichMarkdownState(crlfEdited).content,
  crlfSource.replace("const edit = true;", "const edited = true;"),
  "CRLF, prefix spacing, five-space outer indentation, and fence info survive"
);

const duplicateSource = [
  "Before[^dup].",
  "",
  "[^dup]: First.",
  "",
  "    ```js",
  "    const first = true;",
  "    ```",
  "",
  "[^dup]: Duplicate.",
  "",
  "    ```js",
  "    const second = true;",
  "    ```",
  ""
].join("\n");
const duplicateState = rich.createRichMarkdownState(duplicateSource, { dialect: "momentarise-enhanced" });
assertEqual(
  topLevelNodes(duplicateState).filter((node) => node.type.name === "footnote_definition").length,
  0,
  "duplicate code definitions remain source-only"
);
assertEqual(rich.serializeRichMarkdownState(duplicateState).content, duplicateSource, "duplicate code source identity");

const invalidIndentSource = [
  "Before[^bad].",
  "",
  "[^bad]: First.",
  "",
  "    ```js",
  "\tconst inconsistent = true;",
  "    ```",
  ""
].join("\n");
const invalidIndentState = rich.createRichMarkdownState(invalidIndentSource, { dialect: "momentarise-enhanced" });
assertEqual(
  topLevelNodes(invalidIndentState).filter((node) => node.type.name === "footnote_definition").length,
  0,
  "inconsistent code indentation remains source-only"
);
assertEqual(
  rich.serializeRichMarkdownState(invalidIndentState).content,
  invalidIndentSource,
  "invalid-indent code source identity"
);

const staleState = { ...state, source: "Externally changed source.\n" };
const staleRename = rich.renameRichFootnoteIdentifier(staleState, {
  identifier: "code-top",
  nextIdentifier: "stale-code"
});
assertEqual(staleRename.handled, false, "stale code rename rejected");
assertEqual(staleRename.reason, "stale-source", "stale code rejection reason");
assertEqual(staleRename.state, staleState, "stale code rejection does not mutate state");

const saveTarget = save.createMemorySaveTarget({ initialContent: source });
const saveEngine = save.createSaveEngine({ content: source, target: saveTarget });
saveEngine.updateContent(listOutput, { now: new Date("2026-07-21T00:00:00.000Z") });
assertEqual(saveEngine.getState().status, "dirty", "code edit marks save state dirty");
assertEqual(saveEngine.getState().currentHash, save.hashMarkdownContent(listOutput), "code edit save hash");
const saved = await saveEngine.flush({ reason: "autosave" });
assertEqual(saved.status, "saved", "code edit autosave status");
assertEqual(saveTarget.readContent(), expectedListEdit, "code edit autosave content");

function assertStableCodeShape(markdown, text, expectedAncestors) {
  const reparsed = rich.createRichMarkdownState(markdown, { dialect: "momentarise-enhanced" });
  assertEqual(rich.serializeRichMarkdownState(reparsed).content, markdown, "reconstructed fenced-code source is stable");
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

function assertEqual(actual, expectedValue, label) {
  if (actual !== expectedValue) {
    throw new Error(`${label}: expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actual)}.`);
  }
}
