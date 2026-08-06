/*
 * MME-0123 — mounting a document into the rich view must not drop model
 * content.
 *
 * Measured at `40d3405`, before this suite existed, against the built package:
 *
 *   alpha  \nbravo\n   parses to paragraph[text("alpha"), lineBreak, text("bravo")]
 *                      mounts   as paragraph[text("alphabravo")]
 *                      one edit serializes "**alphabravo**\n"      <- data loss
 *   alpha\\\nbravo\n   identical, for the backslash spelling
 *   **a ![alt](i.png) b**\n  mounts the image with NO marks, so one edit
 *                      serializes "**a **![alt](i.png)** b!**\n"   <- MME-0121's
 *                      one-delimiter-pair guarantee re-fractured by the mount
 *
 * The mechanism was spelling drift: `inlineNodeToProseMirror` tested
 * `node.type === "break"`, while the parser's mdast->Momentarise map emits
 * `"lineBreak"`. Three other whitelists in the same file accepted both
 * spellings, which is why the dead branch went unnoticed.
 *
 * These cases therefore assert THREE things, because any one alone can pass
 * while the document is being destroyed:
 *
 *   1. the mounted ProseMirror shape (the break survives as a hard_break, and
 *      images/hard breaks carry the marks the model gave them);
 *   2. the serialized bytes after an edit to that very paragraph, which is the
 *      only moment the loss becomes visible on disk;
 *   3. the bytes of untouched neighbours, LF and CRLF, which is the
 *      preservation contract the derived-view gate (4.5) is built on.
 *
 * Byte-identity for a document nobody edits is NOT sufficient evidence here:
 * targeted serialization replays untouched blocks from their source ranges, so
 * it returned the right bytes throughout the defect's life.
 */

import {
  applyRichMarkdownCommand,
  createMomentariseRichSchema,
  createRichMarkdownState,
  insertRichFootnote,
  markdownDocumentToProseMirror,
  selectFirstRichText,
  serializeRichMarkdownState
} from "../packages/md-rich-prosemirror/dist/index.js";
import { createMarkdownAstParser } from "../packages/md-format/dist/index.js";
import { MOMENTARISE_LINE_BREAK_TYPE, isMomentariseLineBreakNode } from "../packages/md-core/dist/index.js";
import { TextSelection } from "prosemirror-state";

const parser = createMarkdownAstParser();
const failures = [];

/* ------------------------------------------------------------------ *
 * Section 1 — the shared constant. The drift closes structurally or it
 * reopens: a consumer that hardcodes one spelling is the defect.
 * ------------------------------------------------------------------ */

check("md-core owns the canonical line-break type name", () => {
  assertEqual(MOMENTARISE_LINE_BREAK_TYPE, "lineBreak", "canonical model type name");
});

check("the parser emits exactly the canonical type name", () => {
  const inline = parser
    .parse("alpha  \nbravo\n", { dialect: "gfm-plus", path: "memory://mme-0123.md" })
    .document.root.children[0].children;
  const breaks = inline.filter((node) => isMomentariseLineBreakNode(node));
  assertEqual(breaks.length, 1, "one line break in the parsed paragraph");
  assertEqual(breaks[0].type, MOMENTARISE_LINE_BREAK_TYPE, "parser-emitted break type");
});

check("the shared predicate is what recognises a break, for either spelling", () => {
  // `break` is mdast's spelling. It reaches the model only through history and
  // through hosts building nodes by hand; tolerating it in ONE place is the
  // point — a second private whitelist is how this defect happened.
  assertEqual(isMomentariseLineBreakNode({ kind: "inline", type: "lineBreak" }), true, "canonical spelling");
  assertEqual(isMomentariseLineBreakNode({ kind: "inline", type: "break" }), true, "mdast spelling");
  assertEqual(isMomentariseLineBreakNode({ kind: "inline", type: "text" }), false, "a text node is not a break");
  assertEqual(
    isMomentariseLineBreakNode({ kind: "opaque", raw: "x", type: "opaque" }),
    false,
    "an opaque node is never a break"
  );
});

check("the mdast spelling still mounts, so a hand-built node is not silently dropped", () => {
  // The tolerance the predicate grants has to be reachable, or it is decoration.
  // This is the only case in the suite that reaches the alias branch through the
  // real mount rather than through the predicate directly.
  const parseResult = {
    diagnostics: [],
    document: {
      dialect: "gfm-plus",
      diagnostics: [],
      root: {
        children: [
          {
            children: [
              { attributes: { value: "alpha" }, id: "t1", kind: "inline", type: "text" },
              { id: "b", kind: "inline", type: "break" },
              { attributes: { value: "bravo" }, id: "t2", kind: "inline", type: "text" }
            ],
            id: "p",
            kind: "block",
            type: "paragraph"
          }
        ],
        id: "root",
        kind: "root",
        type: "document"
      }
    },
    snapshot: {
      content: "alpha  \nbravo\n",
      dialect: "gfm-plus",
      hash: "mme-0123",
      path: "memory://mme-0123.md"
    }
  };
  const doc = markdownDocumentToProseMirror(parseResult, createMomentariseRichSchema());
  assertEqual(pmShape(doc), 'paragraph text("alpha") hard_break text("bravo")', "mdast-spelled break mounted shape");
});

/* ------------------------------------------------------------------ *
 * Section 2 — the mount. Both spellings reach a real hard_break.
 * ------------------------------------------------------------------ */

const mountTable = [
  {
    label: "two-space break",
    pm: 'paragraph text("alpha") hard_break text("bravo")',
    source: "alpha  \nbravo\n"
  },
  {
    label: "backslash break",
    pm: 'paragraph text("alpha") hard_break text("bravo")',
    source: "alpha\\\nbravo\n"
  },
  {
    label: "break inside a strong run",
    pm: 'paragraph text("alpha"){strong} hard_break{strong} text("bravo"){strong}',
    source: "**alpha  \nbravo**\n"
  },
  {
    label: "image inside a strong run",
    pm: 'paragraph text("a "){strong} image("i.png"){strong} text(" b"){strong}',
    source: "**a ![alt](i.png) b**\n"
  },
  {
    label: "break and image together inside a link",
    pm: 'paragraph text("a"){link} hard_break{link} image("i.png"){link}',
    source: "[a  \n![alt](i.png)](https://e.com)\n"
  }
];

for (const row of mountTable) {
  check(`${row.label} mounts without losing content`, () => {
    const state = createRichMarkdownState(row.source);
    assertEqual(pmShape(state.editorState.doc), row.pm, `${row.label} mounted shape`);
  });
}

/* ------------------------------------------------------------------ *
 * Section 3 — the data loss, at the only moment it reaches disk: an
 * edit to the paragraph that holds the break.
 * ------------------------------------------------------------------ */

const editTable = [
  {
    bytes: "**alpha  \nbravo**\n",
    label: "bold a two-space-broken paragraph",
    shape: 'paragraph[strong[text("alpha"), lineBreak, text("bravo")]]',
    source: "alpha  \nbravo\n"
  },
  {
    // The backslash form normalizes to the two-space form on reconstruction —
    // a break is still a break. Losing the line entirely is the defect.
    bytes: "**alpha  \nbravo**\n",
    label: "bold a backslash-broken paragraph",
    shape: 'paragraph[strong[text("alpha"), lineBreak, text("bravo")]]',
    source: "alpha\\\nbravo\n"
  },
  {
    // The source is ALREADY bold, so the marks under test come from the mount
    // rather than from the command. With an unmarked source this row would pass
    // against a fully reverted image fix — it would be re-testing MME-0121.
    bytes: "a ![alt](i.png) b\n",
    label: "unbold a loaded paragraph holding an image",
    shape: 'paragraph[text("a "), image, text(" b")]',
    source: "**a ![alt](i.png) b**\n"
  }
];

for (const row of editTable) {
  check(`${row.label} keeps every line`, () => {
    const state = applyRichMarkdownCommand(
      selectWholeFirstParagraph(createRichMarkdownState(row.source)),
      "bold"
    );
    const content = serializeRichMarkdownState(state).content;
    assertEqual(content, row.bytes, `${row.label} bytes`);
    assertEqual(shapeOf(content), row.shape, `${row.label} reopened shape`);
  });
}

check("typing one character into a soft-broken paragraph keeps the break", () => {
  // The cheapest possible edit, and the one a writer makes without thinking.
  // Before the fix this returned "Xalphabravo\n".
  const state = createRichMarkdownState("alpha  \nbravo\n");
  let editorState = state.editorState;
  editorState = editorState.apply(editorState.tr.setSelection(TextSelection.create(editorState.doc, 1, 1)));
  editorState = editorState.applyTransaction(editorState.tr.insertText("X")).state;
  assertEqual(
    serializeRichMarkdownState({ ...state, editorState }).content,
    "Xalpha  \nbravo\n",
    "typed-character bytes"
  );
});

check("an already-marked hard break survives an edit inside its own run", () => {
  // The symmetric half of the image case: the criterion says marks on hard
  // breaks must "serialize back per the MME-0121 run rules", and only bytes can
  // show that. Without the break's marks this writes `**alpha**  \n**bravo!**`
  // — two pairs where the file had one (measured).
  const state = createRichMarkdownState("**alpha  \nbravo**\n");
  let editorState = state.editorState;
  const end = 1 + editorState.doc.child(0).content.size;
  editorState = editorState.applyTransaction(
    editorState.tr.setSelection(TextSelection.create(editorState.doc, end, end)).insertText("!")
  ).state;
  const content = serializeRichMarkdownState({ ...state, editorState }).content;
  assertEqual(content, "**alpha  \nbravo!**\n", "loaded-then-edited break stays inside one pair");
  assertEqual(
    shapeOf(content),
    'paragraph[strong[text("alpha"), lineBreak, text("bravo!")]]',
    "loaded-then-edited break reopened shape"
  );
});

/*
 * A mark run may CONTAIN a hard break but must not begin or end on one.
 * CommonMark's flanking rules reject a delimiter next to a line ending, so
 * `**alpha  \n**bravo` reopens with two literal asterisks and no bold at all.
 *
 * This corruption was unreachable before MME-0123 — the break did not survive
 * the mount, so no selection could straddle it. Restoring the break made an
 * ordinary gesture (`Home`, `Shift+ArrowDown` in a two-line paragraph) reach
 * it. Measured before the guard:
 *
 *   PM 1..7  ->  "**alpha  \n**bravo\n"   reopens as text("**alpha") … text("**bravo")
 *   PM 6..12 ->  "alpha**  \nbravo**\n"   reopens as text("alpha**") … text("bravo**")
 *
 * Found by the MME-0123 Test Reviewer. The whole-paragraph row above is the
 * counterweight: trimming must not cost the interior case its single pair.
 */
const edgeBreakTable = [
  {
    bytes: "**alpha**  \nbravo\n",
    from: 1,
    label: "selection ends on the break",
    shape: 'paragraph[strong[text("alpha")], lineBreak, text("bravo")]',
    to: 7
  },
  {
    bytes: "alpha  \n**bravo**\n",
    from: 6,
    label: "selection starts on the break",
    shape: 'paragraph[text("alpha"), lineBreak, strong[text("bravo")]]',
    to: 12
  },
  {
    bytes: "**alpha  \nbravo**\n",
    from: 1,
    label: "selection spans the whole paragraph",
    shape: 'paragraph[strong[text("alpha"), lineBreak, text("bravo")]]',
    to: 12
  }
];

for (const row of edgeBreakTable) {
  check(`bolding a range where the ${row.label} emits delimiters that re-parse`, () => {
    const state = createRichMarkdownState("alpha  \nbravo\n");
    const editorState = state.editorState.apply(
      state.editorState.tr.setSelection(TextSelection.create(state.editorState.doc, row.from, row.to))
    );
    const content = serializeRichMarkdownState(
      applyRichMarkdownCommand({ ...state, editorState }, "bold")
    ).content;
    assertEqual(content, row.bytes, `${row.label} bytes`);
    // The bytes alone are not the claim: literal `**` in the file looks
    // plausible. The reopened shape is what proves the bold is real.
    assertEqual(shapeOf(content), row.shape, `${row.label} reopened shape`);
  });
}

check("an already-marked image survives an edit inside its own run", () => {
  // MME-0121 guarantees one delimiter pair per run for COMMAND-applied marks.
  // A loaded document re-fractured through the mount gap: the image arrived
  // unmarked, so the run broke at both of its boundaries.
  const state = createRichMarkdownState("**a ![alt](i.png) b**\n");
  let editorState = state.editorState;
  const end = 1 + editorState.doc.child(0).content.size;
  editorState = editorState.applyTransaction(
    editorState.tr.setSelection(TextSelection.create(editorState.doc, end, end)).insertText("!")
  ).state;
  assertEqual(
    serializeRichMarkdownState({ ...state, editorState }).content,
    "**a ![alt](i.png) b!**\n",
    "loaded-then-edited image stays inside one pair"
  );
});

/* ------------------------------------------------------------------ *
 * Section 4 — preservation. Editing one paragraph leaves a soft-broken
 * neighbour byte-identical, LF and CRLF.
 * ------------------------------------------------------------------ */

const preservationTable = [
  {
    edited: "**Intro**.\r\n\r\nalpha  \r\nbravo\r\n\r\nOutro.\r\n",
    label: "CRLF",
    source: "Intro.\r\n\r\nalpha  \r\nbravo\r\n\r\nOutro.\r\n"
  },
  {
    edited: "**Intro**.\n\nalpha  \nbravo\n\nOutro.\n",
    label: "LF",
    source: "Intro.\n\nalpha  \nbravo\n\nOutro.\n"
  }
];

for (const row of preservationTable) {
  check(`editing a neighbour leaves the soft-broken paragraph byte-identical (${row.label})`, () => {
    let state = selectFirstRichText(createRichMarkdownState(row.source), "Intro");
    state = applyRichMarkdownCommand(state, "bold");
    assertEqual(serializeRichMarkdownState(state).content, row.edited, `${row.label} neighbour bytes`);
  });

  check(`editing the soft-broken paragraph keeps its line ending (${row.label})`, () => {
    // The reconstructed block adopts the document's line ending; a break that
    // reappeared as a bare LF inside a CRLF file would be a mixed-ending file.
    const state = createRichMarkdownState(row.source);
    const paragraph = state.editorState.doc.child(1);
    const start = state.editorState.doc.resolve(0).posAtIndex(1) + 1;
    let editorState = state.editorState.apply(
      state.editorState.tr.setSelection(
        TextSelection.create(state.editorState.doc, start, start + paragraph.content.size)
      )
    );
    const bolded = applyRichMarkdownCommand({ ...state, editorState }, "bold");
    const eol = row.label === "CRLF" ? "\r\n" : "\n";
    assertEqual(
      serializeRichMarkdownState(bolded).content,
      `Intro.${eol}${eol}**alpha  ${eol}bravo**${eol}${eol}Outro.${eol}`,
      `${row.label} edited-paragraph bytes`
    );
  });
}

check("an untouched soft-broken document round-trips byte-identically", () => {
  // The last two are the criterion's "bold-across-break case round-trips to
  // identical bytes"; the first three are the plain break, both spellings, both
  // line endings.
  for (const source of [
    "alpha  \nbravo\n",
    "alpha\\\nbravo\n",
    "alpha  \r\nbravo\r\n",
    "**alpha  \nbravo**\n",
    "**alpha  \r\nbravo**\r\n"
  ]) {
    assertEqual(
      serializeRichMarkdownState(createRichMarkdownState(source)).content,
      source,
      `identity round trip for ${JSON.stringify(source)}`
    );
  }
});

/* ------------------------------------------------------------------ *
 * Section 5 — the two consumers that read a break's *size* and its
 * *line-start* effect. Both were rewritten onto the shared predicate by
 * this issue, and neither is covered by sections 1-4: the first two
 * mutation rounds found both surviving, which is the whole point of the
 * rule. Each case below is the interaction a writer performs.
 * ------------------------------------------------------------------ */

check("a footnote inserted at the end of a soft-broken paragraph lands after the last word", () => {
  // `modelInlineSize` maps a rich caret offset onto a source byte offset. A
  // break that measures 0 instead of 1 puts every caret past it one byte early,
  // so the reference lands INSIDE the final word.
  const state = createRichMarkdownState("alpha  \nbravo\n");
  const end = 1 + state.editorState.doc.child(0).content.size;
  const editorState = state.editorState.apply(
    state.editorState.tr.setSelection(TextSelection.create(state.editorState.doc, end, end))
  );
  const result = insertRichFootnote({ ...state, editorState }, { text: "note body" });
  assertEqual(result.handled, true, "the insertion must be accepted");
  assertEqual(
    serializeRichMarkdownState(result.state).content,
    "alpha  \nbravo[^note]\n\n[^note]: note body\n",
    "footnote-after-break bytes"
  );
});

/*
 * The last two rows are the ones that pin the flag rather than the outcome.
 * MME-0120 serializes a paragraph in escalating tiers and verifies each by
 * re-parsing, so losing the line-start signal does not corrupt the file — it
 * makes tier 1 fail verification and drops the paragraph to the aggressive
 * tier, which escapes every ASCII punctuation character it finds.
 *
 * That is why the first four rows cannot kill the mutant: `\# bravo` is what
 * both tiers produce. Measured on this row's own input, typing `"# (x) "` at
 * the start of the second line:
 *
 *   atLineStart from the break  ->  "alpha  \n\\# (x) bravo\n"
 *   atLineStart forced false    ->  "alpha  \n\\# \\(x\\) bravo\n"
 *
 * Same meaning, uglier bytes in the writer's file. The last two rows are the
 * mutation kill; the first four are coverage of the markers themselves.
 */
const lineStartTable = [
  { bytes: "alpha  \n\\# bravo\n", label: "#", typed: "# " },
  { bytes: "alpha  \n\\> bravo\n", label: ">", typed: "> " },
  { bytes: "alpha  \n\\- bravo\n", label: "-", typed: "- " },
  { bytes: "alpha  \n1\\. bravo\n", label: "1.", typed: "1. " },
  { bytes: "alpha  \n\\# (x) bravo\n", label: "# with parentheses", typed: "# (x) " },
  { bytes: "alpha  \n\\> (x) bravo\n", label: "> with parentheses", typed: "> (x) " }
];

for (const row of lineStartTable) {
  check(`a literal "${row.label}" typed after a break is escaped, not re-parsed as a block`, () => {
    // The text after a hard break starts a line, so an unescaped block marker
    // there re-opens as a heading/quote/list and the paragraph is gone. This is
    // MME-0120's escaping contract, reached through the break.
    const state = createRichMarkdownState("alpha  \nbravo\n");
    // "alpha" is 5 characters, the hard break is 1: the caret sits at the start
    // of the second visual line.
    const afterBreak = 1 + 5 + 1;
    let editorState = state.editorState.apply(
      state.editorState.tr.setSelection(TextSelection.create(state.editorState.doc, afterBreak, afterBreak))
    );
    editorState = editorState.applyTransaction(editorState.tr.insertText(row.typed)).state;
    const content = serializeRichMarkdownState({ ...state, editorState }).content;
    assertEqual(content, row.bytes, `escaped "${row.label}" bytes`);
    assertEqual(
      shapeOf(content),
      `paragraph[text("alpha"), lineBreak, text("${row.typed}bravo")]`,
      `escaped "${row.label}" reopened shape`
    );
  });
}

if (failures.length > 0) {
  throw new Error([`MME-0123: ${failures.length} case(s) failed.`, ...failures].join("\n\n"));
}

console.log("MME-0123 mount fidelity: all cases passed.");

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

function pmShape(doc) {
  const parts = [];
  doc.descendants((node) => {
    // The image's `src` is part of the shape: without it these rows would pass
    // against a mount that created the node with empty attrs.
    const detail = node.isText
      ? `(${JSON.stringify(node.text)})`
      : node.type.name === "image"
        ? `(${JSON.stringify(node.attrs.src)})`
        : "";
    const marks = node.marks.length > 0 ? `{${node.marks.map((mark) => mark.type.name).join(",")}}` : "";
    parts.push(`${node.type.name}${detail}${marks}`);
    return true;
  });
  return parts.join(" ");
}

function shapeOf(content) {
  return shapeList(
    parser.parse(content, { dialect: "gfm-plus", path: "memory://mme-0123.md" }).document.root.children
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

function selectWholeFirstParagraph(state) {
  const editorState = state.editorState;
  const paragraph = editorState.doc.child(0);
  return {
    ...state,
    editorState: editorState.apply(
      editorState.tr.setSelection(TextSelection.create(editorState.doc, 1, 1 + paragraph.content.size))
    )
  };
}
