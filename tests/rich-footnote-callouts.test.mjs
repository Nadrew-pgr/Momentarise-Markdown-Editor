import { readFile } from "node:fs/promises";

const rich = await import("../packages/md-rich-prosemirror/dist/index.js");
const save = await import("../packages/md-save/dist/index.js");
const history = await import("prosemirror-history");
const { JSDOM } = await import("jsdom");
const { DOMParser: ProseMirrorDOMParser, DOMSerializer } = await import("prosemirror-model");

const source = await readFile("fixtures/033-callout-footnote-editing/input.md", "utf8");
const state = rich.createRichMarkdownState(source, { dialect: "momentarise-enhanced" });
const definitions = topLevelNodes(state).filter((node) => node.type.name === "footnote_definition");

for (const identifier of ["callout-top", "callout-list", "callout-task", "unsafe-body"]) {
  if (!definitions.some((node) => node.attrs.identifier === identifier)) {
    throw new Error(`Safe callout definition must be editable: ${identifier}.`);
  }
}
const topDefinition = definitions.find((node) => node.attrs.identifier === "callout-top");
const listDefinition = definitions.find((node) => node.attrs.identifier === "callout-list");
const taskDefinition = definitions.find((node) => node.attrs.identifier === "callout-task");
const quoteDefinition = definitions.find((node) => node.attrs.identifier === "quote-existing");
const inlineHtmlDefinition = definitions.find((node) => node.attrs.identifier === "unsafe-body");
assertIncludes(JSON.stringify(inlineHtmlDefinition?.toJSON()), '"raw_html_source"', "callout inline HTML is inert marked source");

const topCallout = topDefinition?.child(1);
assertEqual(topCallout?.type.name, "callout", "top-level callout is semantic");
assertCalloutAttrs(topCallout, { fold: null, title: "Release note", type: "NOTE" });
assertEqual(topCallout?.childCount, 2, "top-level callout exposes two body paragraphs");
assertEqual(topCallout?.textContent.includes("Release note"), false, "callout header stays outside editable body");
assertEqual(topCallout?.child(1).child(1).marks[0]?.type.name, "strong", "callout body mark stays semantic");
assertSemanticCalloutDom(topCallout, "Release note", "NOTE", "none");
assertCalloutDomRoundTrip(topCallout, state.schema);

const orderedList = listDefinition?.child(1);
const orderedItem = orderedList?.child(0);
const listCallout = orderedItem?.child(1);
assertEqual(orderedList?.type.name, "ordered_list", "ordered callout list is semantic");
assertEqual(orderedList?.attrs.order, 3, "ordered callout start remains semantic");
assertEqual(orderedItem?.attrs.loose, true, "ordered callout item remains loose");
assertEqual(listCallout?.type.name, "callout", "ordered-item callout is semantic");
assertCalloutAttrs(listCallout, { fold: "-", title: "Release warning", type: "WARNING" });

const taskList = taskDefinition?.child(1);
const taskItem = taskList?.child(0);
const taskCallout = taskItem?.child(1);
assertEqual(taskItem?.type.name, "todo_item", "task callout item is semantic");
assertEqual(taskItem?.attrs.checked, false, "task callout state remains semantic");
assertEqual(taskItem?.attrs.loose, true, "task callout item remains loose");
assertEqual(taskCallout?.type.name, "callout", "task-item callout is semantic");
assertCalloutAttrs(taskCallout, { fold: "+", title: "Release tip", type: "TIP" });
assertEqual(quoteDefinition?.child(1).type.name, "blockquote", "existing plain quote remains semantic");
assertEqual(rich.serializeRichMarkdownState(state).content, source, "untouched callout document identity");
assertNoExactSourceMetadataInDom(topDefinition);
assertNoExactSourceMetadataInDom(topCallout);

const topEdited = rich.replaceFirstRichText(state, "Edit top callout body", "Edited top callout body");
const expectedTopEdit = source.replace("Edit top callout body", "Edited top callout body");
const topOutput = rich.serializeRichMarkdownState(topEdited).content;
assertEqual(topOutput, expectedTopEdit, "top-level body edit changes only bounded callout source");
assertIncludes(topOutput, "> [!NOTE] Release note", "top-level marker and title survive");
assertIncludes(topOutput, "> Keep top callout **detail**.", "marked sibling body survives");
assertStableCalloutShape(topOutput, "Edited top callout body", [
  "footnote_definition",
  "callout",
  "paragraph"
]);

const listEdited = rich.replaceFirstRichText(state, "Edit list callout body", "Edited list callout body");
const expectedListEdit = source.replace("Edit list callout body", "Edited list callout body");
const listOutput = rich.serializeRichMarkdownState(listEdited).content;
assertEqual(listOutput, expectedListEdit, "ordered-item callout edit changes only bounded list source");
assertIncludes(listOutput, "> [!WARNING]- Release warning", "collapsed callout header survives");
assertStableCalloutShape(listOutput, "Edited list callout body", [
  "footnote_definition",
  "ordered_list",
  "list_item",
  "callout",
  "paragraph"
]);

const taskEdited = rich.replaceFirstRichText(state, "Edit task callout body", "Edited task callout body");
const expectedTaskEdit = source.replace("Edit task callout body", "Edited task callout body");
const taskOutput = rich.serializeRichMarkdownState(taskEdited).content;
assertEqual(taskOutput, expectedTaskEdit, "task-item callout edit changes only bounded list source");
assertIncludes(taskOutput, "> [!TIP]+ Release tip", "expanded callout header survives");
assertStableCalloutShape(taskOutput, "Edited task callout body", [
  "footnote_definition",
  "bullet_list",
  "todo_item",
  "callout",
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

const topUndone = applyEditorCommand(topEdited, history.undo);
assertEqual(rich.serializeRichMarkdownState(topUndone).content, source, "one undo restores exact callout source");
const topRedone = applyEditorCommand(topUndone, history.redo);
assertEqual(rich.serializeRichMarkdownState(topRedone).content, expectedTopEdit, "one redo restores callout edit");

const selected = rich.selectRichFootnoteDefinition(state, { identifier: "callout-list" });
assertEqual(selected.editorState.selection.empty, false, "callout definition selection remains available");
const replaced = rich.replaceRichFootnoteDefinitionText(state, {
  identifier: "callout-top",
  text: "Whole callout definition replaced"
});
assertIncludes(
  rich.serializeRichMarkdownState(replaced).content,
  "[^callout-top]: Whole callout definition replaced",
  "whole-definition replacement remains compatible"
);
const renamed = rich.renameRichFootnoteIdentifier(state, {
  identifier: "callout-task",
  nextIdentifier: "release-callout"
});
assertEqual(renamed.handled, true, "callout definition rename handled");
assertEqual(
  rich.serializeRichMarkdownState(renamed.state).content,
  source.replaceAll("[^callout-task]", "[^release-callout]"),
  "callout definition rename changes identifier tokens only"
);

const crlfSource = [
  "Before[^note].",
  "",
  "  [^note]:   Callout guidance.",
  "",
  "     > [!IMPORTANT]- CRLF title",
  "     > Edit CRLF body.",
  "",
  "After.",
  ""
].join("\r\n");
const crlfState = rich.createRichMarkdownState(crlfSource, { dialect: "momentarise-enhanced" });
const crlfDefinition = topLevelNodes(crlfState).find((node) => node.type.name === "footnote_definition");
assertEqual(crlfDefinition?.child(1).type.name, "callout", "CRLF callout mounts semantically");
assertCalloutAttrs(crlfDefinition?.child(1), { fold: "-", title: "CRLF title", type: "IMPORTANT" });
const crlfEdited = rich.replaceFirstRichText(crlfState, "Edit CRLF body", "Edited CRLF body");
assertEqual(
  rich.serializeRichMarkdownState(crlfEdited).content,
  crlfSource.replace("Edit CRLF body", "Edited CRLF body"),
  "CRLF, prefix spacing, five-space indentation, and callout header survive"
);

const fallbacks = collectNodesByType(state.editorState.doc, "unsupported_block");
for (const marker of [
  "[^marker-only]:",
  "[^malformed-type]:",
  "[^malformed-fold]:",
  "[^nested-callout]:",
  "[^list-body]:",
  "[^mixed-containers]:",
  "[^duplicate]:",
  "[^nested-container]:"
]) {
  const fallback = fallbacks.find((node) => String(node.attrs.raw ?? "").includes(marker));
  if (!fallback || !/footnote/i.test(String(fallback.attrs.reason ?? ""))) {
    throw new Error(`Expected explicit source-only callout fallback for ${marker}.`);
  }
}
for (const fallbackText of ["Preserve nested body", "Preserve nested list item"] ) {
  let rejected = false;
  try {
    rich.replaceFirstRichText(state, fallbackText, `Edited ${fallbackText}`);
  } catch (error) {
    rejected = error instanceof Error && error.message.includes("Could not find rich text");
  }
  assertEqual(rejected, true, `source-only fallback rejects partial Rich edit for ${fallbackText}`);
  assertEqual(rich.serializeRichMarkdownState(state).content, source, "rejected fallback edit leaves source exact");
}

const commandState = rich.applyRichMarkdownCommand(
  rich.createRichMarkdownState("Callout command body\n", { dialect: "momentarise-enhanced" }),
  "callout"
);
assertEqual(
  topLevelNodes(commandState)[0]?.type.name,
  "unsupported_block",
  "existing callout command remains raw fallback in this slice"
);
assertIncludes(
  rich.serializeRichMarkdownState(commandState).content,
  "> [!NOTE] Callout command body",
  "existing callout command Markdown remains compatible"
);

const standaloneCalloutSource = await readFile("fixtures/007-obsidian-callout/input.md", "utf8");
const standaloneCalloutState = rich.createRichMarkdownState(standaloneCalloutSource, {
  dialect: "momentarise-enhanced"
});
assertEqual(
  collectNodesByType(standaloneCalloutState.editorState.doc, "callout").length,
  0,
  "existing top-level opaque callout remains outside this slice"
);
assertEqual(
  rich.serializeRichMarkdownState(standaloneCalloutState).content,
  standaloneCalloutSource,
  "existing top-level callout remains byte-identical"
);

const saveTarget = save.createMemorySaveTarget({ initialContent: source });
const saveEngine = save.createSaveEngine({ content: source, target: saveTarget });
saveEngine.updateContent(taskOutput, { now: new Date("2026-07-21T00:00:00.000Z") });
assertEqual(saveEngine.getState().status, "dirty", "callout edit marks save state dirty");
assertEqual(saveEngine.getState().currentHash, save.hashMarkdownContent(taskOutput), "callout edit save hash");
const saved = await saveEngine.flush({ reason: "autosave" });
assertEqual(saved.status, "saved", "callout autosave status");
assertEqual(saveTarget.readContent(), expectedTaskEdit, "callout autosave content");

function assertStableCalloutShape(markdown, text, expectedAncestors) {
  const reparsed = rich.createRichMarkdownState(markdown, { dialect: "momentarise-enhanced" });
  assertEqual(rich.serializeRichMarkdownState(reparsed).content, markdown, "reconstructed callout source is stable");
  assertEqual(
    JSON.stringify(textAncestorNames(reparsed, text)),
    JSON.stringify(expectedAncestors),
    `callout hierarchy survives reparse for ${JSON.stringify(text)}`
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

function assertCalloutAttrs(node, expected) {
  assertEqual(node?.attrs.calloutType, expected.type, "callout type attr");
  assertEqual(node?.attrs.fold, expected.fold, "callout fold attr");
  assertEqual(node?.attrs.title, expected.title, "callout title attr");
}

function assertSemanticCalloutDom(node, title, type, fold) {
  const dom = node?.type.spec.toDOM?.(node);
  const parseRule = node?.type.spec.parseDOM?.[0];
  const serialized = JSON.stringify(dom);
  assertIncludes(serialized, '"data-mme-callout":"true"', "semantic callout DOM marker");
  assertIncludes(serialized, `"data-mme-callout-type":"${type}"`, "semantic callout DOM type");
  assertIncludes(serialized, `"data-mme-callout-fold":"${fold}"`, "semantic callout DOM fold");
  assertIncludes(serialized, '"role":"note"', "semantic callout DOM role");
  assertIncludes(serialized, '"contenteditable":"false"', "semantic callout header is non-editable");
  assertIncludes(serialized, JSON.stringify(title), "semantic callout DOM title");
  assertEqual(parseRule?.contentElement, '[data-mme-callout-body="true"]', "DOM reparse excludes callout header");
}

function assertCalloutDomRoundTrip(node, schema) {
  const dom = new JSDOM("<!doctype html><body><div id=\"root\"></div></body>");
  const previousHTMLElement = globalThis.HTMLElement;
  globalThis.HTMLElement = dom.window.HTMLElement;
  try {
    const root = dom.window.document.querySelector("#root");
    root.append(DOMSerializer.fromSchema(schema).serializeNode(node, { document: dom.window.document }));
    const parsed = ProseMirrorDOMParser.fromSchema(schema).parse(root);
    const callout = parsed.firstChild;
    assertEqual(callout?.type.name, "callout", "semantic callout survives DOM reparse");
    assertEqual(callout?.attrs.calloutType, "NOTE", "DOM reparse keeps callout type");
    assertEqual(callout?.attrs.title, "Release note", "DOM reparse keeps callout title");
    assertEqual(callout?.textContent, "Edit top callout body.Keep top callout detail.", "DOM reparse keeps body only");
  } finally {
    globalThis.HTMLElement = previousHTMLElement;
    dom.window.close();
  }
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
