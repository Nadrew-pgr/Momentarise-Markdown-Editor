import { readFile } from "node:fs/promises";

const rich = await import("../packages/md-rich-prosemirror/dist/index.js");
const save = await import("../packages/md-save/dist/index.js");
const history = await import("prosemirror-history");

for (const exportName of ["replaceRichFootnoteDefinitionText", "selectRichFootnoteDefinition"]) {
  if (typeof rich[exportName] !== "function") {
    throw new Error(`Missing MME-0056 rich footnote export: ${exportName}`);
  }
}

const source = await readFile("fixtures/022-simple-footnote-editing/input.md", "utf8");
const state = rich.createRichMarkdownState(source, { dialect: "momentarise-enhanced" });

const rootTypes = topLevelNodes(state).map((node) => node.type.name);
assertEqual(rootTypes.filter((type) => type === "footnote_definition").length, 1, "only one safe unique definition must be editable");
assertEqual(countNodeType(state.editorState.doc, "footnote_reference"), 3, "footnote references must remain semantic rich nodes");
assertEqual(rich.serializeRichMarkdownState(state).content, source, "untouched footnote document must remain byte-identical");

const editableDefinition = topLevelNodes(state).find((node) => node.type.name === "footnote_definition");
assertEqual(editableDefinition?.attrs.identifier, "simple", "editable definition identifier");
assertEqual(editableDefinition?.textContent, "Simple definition with inline code and a relative link.", "editable definition body");
assertDomAttribute(editableDefinition, "data-mme-footnote-definition", "true");
assertEqual(countMarkType(editableDefinition, "strong"), 1, "editable definition strong mark");
assertEqual(countMarkType(editableDefinition, "code"), 1, "editable definition code mark");
assertEqual(countMarkType(editableDefinition, "link"), 1, "editable definition link mark");

const reference = findNodeType(state.editorState.doc, "footnote_reference");
assertEqual(reference?.attrs.identifier, "simple", "semantic reference identifier");
assertEqual(reference?.attrs.raw, "[^simple]", "semantic reference must retain original Markdown spelling");
assertDomAttribute(reference, "data-mme-footnote-reference", "true");

const fallbacks = topLevelNodes(state).filter((node) => node.type.name === "unsupported_block");
for (const preserved of [
  "[^complex]: Complex definition starts here.",
  "[^multi]: First definition paragraph stays source-only.",
  "[^unsafe]: Unsafe definition keeps raw HTML",
  "[^duplicate]: First duplicate definition stays source-only.",
  "[^duplicate]: Second duplicate definition stays source-only.",
  "[^malformed] Missing colon stays source-only."
]) {
  const fallback = fallbacks.find((node) => String(node.attrs.raw ?? "").includes(preserved));
  if (!fallback || !/footnote/i.test(String(fallback.attrs.reason ?? ""))) {
    throw new Error(`Expected explicit preserved-footnote fallback for ${preserved}.`);
  }
}

const selected = rich.selectRichFootnoteDefinition(state, { identifier: "simple" });
assertEqual(selected.editorState.selection.$from.parent.type.name, "footnote_definition", "definition helper selection parent");
assertEqual(selected.editorState.selection.from < selected.editorState.selection.to, true, "definition helper must select body text");
assertRangeError(
  () => rich.selectRichFootnoteDefinition(state, { identifier: "missing" }),
  "missing definition selection"
);
assertRangeError(
  () => rich.replaceRichFootnoteDefinitionText(state, { identifier: "missing", text: "No edit" }),
  "missing definition replacement"
);

const edited = rich.replaceRichFootnoteDefinitionText(state, {
  identifier: "simple",
  text: "Edited definition body"
});
const editedOutput = rich.serializeRichMarkdownState(edited).content;
assertIncludes(editedOutput, "[^simple]: Edited definition body", "edited simple definition Markdown");
const expectedEditedOutput = source.replace(
  "[^simple]: Simple **definition** with `inline code` and a [relative link](./target.md).",
  "[^simple]: Edited definition body"
);
assertEqual(editedOutput, expectedEditedOutput, "only the selected definition source range may change");
for (const preserved of [
  "one simple note[^simple] twice[^simple]",
  "[^complex]: Complex definition starts here.\n    Continued definition line stays source-only.",
  "[^multi]: First definition paragraph stays source-only.\n\n    Second definition paragraph stays source-only.",
  "[^unsafe]: Unsafe definition keeps raw HTML <span onclick=\"boom()\">label</span>.",
  "[^duplicate]: First duplicate definition stays source-only.",
  "[^duplicate]: Second duplicate definition stays source-only.",
  "[^malformed] Missing colon stays source-only."
]) {
  assertIncludes(editedOutput, preserved, `preserved footnote source ${preserved}`);
}

const neighborEdited = rich.replaceFirstRichText(state, "Neighbor paragraph", "Edited neighbor paragraph");
const neighborOutput = rich.serializeRichMarkdownState(neighborEdited).content;
assertIncludes(
  neighborOutput,
  "Intro uses one simple note[^simple] twice[^simple] and keeps a complex note[^complex].",
  "neighbor edit must keep semantic reference Markdown"
);

const undone = applyEditorCommand(edited, history.undo);
assertEqual(rich.serializeRichMarkdownState(undone).content, source, "undo must restore exact original definition bytes");
const redone = applyEditorCommand(undone, history.redo);
assertEqual(rich.serializeRichMarkdownState(redone).content, editedOutput, "redo must restore edited definition Markdown");

const crlfSource = "Before[^note].\r\n\r\n[^note]: Original body.\r\n\r\nAfter.\r\n";
const crlfEdited = rich.replaceRichFootnoteDefinitionText(
  rich.createRichMarkdownState(crlfSource, { dialect: "momentarise-enhanced" }),
  { identifier: "note", text: "Changed body" }
);
const crlfOutput = rich.serializeRichMarkdownState(crlfEdited).content;
assertIncludes(crlfOutput, "[^note]: Changed body\r\n", "definition edit must inherit CRLF");
if (/(^|[^\r])\n/.test(crlfOutput)) {
  throw new Error(`Footnote definition edit must not introduce lone LF bytes.\n${JSON.stringify(crlfOutput)}`);
}

const saveTarget = save.createMemorySaveTarget({ initialContent: source });
const saveEngine = save.createSaveEngine({ content: source, target: saveTarget });
saveEngine.updateContent(editedOutput, { now: new Date("2026-07-20T00:00:00.000Z") });
assertEqual(saveEngine.getState().status, "dirty", "definition edit must mark save state dirty");
assertEqual(saveEngine.getState().currentHash, save.hashMarkdownContent(editedOutput), "definition edit save hash");
const saved = await saveEngine.flush({ reason: "autosave" });
assertEqual(saved.status, "saved", "definition autosave status");
assertEqual(saveTarget.readContent(), editedOutput, "definition autosave content");
saveEngine.updateContent(rich.serializeRichMarkdownState(undone).content, {
  now: new Date("2026-07-20T00:00:01.000Z")
});
assertEqual(saveEngine.getState().status, "dirty", "undo after save must become dirty truthfully");
const undoSaved = await saveEngine.flush({ reason: "manual" });
assertEqual(undoSaved.status, "saved", "post-undo save status");
assertEqual(saveTarget.readContent(), source, "post-undo saved content");

const prefixSource = "Use the note[^Mixed].\n\n  [^Mixed]:   Original body.\n";
const prefixEdited = rich.replaceRichFootnoteDefinitionText(
  rich.createRichMarkdownState(prefixSource, { dialect: "momentarise-enhanced" }),
  { identifier: "mixed", text: "Changed body" }
);
assertEqual(
  rich.serializeRichMarkdownState(prefixEdited).content,
  "Use the note[^Mixed].\n\n  [^Mixed]:   Changed body\n",
  "definition edit must preserve indentation, label case, and marker spacing"
);

const nestedSource = "> [^nested]: Nested definition stays source-only.\n";
const nestedState = rich.createRichMarkdownState(nestedSource, { dialect: "momentarise-enhanced" });
assertEqual(countNodeType(nestedState.editorState.doc, "footnote_definition"), 0, "nested definition rich exclusion");
assertIncludes(
  JSON.stringify(nestedState.editorState.doc.toJSON()),
  "Nested definition stays source-only.",
  "nested definition visible fallback"
);
assertEqual(rich.serializeRichMarkdownState(nestedState).content, nestedSource, "nested definition exact round-trip");

const nestedDuplicateSource = "[^same]: Top-level duplicate.\n\n> [^same]: Nested duplicate.\n";
const nestedDuplicateState = rich.createRichMarkdownState(nestedDuplicateSource, {
  dialect: "momentarise-enhanced"
});
assertEqual(
  countNodeType(nestedDuplicateState.editorState.doc, "footnote_definition"),
  0,
  "nested duplicate must keep matching top-level definition source-only"
);
assertEqual(
  rich.serializeRichMarkdownState(nestedDuplicateState).content,
  nestedDuplicateSource,
  "nested duplicate exact round-trip"
);

const unsafeLinkSource = "[^unsafe-link]: [label](javascript:alert(1))\n";
const unsafeLinkState = rich.createRichMarkdownState(unsafeLinkSource, { dialect: "momentarise-enhanced" });
assertEqual(countNodeType(unsafeLinkState.editorState.doc, "footnote_definition"), 0, "unsafe-link definition rich exclusion");
assertEqual(rich.serializeRichMarkdownState(unsafeLinkState).content, unsafeLinkSource, "unsafe-link definition exact round-trip");

function applyEditorCommand(state, command) {
  let editorState = state.editorState;
  if (!command(editorState, (transaction) => {
    editorState = editorState.apply(transaction);
  })) {
    throw new Error("Expected editor command to be handled.");
  }
  return { ...state, editorState };
}

function topLevelNodes(state) {
  const nodes = [];
  state.editorState.doc.forEach((node) => nodes.push(node));
  return nodes;
}

function countNodeType(node, typeName) {
  let count = node.type.name === typeName ? 1 : 0;
  node.forEach((child) => {
    count += countNodeType(child, typeName);
  });
  return count;
}

function findNodeType(node, typeName) {
  if (node.type.name === typeName) {
    return node;
  }
  let result = null;
  node.forEach((child) => {
    result ??= findNodeType(child, typeName);
  });
  return result;
}

function countMarkType(node, markTypeName) {
  let count = node.marks.some((mark) => mark.type.name === markTypeName) ? 1 : 0;
  node.forEach((child) => {
    count += countMarkType(child, markTypeName);
  });
  return count;
}

function assertDomAttribute(node, attribute, expected) {
  const dom = node?.type.spec.toDOM?.(node);
  const attrs = Array.isArray(dom) && dom[1] && typeof dom[1] === "object" && !Array.isArray(dom[1]) ? dom[1] : {};
  assertEqual(attrs[attribute], expected, `${node?.type.name ?? "missing node"} DOM ${attribute}`);
}

function assertIncludes(value, expected, label) {
  if (!value.includes(expected)) {
    throw new Error(`${label}: missing ${JSON.stringify(expected)}.\n${value}`);
  }
}

function assertRangeError(callback, label) {
  try {
    callback();
  } catch (error) {
    if (error instanceof RangeError) {
      return;
    }
    throw new Error(`${label}: expected RangeError, got ${String(error)}.`);
  }
  throw new Error(`${label}: expected RangeError.`);
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}.`);
  }
}
