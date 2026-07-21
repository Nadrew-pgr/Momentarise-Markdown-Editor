import { readFile } from "node:fs/promises";

const rich = await import("../packages/md-rich-prosemirror/dist/index.js");
const save = await import("../packages/md-save/dist/index.js");
const history = await import("prosemirror-history");
const { JSDOM } = await import("jsdom");
const { DOMParser: ProseMirrorDOMParser, DOMSerializer } = await import("prosemirror-model");

const source = await readFile("fixtures/034-raw-html-footnote-editing/input.md", "utf8");
const state = rich.createRichMarkdownState(source, { dialect: "momentarise-enhanced" });
const definitions = topLevelNodes(state).filter((node) => node.type.name === "footnote_definition");

for (const identifier of ["html-top", "html-list", "html-task", "inline-html", "paragraph-html"]) {
  if (!definitions.some((node) => node.attrs.identifier === identifier)) {
    throw new Error(`Safe raw-HTML definition must be editable: ${identifier}.`);
  }
}

const topDefinition = definitions.find((node) => node.attrs.identifier === "html-top");
const listDefinition = definitions.find((node) => node.attrs.identifier === "html-list");
const taskDefinition = definitions.find((node) => node.attrs.identifier === "html-task");
const inlineHtmlDefinition = definitions.find((node) => node.attrs.identifier === "inline-html");
assertIncludes(JSON.stringify(inlineHtmlDefinition?.toJSON()), '"raw_html_source"', "inline HTML is inert marked source");
const paragraphHtmlDefinition = definitions.find((node) => node.attrs.identifier === "paragraph-html");
assertIncludes(JSON.stringify(paragraphHtmlDefinition?.toJSON()), '"raw_html_source"', "single-line HTML element is inert marked source");
const topHtml = topDefinition?.child(1);
const orderedList = listDefinition?.child(1);
const orderedItem = orderedList?.child(0);
const listHtml = orderedItem?.child(1);
const taskList = taskDefinition?.child(1);
const taskItem = taskList?.child(0);
const taskHtml = taskItem?.child(1);

assertEqual(topHtml?.type.name, "raw_html_block", "top-level raw HTML is semantic inert source");
assertEqual(
  topHtml?.textContent,
  '<aside data-kind="note">\n  <!-- keep exact comment -->\n  <p>Edit top HTML source.</p>\n</aside>',
  "top-level HTML text removes only outer footnote indentation"
);
assertEqual(orderedList?.type.name, "ordered_list", "ordered raw-HTML list is semantic");
assertEqual(orderedList?.attrs.order, 3, "ordered raw-HTML start remains semantic");
assertEqual(orderedItem?.attrs.loose, true, "ordered raw-HTML item remains loose");
assertEqual(listHtml?.type.name, "raw_html_block", "ordered-item raw HTML is semantic inert source");
assertIncludes(listHtml?.textContent ?? "", "data-state='draft'", "attribute quoting remains literal text");
assertEqual(taskItem?.type.name, "todo_item", "task raw-HTML item is semantic");
assertEqual(taskItem?.attrs.checked, false, "task raw-HTML checked state remains semantic");
assertEqual(taskItem?.attrs.loose, true, "task raw-HTML item remains loose");
assertEqual(taskHtml?.type.name, "raw_html_block", "task-item raw HTML is semantic inert source");
assertIncludes(taskHtml?.textContent ?? "", "<script>", "hostile script remains literal text");
assertIncludes(taskHtml?.textContent ?? "", "onclick=", "hostile event handler remains literal text");
assertRawHtmlDom(topHtml, state.schema);
assertRawHtmlDom(taskHtml, state.schema);
assertNoExactSourceMetadataInDom(topDefinition);
assertNoExactSourceMetadataInDom(topHtml);
assertEqual(rich.serializeRichMarkdownState(state).content, source, "untouched raw-HTML document identity");

const topEdited = rich.replaceFirstRichText(state, "Edit top HTML source", "Edited top HTML source");
const expectedTopEdit = source.replace("Edit top HTML source", "Edited top HTML source");
const topOutput = rich.serializeRichMarkdownState(topEdited).content;
assertEqual(topOutput, expectedTopEdit, "top-level HTML edit changes only bounded source");
assertStableHtmlShape(topOutput, "Edited top HTML source", ["footnote_definition", "raw_html_block"]);

const listEdited = rich.replaceFirstRichText(state, "data-state='draft'", 'data-state="ready"');
const expectedListEdit = source.replace("data-state='draft'", 'data-state="ready"');
const listOutput = rich.serializeRichMarkdownState(listEdited).content;
assertEqual(listOutput, expectedListEdit, "ordered-item HTML edit changes only bounded list source");
assertStableHtmlShape(listOutput, 'data-state="ready"', [
  "footnote_definition",
  "ordered_list",
  "list_item",
  "raw_html_block"
]);

const taskEdited = rich.replaceFirstRichText(state, "Edit task HTML source", "Edited task HTML source");
const expectedTaskEdit = source.replace("Edit task HTML source", "Edited task HTML source");
const taskOutput = rich.serializeRichMarkdownState(taskEdited).content;
assertEqual(taskOutput, expectedTaskEdit, "task-item HTML edit changes only bounded list source");
assertStableHtmlShape(taskOutput, "Edited task HTML source", [
  "footnote_definition",
  "bullet_list",
  "todo_item",
  "raw_html_block"
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

const undone = applyEditorCommand(taskEdited, history.undo);
assertEqual(rich.serializeRichMarkdownState(undone).content, source, "one undo restores exact HTML source");
const redone = applyEditorCommand(undone, history.redo);
assertEqual(rich.serializeRichMarkdownState(redone).content, expectedTaskEdit, "one redo restores HTML edit");

const selected = rich.selectRichFootnoteDefinition(state, { identifier: "html-list" });
assertEqual(selected.editorState.selection.empty, false, "raw-HTML definition selection remains available");
const replaced = rich.replaceRichFootnoteDefinitionText(state, {
  identifier: "html-top",
  text: "Whole HTML definition replaced"
});
assertIncludes(
  rich.serializeRichMarkdownState(replaced).content,
  "[^html-top]: Whole HTML definition replaced",
  "whole-definition replacement remains compatible"
);
const renamed = rich.renameRichFootnoteIdentifier(state, {
  identifier: "html-task",
  nextIdentifier: "renamed-html"
});
assertEqual(renamed.handled, true, "raw-HTML definition rename handled");
assertEqual(
  rich.serializeRichMarkdownState(renamed.state).content,
  source.replaceAll("[^html-task]", "[^renamed-html]"),
  "raw-HTML definition rename changes identifier tokens only"
);

const crlfSource = [
  "Before[^note].",
  "",
  "[^note]:   HTML guidance.",
  "",
  "    <section data-kind=\"crlf\">",
  "      <p>Edit CRLF HTML.</p>",
  "    </section>",
  "",
  "After.",
  ""
].join("\r\n");
const crlfState = rich.createRichMarkdownState(crlfSource, { dialect: "momentarise-enhanced" });
const crlfDefinition = topLevelNodes(crlfState).find((node) => node.type.name === "footnote_definition");
assertEqual(crlfDefinition?.child(1).type.name, "raw_html_block", "CRLF raw HTML mounts semantically");
const crlfEdited = rich.replaceFirstRichText(crlfState, "Edit CRLF HTML", "Edited CRLF HTML");
assertEqual(
  rich.serializeRichMarkdownState(crlfEdited).content,
  crlfSource.replace("Edit CRLF HTML", "Edited CRLF HTML"),
  "CRLF, prefix spacing, continuation indentation, and inner HTML spacing survive"
);

const fallbacks = collectNodesByType(state.editorState.doc, "unsupported_block");
for (const marker of [
  "[^malformed-html]:",
  "[^quote-html]:",
  "[^mixed-containers]:",
  "[^multiple-html]:",
  "[^duplicate]:",
  "[^nested-container]:"
]) {
  const fallback = fallbacks.find((node) => String(node.attrs.raw ?? "").includes(marker));
  if (!fallback || !/footnote/i.test(String(fallback.attrs.reason ?? ""))) {
    throw new Error(`Expected explicit source-only raw-HTML fallback for ${marker}.`);
  }
}
for (const fallbackText of [
  "Edit malformed HTML",
  "Edit quote HTML",
  "Edit mixed HTML",
  "Edit second HTML container",
  "Edit nested-container HTML"
]) {
  let rejected = false;
  try {
    rich.replaceFirstRichText(state, fallbackText, `Edited ${fallbackText}`);
  } catch (error) {
    rejected = error instanceof Error && error.message.includes("Could not find rich text");
  }
  assertEqual(rejected, true, `source-only fallback rejects partial Rich edit for ${fallbackText}`);
  assertEqual(rich.serializeRichMarkdownState(state).content, source, "rejected fallback leaves source exact");
}

const standaloneSource = await readFile("fixtures/010-html-inline-block/input.md", "utf8");
const standaloneState = rich.createRichMarkdownState(standaloneSource, { dialect: "momentarise-enhanced" });
assertEqual(
  collectNodesByType(standaloneState.editorState.doc, "raw_html_block").length,
  0,
  "generic top-level raw HTML remains outside this footnote-only slice"
);
assertEqual(
  rich.serializeRichMarkdownState(standaloneState).content,
  standaloneSource,
  "existing top-level/inline HTML remains byte-identical"
);

const saveTarget = save.createMemorySaveTarget({ initialContent: source });
const saveEngine = save.createSaveEngine({ content: source, target: saveTarget });
saveEngine.updateContent(taskOutput, { now: new Date("2026-07-21T00:00:00.000Z") });
assertEqual(saveEngine.getState().status, "dirty", "raw-HTML edit marks save state dirty");
assertEqual(saveEngine.getState().currentHash, save.hashMarkdownContent(taskOutput), "raw-HTML save hash");
const saved = await saveEngine.flush({ reason: "autosave" });
assertEqual(saved.status, "saved", "raw-HTML autosave status");
assertEqual(saveTarget.readContent(), expectedTaskEdit, "raw-HTML autosave content");

function assertRawHtmlDom(node, schema) {
  const domSpec = node?.type.spec.toDOM?.(node);
  const serializedSpec = JSON.stringify(domSpec);
  assertIncludes(serializedSpec, '"data-mme-raw-html-block":"true"', "raw-HTML DOM marker");
  assertIncludes(serializedSpec, '"aria-label":"Raw HTML source block"', "raw-HTML accessible label");
  for (const forbidden of ["onclick", "<script", "<aside", "<x-status", "globalThis.__MME_HTML_RAN__"]) {
    if (serializedSpec.includes(forbidden)) {
      throw new Error(`Raw payload leaked into DOM spec: ${forbidden}.`);
    }
  }

  const dom = new JSDOM("<!doctype html><body><div id=\"root\"></div></body>", {
    runScripts: "dangerously"
  });
  const previousHTMLElement = globalThis.HTMLElement;
  globalThis.HTMLElement = dom.window.HTMLElement;
  dom.window.__MME_HTML_RAN__ = false;
  try {
    const root = dom.window.document.querySelector("#root");
    root.append(DOMSerializer.fromSchema(schema).serializeNode(node, { document: dom.window.document }));
    assertEqual(root.querySelectorAll("script, aside, section, x-status, [onclick]").length, 0, "payload creates zero active DOM");
    assertEqual(dom.window.__MME_HTML_RAN__, false, "payload script never executes");
    assertIncludes(root.textContent ?? "", node.textContent, "payload remains visible as literal text");
    const parsed = ProseMirrorDOMParser.fromSchema(schema).parse(root);
    assertEqual(parsed.firstChild?.type.name, "raw_html_block", "raw-HTML node survives DOM reparse");
    assertEqual(parsed.firstChild?.textContent, node.textContent, "DOM reparse keeps literal raw text only");
  } finally {
    globalThis.HTMLElement = previousHTMLElement;
    dom.window.close();
  }
}

function assertStableHtmlShape(markdown, text, expectedAncestors) {
  const reparsed = rich.createRichMarkdownState(markdown, { dialect: "momentarise-enhanced" });
  assertEqual(rich.serializeRichMarkdownState(reparsed).content, markdown, "reconstructed raw-HTML source is stable");
  assertEqual(
    JSON.stringify(textAncestorNames(reparsed, text)),
    JSON.stringify(expectedAncestors),
    `raw-HTML hierarchy survives reparse for ${JSON.stringify(text)}`
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
  const serialized = JSON.stringify(node?.type.spec.toDOM?.(node));
  for (const forbidden of ["blockSources", "blockFingerprints", "paragraphSources", "paragraphFingerprints"]) {
    if (serialized.includes(forbidden)) {
      throw new Error(`Exact source metadata must remain out of rendered DOM: ${forbidden}.`);
    }
  }
}

function assertIncludes(value, expected, label) {
  if (!value.includes(expected)) {
    throw new Error(`${label}: missing ${JSON.stringify(expected)}.\n${value}`);
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}.`);
  }
}
