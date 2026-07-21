import { readFile } from "node:fs/promises";

const rich = await import("../packages/md-rich-prosemirror/dist/index.js");
const save = await import("../packages/md-save/dist/index.js");
const history = await import("prosemirror-history");
const { JSDOM } = await import("jsdom");
const { DOMParser: ProseMirrorDOMParser, DOMSerializer } = await import("prosemirror-model");

const source = await readFile("fixtures/035-inline-html-footnote-editing/input.md", "utf8");
const state = rich.createRichMarkdownState(source, { dialect: "momentarise-enhanced" });
const supportedIdentifiers = [
  "inline-top",
  "inline-multi",
  "inline-list",
  "inline-task",
  "inline-quote",
  "inline-callout",
  "inline-hostile",
  "block-compatible"
];

for (const identifier of supportedIdentifiers) {
  if (!findDefinition(state, identifier)) {
    throw new Error(`Safe inline-HTML definition must be editable: ${identifier}.`);
  }
}

const topDefinition = findDefinition(state, "inline-top");
const multiDefinition = findDefinition(state, "inline-multi");
const listDefinition = findDefinition(state, "inline-list");
const taskDefinition = findDefinition(state, "inline-task");
const quoteDefinition = findDefinition(state, "inline-quote");
const calloutDefinition = findDefinition(state, "inline-callout");
const hostileDefinition = findDefinition(state, "inline-hostile");
const blockDefinition = findDefinition(state, "block-compatible");

assertMarkedTokens(topDefinition, ['<kbd data-key="cmd">', "</kbd>"], "top inline HTML");
assertMarkedTokens(multiDefinition, ["<!-- Edit comment token -->"], "inline HTML comment");
assertMarkedTokens(listDefinition, ["<span data-state='draft'>", "</span>"], "ordered-list inline HTML");
assertMarkedTokens(taskDefinition, ['<x-status data-state="pending">', "</x-status>"], "task inline HTML");
assertMarkedTokens(quoteDefinition, ["<mark>", "</mark>"], "quote inline HTML");
assertMarkedTokens(calloutDefinition, ["<i>", "</i>"], "callout inline HTML");
assertMarkedTokens(
  hostileDefinition,
  ["<script>", "</script>", '<img src="javascript:alert(1)" onerror="globalThis.__MME_INLINE_HTML_RAN__ = true" style="display:none">'],
  "hostile inline HTML"
);
assertEqual(collectNodesByType(blockDefinition, "raw_html_block").length, 1, "block raw HTML compatibility");
assertEqual(rich.serializeRichMarkdownState(state).content, source, "untouched inline-HTML document identity");
assertLiteralDom(topDefinition, state.schema);
assertLiteralDom(hostileDefinition, state.schema);
assertNoExactSourceMetadataInDom(topDefinition);

const tokenEdited = rich.replaceFirstRichText(state, 'data-key="cmd"', 'data-key="meta"');
const expectedTokenEdit = source.replace('data-key="cmd"', 'data-key="meta"');
assertEqual(
  rich.serializeRichMarkdownState(tokenEdited).content,
  expectedTokenEdit,
  "inline tag edit changes only bounded paragraph source"
);
assertStableMarkedShape(tokenEdited, "inline-top", ['<kbd data-key="meta">', "</kbd>"]);

const adjacentEdited = rich.replaceFirstRichText(state, "Edit comment token", "Edited comment token");
const expectedAdjacentEdit = source.replace("Edit comment token", "Edited comment token");
assertEqual(
  rich.serializeRichMarkdownState(adjacentEdited).content,
  expectedAdjacentEdit,
  "inline comment edit changes only bounded second paragraph"
);

for (const [identifier, before, after, expectedAncestors] of [
  ["inline-list", "Edit list inline", "Edited list inline", ["footnote_definition", "ordered_list", "list_item", "paragraph"]],
  ["inline-task", "Edit task inline", "Edited task inline", ["footnote_definition", "bullet_list", "todo_item", "paragraph"]],
  ["inline-quote", "Edit quote inline", "Edited quote inline", ["footnote_definition", "blockquote", "paragraph"]],
  ["inline-callout", "Edit callout inline", "Edited callout inline", ["footnote_definition", "callout", "paragraph"]]
]) {
  const edited = rich.replaceFirstRichText(state, before, after);
  const output = rich.serializeRichMarkdownState(edited).content;
  assertEqual(output, source.replace(before, after), `${identifier} edit remains bounded`);
  assertStableTextShape(output, after, expectedAncestors);
}

for (const preserved of [
  "    4. Keep ordered sibling.",
  "    - [x] Keep completed sibling.",
  'Neighbor <x-unknown keep="exact">syntax</x-unknown> stays byte-exact.',
  "Final paragraph stays byte-exact."
]) {
  assertIncludes(expectedTokenEdit, preserved, `preserved source ${preserved}`);
}

const undone = applyEditorCommand(tokenEdited, history.undo);
assertEqual(rich.serializeRichMarkdownState(undone).content, source, "one undo restores exact inline HTML source");
const redone = applyEditorCommand(undone, history.redo);
assertEqual(rich.serializeRichMarkdownState(redone).content, expectedTokenEdit, "one redo restores inline HTML edit");

const selected = rich.selectRichFootnoteDefinition(state, { identifier: "inline-list" });
assertEqual(selected.editorState.selection.empty, false, "inline-HTML definition selection remains available");
const replaced = rich.replaceRichFootnoteDefinitionText(state, {
  identifier: "inline-top",
  text: "Whole inline definition replaced"
});
assertIncludes(
  rich.serializeRichMarkdownState(replaced).content,
  "[^inline-top]: Whole inline definition replaced",
  "whole-definition replacement remains compatible"
);
const renamed = rich.renameRichFootnoteIdentifier(state, {
  identifier: "inline-task",
  nextIdentifier: "renamed-inline"
});
assertEqual(renamed.handled, true, "inline-HTML definition rename handled");
assertEqual(
  rich.serializeRichMarkdownState(renamed.state).content,
  source.replaceAll("[^inline-task]", "[^renamed-inline]"),
  "inline-HTML definition rename changes identifier tokens only"
);

const crlfSource = [
  "Before[^note].",
  "",
  "[^note]:   Text <kbd data-kind=\"crlf\">Edit CRLF inline</kbd> after.",
  "",
  "After.",
  ""
].join("\r\n");
const crlfState = rich.createRichMarkdownState(crlfSource, { dialect: "momentarise-enhanced" });
assertMarkedTokens(findDefinition(crlfState, "note"), ['<kbd data-kind="crlf">', "</kbd>"], "CRLF inline HTML");
const crlfEdited = rich.replaceFirstRichText(crlfState, "Edit CRLF inline", "Edited CRLF inline");
assertEqual(
  rich.serializeRichMarkdownState(crlfEdited).content,
  crlfSource.replace("Edit CRLF inline", "Edited CRLF inline"),
  "CRLF, prefix spacing, and inline token bytes survive"
);

const fallbacks = collectNodesByType(state.editorState.doc, "unsupported_block");
for (const marker of [
  "[^wrapped-strong]:",
  "[^wrapped-emphasis]:",
  "[^wrapped-strike]:",
  "[^wrapped-link]:",
  "[^multiline-html]:",
  "[^table-html]:",
  "[^duplicate]:",
  "[^nested-container]:"
]) {
  const fallback = fallbacks.find((node) => String(node.attrs.raw ?? "").includes(marker));
  if (!fallback || !/footnote/i.test(String(fallback.attrs.reason ?? ""))) {
    throw new Error(`Expected explicit source-only inline-HTML fallback for ${marker}.`);
  }
}
for (const fallbackText of [
  "Edit strong-wrapped inline",
  "Edit emphasis-wrapped inline",
  "Edit strike-wrapped inline",
  "Edit link-wrapped inline",
  "Edit multiline",
  "Edit table inline",
  "Edit first duplicate inline",
  "Edit nested-container inline"
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

const invalidIndentSource = [
  "Before[^bad].",
  "",
  "[^bad]: First.",
  "",
  "    > Quote <kbd>Edit invalid indent inline</kbd>.",
  "     >",
  "      > Inconsistent outer indentation.",
  ""
].join("\n");
const invalidIndentState = rich.createRichMarkdownState(invalidIndentSource, { dialect: "momentarise-enhanced" });
assertEqual(
  collectNodesByType(invalidIndentState.editorState.doc, "footnote_definition").length,
  0,
  "invalid outer indentation remains whole source-only"
);
assertEqual(
  rich.serializeRichMarkdownState(invalidIndentState).content,
  invalidIndentSource,
  "invalid-indent inline HTML source identity"
);

const staleState = { ...state, source: "Externally changed source.\n" };
const staleRename = rich.renameRichFootnoteIdentifier(staleState, {
  identifier: "inline-top",
  nextIdentifier: "stale-inline"
});
assertEqual(staleRename.handled, false, "stale inline-HTML rename rejected");
assertEqual(staleRename.reason, "stale-source", "stale inline-HTML rejection reason");
assertEqual(staleRename.state, staleState, "stale rejection does not mutate state");

const standaloneSource = await readFile("fixtures/010-html-inline-block/input.md", "utf8");
const standaloneState = rich.createRichMarkdownState(standaloneSource, { dialect: "momentarise-enhanced" });
assertEqual(
  rich.serializeRichMarkdownState(standaloneState).content,
  standaloneSource,
  "existing generic inline/block HTML remains byte-identical"
);

const saveTarget = save.createMemorySaveTarget({ initialContent: source });
const saveEngine = save.createSaveEngine({ content: source, target: saveTarget });
saveEngine.updateContent(expectedTokenEdit, { now: new Date("2026-07-21T00:00:00.000Z") });
assertEqual(saveEngine.getState().status, "dirty", "inline-HTML edit marks save state dirty");
const saved = await saveEngine.flush({ reason: "autosave" });
assertEqual(saved.status, "saved", "inline-HTML autosave status");
assertEqual(saveTarget.readContent(), expectedTokenEdit, "inline-HTML autosave content");

function assertMarkedTokens(node, expected, label) {
  const marked = collectMarkedText(node);
  for (const token of expected) {
    if (!marked.includes(token)) {
      throw new Error(`${label}: missing marked token ${JSON.stringify(token)} in ${JSON.stringify(marked)}.`);
    }
  }
}

function collectMarkedText(node) {
  const values = [];
  node?.descendants((child) => {
    if (child.isText && child.marks.some((mark) => mark.type.name === "raw_html_source")) {
      values.push(child.text ?? "");
    }
    return true;
  });
  return values;
}

function assertLiteralDom(node, schema) {
  const dom = new JSDOM("<!doctype html><body><div id=\"root\"></div></body>", { runScripts: "dangerously" });
  const previousHTMLElement = globalThis.HTMLElement;
  globalThis.HTMLElement = dom.window.HTMLElement;
  dom.window.__MME_INLINE_HTML_RAN__ = false;
  try {
    const root = dom.window.document.querySelector("#root");
    root.append(DOMSerializer.fromSchema(schema).serializeNode(node, { document: dom.window.document }));
    const wrappers = root.querySelectorAll('[data-mme-raw-html-inline="true"]');
    if (wrappers.length === 0 || Array.from(wrappers).some((wrapper) => wrapper.getAttribute("aria-label") !== "Raw HTML source")) {
      throw new Error("Inline raw HTML must use labelled package-owned wrappers.");
    }
    assertEqual(
      root.querySelectorAll("script, kbd, img, x-status, [onclick], [onerror], [style], [src]").length,
      0,
      "inline payload creates zero active DOM or payload attributes"
    );
    assertEqual(dom.window.__MME_INLINE_HTML_RAN__, false, "inline payload script never executes");
    assertIncludes(root.textContent ?? "", "<", "inline payload remains visible literal text");
    const parsed = ProseMirrorDOMParser.fromSchema(schema).parse(root);
    if (collectMarkedText(parsed).length === 0) {
      throw new Error("Inline raw-HTML source mark must survive DOM reparse.");
    }
  } finally {
    globalThis.HTMLElement = previousHTMLElement;
    dom.window.close();
  }
}

function assertStableMarkedShape(stateValue, identifier, expectedTokens) {
  const output = rich.serializeRichMarkdownState(stateValue).content;
  const reparsed = rich.createRichMarkdownState(output, { dialect: "momentarise-enhanced" });
  assertEqual(rich.serializeRichMarkdownState(reparsed).content, output, "reconstructed inline HTML source is stable");
  assertMarkedTokens(findDefinition(reparsed, identifier), expectedTokens, `${identifier} reparse`);
}

function assertStableTextShape(markdown, text, expectedAncestors) {
  const reparsed = rich.createRichMarkdownState(markdown, { dialect: "momentarise-enhanced" });
  assertEqual(rich.serializeRichMarkdownState(reparsed).content, markdown, "reconstructed inline HTML hierarchy is stable");
  assertEqual(
    JSON.stringify(textAncestorNames(reparsed, text)),
    JSON.stringify(expectedAncestors),
    `inline-HTML hierarchy survives reparse for ${JSON.stringify(text)}`
  );
}

function textAncestorNames(stateValue, text) {
  let names = null;
  stateValue.editorState.doc.descendants((node, position) => {
    if (!node.isText || typeof node.text !== "string" || !node.text.includes(text)) return true;
    const $position = stateValue.editorState.doc.resolve(position);
    names = [];
    for (let depth = 1; depth <= $position.depth; depth += 1) names.push($position.node(depth).type.name);
    return false;
  });
  if (!names) throw new Error(`Cannot find text ancestors for ${JSON.stringify(text)}.`);
  return names;
}

function applyEditorCommand(stateValue, command) {
  let editorState = stateValue.editorState;
  if (!command(editorState, (transaction) => { editorState = editorState.apply(transaction); })) {
    throw new Error("Expected editor command to be handled.");
  }
  return { ...stateValue, editorState };
}

function findDefinition(stateValue, identifier) {
  let found = null;
  stateValue.editorState.doc.forEach((node) => {
    if (node.type.name === "footnote_definition" && node.attrs.identifier === identifier) found = node;
  });
  return found;
}

function collectNodesByType(node, typeName) {
  const nodes = node?.type.name === typeName ? [node] : [];
  node?.forEach((child) => nodes.push(...collectNodesByType(child, typeName)));
  return nodes;
}

function assertNoExactSourceMetadataInDom(node) {
  const serialized = JSON.stringify(node?.type.spec.toDOM?.(node));
  for (const forbidden of ["blockSources", "blockFingerprints", "paragraphSources", "paragraphFingerprints"]) {
    if (serialized.includes(forbidden)) throw new Error(`Exact source metadata leaked into DOM: ${forbidden}.`);
  }
}

function assertIncludes(value, expected, label) {
  if (!value.includes(expected)) throw new Error(`${label}: missing ${JSON.stringify(expected)}.\n${value}`);
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}.`);
  }
}
