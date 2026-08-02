import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * MME-0103 — block selection model (benchmark contract 3), attempt 2.
 *
 * Attempt 1 was reverted from `main` for silent Markdown corruption. Three of
 * its gates were vacuous, so the shape of this file is a direct response:
 *
 *  - preservation is asserted with `assert.equal` on the FULL output against
 *    CRLF, wide-gap, frontmatter and footnote-definition fixtures, never with
 *    `includes(substring)`;
 *  - the framed-block matrix reaches a real table, and each case's expected
 *    output is derived from that case's own source span, so a case that
 *    silently re-tested a neighbouring block (attempt 1's
 *    `label === "a table" ? FIXTURE : FIXTURE`) fails instead of passing;
 *  - undo atomicity is asserted on `undoDepth` delta and `tr.steps.length`,
 *    because `prosemirror-history` merges adjacent transactions inside a 500ms
 *    window and hides a split operation from a keystroke test;
 *  - the state machine is driven by real `KeyboardEvent`s dispatched at a real
 *    mounted `EditorView`, not by calling the exported functions. Attempt 1
 *    exported working functions with zero call sites and its gates never
 *    noticed.
 *
 * The reversion-to-failure table for every assertion here is in this issue's
 * `docs/internal/build-log.md` entry.
 */

const { JSDOM } = await import("jsdom");
const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
for (const globalName of [
  "DOMParser",
  "DocumentFragment",
  "Element",
  "Event",
  "HTMLElement",
  "KeyboardEvent",
  "MutationObserver",
  "Node",
  "Range"
]) {
  if (dom.window[globalName] !== undefined) {
    globalThis[globalName] = dom.window[globalName];
  }
}

const rich = await import("../packages/md-rich-prosemirror/dist/index.js");
const surface = await import("../packages/md-surface/dist/index.js");
const { EditorView } = await import("prosemirror-view");
const { NodeSelection, Selection, TextSelection } = await import("prosemirror-state");
const { undoDepth } = await import("prosemirror-history");

const {
  createMomentariseRichPlugins,
  createRichMarkdownState,
  createRichBlockSelectionPlugin,
  richBlockSelection,
  richBlockSelectionAnnouncement,
  richBlockSelectionMarkdown,
  richBlockSelectionPluginKey,
  serializeRichMarkdownState
} = rich;

for (const exportName of [
  "createRichBlockSelectionPlugin",
  "richBlockSelection",
  "richBlockSelectionAnnouncement",
  "richBlockSelectionMarkdown",
  "richBlockSelectionPluginKey"
]) {
  assert.equal(
    typeof rich[exportName],
    exportName === "richBlockSelectionPluginKey" ? "object" : "function",
    `@momentarise/md-rich-prosemirror must export ${exportName} (MME-0103).`
  );
}

const lfFixture = readFileSync("fixtures/040-block-selection/input.md", "utf8");
const crlfFixture = readFileSync("fixtures/040-block-selection/input-crlf.md", "utf8");

assert(crlfFixture.includes("\r\n"), "the CRLF fixture must actually contain CRLF line endings.");
assert(
  !/[^\r]\n/.test(crlfFixture),
  "the CRLF fixture must contain no bare LF, or it cannot prove line endings survive."
);

// ---------------------------------------------------------------------------
// Harness — a real EditorView, driven by real key events
// ---------------------------------------------------------------------------

function mount(markdown) {
  const host = dom.window.document.createElement("div");
  dom.window.document.body.append(host);
  const state = createRichMarkdownState(markdown, { dialect: "momentarise-enhanced" });
  const view = new EditorView(host, { state: state.editorState });
  return {
    destroy() {
      view.destroy();
      host.remove();
    },
    host,
    markdown() {
      return serializeRichMarkdownState({ ...state, editorState: view.state }).content;
    },
    state,
    view
  };
}

/** Dispatches the key the user actually presses at the editor's DOM. */
function press(editor, key, modifiers = {}) {
  const event = new dom.window.KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    key,
    ...modifiers
  });
  editor.view.dom.dispatchEvent(event);
  return event;
}

/**
 * Puts the user's cursor on the top-level block at `index`.
 *
 * A textblock gets a caret inside it. An atom block (callout, raw HTML, opaque
 * syntax, media) has no inside to put a caret in — clicking one produces a node
 * selection, so that is what this does. Asserted either way: the landing block
 * must be the block asked for.
 */
function caretInBlock(editor, index) {
  const ranges = rich.richTopLevelBlockRanges(editor.view.state);
  const range = ranges[index];
  assert(range, `fixture has no block at index ${index}.`);
  const { doc } = editor.view.state;
  const inside = Selection.near(doc.resolve(range.from + 1), 1);
  const landed = inside.$from.depth === 0 ? inside.$from.index() : inside.$from.index(0);
  const selection = landed === index ? inside : NodeSelection.create(doc, range.from);
  editor.view.dispatch(editor.view.state.tr.setSelection(selection));
  return range;
}

/** Enters block selection on `index` the way a user does: caret, then Escape. */
function selectBlock(editor, index) {
  caretInBlock(editor, index);
  press(editor, "Escape");
  const info = richBlockSelection(editor.view.state);
  assert(info, `Escape did not enter block selection on block ${index}.`);
  assert.equal(info.fromIndex, index, `Escape selected block ${info.fromIndex} instead of ${index}.`);
  return info;
}

/** A DataTransfer stand-in: jsdom ships neither ClipboardEvent nor DataTransfer. */
function clipboardStub(initial = {}) {
  const data = { ...initial };
  return {
    getData(type) {
      return data[type] ?? "";
    },
    setData(type, value) {
      data[type] = value;
    },
    types: Object.keys(data),
    values: data
  };
}


// ---------------------------------------------------------------------------
// 1. Separators are bytes too — full-output equality, no substring checks
// ---------------------------------------------------------------------------

/*
 * Deleting a block removes exactly that block and the gap its author wrote after
 * it. The expected document is therefore derived from the source offsets rather
 * than restated by hand, which makes it impossible for the assertion to agree
 * with an implementation that rewrote separators.
 */
function expectedAfterDeletingBlock(source, blockSource) {
  assert.equal(
    source.split(blockSource).length,
    2,
    `the fixture must contain ${JSON.stringify(blockSource.slice(0, 40))} exactly once, or the expectation is ambiguous.`
  );
  const start = source.indexOf(blockSource);
  const end = start + blockSource.length;
  const gapAfter = /^(?:\r?\n)+/.exec(source.slice(end))?.[0] ?? "";
  if (end + gapAfter.length >= source.length) {
    // The last block: it takes the gap BEFORE it, and the document keeps its
    // own trailing bytes.
    const gapBefore = /(?:\r?\n)+$/.exec(source.slice(0, start))?.[0] ?? "";
    return source.slice(0, start - gapBefore.length) + gapAfter;
  }
  return source.slice(0, start) + source.slice(end + gapAfter.length);
}

const separatorCases = [
  {
    blockIndex: 1,
    blockSource: "B.",
    label: "CRLF document, middle block",
    source: "A.\r\n\r\nB.\r\n\r\nC.\r\n"
  },
  {
    blockIndex: 2,
    blockSource: "C.",
    label: "CRLF document, last block",
    source: "A.\r\n\r\nB.\r\n\r\nC.\r\n"
  },
  {
    blockIndex: 0,
    blockSource: "A.",
    label: "CRLF document, first block",
    source: "A.\r\n\r\nB.\r\n\r\nC.\r\n"
  },
  {
    blockIndex: 1,
    blockSource: "B.",
    label: "four-newline gaps, middle block",
    source: "A.\n\n\n\nB.\n\n\n\nC.\n"
  },
  {
    blockIndex: 0,
    blockSource: "A.",
    label: "frontmatter document, first body block",
    source: "---\ntitle: T\nowner: docs\n---\n\nA.\n\nB.\n\nC.\n"
  },
  {
    blockIndex: 2,
    blockSource: "Second paragraph, the one block operations remove.",
    label: "CRLF fixture, middle paragraph",
    source: crlfFixture
  },
  {
    blockIndex: 5,
    blockSource: "[^eol]: Line endings are bytes, and bytes are the durable source.",
    label: "CRLF fixture, trailing footnote definition",
    source: crlfFixture
  },
  {
    blockIndex: 2,
    blockSource: "A paragraph separated by a wide blank-line gap above and below.",
    label: "LF fixture, block between four-newline gaps",
    source: lfFixture
  }
];

for (const testCase of separatorCases) {
  const editor = mount(testCase.source);
  assert.equal(
    editor.markdown(),
    testCase.source,
    `${testCase.label}: an untouched document must serialize to its own bytes before anything is deleted.`
  );
  selectBlock(editor, testCase.blockIndex);
  press(editor, "Backspace");
  assert.equal(
    editor.markdown(),
    expectedAfterDeletingBlock(testCase.source, testCase.blockSource),
    `${testCase.label}: deleting a block must remove only that block and the gap after it, leaving every other byte — including line endings and blank-line runs — exactly as authored.`
  );
  editor.destroy();
}

// Duplicating is the harder case: the copy is always "inserted", so attempt 1
// invented a separator for it every single time.
{
  const editor = mount("A.\r\n\r\nB.\r\n\r\nC.\r\n");
  selectBlock(editor, 1);
  press(editor, "d", { metaKey: true });
  assert.equal(
    editor.markdown(),
    "A.\r\n\r\nB.\r\n\r\nB.\r\n\r\nC.\r\n",
    "duplicating a block in a CRLF document must join the copy with CRLF, not with a bare LF."
  );
  editor.destroy();
}

{
  const editor = mount("A.\n\n\n\nB.\n\n\n\nC.\n");
  selectBlock(editor, 1);
  press(editor, "d", { metaKey: true });
  assert.equal(
    editor.markdown(),
    "A.\n\n\n\nB.\n\n\n\nB.\n\n\n\nC.\n",
    "duplicating a block must reuse the document's authored blank-line gap, not collapse it to one blank line."
  );
  editor.destroy();
}

/*
 * Duplicating is where preservation and reconstruction meet. The original block
 * keeps its own bytes — `*   alpha` with its unusual marker and spacing — while
 * the copy is a new block and is emitted by the reconstructing serializer. The
 * deviation is confined to the block the user acted on; nothing else moves.
 */
{
  const source = "Intro.\n\n*   alpha\n*   beta\n\nOutro.\n";
  const editor = mount(source);
  selectBlock(editor, 1);
  press(editor, "d", { metaKey: true });
  assert.equal(
    editor.markdown(),
    "Intro.\n\n*   alpha\n*   beta\n\n- alpha\n- beta\n\nOutro.\n",
    "duplicating a list keeps the original's authored markers byte-exact and places the reconstructed copy immediately after it."
  );
  editor.destroy();
}

/*
 * `Enter` on a block selection, stated as a whole document rather than sampled.
 *
 * Markdown has no syntax for an empty paragraph, so the replacement block is
 * emitted as nothing and the document reads as a wider blank-line run until the
 * user types into it. That is a Markdown-native consequence, not a defect — and
 * writing the expectation out in full is the only way to say so honestly. Every
 * other byte, including the CRLF endings and the frontmatter, is unchanged.
 */
{
  const editor = mount(crlfFixture);
  selectBlock(editor, 3);
  press(editor, "Enter");
  assert.equal(
    editor.markdown(),
    crlfFixture.replace("```ts\r\nconst crlf = true;\r\n```", ""),
    "replacing the code fence must leave every other byte of the CRLF document exactly as authored."
  );
  assert.equal(
    /[^\r]\n/.test(editor.markdown()),
    false,
    "and no bare LF may appear anywhere in a CRLF document after the replacement."
  );
  editor.destroy();
}

/*
 * Replace, paste and type get the same full-output treatment as delete and
 * duplicate — and specifically against the case that broke: a block whose NEW
 * content equals a LATER block's.
 *
 * The block-alignment pass matched such a block to that later pair, which
 * re-slotted the untouched later block into the vacated earlier pair, and both
 * survivors then drew the wrong gap. Nothing was lost and no bare LF appeared,
 * so only full-document equality against a wide-gap fixture catches it: the
 * earlier `startsWith`/`endsWith` paste assertions ran on a uniform-gap document
 * and passed straight through it.
 */
for (const transposition of [
  {
    blockIndex: 0,
    expected: "B.\n\n\n\nB.\n\nC.\n",
    label: "paste content equal to a later block",
    payload: "B.\n",
    source: "A.\n\n\n\nB.\n\nC.\n",
    via: "paste"
  },
  {
    blockIndex: 0,
    expected: "B.\r\n\r\n\r\n\r\nB.\r\n\r\nC.\r\n",
    label: "paste, CRLF document with a wide gap",
    payload: "B.\n",
    source: "A.\r\n\r\n\r\n\r\nB.\r\n\r\nC.\r\n",
    via: "paste"
  },
  {
    blockIndex: 0,
    expected: "```ts\nx\n```\n\n\n\n```ts\nx\n```\n\nTail.\n",
    label: "paste a code fence equal to a later code fence",
    payload: "```ts\nx\n```\n",
    source: "# H1\n\n\n\n```ts\nx\n```\n\nTail.\n",
    via: "paste"
  },
  {
    blockIndex: 0,
    expected: "B.\n\n\n\nB.\n\nC.\n",
    label: "type content equal to a later block",
    payload: "B.",
    source: "A.\n\n\n\nB.\n\nC.\n",
    via: "type"
  }
]) {
  const editor = mount(transposition.source);
  selectBlock(editor, transposition.blockIndex);
  const handled =
    transposition.via === "paste"
      ? editor.view.someProp("handlePaste", (handler) =>
          handler(editor.view, { clipboardData: clipboardStub({ "text/plain": transposition.payload }) })
        )
      : editor.view.someProp("handleTextInput", (handler) =>
          handler(editor.view, editor.view.state.selection.from, editor.view.state.selection.to, transposition.payload)
        );
  assert.equal(handled, true, `${transposition.label}: the block layer must handle it.`);
  assert.equal(
    editor.markdown(),
    transposition.expected,
    `${transposition.label}: the blocks the user never touched must keep the blank-line runs their author wrote, including the gap BETWEEN them.`
  );
  editor.destroy();
}

// ---------------------------------------------------------------------------
// 2. The state machine, through real key events
// ---------------------------------------------------------------------------

{
  const editor = mount("A.\n\nB.\n\nC.\n");

  caretInBlock(editor, 1);
  assert.equal(richBlockSelection(editor.view.state), null, "a caret is not a block selection.");

  press(editor, "Escape");
  const entered = richBlockSelection(editor.view.state);
  assert(entered, "Escape from inside a block must select that block.");
  assert.deepEqual(
    { count: entered.count, fromIndex: entered.fromIndex, toIndex: entered.toIndex },
    { count: 1, fromIndex: 1, toIndex: 1 },
    "Escape selects exactly the block the caret was in."
  );
  assert(
    editor.view.state.selection instanceof NodeSelection,
    "a single-block selection is a NodeSelection, so no per-character highlight is painted."
  );

  press(editor, "Escape");
  assert.equal(richBlockSelection(editor.view.state), null, "a second Escape clears the block selection.");
  const restored = editor.view.state.selection;
  assert(restored instanceof TextSelection && restored.empty, "clearing leaves a caret, not a range.");
  assert.equal(
    restored.$from.parent.textContent,
    "B.",
    "and the caret is returned to the block that was selected, not to some arbitrary block."
  );

  press(editor, "Escape");
  press(editor, "ArrowDown");
  assert.equal(
    richBlockSelection(editor.view.state)?.fromIndex,
    2,
    "ArrowDown moves the block selection to the next sibling."
  );
  press(editor, "ArrowUp");
  assert.equal(
    richBlockSelection(editor.view.state)?.fromIndex,
    1,
    "ArrowUp moves the block selection to the previous sibling."
  );

  press(editor, "ArrowDown", { shiftKey: true });
  const extended = richBlockSelection(editor.view.state);
  assert.deepEqual(
    { anchorIndex: extended.anchorIndex, count: extended.count, fromIndex: extended.fromIndex },
    { anchorIndex: 1, count: 2, fromIndex: 1 },
    "Shift+ArrowDown extends the block selection instead of moving it."
  );
  press(editor, "ArrowUp", { shiftKey: true });
  assert.equal(
    richBlockSelection(editor.view.state)?.count,
    1,
    "Shift+ArrowUp contracts the extended selection back to the anchor."
  );

  /*
   * The edges absorb the key rather than letting the caret escape sideways.
   * Asserted on `defaultPrevented`, which is what ProseMirror sets when a
   * `handleKeyDown` claims the event: observing only the plugin state would pass
   * even if the key fell through, because the caret it leaves behind still lands
   * inside block 0 and the state survives.
   */
  press(editor, "ArrowUp");
  const atFirstBlock = press(editor, "ArrowUp");
  assert.equal(
    atFirstBlock.defaultPrevented,
    true,
    "ArrowUp at the first block must be consumed by the block layer, not fall through to the caret."
  );
  assert.equal(
    richBlockSelection(editor.view.state)?.fromIndex,
    0,
    "and the block selection stays on the first block."
  );
  editor.destroy();
}

/*
 * Tab steps the block layer out of the way rather than claiming the key.
 *
 * Without this, Tab inside a selected table moved the caret into a cell while
 * the block stayed painted around it — and because that transaction's selection
 * lands INSIDE the selected range, the browser-echo tolerance kept the stale
 * block selection alive. Tab still belongs to the table walk and list
 * indentation, so the handler must decline after clearing.
 */
{
  const editor = mount("- one\n- two\n\nParagraph.\n");
  selectBlock(editor, 0);
  const blockSelectionPlugin = editor.view.state.plugins.find(
    (plugin) => plugin.spec.key === richBlockSelectionPluginKey
  );
  const handled = blockSelectionPlugin.props.handleKeyDown(
    editor.view,
    new dom.window.KeyboardEvent("keydown", { cancelable: true, key: "Tab" })
  );
  assert.equal(handled, false, "Tab must not be claimed by the block layer; it belongs to lists and table cells.");
  assert.equal(
    richBlockSelection(editor.view.state),
    null,
    "but Tab must clear the block selection, or it stays painted around a block whose caret has moved elsewhere."
  );
  editor.destroy();
}

// Cmd/Ctrl+A escalates: inline selection -> current block -> whole document.
{
  const editor = mount("A.\n\nB.\n\nC.\n");
  caretInBlock(editor, 1);

  press(editor, "a", { metaKey: true });
  assert.equal(richBlockSelection(editor.view.state), null, "the first Cmd+A stays inline.");
  const inline = editor.view.state.selection;
  assert.equal(
    editor.view.state.doc.textBetween(inline.from, inline.to),
    "B.",
    "the first Cmd+A selects the current block's inline content."
  );

  press(editor, "a", { metaKey: true });
  assert.deepEqual(
    {
      count: richBlockSelection(editor.view.state)?.count,
      fromIndex: richBlockSelection(editor.view.state)?.fromIndex
    },
    { count: 1, fromIndex: 1 },
    "the second Cmd+A escalates the inline selection to the current block."
  );

  press(editor, "a", { metaKey: true });
  assert.deepEqual(
    {
      count: richBlockSelection(editor.view.state)?.count,
      fromIndex: richBlockSelection(editor.view.state)?.fromIndex
    },
    { count: 3, fromIndex: 0 },
    "the third Cmd+A escalates to the whole document."
  );

  /*
   * A fourth press must be consumed, not fall through to `baseKeymap`'s
   * `selectAll`. Checking the count alone would pass either way: an
   * `AllSelection` spans the whole document, which is inside the selected range,
   * so the plugin state survives the fall-through untouched. The selection TYPE
   * is what distinguishes them.
   */
  const fourth = press(editor, "a", { metaKey: true });
  assert.equal(fourth.defaultPrevented, true, "a fourth Cmd+A must be consumed by the block layer.");
  assert.equal(
    editor.view.state.selection.constructor.name,
    "NodeSelection",
    "a fourth Cmd+A must not fall through to selectAll, which would replace the block layer with an AllSelection."
  );
  assert.equal(richBlockSelection(editor.view.state)?.count, 3, "and the whole document stays selected as blocks.");
  editor.destroy();
}

// Typing replaces the selected blocks.
{
  const editor = mount("A.\n\nB.\n\nC.\n");
  selectBlock(editor, 0);
  press(editor, "ArrowDown", { shiftKey: true });
  assert.equal(richBlockSelection(editor.view.state)?.count, 2, "two blocks are selected before typing.");
  const handled = editor.view.someProp("handleTextInput", (handler) =>
    handler(editor.view, editor.view.state.selection.from, editor.view.state.selection.to, "typed")
  );
  assert.equal(handled, true, "typing over a block selection must be handled by the block layer.");
  assert.equal(
    editor.markdown(),
    "typed\n\nC.\n",
    "typing replaces every selected block with the typed text, and leaves the rest byte-identical."
  );
  assert.equal(richBlockSelection(editor.view.state), null, "typing leaves block-selection mode.");
  editor.destroy();
}

// Enter replaces the selection with an empty paragraph and places the caret.
{
  const editor = mount("A.\n\nB.\n\nC.\n");
  selectBlock(editor, 1);
  press(editor, "Enter");
  assert.equal(richBlockSelection(editor.view.state), null, "Enter leaves block-selection mode.");
  const { selection } = editor.view.state;
  assert(selection instanceof TextSelection && selection.empty, "Enter leaves a caret, not a selection.");
  assert.equal(
    editor.view.state.doc.child(1).type.name,
    "paragraph",
    "Enter replaces the selected block with a paragraph."
  );
  assert.equal(editor.view.state.doc.child(1).content.size, 0, "the replacement paragraph is empty.");
  assert.equal(
    selection.$from.parent,
    editor.view.state.doc.child(1),
    "the caret is placed inside the replacement paragraph."
  );
  editor.destroy();
}

// ---------------------------------------------------------------------------
// 3. Undo atomicity — measured, never inferred from one Cmd+Z
// ---------------------------------------------------------------------------

/*
 * Every mutating operation, not a sample of them: the acceptance criterion says
 * *every* operation is one undoable transaction, and cut in particular both
 * copies and deletes, which is exactly the shape that tends to split in two.
 */
for (const [label, run] of [
  ["delete", (editor) => press(editor, "Backspace")],
  ["delete with the Delete key", (editor) => press(editor, "Delete")],
  ["duplicate", (editor) => press(editor, "d", { metaKey: true })],
  ["duplicate with Ctrl", (editor) => press(editor, "d", { ctrlKey: true })],
  ["replace with a paragraph", (editor) => press(editor, "Enter")],
  [
    "typing over the selection",
    (editor) =>
      editor.view.someProp("handleTextInput", (handler) =>
        handler(editor.view, editor.view.state.selection.from, editor.view.state.selection.to, "typed")
      )
  ],
  [
    "pasting over the selection",
    (editor) =>
      editor.view.someProp("handlePaste", (handler) =>
        handler(editor.view, { clipboardData: clipboardStub({ "text/plain": "Pasted.\n\nAlso pasted.\n" }) })
      )
  ],
  [
    "cut",
    (editor) =>
      editor.view.someProp("handleDOMEvents", (handlers) =>
        handlers.cut?.(editor.view, { clipboardData: clipboardStub(), preventDefault() {} })
      )
  ]
]) {
  const editor = mount(crlfFixture);
  selectBlock(editor, 2);
  const depthBefore = undoDepth(editor.view.state);

  const steps = [];
  const originalDispatch = editor.view.dispatch.bind(editor.view);
  editor.view.dispatch = (transaction) => {
    if (transaction.docChanged) {
      steps.push(transaction.steps.length);
    }
    originalDispatch(transaction);
  };
  run(editor);
  editor.view.dispatch = originalDispatch;

  assert.equal(
    steps.length,
    1,
    `${label} must be a single document-changing transaction; ${steps.length} were dispatched, and prosemirror-history would merge them within 500ms so a keystroke test could not tell.`
  );
  assert.equal(steps[0], 1, `${label} must be one step, not ${steps[0]}.`);
  assert.equal(
    undoDepth(editor.view.state) - depthBefore,
    1,
    `${label} must add exactly one undo entry.`
  );
  editor.destroy();
}

// One undo restores the document byte-for-byte.
{
  const editor = mount(crlfFixture);
  selectBlock(editor, 2);
  press(editor, "Backspace");
  assert.notEqual(editor.markdown(), crlfFixture, "the delete must have changed the document.");
  const { undo } = await import("prosemirror-history");
  undo(editor.view.state, editor.view.dispatch.bind(editor.view));
  assert.equal(editor.markdown(), crlfFixture, "one undo restores the original bytes exactly.");
  editor.destroy();
}

// ---------------------------------------------------------------------------
// 4. Framed blocks — every one, and the matrix really reaches the table
// ---------------------------------------------------------------------------

/*
 * Each case names the block's own source. Nothing is shared between cases and
 * nothing is derived from the implementation: if a case pointed at the wrong
 * block index, the full-document equality below would fail rather than quietly
 * pass against a neighbour. That is the exact defect attempt 1 shipped.
 */
const framedBlockCases = [
  {
    label: "table",
    nodeType: "table",
    source: "| Area | Risk |\n| --- | --- |\n| Table | cell selection |"
  },
  {
    label: "fenced code block",
    nodeType: "code_block",
    source: "```ts\nconst selected = true;\n```"
  },
  {
    label: "callout",
    nodeType: "unsupported_block",
    source: "> [!NOTE] Callout block\n> Framed blocks are selected as whole objects."
  },
  {
    label: "raw HTML block",
    nodeType: "unsupported_block",
    source: '<div data-block="framed">Raw HTML block</div>'
  },
  {
    label: "opaque unknown syntax",
    nodeType: "unsupported_block",
    source: "::: unknown-directive\nOpaque content that must never be flattened.\n:::"
  },
  {
    label: "media image",
    nodeType: "paragraph",
    source: "![Diagram](./diagram.png)"
  },
  {
    label: "footnote definition",
    nodeType: "footnote_definition",
    source: "[^one]: The footnote definition is a top-level block too."
  }
];

const seenFramedTypes = new Set();
for (const framed of framedBlockCases) {
  const editor = mount(lfFixture);
  const ranges = rich.richTopLevelBlockRanges(editor.view.state);
  const blockIndex = blockIndexOfSource(lfFixture, framed.source);
  assert(ranges[blockIndex], `${framed.label}: the fixture has no block at index ${blockIndex}.`);
  assert.equal(
    ranges[blockIndex].type,
    framed.nodeType,
    `${framed.label}: expected a ${framed.nodeType} block, found ${ranges[blockIndex].type} — the matrix is pointing at the wrong block.`
  );
  seenFramedTypes.add(framed.label);

  const info = selectBlock(editor, blockIndex);
  assert.equal(info.count, 1, `${framed.label}: Escape must select the framed block as one whole object.`);
  /*
   * The ProseMirror selection, not the plugin's own arithmetic. `info.from`/`to`
   * are derived from the same block ranges this would compare them against, so
   * comparing the two is true by construction and proves nothing; what matters
   * is that the editor's actual selection covers the whole node.
   */
  const framedSelection = editor.view.state.selection;
  assert.equal(
    framedSelection.constructor.name,
    "NodeSelection",
    `${framed.label}: a framed block must be selected as an object.`
  );
  assert.equal(
    framedSelection.from,
    ranges[blockIndex].from,
    `${framed.label}: the selection must start at the block, not inside it.`
  );
  assert.equal(
    framedSelection.to,
    ranges[blockIndex].to,
    `${framed.label}: the selection must end at the block, not inside it.`
  );

  press(editor, "Backspace");
  assert.equal(
    editor.markdown(),
    expectedAfterDeletingBlock(lfFixture, framed.source),
    `${framed.label}: deleting it must remove exactly its own source and leave every other block byte-identical.`
  );
  editor.destroy();
}

assert.equal(
  seenFramedTypes.size,
  framedBlockCases.length,
  "every framed-block case must have run as its own case."
);

/*
 * Duplicating a framed block is the harder half: the copy is always "inserted",
 * so it is the case where a separator gets invented rather than inherited. Run
 * for every framed type, with full-document equality against the fixture.
 */
for (const framed of framedBlockCases) {
  const editor = mount(lfFixture);
  const blockIndex = blockIndexOfSource(lfFixture, framed.source);
  const isLastBlock = blockIndex === editor.view.state.doc.childCount - 1;
  selectBlock(editor, blockIndex);
  press(editor, "d", { metaKey: true });
  const end = lfFixture.indexOf(framed.source) + framed.source.length;
  // The gap the author wrote after this block; the last block has no gap after
  // it, only the document's trailing bytes, so the copy inherits the document's
  // own paragraph break instead.
  const separator = isLastBlock ? "\n\n" : (/^(?:\r?\n)+/.exec(lfFixture.slice(end))?.[0] ?? "\n\n");
  assert.equal(
    editor.markdown(),
    lfFixture.slice(0, end) + separator + framed.source + lfFixture.slice(end),
    `${framed.label}: duplicating must leave the original byte-exact, reproduce it faithfully, and join the copy with the authored gap.`
  );
  editor.destroy();
}

/**
 * The block index a source span belongs to, counted by how many blank-line
 * separated top-level blocks precede it in the body. Independent of the editor,
 * so a wrong index in the matrix above surfaces as a failure.
 */
function blockIndexOfSource(source, blockSource) {
  const bodyStart = source.startsWith("---\n") ? source.indexOf("\n---\n", 3) + "\n---\n".length : 0;
  const body = source.slice(bodyStart).replace(/^(?:\r?\n)+/, "");
  const offset = body.indexOf(blockSource);
  assert(offset >= 0, `could not find ${JSON.stringify(blockSource.slice(0, 30))} in the fixture body.`);
  const before = body.slice(0, offset);
  return before.length === 0 ? 0 : before.split(/(?:\r?\n){2,}/).filter((part) => part.length > 0).length;
}

// The table specifically: prosemirror-tables must not reinterpret the selection.
{
  const editor = mount(lfFixture);
  const tableIndex = rich.richTopLevelBlockRanges(editor.view.state).findIndex((range) => range.type === "table");
  assert(tableIndex >= 0, "the fixture must contain a table for this case to mean anything.");

  // Enter through a table CELL, which is where a user's caret actually is.
  let cellPosition = null;
  editor.view.state.doc.descendants((node, position) => {
    if (cellPosition === null && node.type.name === "table_cell") {
      cellPosition = position + 2;
    }
    return cellPosition === null;
  });
  assert(cellPosition !== null, "the fixture table must have a cell.");
  editor.view.dispatch(editor.view.state.tr.setSelection(TextSelection.create(editor.view.state.doc, cellPosition)));
  press(editor, "Escape");

  const info = richBlockSelection(editor.view.state);
  assert(info, "Escape inside a table cell must select the table as a block.");
  assert.equal(info.fromIndex, tableIndex, "Escape from a cell selects the owning table block.");
  assert.equal(
    editor.view.state.selection.constructor.name,
    "NodeSelection",
    "the table selection must stay a NodeSelection; tableEditing() converting it to a CellSelection is what made Esc+Backspace wipe every cell in attempt 1."
  );

  press(editor, "Backspace");
  const afterTableDelete = editor.markdown();
  assert.equal(
    afterTableDelete,
    expectedAfterDeletingBlock(lfFixture, framedBlockCases[0].source),
    "Backspace on a selected table deletes the table block, byte-exactly."
  );
  assert.equal(
    afterTableDelete.includes("|  |  |"),
    false,
    "Backspace must not empty the table's cells — that was the destructive failure mode."
  );
  editor.destroy();
}

// ---------------------------------------------------------------------------
// 5. Clipboard — canonical Markdown out, equivalent blocks back in
// ---------------------------------------------------------------------------

{
  const editor = mount(lfFixture);
  selectBlock(editor, 3);
  press(editor, "ArrowDown", { shiftKey: true });
  assert.equal(richBlockSelection(editor.view.state)?.count, 2, "table plus code fence are selected.");

  const clipboardData = clipboardStub();
  let defaultPrevented = false;
  const handled = editor.view.someProp("handleDOMEvents", (handlers) =>
    handlers.copy?.(editor.view, {
      clipboardData,
      preventDefault() {
        defaultPrevented = true;
      }
    })
  );
  assert.equal(handled, true, "a copy over a block selection must be handled by the block layer.");
  assert.equal(defaultPrevented, true, "the block layer owns the clipboard payload, so it prevents the default copy.");

  const copied = clipboardData.getData("text/plain");
  assert.equal(
    copied,
    richBlockSelectionMarkdown(editor.view.state),
    "text/plain must be the block selection's canonical Markdown."
  );
  assert.equal(
    copied,
    "| Area | Risk |\n| --- | --- |\n| Table | cell selection |\n\n```ts\nconst selected = true;\n```\n",
    "the copied Markdown is exactly the two selected blocks, in order, and nothing else."
  );
  assert(clipboardData.getData("text/html").length > 0, "the HTML clipboard flavour is written too.");

  // Paste that Markdown over another block selection: equivalent blocks return.
  const target = mount("A.\n\nB.\n\nC.\n");
  target.view.dispatch(
    target.view.state.tr.setSelection(TextSelection.create(target.view.state.doc, 5))
  );
  press(target, "Escape");
  const pasted = target.view.someProp("handlePaste", (handler) =>
    handler(target.view, { clipboardData: clipboardStub({ "text/plain": copied }) })
  );
  assert.equal(pasted, true, "pasting Markdown over a block selection must be handled.");
  const restored = rich.richTopLevelBlockRanges(target.view.state);
  assert.deepEqual(
    restored.map((range) => range.type),
    ["paragraph", "table", "code_block", "paragraph"],
    "pasting the copied Markdown restores equivalent blocks, not flattened paragraphs."
  );
  assert.equal(
    target.markdown().includes("| Area | Risk |"),
    true,
    "the pasted table survives as a table in the Markdown."
  );
  assert.equal(
    target.markdown().includes("const selected = true;"),
    true,
    "the pasted code fence survives in the Markdown."
  );
  assert.equal(
    target.markdown().startsWith("A.\n\n"),
    true,
    "the block before the pasted range is untouched."
  );
  assert.equal(target.markdown().endsWith("C.\n"), true, "the block after the pasted range is untouched.");
  target.destroy();
  editor.destroy();
}

// Cut is copy plus delete, and both halves have to happen.
{
  const editor = mount(crlfFixture);
  selectBlock(editor, 2);
  const clipboardData = clipboardStub();
  let defaultPrevented = false;
  const handled = editor.view.someProp("handleDOMEvents", (handlers) =>
    handlers.cut?.(editor.view, {
      clipboardData,
      preventDefault() {
        defaultPrevented = true;
      }
    })
  );
  assert.equal(handled, true, "a cut over a block selection must be handled by the block layer.");
  assert.equal(defaultPrevented, true, "and it owns the clipboard payload.");
  assert.equal(
    clipboardData.getData("text/plain"),
    "Second paragraph, the one block operations remove.\n",
    "cut must put the block's canonical Markdown on the clipboard, exactly."
  );
  assert.equal(
    editor.markdown(),
    expectedAfterDeletingBlock(crlfFixture, "Second paragraph, the one block operations remove."),
    "and cut must remove the block byte-exactly, leaving the CRLF separators as authored."
  );
  assert.equal(richBlockSelection(editor.view.state), null, "cut leaves block-selection mode.");
  editor.destroy();
}

// Copy with no block selection is not the block layer's business.
{
  const editor = mount("A.\n\nB.\n");
  caretInBlock(editor, 0);
  const handled = editor.view.someProp("handleDOMEvents", (handlers) =>
    handlers.copy?.(editor.view, { clipboardData: clipboardStub(), preventDefault() {} })
  );
  assert.notEqual(handled, true, "an ordinary copy must fall through to ProseMirror.");
  editor.destroy();
}

// ---------------------------------------------------------------------------
// 6. The presentation ships with the model
// ---------------------------------------------------------------------------

{
  // Default plugins only — no affordance plugin, no host wiring.
  const defaultPlugins = createMomentariseRichPlugins();
  assert(
    defaultPlugins.some((plugin) => plugin.spec.key === richBlockSelectionPluginKey),
    "createMomentariseRichPlugins must include the block-selection plugin, or default-plugin consumers get an invisible block-selection mode."
  );

  const editor = mount("A.\n\nB.\n\nC.\n");
  const blocks = () => [...editor.view.dom.children].filter((child) => !child.classList.contains("ProseMirror-widget"));

  assert.deepEqual(
    blocks().map((block) => block.getAttribute("data-mme-block-selected")),
    [null, null, null],
    "no block is marked selected before anything is selected."
  );

  selectBlock(editor, 1);
  assert.deepEqual(
    blocks().map((block) => block.getAttribute("data-mme-block-selected")),
    [null, "true", null],
    "the selected block, and only the selected block, is marked."
  );
  assert.equal(
    editor.view.dom.getAttribute("data-mme-block-selection"),
    "1",
    "the editor advertises how many blocks are selected, which is what suppresses the text highlight."
  );

  press(editor, "ArrowDown", { shiftKey: true });
  assert.deepEqual(
    blocks().map((block) => block.getAttribute("data-mme-block-selected")),
    [null, "true", "true"],
    "extending the selection marks every block in the range."
  );
  assert.equal(editor.view.dom.getAttribute("data-mme-block-selection"), "2");

  press(editor, "Escape");
  assert.deepEqual(
    blocks().map((block) => block.getAttribute("data-mme-block-selected")),
    [null, null, null],
    "clearing the selection unmarks every block."
  );
  assert.equal(
    editor.view.dom.getAttribute("data-mme-block-selection"),
    null,
    "clearing the selection removes the editor-level marker."
  );
  editor.destroy();
}

/*
 * The one internal ProseMirror API this feature leans on, asserted so an upgrade
 * fails loudly.
 *
 * Marking block DOM that ProseMirror owns makes its mutation observer re-read
 * the block, which redraws it, which re-marks it — a real lock-up in Chrome, not
 * a theoretical one. Pausing `view.domObserver` is the fix, and `domObserver` is
 * an internal field that appears nowhere in prosemirror-view's public types. The
 * calls are optional so a rename cannot throw, which means a rename would
 * silently bring the lock-up back. This is the tripwire.
 */
{
  const editor = mount("A.\n\nB.\n");
  const observer = editor.view.domObserver;
  assert(
    observer && typeof observer.stop === "function" && typeof observer.start === "function",
    "prosemirror-view no longer exposes view.domObserver.stop()/start(); the block-selection marking will silently re-enter the mark/re-read/redraw loop that locks up the browser. Re-check the painting strategy before upgrading."
  );
  editor.destroy();
}

// The packaged stylesheet, not the demo, carries the selection appearance.
{
  const packageStyles = readFileSync("packages/md-theme/src/styles.css", "utf8");
  const rules = [...packageStyles.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    body: match[2],
    selector: match[1].trim()
  }));

  const selectionRule = rules.find((rule) => rule.selector.includes('[data-mme-block-selected="true"]') && /background/.test(rule.body));
  assert(selectionRule, "the packaged stylesheet must give selected blocks a background.");
  // The `background` declaration itself, not merely "the token appears somewhere
  // in the rule" — the box-shadow already mentions it, so the loose check would
  // pass with a literal colour swapped into the background.
  const backgroundValue = /(?:^|;)\s*background\s*:\s*([^;]+)/.exec(selectionRule.body)?.[1]?.trim() ?? "";
  assert.equal(
    backgroundValue,
    "var(--mme-color-selection)",
    "the block-selection background must be exactly the selection token, not a literal colour (Gate 13)."
  );
  assert(
    !/#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/i.test(selectionRule.body),
    "the block-selection rule must contain no literal colour value at all (Gate 13)."
  );

  /*
   * The tint is not the indicator. `--mme-color-selection` is a low-alpha accent
   * mix — measured around 1.4:1 against the page in dark and weaker in light,
   * under WCAG 1.4.11's 3:1 for a state indicator — and a framed block paints its
   * own background straight over it, so a selected table showed no fill at all.
   * The ring carries the state, and it uses the one token this repository gates
   * at >= 3:1 in both schemes.
   */
  const ringValue = /(?:^|;)\s*box-shadow\s*:\s*([^;]+)/.exec(selectionRule.body)?.[1]?.trim() ?? "";
  assert(
    ringValue.includes("var(--mme-color-focus-ring)"),
    `selected blocks need a ring in a contrast-gated token, not only the low-alpha tint; got ${JSON.stringify(ringValue)}.`
  );
  assert(
    !ringValue.includes("var(--mme-color-selection)"),
    "the ring must not reuse the selection tint, or it adds no separation from the page."
  );
  const contrastGate = readFileSync("tests/theme-contrast.test.mjs", "utf8");
  assert(
    contrastGate.includes("--mme-color-focus-ring"),
    "the ring token must be one the theme contrast gate actually checks, or its 3:1 claim is unverified."
  );

  /*
   * A node selection this feature does not own — clicking an image or a divider
   * — must still be visible. Removing prosemirror-view's default outline without
   * replacing it left those selected invisibly, and the next Backspace deleted
   * something the user could not see was selected.
   */
  const nodeSelectionRule = rules.find((rule) => rule.selector.includes(".ProseMirror-selectednode"));
  assert(nodeSelectionRule, "the packaged stylesheet must style ProseMirror's own node selection.");
  assert(
    /box-shadow|outline\s*:\s*(?!none)/.test(nodeSelectionRule.body),
    "removing the default outline without replacing it leaves a plain node selection with no visible indicator."
  );
  assert(
    nodeSelectionRule.body.includes("var(--mme-color-focus-ring)"),
    "and the replacement indicator must be token-driven."
  );

  const highlightRule = rules.find(
    (rule) => rule.selector.includes("[data-mme-block-selection]") && rule.selector.includes("::selection")
  );
  assert(highlightRule, "block selection must suppress the browser's per-character text highlight.");
  assert(
    /background\s*:\s*transparent/.test(highlightRule.body),
    "the ::selection suppression must actually make the highlight transparent."
  );
}

// ---------------------------------------------------------------------------
// 7. Accessibility — a polite live region, and none of attempt 1's regressions
// ---------------------------------------------------------------------------

{
  const editor = mount("A.\n\nB.\n\nC.\n");
  const liveRegion = editor.host.querySelector('[data-testid="rich-block-selection-live-region"]');
  assert(liveRegion, "the block-selection plugin must own a live region so the state is announced.");
  assert.equal(liveRegion.getAttribute("aria-live"), "polite", "the announcement must be polite, never assertive.");
  assert.equal(liveRegion.getAttribute("role"), "status");
  assert.equal(
    editor.view.dom.contains(liveRegion),
    false,
    "the live region must live outside the contenteditable, or it becomes document content."
  );
  assert.equal(liveRegion.textContent, "", "nothing is announced before the first selection.");

  /*
   * Identity, not arithmetic. "Block selected" tells a screen-reader user
   * nothing about where the block cursor is, and — the reason this matters most
   * — arrow-moving between two single blocks does not change the count, so an
   * announcement built from the count alone never changes and the live region is
   * never touched. Every assertion below is on the region's own text, so a
   * silent move fails here.
   */
  selectBlock(editor, 1);
  assert.equal(
    liveRegion.textContent,
    "Paragraph, block 2 of 3: B.",
    "selecting a block announces its type, its position, the total, and an excerpt."
  );
  assert.equal(
    richBlockSelectionAnnouncement(editor.view.state),
    liveRegion.textContent,
    "the announcement string is also available to hosts for localization."
  );

  press(editor, "ArrowDown");
  assert.equal(
    liveRegion.textContent,
    "Paragraph, block 3 of 3: C.",
    "moving the block selection announces the new block, even though the count did not change."
  );

  press(editor, "ArrowUp", { shiftKey: true });
  assert.equal(
    liveRegion.textContent,
    "2 blocks selected, 2 to 3 of 3",
    "extending announces the count and which blocks it covers."
  );

  press(editor, "Escape");
  assert.equal(liveRegion.textContent, "Block selection cleared", "clearing is announced too.");

  // An operation announces what it did, not merely that the selection went away.
  selectBlock(editor, 0);
  press(editor, "ArrowDown", { shiftKey: true });
  press(editor, "Backspace");
  assert.equal(
    liveRegion.textContent,
    "2 blocks deleted",
    "deleting announces the deletion; announcing only 'cleared' would make a destructive edit indistinguishable from pressing Escape."
  );

  const duplicating = mount("A.\n\nB.\n\nC.\n");
  const duplicateRegion = duplicating.host.querySelector('[data-testid="rich-block-selection-live-region"]');
  selectBlock(duplicating, 1);
  press(duplicating, "d", { metaKey: true });
  assert.equal(
    duplicateRegion.textContent,
    "Block duplicated",
    "duplicating announces the duplication, in the singular when it is one block."
  );
  duplicating.destroy();

  const replacing = mount("A.\n\nB.\n\nC.\n");
  const replaceRegion = replacing.host.querySelector('[data-testid="rich-block-selection-live-region"]');
  selectBlock(replacing, 1);
  press(replacing, "Enter");
  assert.equal(
    replaceRegion.textContent,
    "Block replaced",
    "replacing announces the replacement, in the singular when it is one block."
  );
  replacing.destroy();

  // Block type names come from the schema, not from a guess about the tag.
  const framed = mount(lfFixture);
  const framedRegion = framed.host.querySelector('[data-testid="rich-block-selection-live-region"]');
  selectBlock(framed, blockIndexOfSource(lfFixture, "| Area | Risk |\n| --- | --- |\n| Table | cell selection |"));
  assert(
    framedRegion.textContent.startsWith("Table, block "),
    `a selected table must announce as a table; got ${JSON.stringify(framedRegion.textContent)}.`
  );
  framed.destroy();

  editor.destroy();
}

/*
 * Attempt 1's accessibility work was a net regression; these are its two bugs.
 *
 * The document MUST contain a heading. The first version of this guard ran
 * against three paragraphs, so `querySelector("h1")` was null and the assertion
 * was unconditionally true — it would have passed against the exact regression it
 * names. That is the same vacuity attempt 1 shipped, reproduced in the gate
 * written to prevent it.
 */
{
  const editor = mount("# Release notes\n\nBody paragraph.\n\nAnother paragraph.\n");
  const heading = editor.view.dom.querySelector("h1");
  assert(heading, "the fixture must actually render a heading, or this guard proves nothing.");
  assert.equal(heading.textContent, "Release notes", "and the heading must carry its own text.");

  selectBlock(editor, 0);
  const blocks = [...editor.view.dom.children].filter((child) => !child.classList.contains("ProseMirror-widget"));
  assert.equal(blocks[0], heading, "the selected block is the heading.");
  for (const block of blocks) {
    assert.equal(
      block.hasAttribute("aria-selected"),
      false,
      "aria-selected is invalid on paragraph/heading/list roles and is announced by no AT."
    );
  }
  assert.equal(
    heading.hasAttribute("aria-label"),
    false,
    "aria-label on a heading REPLACES its accessible name, so the heading would announce as 'Block selected' instead of 'Release notes'."
  );
  assert.equal(
    heading.getAttribute("aria-labelledby"),
    null,
    "and nothing else may override the heading's accessible name either."
  );
  assert.equal(
    heading.textContent,
    "Release notes",
    "selecting a heading must leave its accessible name untouched."
  );
  editor.destroy();
}

/*
 * Hosts relabel through the PLUGIN, and the relabelled string must reach the
 * live region. Asserting `richBlockSelectionAnnouncement(state, labels)` instead
 * would prove only that the function substitutes an argument — a plugin that
 * discarded `options.labels` entirely would still pass.
 */
{
  const host = dom.window.document.createElement("div");
  dom.window.document.body.append(host);
  const base = createRichMarkdownState("# Titre\n\nParagraphe.\n", { dialect: "momentarise-enhanced" });
  const relabelled = base.editorState.reconfigure({
    plugins: [
      ...base.editorState.plugins.filter((plugin) => plugin.spec.key !== richBlockSelectionPluginKey),
      createRichBlockSelectionPlugin({
        labels: {
          blockTypes: { heading: "Titre" },
          single: "{type} {position}/{total}{excerpt}"
        }
      })
    ]
  });
  const view = new EditorView(host, { state: relabelled });
  view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, 0)));
  const region = host.querySelector('[data-testid="rich-block-selection-live-region"]');
  assert(region, "the relabelled plugin still owns a live region.");
  view.someProp("handleKeyDown", (handler) =>
    handler(view, new dom.window.KeyboardEvent("keydown", { cancelable: true, key: "Escape" }))
  );
  assert.equal(
    region.textContent,
    "Titre 1/2: Titre",
    "the host's labels must reach the live region, not just the exported announcement function."
  );
  view.destroy();
  host.remove();
}

// A host that owns the keymap gets the presentation without the key handling.
{
  const delegated = createMomentariseRichPlugins({ keymapDelegateToHost: true });
  assert(
    delegated.some((plugin) => plugin.spec.key === richBlockSelectionPluginKey),
    "delegating the keymap must not remove the block-selection presentation."
  );
  const state = createRichMarkdownState("A.\n\nB.\n", {
    preferences: { keymapDelegateToHost: true }
  });
  const handled = state.editorState.plugins
    .map((plugin) => plugin.props?.handleKeyDown)
    .filter(Boolean)
    .some((handler) =>
      handler({ dispatch() {}, state: state.editorState }, { key: "Escape", metaKey: false, shiftKey: false })
    );
  assert.equal(handled, false, "a host-delegated keymap must not have Escape hijacked by the package.");
}

// ---------------------------------------------------------------------------
// 8. One Escape, one meaning — the MME-0086/0088 overlay collision
// ---------------------------------------------------------------------------

{
  const controller = surface.createSurfaceOverlayDismissController();
  let open = true;
  controller.register({
    close() {
      open = false;
    },
    contains() {
      return false;
    },
    id: "slash",
    isOpen() {
      return open;
    }
  });

  const scope = dom.window.document.createElement("div");
  dom.window.document.body.append(scope);
  const detach = surface.attachSurfaceOverlayDismissListeners({ controller, scope });

  const dismissing = new dom.window.KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Escape" });
  scope.dispatchEvent(dismissing);
  assert.equal(open, false, "Escape dismisses the open overlay.");
  assert.equal(
    dismissing.defaultPrevented,
    true,
    "an Escape that actually dismissed an overlay must be marked handled, or one press both closes the slash menu and enters block selection."
  );

  const passthrough = new dom.window.KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Escape" });
  scope.dispatchEvent(passthrough);
  assert.equal(
    passthrough.defaultPrevented,
    false,
    "an Escape that dismissed nothing must reach the editor untouched, or block selection can never be entered."
  );
  detach();
  scope.remove();
}

// And the editor honours that mark. Asserted against the package's own handler,
// because prosemirror-view separately drops a bubbling event whose default was
// prevented — so the end-to-end dispatch below would pass even with no guard in
// the package at all, and would be a vacuous test of it. Hosts that route keys
// themselves (the demo has a view-level `handleKeyDown`) reach this handler with
// the event intact, which is what the guard is for.
{
  const editor = mount("A.\n\nB.\n\nC.\n");
  caretInBlock(editor, 1);
  const blockSelectionPlugin = editor.view.state.plugins.find(
    (plugin) => plugin.spec.key === richBlockSelectionPluginKey
  );
  assert(blockSelectionPlugin, "the block-selection plugin must be registered.");

  const consumed = new dom.window.KeyboardEvent("keydown", { cancelable: true, key: "Escape" });
  consumed.preventDefault();
  assert.equal(
    blockSelectionPlugin.props.handleKeyDown(editor.view, consumed),
    false,
    "an Escape already consumed by an overlay must be declined, or one press both closes the slash menu and enters block selection."
  );
  assert.equal(richBlockSelection(editor.view.state), null, "and it must not have entered block selection.");

  const fresh = new dom.window.KeyboardEvent("keydown", { cancelable: true, key: "Escape" });
  assert.equal(
    blockSelectionPlugin.props.handleKeyDown(editor.view, fresh),
    true,
    "an unconsumed Escape is still handled, so the guard cannot disable the feature."
  );
  assert(richBlockSelection(editor.view.state), "and it enters block selection.");
  editor.destroy();
}

/*
 * There is deliberately no end-to-end "dispatch a defaultPrevented Escape at the
 * editor DOM" assertion here. prosemirror-view's own `eventBelongsToView` drops
 * any bubbling event whose default was prevented before a plugin ever sees it,
 * so such an assertion passes with no guard in this package at all — it cannot
 * be made to fail, which under AGENT.md's mutation rule makes it not a test.
 * The integrated path is proven where it is real instead: a live browser, a real
 * slash menu, a real Escape, in `scripts/visual-check-mme0103.mjs`.
 */

// ---------------------------------------------------------------------------
// 9. The block layer stays out of ordinary editing
// ---------------------------------------------------------------------------

{
  const editor = mount("- one\n- two\n\nParagraph.\n");
  caretInBlock(editor, 0);
  const before = editor.markdown();
  const escapeEvent = press(editor, "ArrowDown");
  assert.equal(
    escapeEvent.defaultPrevented || richBlockSelection(editor.view.state) !== null,
    false,
    "arrow keys must do nothing special while no block is selected."
  );
  assert.equal(editor.markdown(), before, "moving the caret changes no bytes.");

  /*
   * The block-selection plugin is registered first, so every one of its handlers
   * must decline while no block is selected — otherwise it would shadow the list
   * merge (MME-0043), the code-fence exit, the input rules and `baseKeymap`.
   */
  const blockSelectionPlugin = editor.view.state.plugins.find(
    (plugin) => plugin.spec.key === richBlockSelectionPluginKey
  );
  assert(blockSelectionPlugin, "the block-selection plugin must be registered.");
  for (const key of ["Backspace", "Delete", "Enter", "ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"]) {
    assert.equal(
      blockSelectionPlugin.props.handleKeyDown(
        editor.view,
        new dom.window.KeyboardEvent("keydown", { cancelable: true, key })
      ),
      false,
      `${key} without a block selection must fall through to the editor's ordinary commands.`
    );
  }
  assert.equal(
    blockSelectionPlugin.props.handleTextInput(editor.view, 1, 1, "x"),
    false,
    "typing without a block selection must fall through to the input rules."
  );
  assert.equal(
    blockSelectionPlugin.props.handlePaste(editor.view, { clipboardData: clipboardStub({ "text/plain": "x" }) }),
    false,
    "pasting without a block selection must fall through to the paste sanitizer."
  );
  editor.destroy();
}

console.log("rich-block-selection: all MME-0103 assertions passed.");
