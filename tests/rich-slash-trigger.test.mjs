import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * MME-0088 — the slash menu triggers exactly where Notion triggers it.
 *
 * The demo's `detectSlashCommandState` matched `/query$` in ANY textblock, so
 * typing `/` inside a fenced code block inserted the character into the code AND
 * opened the menu, and `a/b` mid-word opened it too.
 *
 * The "is this a safe context" decision is a package contract rather than demo
 * wiring, because MME-0104's input rules need exactly the same answer.
 */

const rich = await import("../packages/md-rich-prosemirror/dist/index.js");
const { TextSelection } = await import("prosemirror-state");

for (const exportName of ["matchRichSlashTrigger", "richTextInputContext"]) {
  assert(exportName in rich, `@momentarise/md-rich-prosemirror must export ${exportName} (MME-0088).`);
}

const { createMomentariseRichPlugins, createRichMarkdownState, matchRichSlashTrigger, richTextInputContext } = rich;
const { NodeSelection } = await import("prosemirror-state");

/** Selects the first top-level node of the given type as an object. */
function stateWithNodeSelection(markdown, typeName) {
  const base = createRichMarkdownState(markdown, { plugins: createMomentariseRichPlugins() });
  let target = null;
  base.editorState.doc.forEach((node, offset) => {
    if (target === null && node.type.name === typeName) {
      target = offset;
    }
  });
  assert(target !== null, `no ${typeName} in ${JSON.stringify(markdown)}.`);
  return base.editorState.apply(base.editorState.tr.setSelection(NodeSelection.create(base.editorState.doc, target)));
}

/** Build a state whose caret sits immediately after `needle`. */
function stateWithCaretAfter(markdown, needle, { insideCodeMark = false } = {}) {
  const base = createRichMarkdownState(markdown, { plugins: createMomentariseRichPlugins() });
  let target = null;
  base.editorState.doc.descendants((node, pos) => {
    if (target !== null) {
      return false;
    }
    if (node.isText && node.text?.includes(needle)) {
      const offset = node.text.indexOf(needle) + needle.length;
      const marked = insideCodeMark ? node.marks.some((mark) => mark.type.name === "code") : true;
      if (marked) {
        target = pos + offset;
        return false;
      }
    }
    return true;
  });
  assert(target !== null, `could not find ${JSON.stringify(needle)} in ${JSON.stringify(markdown)}.`);
  return base.editorState.apply(base.editorState.tr.setSelection(TextSelection.create(base.editorState.doc, target)));
}

// ---------------------------------------------------------------------------
// 1. context classification
// ---------------------------------------------------------------------------

const unsafe = [
  ["a fenced code block", "```ts\nconst slash = 1;\n```\n", "const slash", "code-block"],
  // Mid-span, not at the closing boundary: `code` is non-inclusive, so a caret
  // at the end of the span is legitimately outside it.
  ["an inline code mark", "Text with `inline slash` here.\n", "inline sl", "inline-code"],
  ["a table cell", "| head |\n| --- |\n| cell slash |\n", "cell slash", "table-cell"]
];

// Preserved raw HTML parses to an atom block that cannot hold a caret at all, so
// it is exercised as an object selection rather than through the caret matrix.
{
  const context = richTextInputContext(stateWithNodeSelection("<div>raw slash</div>\n", "unsupported_block"));
  assert.equal(context.allowsMarkdownTriggers, false, "a selected opaque block must not allow Markdown triggers.");
  assert.equal(context.reason, "opaque");
}

for (const [label, markdown, needle, expectedReason] of unsafe) {
  const state = stateWithCaretAfter(markdown, needle, { insideCodeMark: expectedReason === "inline-code" });
  const context = richTextInputContext(state);
  assert.equal(
    context.allowsMarkdownTriggers,
    false,
    `${label} must not allow Markdown triggers (MME-0088). Got reason ${context.reason}.`
  );
  assert.equal(context.reason, expectedReason, `${label} must report reason "${expectedReason}".`);
}

const safe = [
  ["a paragraph", "A paragraph here.\n", "A paragraph"],
  ["a heading", "# A heading here\n", "A heading"],
  ["a bullet item", "- A bullet here\n", "A bullet"],
  ["a todo item", "- [ ] A task here\n", "A task"],
  ["a blockquote", "> A quote here\n", "A quote"]
];

for (const [label, markdown, needle] of safe) {
  const context = richTextInputContext(stateWithCaretAfter(markdown, needle));
  assert.equal(context.allowsMarkdownTriggers, true, `${label} must allow Markdown triggers. Got reason ${context.reason}.`);
  assert.equal(context.reason, null);
}

// Finding 6: the boundary-aware inline-code claim, asserted rather than advertised.
{
  const codeText = "Text with `inline slash` here.\n";
  const atEnd = richTextInputContext(stateWithCaretAfter(codeText, "inline slash"));
  assert.equal(
    atEnd.allowsMarkdownTriggers,
    true,
    "a caret at the END of a non-inclusive code span is outside it — the next character typed is plain text."
  );
  const inside = richTextInputContext(stateWithCaretAfter(codeText, "inline sl"));
  assert.equal(inside.allowsMarkdownTriggers, false, "a caret strictly inside the span is inside it.");
}

// Finding 7: `raw-html` is only reachable inside footnote content, so exercise it
// where it actually exists rather than leaving the reason untested.
{
  const blockHtml = "Text[^1] x.\n\n[^1]: para\n\n    <div>block html</div>\n";
  const context = richTextInputContext(stateWithCaretAfter(blockHtml, "block ht"));
  assert.equal(context.allowsMarkdownTriggers, false, "raw HTML inside a footnote must not allow triggers.");
  assert.equal(context.reason, "raw-html");
}

// Finding 10: the table-cell decision is "never", including the empty cell the AC
// names as the acceptable alternative.
{
  const emptyCell = createRichMarkdownState("| head |\n| --- |\n|  |\n", { plugins: createMomentariseRichPlugins() });
  let editorState = emptyCell.editorState;
  let target = null;
  editorState.doc.descendants((node, pos) => {
    if (target === null && node.type.name === "table_cell") {
      target = pos + 2;
    }
    return true;
  });
  assert(target !== null, "the fixture must contain a table cell.");
  editorState = editorState.apply(editorState.tr.setSelection(TextSelection.create(editorState.doc, target)));
  const context = richTextInputContext(editorState);
  assert.equal(context.allowsMarkdownTriggers, false, "an EMPTY table cell is also refused — one behaviour, uniformly.");
  assert.equal(context.reason, "table-cell");
}

// The classifier must actually be discriminating, not returning a constant.
assert(
  unsafe.length >= 3 && safe.length >= 5,
  "the context matrix must cover both safe and unsafe contexts, or it proves nothing."
);

// ---------------------------------------------------------------------------
// 2. the slash trigger itself
// ---------------------------------------------------------------------------

/** Types `text` at the caret and returns the resulting trigger match. */
function triggerAfterTyping(markdown, needle, typed, options) {
  const state = stateWithCaretAfter(markdown, needle, options);
  const next = state.apply(state.tr.insertText(typed));
  return { match: matchRichSlashTrigger(next), state: next };
}

// Fires at the start of an empty block.
const emptyBlock = createRichMarkdownState("A paragraph.\n", { plugins: createMomentariseRichPlugins() });
{
  let editorState = emptyBlock.editorState;
  const end = editorState.doc.content.size - 1;
  editorState = editorState.apply(editorState.tr.setSelection(TextSelection.create(editorState.doc, end)));
  const paragraph = editorState.schema.nodes.paragraph;
  let transaction = editorState.tr.insert(end + 1, paragraph.create());
  transaction = transaction.setSelection(TextSelection.create(transaction.doc, end + 2));
  editorState = editorState.apply(transaction);
  editorState = editorState.apply(editorState.tr.insertText("/"));
  const match = matchRichSlashTrigger(editorState);
  assert(match, "`/` at the start of an empty paragraph must open the menu.");
  assert.equal(match.query, "");
}

// Fires after a space. (Markdown strips trailing spaces, so the space is typed.)
assert(
  triggerAfterTyping("Some text\n", "Some text", " /head").match,
  "`/` after a space in a paragraph must open the menu."
);
assert.equal(triggerAfterTyping("Some text\n", "Some text", " /head").match.query, "head");

// Does NOT fire mid-word — `a/b` is a path or a fraction, not a command.
assert.equal(
  triggerAfterTyping("Some text\n", "Some text", "/b").match,
  null,
  "`/` immediately after a word character must not open the menu (MME-0088)."
);

// Does NOT fire in any unsafe context.
for (const [label, markdown, needle, reason] of unsafe) {
  assert.equal(
    triggerAfterTyping(markdown, needle, " /head", { insideCodeMark: reason === "inline-code" }).match,
    null,
    `typing "/" in ${label} must not open the slash menu (MME-0088).`
  );
}
// `matchRichSlashTrigger` returns null for ANY non-empty selection, so asserting
// null on a NodeSelection proves nothing on its own. The classifier is the part
// that carries the meaning here, so assert that directly.
assert.equal(
  richTextInputContext(stateWithNodeSelection("<div>raw slash</div>\n", "unsupported_block")).reason,
  "opaque",
  "a selected opaque block must be classified as opaque, not merely rejected for being a non-empty selection."
);

// The reported defect, stated as its own case: `/` in a fenced code block.
const codeFence = triggerAfterTyping("```ts\nconst slash = 1;\n```\n", "const slash", " /");
assert.equal(codeFence.match, null, "typing `/` inside a fenced code block must not open the slash menu.");
// …and the character itself still reaches the code, unharmed.
assert(
  codeFence.state.doc.textBetween(0, codeFence.state.doc.content.size, "\n", "\n").includes("const slash /"),
  "the `/` character must still be inserted into the code block; only the menu is suppressed."
);

// The match reports a range that covers exactly the `/` plus the query, so the
// host can remove it when a command runs and leave it when the menu is dismissed.
{
  const { match, state } = triggerAfterTyping("Some text\n", "Some text", " /head");
  assert.equal(state.doc.textBetween(match.from, match.to), "/head", "the match range must cover the slash and the query.");
}

// ---------------------------------------------------------------------------
// 3. the demo consumes the package contract instead of its own regex
// ---------------------------------------------------------------------------

const demoSource = readFileSync("apps/md-demo/src/main.ts", "utf8");
assert(
  demoSource.includes("matchRichSlashTrigger"),
  "the demo must use the packaged slash trigger contract, so a consumer gets the same behaviour."
);
assert(
  !/textBefore\.match\(\/\\\/\(\[A-Za-z0-9_-\]\*\)\$\/\)/.test(demoSource),
  "the demo must not keep its own context-free slash regex."
);

// ---------------------------------------------------------------------------
// registration
// ---------------------------------------------------------------------------

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
assert.equal(
  packageJson.scripts["test:rich-slash-trigger"],
  "npm run build && node tests/rich-slash-trigger.test.mjs",
  "Missing test:rich-slash-trigger script."
);
assert(packageJson.scripts.test.includes("test:rich-slash-trigger"), "Root npm test must include the slash trigger gate.");
assert.equal(
  packageJson.scripts["visual:mme-0088"],
  "node scripts/visual-check-mme0088.mjs",
  "Missing visual:mme-0088 script."
);

console.log("rich-slash-trigger: all assertions passed.");
