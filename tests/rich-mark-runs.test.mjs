/*
 * MME-0121 — a mark spanning multiple text nodes serializes one delimiter pair
 * around the run.
 *
 * Measured at `0f9f3f8` before this suite existed, through the real command
 * path (load, select the paragraph, run `bold`):
 *
 *   a `x` b   ->  **a ****`x`**** b**   ->  reopens as strong[strong[strong[inlineCode]]]
 *   a **b** c ->  *a ****b**** c*       ->  reopens as emphasis[strong[strong]]
 *
 * `wrapMomentariseTextMarks` wrapped every ProseMirror text node independently,
 * so every boundary between differently-marked nodes fractured the run into
 * its own delimiter pair. Corruption reachable with no input rule involved.
 *
 * Every case asserts three things: the serialized bytes, the re-parsed node
 * shapes (`parse(serialize(doc))` — the acceptance criterion), and where the
 * defect fired, that untouched neighbours stayed byte-identical.
 */

import {
  applyRichMarkdownCommand,
  createRichMarkdownState,
  selectFirstRichText,
  serializeRichMarkdownState
} from "../packages/md-rich-prosemirror/dist/index.js";
import { createMarkdownAstParser } from "../packages/md-format/dist/index.js";
import { TextSelection } from "prosemirror-state";

const parser = createMarkdownAstParser();
const failures = [];

/* ------------------------------------------------------------------ *
 * Section 1 — the measured table, through the real command path.
 * ------------------------------------------------------------------ */

const commandTable = [
  {
    bytes: "**a `x` b**\n",
    commands: ["bold"],
    label: "bold across a code span",
    shape: 'paragraph[strong[text("a "), inlineCode("x"), text(" b")]]',
    source: "a `x` b\n"
  },
  {
    bytes: "*a **b** c*\n",
    commands: ["italic"],
    label: "italic across existing bold",
    shape: 'paragraph[emphasis[text("a "), strong[text("b")], text(" c")]]',
    source: "a **b** c\n"
  },
  {
    bytes: "**a [t](https://e.com) b**\n",
    commands: ["bold"],
    label: "bold across a link",
    shape: 'paragraph[strong[text("a "), link[text("t")], text(" b")]]',
    source: "a [t](https://e.com) b\n"
  },
  {
    bytes: "***a `x` b***\n",
    commands: ["bold", "italic"],
    label: "bold then italic stacked",
    shape: 'paragraph[emphasis[strong[text("a "), inlineCode("x"), text(" b")]]]',
    source: "a `x` b\n"
  },
  {
    bytes: "**a ![alt](i.png) b**\n",
    commands: ["bold"],
    label: "bold across an image",
    shape: 'paragraph[strong[text("a "), image, text(" b")]]',
    source: "a ![alt](i.png) b\n"
  },
  {
    // The run STARTS at a node carrying two marks; the grouper must still pick
    // the mark that spans furthest, not merely the node's first mark.
    bytes: "**`x` b**\n",
    commands: ["bold"],
    label: "bold starting on a code span",
    shape: 'paragraph[strong[inlineCode("x"), text(" b")]]',
    source: "`x` b\n"
  },
  {
    bytes: "**[t](https://e.com) b**\n",
    commands: ["bold"],
    label: "bold starting on a link",
    shape: 'paragraph[strong[link[text("t")], text(" b")]]',
    source: "[t](https://e.com) b\n"
  }
];

for (const row of commandTable) {
  check(`${row.label} serializes one delimiter pair per run`, () => {
    let state = selectWholeFirstParagraph(createRichMarkdownState(row.source));
    for (const id of row.commands) {
      state = applyRichMarkdownCommand(state, id);
      state = selectWholeFirstParagraph(state);
    }
    const content = serializeRichMarkdownState(state).content;
    assertEqual(content, row.bytes, `${row.label} bytes`);
    assertEqual(shapeOf(content), row.shape, `${row.label} reopened shape`);
  });
}

check("a shorter first-ranked mark does not truncate a longer run", () => {
  /*
   * ProseMirror sorts a node's marks by schema rank, and `em` outranks
   * `strong` here (measured: node0 marks are `em,strong`). Italicize `a`, then
   * bold the whole of `a b`: the first-listed mark on node0 spans one node
   * while `strong` spans two. Picking the first mark instead of the
   * longest-running one serializes `***a*** ** b**` — this pins the scan.
   */
  let state = createRichMarkdownState("a b\n");
  state = applyRichMarkdownCommand(selectRange(state, 1, 2), "italic");
  state = applyRichMarkdownCommand(selectRange(state, 1, 4), "bold");
  const content = serializeRichMarkdownState(state).content;
  assertEqual(content, "***a* b**\n", "italic-word bold-sentence bytes");
  assertEqual(
    shapeOf(content),
    'paragraph[strong[emphasis[text("a")], text(" b")]]',
    "italic-word bold-sentence reopened shape"
  );
});

check("a run starting on an image keeps the image inside the pair", () => {
  // Run EXTENSION reads marks off every node, but a run can also START on a
  // non-text node; excluding those from grouping leaves the image outside:
  // `![alt](i.png)** b**`.
  const state = boldWholeFirstParagraph("![alt](i.png) b\n");
  const content = serializeRichMarkdownState(state).content;
  assertEqual(content, "**![alt](i.png) b**\n", "bold starting on an image bytes");
  assertEqual(
    shapeOf(content),
    'paragraph[strong[image, text(" b")]]',
    "bold starting on an image reopened shape"
  );
});

check("adjacent links with different destinations stay separate runs", () => {
  // Runs group on mark EQUALITY (type and attrs), not on mark type: merging
  // these two links would rewrite `b`'s destination to `a`'s.
  const state = boldWholeFirstParagraph("[a](https://one.example)[b](https://two.example)\n");
  const content = serializeRichMarkdownState(state).content;
  assertEqual(
    content,
    "**[a](https://one.example)[b](https://two.example)**\n",
    "adjacent distinct links bytes"
  );
  assertEqual(
    shapeOf(content),
    'paragraph[strong[link[text("a")], link[text("b")]]]',
    "adjacent distinct links reopened shape"
  );
});

check("toggling bold off returns the original bytes", () => {
  let state = boldWholeFirstParagraph("a `x` b\n");
  state = selectWholeFirstParagraph(state);
  state = applyRichMarkdownCommand(state, "bold");
  assertEqual(serializeRichMarkdownState(state).content, "a `x` b\n", "toggle-off bytes");
});

/* ------------------------------------------------------------------ *
 * Section 2 — the defect inside a real document: neighbours survive.
 * ------------------------------------------------------------------ */

check("bolding one paragraph leaves its neighbours byte-identical", () => {
  const source = "Intro paragraph.\n\na `x` b\n\nOutro paragraph.\n";
  // The document text is `a x b` — backticks are syntax, not content.
  const selected = selectFirstRichText(createRichMarkdownState(source), "x");
  const state = applyRichMarkdownCommand(expandSelectionToParagraph(selected), "bold");
  assertEqual(
    serializeRichMarkdownState(state).content,
    "Intro paragraph.\n\n**a `x` b**\n\nOutro paragraph.\n",
    "neighbour bytes around a bolded run"
  );
});

check("a selection spanning two paragraphs bolds each as one run", () => {
  const source = "one `x` two\n\nthree `y` four\n";
  const base = createRichMarkdownState(source);
  let editorState = base.editorState;
  editorState = editorState.apply(
    editorState.tr.setSelection(
      TextSelection.create(editorState.doc, 1, editorState.doc.content.size - 1)
    )
  );
  const state = applyRichMarkdownCommand({ ...base, editorState }, "bold");
  const content = serializeRichMarkdownState(state).content;
  assertEqual(content, "**one `x` two**\n\n**three `y` four**\n", "cross-paragraph bytes");
  assertEqual(
    shapeOf(content),
    'paragraph[strong[text("one "), inlineCode("x"), text(" two")]] | paragraph[strong[text("three "), inlineCode("y"), text(" four")]]',
    "cross-paragraph reopened shape"
  );
});

/* ------------------------------------------------------------------ *
 * Section 3 — the second serializer: table cells and footnote
 * definitions do not go through the momentarise-model path
 * (`serializeReconstructedProseMirrorBlock` short-circuits both), so the
 * run grouper must live in `serializeInline` too. Found by the MME-0121
 * Test Reviewer; before the fix a bolded cell wrote
 * `| **a **`**x**`** b** |` — per-node pairs plus literal `**` injected
 * INTO the code span's content, because the old `wrapTextWithMarks`
 * nested first-mark-innermost.
 * ------------------------------------------------------------------ */

check("bold across a code span inside a table cell", () => {
  const source = "| A | B |\n| --- | --- |\n| a `x` b | two |\n";
  let state = selectFirstRichText(createRichMarkdownState(source), "x");
  state = applyRichMarkdownCommand(expandSelectionToParagraph(state), "bold");
  assertEqual(
    serializeRichMarkdownState(state).content,
    "| A | B |\n| --- | --- |\n| **a `x` b** | two |\n",
    "bolded cell bytes, neighbours byte-identical"
  );
});

check("bold across a code span inside a footnote definition", () => {
  const source = "Use[^n].\n\n[^n]: fa `x` fb\n";
  let state = selectFirstRichText(createRichMarkdownState(source), "x");
  state = applyRichMarkdownCommand(expandSelectionToParagraph(state), "bold");
  assertEqual(
    serializeRichMarkdownState(state).content,
    "Use[^n].\n\n[^n]: **fa `x` fb**\n",
    "bolded footnote body bytes"
  );
});

/* ------------------------------------------------------------------ *
 * Section 4 — a code run must never swallow structure. Found by the
 * MME-0121 reviewer as a regression of the first grouping draft: when
 * `code` won the longest-run contest its children were flattened to
 * text, silently deleting strong marks, images, and footnote
 * references on save while the screen still showed them.
 * ------------------------------------------------------------------ */

check("inline code across existing bold keeps the bold", () => {
  let state = createRichMarkdownState("a **b** c\n");
  state = applyRichMarkdownCommand(selectWholeFirstParagraph(state), "inlineCode");
  const content = serializeRichMarkdownState(state).content;
  assertEqual(content, "`a `**`b`**` c`\n", "code-over-bold bytes");
  assertEqual(
    shapeOf(content),
    'paragraph[inlineCode("a "), strong[inlineCode("b")], inlineCode(" c")]',
    "code-over-bold reopened shape"
  );
});

check("inline code across an image keeps the image", () => {
  let state = createRichMarkdownState("a ![alt](i.png) b\n");
  state = applyRichMarkdownCommand(selectWholeFirstParagraph(state), "inlineCode");
  const content = serializeRichMarkdownState(state).content;
  assertEqual(content, "`a `![alt](i.png)` b`\n", "code-over-image bytes");
  assertEqual(
    shapeOf(content),
    'paragraph[inlineCode("a "), image, inlineCode(" b")]',
    "code-over-image reopened shape"
  );
});

check("inline code across a footnote reference keeps the reference", () => {
  let state = selectFirstRichText(createRichMarkdownState("Use a[^n] b.\n\n[^n]: note\n"), "a");
  state = applyRichMarkdownCommand(expandSelectionToParagraph(state), "inlineCode");
  assertEqual(
    serializeRichMarkdownState(state).content,
    "`Use a`[^n]` b.`\n\n[^n]: note\n",
    "code-over-reference bytes, definition intact"
  );
});

check("bolding half of a code span keeps the other half's code", () => {
  let state = createRichMarkdownState("`ab`\n");
  state = applyRichMarkdownCommand(selectRange(state, 1, 2), "bold");
  const content = serializeRichMarkdownState(state).content;
  assertEqual(content, "**`a`**`b`\n", "half-bolded code bytes");
  assertEqual(
    shapeOf(content),
    'paragraph[strong[inlineCode("a")], inlineCode("b")]',
    "half-bolded code reopened shape"
  );
});

/* ------------------------------------------------------------------ *
 * Section 5 — the input-rule path reaches the same serializer.
 * ------------------------------------------------------------------ */

check("a typed strong across a code span serializes one pair", () => {
  // The MME-0104a case that could not assert bytes while this defect lived:
  // typing `**a `x` b**` converts the code span first, then the strong rule
  // marks the remaining range, leaving strong across three nodes.
  const typed = typeIntoRichState(createRichMarkdownState(""), "**a `x` b**");
  assertEqual(serializeRichMarkdownState(typed).content, "**a `x` b**\n", "typed strong-over-code bytes");
});

if (failures.length > 0) {
  throw new Error([`MME-0121: ${failures.length} case(s) failed.`, ...failures].join("\n\n"));
}

console.log("MME-0121 mark runs: all cases passed.");

/* ------------------------------------------------------------------ *
 * Harness.
 * ------------------------------------------------------------------ */

function check(label, run) {
  try {
    run();
  } catch (error) {
    // A crash is a broken harness, not a failing assertion; stop the run.
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

function shapeOf(content) {
  return shapeList(
    parser.parse(content, { dialect: "gfm-plus", path: "memory://mme-0121.md" }).document.root.children
  ).join(" | ");
}

function shapeList(nodes) {
  return (nodes ?? []).map((node) => {
    if (node.kind === "opaque") {
      return `opaque(${JSON.stringify(node.raw)})`;
    }
    const value = node.attributes?.value;
    const label = `${node.type}${typeof value === "string" ? `(${JSON.stringify(value)})` : ""}`;
    const children = shapeList(node.children);
    return children.length > 0 ? `${label}[${children.join(", ")}]` : label;
  });
}

function selectRange(state, from, to) {
  return {
    ...state,
    editorState: state.editorState.apply(
      state.editorState.tr.setSelection(TextSelection.create(state.editorState.doc, from, to))
    )
  };
}

function selectWholeFirstParagraph(state) {
  let editorState = state.editorState;
  const paragraph = editorState.doc.child(0);
  editorState = editorState.apply(
    editorState.tr.setSelection(TextSelection.create(editorState.doc, 1, 1 + paragraph.content.size))
  );
  return { ...state, editorState };
}

function expandSelectionToParagraph(state) {
  const { $from } = state.editorState.selection;
  const start = $from.start($from.depth);
  const end = start + $from.parent.content.size;
  return {
    ...state,
    editorState: state.editorState.apply(
      state.editorState.tr.setSelection(TextSelection.create(state.editorState.doc, start, end))
    )
  };
}

function boldWholeFirstParagraph(source) {
  return applyRichMarkdownCommand(selectWholeFirstParagraph(createRichMarkdownState(source)), "bold");
}

function typeIntoRichState(state, text) {
  let editorState = state.editorState;
  for (const character of text) {
    editorState = editorState.applyTransaction(editorState.tr.insertText(character)).state;
  }
  return { ...state, editorState };
}
