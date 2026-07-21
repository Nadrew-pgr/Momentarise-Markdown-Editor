import { readFile } from "node:fs/promises";

const rich = await import("../packages/md-rich-prosemirror/dist/index.js");
const save = await import("../packages/md-save/dist/index.js");
const history = await import("prosemirror-history");
const { TextSelection } = await import("prosemirror-state");

const source = await readFile("fixtures/023-multiline-footnote-editing/input.md", "utf8");
const state = rich.createRichMarkdownState(source, { dialect: "momentarise-enhanced" });
const definitions = topLevelNodes(state).filter((node) => node.type.name === "footnote_definition");
assertEqual(definitions.length, 3, "safe continuation, multi-paragraph, and inert inline-HTML definitions must be editable");
assertEqual(definitions[0]?.attrs.identifier, "long", "continuation definition identifier");
assertEqual(definitions[0]?.attrs.continuationIndent, "    ", "continuation indentation metadata");
assertIncludes(definitions[0]?.textContent ?? "", "First definition line stays.\nSecond definition line", "logical multiline body");
const inlineHtmlDefinition = definitions.find((node) => node.attrs.identifier === "unsafe");
assertIncludes(JSON.stringify(inlineHtmlDefinition?.toJSON()), '"raw_html_source"', "continuation inline HTML is inert marked source");
assertEqual(rich.serializeRichMarkdownState(state).content, source, "untouched multiline document identity");

const edited = rich.replaceFirstRichText(state, "Second definition line", "Edited second definition line");
const editedOutput = rich.serializeRichMarkdownState(edited).content;
const expected = source.replace("Second definition line", "Edited second definition line");
assertEqual(editedOutput, expected, "only continuation definition text changes");
for (const preserved of [
  'Neighbor <x-unknown keep="exact">syntax</x-unknown> stays byte-exact.',
  "[^multi]: First paragraph stays source-only.\n\n    Second paragraph stays source-only.",
  "> [^nested]: Nested definition stays source-only.",
  '[^unsafe]: Inline-HTML continuation starts here.\n    Raw HTML <span onclick="boom()">stays inert and editable</span>.',
  "Final paragraph stays byte-exact."
]) {
  assertIncludes(editedOutput, preserved, `preserved source ${preserved}`);
}

const fallbacks = collectNodesByType(state.editorState.doc, "unsupported_block");
for (const preserved of ["[^nested]:"]) {
  if (!fallbacks.some((node) => String(node.attrs.raw ?? "").includes(preserved))) {
    throw new Error(`Expected source-only fallback for ${preserved}.`);
  }
}

const undone = applyEditorCommand(edited, history.undo);
assertEqual(rich.serializeRichMarkdownState(undone).content, source, "one undo restores multiline source");
const redone = applyEditorCommand(undone, history.redo);
assertEqual(rich.serializeRichMarkdownState(redone).content, expected, "one redo restores multiline edit");

const renamed = rich.renameRichFootnoteIdentifier(state, {
  identifier: "long",
  nextIdentifier: "release-note"
});
assertEqual(renamed.handled, true, "multiline definition rename handled");
assertEqual(
  rich.serializeRichMarkdownState(renamed.state).content,
  source.replaceAll("[^long]", "[^release-note]"),
  "multiline rename changes identifier tokens only"
);

const inserted = rich.insertRichFootnote(collapseAfterText(state, "Before uses a long note"), {
  preferredIdentifier: "new-note",
  text: "Inserted body"
});
assertEqual(inserted.handled, true, "insertion remains compatible with multiline definition");
assertIncludes(
  rich.serializeRichMarkdownState(inserted.state).content,
  "Before uses a long note[^new-note][^long] twice[^long].",
  "inserted reference remains targeted"
);

const crlfSource = "Before[^note].\r\n\r\n  [^note]:   First line.\r\n     Second line.\r\n\r\nAfter.\r\n";
const crlfState = rich.createRichMarkdownState(crlfSource, { dialect: "momentarise-enhanced" });
const crlfEdited = rich.replaceFirstRichText(crlfState, "Second line", "Edited second line");
assertEqual(
  rich.serializeRichMarkdownState(crlfEdited).content,
  crlfSource.replace("Second line", "Edited second line"),
  "CRLF and continuation indentation survive"
);

const tabSource = "Before[^tab].\n\n[^tab]: First line.\n\tSecond line.\n";
const tabState = rich.createRichMarkdownState(tabSource, { dialect: "momentarise-enhanced" });
const tabEdited = rich.replaceFirstRichText(tabState, "Second line", "Edited second line");
assertEqual(
  rich.serializeRichMarkdownState(tabEdited).content,
  tabSource.replace("Second line", "Edited second line"),
  "tab continuation indentation survives"
);

const saveTarget = save.createMemorySaveTarget({ initialContent: source });
const saveEngine = save.createSaveEngine({ content: source, target: saveTarget });
saveEngine.updateContent(editedOutput, { now: new Date("2026-07-20T00:00:00.000Z") });
assertEqual(saveEngine.getState().status, "dirty", "multiline edit marks save state dirty");
const saved = await saveEngine.flush({ reason: "autosave" });
assertEqual(saved.status, "saved", "multiline edit autosave status");
assertEqual(saveTarget.readContent(), expected, "multiline edit autosave content");

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
