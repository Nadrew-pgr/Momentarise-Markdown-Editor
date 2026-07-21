import { readFile } from "node:fs/promises";

const rich = await import("../packages/md-rich-prosemirror/dist/index.js");
const save = await import("../packages/md-save/dist/index.js");
const history = await import("prosemirror-history");
const { TextSelection } = await import("prosemirror-state");

const source = await readFile("fixtures/027-task-list-footnote-editing/input.md", "utf8");
const state = rich.createRichMarkdownState(source, { dialect: "momentarise-enhanced" });
const definitions = topLevelNodes(state).filter((node) => node.type.name === "footnote_definition");

assertEqual(definitions.length, 6, "safe task structures and inert inline-HTML definitions must be editable");
const flatDefinition = definitions.find((node) => node.attrs.identifier === "task-flat");
const nestedDefinition = definitions.find((node) => node.attrs.identifier === "task-nested");
const orderedDefinition = definitions.find((node) => node.attrs.identifier === "task-ordered");
const looseDefinition = definitions.find((node) => node.attrs.identifier === "loose-task");
const quoteDefinition = definitions.find((node) => node.attrs.identifier === "quoted-task");
const inlineHtmlDefinition = definitions.find((node) => node.attrs.identifier === "unsafe-task");

const flatList = flatDefinition?.child(1);
assertEqual(flatList?.type.name, "bullet_list", "flat task list is semantic");
assertEqual(flatList?.child(0).type.name, "todo_item", "checked flat task is semantic");
assertEqual(flatList?.child(0).attrs.checked, true, "checked flat task state");
assertEqual(flatList?.child(1).attrs.checked, false, "unchecked flat task state");

const nestedList = nestedDefinition?.child(1);
const nestedTaskList = nestedList?.child(0).child(1);
const deepestTask = nestedTaskList?.child(0);
const standardGrandchildList = deepestTask?.child(1);
assertEqual(nestedList?.child(0).type.name, "list_item", "standard parent remains semantic");
assertEqual(deepestTask?.type.name, "todo_item", "task nested under standard item is semantic");
assertEqual(deepestTask?.attrs.checked, false, "deep task starts unchecked");
assertEqual(standardGrandchildList?.child(0).type.name, "list_item", "standard grandchild under task is semantic");
assertEqual(nestedTaskList?.child(1).attrs.checked, true, "checked nested sibling state");
assertEqual(nestedList?.child(1).attrs.checked, true, "checked outer task state");

const orderedList = orderedDefinition?.child(1);
assertEqual(orderedList?.type.name, "ordered_list", "ordered task list is semantic");
assertEqual(orderedList?.attrs.order, 3, "ordered task start remains semantic");
assertEqual(orderedList?.child(0).attrs.checked, true, "ordered checked task state");
assertEqual(orderedList?.child(1).attrs.checked, false, "ordered unchecked task state");
assertEqual(looseDefinition?.child(1).attrs.loose, true, "loose task list state is semantic");
assertEqual(looseDefinition?.child(1).child(0).childCount, 2, "loose task paragraphs are semantic");
assertEqual(
  quoteDefinition?.child(1).child(0).child(1).type.name,
  "blockquote",
  "safe task-item quote now mounts semantically"
);
assertIncludes(JSON.stringify(inlineHtmlDefinition?.toJSON()), '"raw_html_source"', "task inline HTML is inert marked source");
assertEqual(rich.serializeRichMarkdownState(state).content, source, "untouched task-footnote document identity");
assertAccessibleTodoDom(deepestTask, false);
assertNoExactSourceMetadataInDom(nestedDefinition);

const textEdited = rich.replaceFirstRichText(state, "Edit deepest task", "Edited deepest task");
const expectedTextEdit = source.replace("Edit deepest task", "Edited deepest task");
const textOutput = rich.serializeRichMarkdownState(textEdited).content;
assertEqual(textOutput, expectedTextEdit, "deep task edit changes only bounded list source");
const reparsedTextEdit = rich.createRichMarkdownState(textOutput, { dialect: "momentarise-enhanced" });
assertEqual(
  rich.serializeRichMarkdownState(reparsedTextEdit).content,
  textOutput,
  "canonical task child indentation is stable after reparse"
);
assertEqual(
  findTextAncestor(reparsedTextEdit, "Edited deepest task", "todo_item")?.child(1).child(0).type.name,
  "list_item",
  "canonical reconstruction preserves mixed task hierarchy"
);
for (const preserved of [
  "[^task-flat]: Release checklist starts here.",
  "    Closing flat paragraph stays byte-exact.",
  "3. [x] Keep ordered checked task",
  "[^loose-task]: Loose task stays source-only.",
  'Neighbor <x-unknown keep="exact">syntax</x-unknown> stays byte-exact.',
  "Final paragraph stays byte-exact."
]) {
  assertIncludes(textOutput, preserved, `preserved source ${preserved}`);
}

const selectedTask = setCursorInText(state, "Edit deepest task");
const toggled = rich.toggleCurrentTodoItem(selectedTask);
const expectedToggle = source.replace("- [ ] Edit deepest task", "- [x] Edit deepest task");
assertEqual(
  rich.serializeRichMarkdownState(toggled).content,
  expectedToggle,
  "task toggle changes only checked marker inside bounded list source"
);
assertEqual(
  findTextAncestor(toggled, "Edit deepest task", "todo_item")?.attrs.checked,
  true,
  "task toggle updates semantic checked state"
);

const textUndone = applyEditorCommand(textEdited, history.undo);
assertEqual(rich.serializeRichMarkdownState(textUndone).content, source, "one undo restores task text source");
const textRedone = applyEditorCommand(textUndone, history.redo);
assertEqual(rich.serializeRichMarkdownState(textRedone).content, expectedTextEdit, "one redo restores task text edit");
const toggleUndone = applyEditorCommand(toggled, history.undo);
assertEqual(rich.serializeRichMarkdownState(toggleUndone).content, source, "one undo restores task checked state");
const toggleRedone = applyEditorCommand(toggleUndone, history.redo);
assertEqual(rich.serializeRichMarkdownState(toggleRedone).content, expectedToggle, "one redo restores task checked state");

const selected = rich.selectRichFootnoteDefinition(state, { identifier: "task-nested" });
assertEqual(selected.editorState.selection.empty, false, "task definition selection remains available");
const replaced = rich.replaceRichFootnoteDefinitionText(state, {
  identifier: "task-nested",
  text: "Whole task definition replaced"
});
assertIncludes(
  rich.serializeRichMarkdownState(replaced).content,
  "[^task-nested]: Whole task definition replaced",
  "whole-definition replacement remains compatible"
);
const renamed = rich.renameRichFootnoteIdentifier(state, {
  identifier: "task-flat",
  nextIdentifier: "release-tasks"
});
assertEqual(renamed.handled, true, "task definition rename handled");
assertEqual(
  rich.serializeRichMarkdownState(renamed.state).content,
  source.replaceAll("[^task-flat]", "[^release-tasks]"),
  "task definition rename changes identifier tokens only"
);
const inserted = rich.insertRichFootnote(collapseAfterText(state, "Before uses flat tasks"), {
  preferredIdentifier: "new-task-note",
  text: "Inserted body"
});
assertEqual(inserted.handled, true, "footnote insertion remains compatible with task definitions");
assertIncludes(
  rich.serializeRichMarkdownState(inserted.state).content,
  "Before uses flat tasks[^new-task-note][^task-flat]",
  "inserted reference remains targeted"
);

const fallbacks = collectNodesByType(state.editorState.doc, "unsupported_block");
for (const marker of [
  "[^multiple-task]:",
  "[^nested-container]:"
]) {
  const fallback = fallbacks.find((node) => String(node.attrs.raw ?? "").includes(marker));
  if (!fallback || !/footnote/i.test(String(fallback.attrs.reason ?? ""))) {
    throw new Error(`Expected explicit source-only footnote fallback for ${marker}.`);
  }
}

const crlfSource = [
  "Before[^note].",
  "",
  "  [^note]:   Checklist.",
  "",
  "     - [x] Keep completed task",
  "     - [ ] Edit CRLF task",
  "       - Standard child",
  "",
  "After.",
  ""
].join("\r\n");
const crlfState = rich.createRichMarkdownState(crlfSource, { dialect: "momentarise-enhanced" });
const crlfDefinition = topLevelNodes(crlfState).find((node) => node.type.name === "footnote_definition");
assertEqual(crlfDefinition?.child(1).child(1).type.name, "todo_item", "CRLF task mounts semantically");
const crlfEdited = rich.replaceFirstRichText(crlfState, "Edit CRLF task", "Edited CRLF task");
assertEqual(
  rich.serializeRichMarkdownState(crlfEdited).content,
  crlfSource.replace("Edit CRLF task", "Edited CRLF task"),
  "CRLF, prefix spacing, five-space container indent, and hierarchy survive"
);

const duplicateSource = [
  "Before[^dup].",
  "",
  "[^dup]: First.",
  "",
  "    - [ ] First task",
  "",
  "[^dup]: Duplicate.",
  "",
  "    - [x] Second task",
  ""
].join("\n");
const duplicateState = rich.createRichMarkdownState(duplicateSource, { dialect: "momentarise-enhanced" });
assertEqual(
  topLevelNodes(duplicateState).filter((node) => node.type.name === "footnote_definition").length,
  0,
  "duplicate task definitions remain source-only"
);
assertEqual(rich.serializeRichMarkdownState(duplicateState).content, duplicateSource, "duplicate source identity");

const staleState = { ...state, source: "Externally changed source.\n" };
const staleRename = rich.renameRichFootnoteIdentifier(staleState, {
  identifier: "task-flat",
  nextIdentifier: "stale-task"
});
assertEqual(staleRename.handled, false, "stale task rename rejected");
assertEqual(staleRename.reason, "stale-source", "stale task rejection reason");
assertEqual(staleRename.state, staleState, "stale rejection does not mutate state");

const saveTarget = save.createMemorySaveTarget({ initialContent: source });
const saveEngine = save.createSaveEngine({ content: source, target: saveTarget });
saveEngine.updateContent(expectedToggle, { now: new Date("2026-07-21T00:00:00.000Z") });
assertEqual(saveEngine.getState().status, "dirty", "task toggle marks save state dirty");
assertEqual(saveEngine.getState().currentHash, save.hashMarkdownContent(expectedToggle), "task toggle save hash");
const saved = await saveEngine.flush({ reason: "autosave" });
assertEqual(saved.status, "saved", "task toggle autosave status");
assertEqual(saveTarget.readContent(), expectedToggle, "task toggle autosave content");

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

function assertAccessibleTodoDom(node, checked) {
  const dom = node?.type.spec.toDOM?.(node);
  const button = dom?.[2];
  assertEqual(dom?.[0], "div", "todo DOM root");
  assertEqual(button?.[0], "button", "todo control uses native button");
  assertEqual(button?.[1]?.type, "button", "todo control avoids form submission");
  assertEqual(button?.[1]?.["aria-pressed"], String(checked), "todo control pressed state");
  assertEqual(
    button?.[1]?.["aria-label"],
    checked ? "Mark todo incomplete" : "Mark todo complete",
    "todo control accessible label"
  );
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
