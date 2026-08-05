/*
 * MME-0122 — a document ending in a fenced code block keeps its final newline
 * through serialization, byte-identically, for LF and CRLF.
 *
 * History, established by bisect (2026-08-05): the defect BACKLOG measured on
 * 2026-08-04 — a typed trailing fence reaching the session without its final
 * newline — reproduces at `d5a2db0` and is gone at `62480e8`. Mechanism: while
 * typing ` ``` ` character by character, the intermediate paragraph serialized
 * UNESCAPED, the demo re-anchored on those bytes, and they re-parse as an
 * unclosed fence — whose mdast range swallows the document's final line ending
 * into the node, so the replaced-block tail slice was empty and the trimmed
 * reconstruction dropped the newline, permanently. MME-0120's escaping closed
 * that entry (`\``` ` stays a paragraph).
 *
 * What remained live at HEAD, measured before this suite existed: a document
 * whose source ALREADY ends in an unclosed fence still loses its final line
 * ending when the fence is edited or deleted, because the swallowed ending sits
 * inside the block's range and nothing re-emits it. Section 2 pins the fix;
 * section 1 pins everything that already worked so it cannot regress.
 */

import {
  createRichMarkdownState,
  serializeRichMarkdownState
} from "../packages/md-rich-prosemirror/dist/index.js";
import { TextSelection } from "prosemirror-state";

const failures = [];

/* ------------------------------------------------------------------ *
 * Section 1 — pins: what already held at `6c108a1` must keep holding.
 * ------------------------------------------------------------------ */

const closedFenceTable = [
  {
    edited: "```ts\nconst value = 1;!\n```\n",
    label: "closed fence with LF final newline",
    source: "```ts\nconst value = 1;\n```\n"
  },
  {
    edited: "```ts\r\nconst value = 1;!\r\n```\r\n",
    label: "closed fence with CRLF final newline",
    source: "```ts\r\nconst value = 1;\r\n```\r\n"
  },
  {
    // A file that ends WITHOUT a newline must not gain one: the guarantee is
    // preservation, not normalization.
    edited: "```ts\nconst value = 1;!\n```",
    label: "closed fence without a final newline",
    source: "```ts\nconst value = 1;\n```"
  },
  {
    edited: "Intro.\n\n```ts\nconst value = 1;!\n```\n",
    label: "closed fence after an untouched neighbour",
    source: "Intro.\n\n```ts\nconst value = 1;\n```\n"
  }
];

for (const row of closedFenceTable) {
  check(`${row.label} survives an edit`, () => {
    const state = createRichMarkdownState(row.source);
    assertEqual(
      serializeRichMarkdownState(state).content,
      row.source,
      `${row.label} untouched bytes`
    );
    assertEqual(
      serializeRichMarkdownState(editInsideFence(state)).content,
      row.edited,
      `${row.label} edited bytes`
    );
  });
}

check("every block type keeps the final newline through an edit at the end", () => {
  /*
   * The issue's "no other block type regresses". Each document ends in a
   * different block type; the edit appends a character inside the final
   * textblock; the serialized document must still end with exactly the
   * newline the source had.
   */
  const endings = [
    ["paragraph", "Intro.\n\nfinal paragraph\n"],
    ["heading", "Intro.\n\n## final heading\n"],
    ["bullet list", "Intro.\n\n- one\n- two\n"],
    ["ordered list", "Intro.\n\n1. one\n2. two\n"],
    ["blockquote", "Intro.\n\n> quoted\n"],
    ["todo list", "Intro.\n\n- [ ] task\n"]
  ];
  for (const [label, source] of endings) {
    const edited = serializeRichMarkdownState(editInsideFinalTextblock(createRichMarkdownState(source))).content;
    // Exact bytes, not endsWith: the appended character lands before the final
    // newline and nothing else may change — this also catches a doubled
    // newline or a normalized untouched line (reviewer strengthening).
    assertEqual(edited, `${source.slice(0, -1)}!\n`, `${label} edited bytes`);
  }
});

check("the demo's re-anchoring type loop ends with the final newline", () => {
  /*
   * The original 2026-08-04 measurement path, headless: type a fence character
   * by character, re-anchoring the state on the serialized bytes after every
   * keystroke exactly as `syncRichMarkdownToSource` does. At `d5a2db0` this
   * loop converges to bytes WITHOUT the final newline; MME-0120's escaping
   * keeps the intermediate paragraph literal, and the loop must stay fixed.
   */
  let state = createRichMarkdownState("");
  for (const step of ["`", "`", "`", "t", "s", "\n", "c", "o", "d", "e"]) {
    state = step === "\n" ? pressEnter(state) : typeCharacter(state, step);
    const markdown = serializeRichMarkdownState(state).content;
    state = { ...createRichMarkdownState(markdown, { schema: state.schema }), editorState: state.editorState };
  }
  assertEqual(
    serializeRichMarkdownState(state).content,
    "```ts\ncode\n```\n",
    "typed-fence loop final bytes"
  );
});

check("editing the neighbour of an unclosed fence keeps the fence bytes exactly", () => {
  /*
   * The matched-pair path: the fence is untouched, so its bytes — including
   * the swallowed final newline INSIDE its range — are sliced verbatim. The
   * restore step must recognise the ending is already there and not double it.
   */
  const state = createRichMarkdownState("Intro.\n\n```ts\nabc\n");
  let editorState = state.editorState;
  editorState = editorState.apply(
    editorState.tr.setSelection(TextSelection.create(editorState.doc, 1 + "Intro.".length))
  );
  editorState = editorState.applyTransaction(editorState.tr.insertText("!")).state;
  assertEqual(
    serializeRichMarkdownState({ ...state, editorState }).content,
    "Intro.!\n\n```ts\nabc\n",
    "neighbour-edited bytes beside an unclosed fence"
  );
});

check("an untouched unclosed fence stays byte-identical", () => {
  for (const source of ["```ts\nabc\n", "```ts\r\nabc\r\n", "```ts\nabc"]) {
    assertEqual(
      serializeRichMarkdownState(createRichMarkdownState(source)).content,
      source,
      `untouched ${JSON.stringify(source)}`
    );
  }
});

/* ------------------------------------------------------------------ *
 * Section 2 — the fix: an unclosed fence at EOF swallows the final
 * line ending into its own range; editing or deleting it must not
 * lose that ending.
 * ------------------------------------------------------------------ */

check("editing an unclosed fence keeps the LF final newline", () => {
  assertEqual(
    serializeRichMarkdownState(editInsideFence(createRichMarkdownState("```ts\nabc\n"))).content,
    "```ts\nabc!\n```\n",
    "unclosed LF edited bytes"
  );
});

check("editing an unclosed fence keeps the CRLF final newline", () => {
  assertEqual(
    serializeRichMarkdownState(editInsideFence(createRichMarkdownState("```ts\r\nabc\r\n"))).content,
    "```ts\r\nabc!\r\n```\r\n",
    "unclosed CRLF edited bytes"
  );
});

check("editing an unclosed fence without a final newline does not invent one", () => {
  assertEqual(
    serializeRichMarkdownState(editInsideFence(createRichMarkdownState("```ts\nabc"))).content,
    "```ts\nabc!\n```",
    "unclosed no-newline edited bytes"
  );
});

check("editing an unclosed fence after a neighbour keeps the newline and the neighbour", () => {
  assertEqual(
    serializeRichMarkdownState(editInsideFence(createRichMarkdownState("Intro.\n\n```ts\nabc\n"))).content,
    "Intro.\n\n```ts\nabc!\n```\n",
    "unclosed with neighbour edited bytes"
  );
});

check("deleting a final unclosed fence keeps the file's final newline", () => {
  const state = createRichMarkdownState("Intro.\n\n```ts\nabc\n");
  let editorState = state.editorState;
  let fencePosition = null;
  let fenceNode = null;
  editorState.doc.descendants((node, position) => {
    if (fencePosition !== null) {
      return false;
    }
    if (node.type.name === "code_block") {
      fencePosition = position;
      fenceNode = node;
      return false;
    }
    return true;
  });
  editorState = editorState.applyTransaction(
    editorState.tr.delete(fencePosition, fencePosition + fenceNode.nodeSize)
  ).state;
  assertEqual(
    serializeRichMarkdownState({ ...state, editorState }).content,
    "Intro.\n",
    "deleted final fence bytes"
  );
});

if (failures.length > 0) {
  throw new Error([`MME-0122: ${failures.length} case(s) failed.`, ...failures].join("\n\n"));
}

console.log("MME-0122 trailing newline: all cases passed.");

/* ------------------------------------------------------------------ *
 * Harness.
 * ------------------------------------------------------------------ */

function check(label, run) {
  try {
    run();
  } catch (error) {
    if (error instanceof TypeError || error instanceof ReferenceError) {
      throw new Error(`[${label}] harness fault, not an assertion failure: ${error.stack}`);
    }
    failures.push(`[${label}] ${error.message}`);
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
  }
}

function editInsideFence(state) {
  let editorState = state.editorState;
  let position = null;
  editorState.doc.descendants((node, nodePosition) => {
    if (position !== null) {
      return false;
    }
    if (node.type.name === "code_block") {
      position = nodePosition + 1 + node.content.size;
      return false;
    }
    return true;
  });
  if (position === null) {
    throw new Error("The document must contain a code block for this case.");
  }
  editorState = editorState.apply(
    editorState.tr.setSelection(TextSelection.create(editorState.doc, position))
  );
  editorState = editorState.applyTransaction(editorState.tr.insertText("!")).state;
  return { ...state, editorState };
}

function editInsideFinalTextblock(state) {
  let editorState = state.editorState;
  let end = null;
  editorState.doc.descendants((node, nodePosition) => {
    if (node.isTextblock) {
      end = nodePosition + 1 + node.content.size;
    }
    return true;
  });
  if (end === null) {
    throw new Error("The document must contain a textblock for this case.");
  }
  editorState = editorState.apply(
    editorState.tr.setSelection(TextSelection.create(editorState.doc, end))
  );
  editorState = editorState.applyTransaction(editorState.tr.insertText("!")).state;
  return { ...state, editorState };
}

function typeCharacter(state, character) {
  const result = state.editorState.applyTransaction(state.editorState.tr.insertText(character));
  return { ...state, editorState: result.state };
}

function pressEnter(state) {
  let editorState = state.editorState;
  const event = { key: "Enter", preventDefault() {} };
  for (const plugin of editorState.plugins) {
    const handler = plugin.props.handleKeyDown;
    if (!handler) {
      continue;
    }
    const handled = handler(
      {
        get state() {
          return editorState;
        },
        dispatch(transaction) {
          editorState = editorState.apply(transaction);
        }
      },
      event
    );
    if (handled) {
      break;
    }
  }
  return { ...state, editorState };
}
