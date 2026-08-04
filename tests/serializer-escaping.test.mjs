/*
 * MME-0120 — a paragraph whose literal text would re-parse as a different
 * construct must serialize escaped.
 *
 * Measured at `e11b8e8` before this suite existed, through the real user path
 * (type, one undo, serialize, re-parse):
 *
 *   "# "       -> file "#"        -> reopens as an EMPTY HEADING, characters gone
 *   "3. "      -> file "3."       -> reopens as an EMPTY ORDERED LIST, characters gone
 *   "> "       -> file ">"        -> reopens as an EMPTY BLOCKQUOTE, characters gone
 *   "- "       -> file "-"        -> reopens as an EMPTY LIST, characters gone
 *   "**bold**" -> file "**bold**" -> reopens BOLD, the undo is reversed
 *
 * The suite asserts the criterion in both directions: colliding text must
 * survive the round trip (section 1-3), and non-colliding text must serialize
 * byte-identically to what the serializer produced before the fix (section 4),
 * because a blanket escaper would "pass" section 1-3 while rewriting every
 * document in the corpus.
 */

import { readdir, readFile } from "node:fs/promises";
import {
  createMarkdownAstParser,
  serializeMomentariseDocument
} from "../packages/md-format/dist/index.js";
import {
  createRichMarkdownState,
  selectFirstRichText,
  serializeRichMarkdownState
} from "../packages/md-rich-prosemirror/dist/index.js";
import { TextSelection } from "prosemirror-state";

const dialect = "gfm-plus";
const parser = createMarkdownAstParser();
const failures = [];
let nodeCounter = 0;

/* ------------------------------------------------------------------ *
 * Section 1 — the measured table, at the level the defect lives in.
 * ------------------------------------------------------------------ */

/*
 * `bytes` are measured, not predicted. Two predictions written before the first
 * GREEN run were wrong and are corrected here, both in the direction of fewer
 * escapes:
 *   - the trailing space of `# `/`- `/`> ` does not reach the file at all, since
 *     the document serializer trims each block's end (Markdown cannot carry a
 *     trailing space at the end of a block anyway);
 *   - `**bold**` needs ONE escape, not two: `\**bold**` re-parses as literal
 *     text because the surviving `*` run cannot pair with the closing `**`.
 */
const measuredTable = [
  { bytes: "\\#\n", label: "ATX heading marker", shape: 'paragraph[text("#")]', text: "# " },
  { bytes: "3\\.\n", label: "ordered list marker", shape: 'paragraph[text("3.")]', text: "3. " },
  { bytes: "\\-\n", label: "bullet list marker", shape: 'paragraph[text("-")]', text: "- " },
  { bytes: "\\>\n", label: "blockquote marker", shape: 'paragraph[text(">")]', text: "> " },
  { bytes: "[]\n", label: "bare todo brackets", shape: 'paragraph[text("[]")]', text: "[] " },
  { bytes: "\\**bold**\n", label: "strong delimiters", shape: 'paragraph[text("**bold**")]', text: "**bold**" },
  {
    bytes: "a\\**bold**\n",
    label: "mid-word strong delimiters",
    shape: 'paragraph[text("a**bold**")]',
    text: "a**bold**"
  }
];

for (const row of measuredTable) {
  check(`literal ${row.label} survives serialize -> parse`, () => {
    const content = serializeLiteralParagraph(row.text);
    assertEqual(shapeOf(content), row.shape, `${row.label} re-parsed shape`);
  });
}

for (const row of measuredTable) {
  check(`literal ${row.label} escapes minimally`, () => {
    // Pinned bytes, so "escaped" cannot silently become "escaped everywhere".
    assertEqual(serializeLiteralParagraph(row.text), row.bytes, `${row.label} serialized bytes`);
  });
}

/*
 * These rows exist because the first mutation round found seven surviving
 * mutants. The serializer escalates from targeted escaping to a blunt
 * escape-everything fallback, and for one-character cases like `# ` the two
 * produce identical bytes — so breaking a targeted rule changed nothing an
 * assertion could see. Every row below carries punctuation the blunt fallback
 * would also escape, so the bytes prove which escaper ran.
 */
const escaperPrecisionTable = [
  {
    bytes: "\\# heading, with commas & symbols\n",
    label: "ATX marker with unrelated punctuation",
    text: "# heading, with commas & symbols"
  },
  {
    bytes: "\\- item, with punctuation!\n",
    label: "bullet marker with unrelated punctuation",
    text: "- item, with punctuation!"
  },
  {
    bytes: "3\\. step one; step two\n",
    label: "ordered marker escapes the delimiter, not the digit",
    text: "3. step one; step two"
  },
  {
    bytes: "\\> quoted, with punctuation!\n",
    label: "blockquote marker with unrelated punctuation",
    text: "> quoted, with punctuation!"
  },
  { bytes: "a \\\\* b\n", label: "a literal backslash is doubled once", text: "a \\* b" },
  {
    // Needs three passes: neutralising the outer `**` exposes the inner `*b*`.
    bytes: "\\*\\*a \\*b* c**\n",
    label: "nested delimiter runs need repeated passes",
    text: "**a *b* c**"
  },
  { bytes: "\\*\\*\\*triple***\n", label: "a triple delimiter run", text: "***triple***" },
  /*
   * The next six rows exist because the reviewer's mutant sweep found eight
   * consequential survivors after the builder's first precision round: each of
   * these marker classes escaped identically under the targeted and aggressive
   * tiers for punctuation-free inputs, so dropping the class changed nothing an
   * assertion could see. Every row carries punctuation the aggressive tier
   * would also escape. The worst survivor (leading indent) reintroduced the
   * issue's own silent data loss with a green suite: with the signature's
   * leading-trim deleted, `"  # head"` shipped unescaped and reopened as a
   * heading.
   */
  { bytes: "\\```js, x!\n", label: "fence marker with unrelated punctuation", text: "```js, x!" },
  { bytes: "\\***\n", label: "asterisk thematic break", text: "***" },
  {
    bytes: "line one, x!\n\\===\n",
    label: "setext underline after a soft break",
    text: "line one, x!\n==="
  },
  { bytes: "  \\# head\n", label: "marker after leading indent", reopens: "# head", text: "  # head" },
  { bytes: "Use \\<br\\> to break\n", label: "inline html neutralised by the aggressive tier", text: "Use <br> to break" },
  { bytes: "  \\- item, x!\n", label: "bullet marker after leading indent", reopens: "- item, x!", text: "  - item, x!" }
];

for (const row of escaperPrecisionTable) {
  check(`${row.label} escapes precisely`, () => {
    assertEqual(serializeLiteralParagraph(row.text), row.bytes, `${row.label} serialized bytes`);
    // `reopens` overrides for the indent rows: a two-space indent is kept in
    // the file but normalized out of the parsed text value, the same
    // whitespace normalization the parser applies everywhere.
    assertEqual(
      shapeOf(serializeLiteralParagraph(row.text)),
      `paragraph[text(${JSON.stringify(row.reopens ?? row.text)})]`,
      `${row.label} re-parsed shape`
    );
  });
}

check("a marker after a hard break is escaped like a line start", () => {
  // Reviewer survivor M18: with the `atLineStart` tracking dropped, only the
  // paragraph's first line was marker-escaped. The pinned commas prove the
  // targeted tier ran, not the aggressive rescue.
  const content = serializeParagraph([
    textNode("a"),
    modelNode("inline", "lineBreak"),
    textNode("# c, with commas!")
  ]);
  assertEqual(content, "a  \n\\# c, with commas!\n", "hard-break marker bytes");
  assertEqual(
    shapeOf(content),
    'paragraph[text("a"), lineBreak, text("# c, with commas!")]',
    "hard-break marker shape"
  );
});

check("a marker on a soft-broken line of a mid-paragraph text node is escaped", () => {
  // Reviewer survivor M17: with the `index > 0` clause dropped, a text node
  // that does not open the paragraph never marker-escaped its later lines.
  const content = serializeParagraph([
    strongNode([textNode("A")]),
    textNode(" b\n# c, with commas!")
  ]);
  assertEqual(content, "**A** b\n\\# c, with commas!\n", "soft-break marker bytes");
  assertEqual(
    shapeOf(content),
    'paragraph[strong[text("A")], text(" b\\n# c, with commas!")]',
    "soft-break marker shape"
  );
});

check("a paragraph carrying a footnote reference still escapes colliding text", () => {
  /*
   * Reviewer blocker B1. `[^a]` is a footnote reference only when its
   * definition is in the same document, so verifying the block in isolation
   * reported the reference as plain text, no tier could ever verify, and every
   * footnote paragraph shipped verbatim — measured at the first GREEN:
   * `a**bold**[^a]` reopened bold, the exact defect this issue fixes, in every
   * document with footnotes. The verifier now synthesizes a definition per
   * expected identifier.
   */
  const reference = () =>
    modelNode("inline", "footnoteReference", undefined, { identifier: "a", label: "a", raw: "[^a]" });
  const colliding = serializeParagraph([textNode("a**bold**"), reference()]);
  assertEqual(colliding, "a\\**bold**[^a]\n", "colliding footnote paragraph bytes");
  assertEqual(
    shapeOf(`${colliding}\n[^a]: note\n`),
    'paragraph[text("a**bold**"), footnoteReference] | footnoteDefinition[paragraph[text("note")]]',
    "colliding footnote paragraph reopened with its definition"
  );
  // The control proves the synthesis did not turn into blanket escaping.
  assertEqual(
    serializeParagraph([textNode("plain sentence"), reference()]),
    "plain sentence[^a]\n",
    "non-colliding footnote paragraph stays verbatim"
  );
});

check("a parsed block edited in place still escapes", () => {
  /*
   * The fast path skips verification when a block's rendering reproduces its
   * own source slice. The presence of a range must not be enough: this is a
   * parsed model whose text was edited while its range was kept — the shape a
   * host produces by mutating `value` — and it must still verify and escape.
   */
  const source = "plain text\n";
  const range = { end: { column: 11, line: 1, offset: 10 }, start: { column: 1, line: 1, offset: 0 } };
  const editedInPlace = { ...paragraphNode([textNode("# ")]), sourceRange: range };
  assertEqual(serializeBlocks([editedInPlace], source), "\\#\n", "edited-in-place bytes");
  assertEqual(shapeOf(serializeBlocks([editedInPlace], source)), 'paragraph[text("#")]', "edited-in-place shape");
});

check("adjacent text nodes are compared as one run", () => {
  /*
   * The model permits a paragraph to hold two adjacent text nodes — the rich
   * mapper emits one node per ProseMirror text node — while the parser always
   * returns the run as a single node. Without merging them, nothing the
   * serializer can emit would ever verify and the corrupting bytes would be
   * returned unchanged.
   *
   * The bytes here are the blunt fallback's, not the targeted escaper's, and
   * that is measured rather than aspirational: a delimiter run split across two
   * text nodes is invisible to a per-node escaper, so this is the one measured
   * case where escalation is what saves the text.
   */
  const content = serializeParagraph([textNode("**"), textNode("bold**")]);
  assertEqual(content, "\\*\\*bold\\*\\*\n", "split literal run serialized bytes");
  assertEqual(shapeOf(content), 'paragraph[text("**bold**")]', "split literal run re-parsed shape");
});

check("a literal fence marker survives serialize -> parse", () => {
  assertEqual(shapeOf(serializeLiteralParagraph("```")), 'paragraph[text("```")]', "fence marker");
});

check("a literal thematic break survives serialize -> parse", () => {
  assertEqual(shapeOf(serializeLiteralParagraph("---")), 'paragraph[text("---")]', "thematic break");
});

check("a literal setext underline survives serialize -> parse", () => {
  assertEqual(shapeOf(serializeLiteralParagraph("===")), 'paragraph[text("===")]', "setext underline");
});

check("literal emphasis, code span and link syntax survive serialize -> parse", () => {
  for (const [text, shape] of [
    ["*em*", 'paragraph[text("*em*")]'],
    ["_em_", 'paragraph[text("_em_")]'],
    ["~~gone~~", 'paragraph[text("~~gone~~")]'],
    ["`code`", 'paragraph[text("`code`")]'],
    ["[label](notes.md)", 'paragraph[text("[label](notes.md)")]'],
    ["![alt](image.png)", 'paragraph[text("![alt](image.png)")]'],
    ["a \\* b", 'paragraph[text("a \\\\* b")]']
  ]) {
    assertEqual(shapeOf(serializeLiteralParagraph(text)), shape, `literal ${JSON.stringify(text)}`);
  }
});

check("a bare URL is left alone, because no escape can stop a GFM autolink", () => {
  /*
   * Measured, not assumed: remark-gfm claims a bare URL as an autolink literal
   * even when every ASCII punctuation character in it is escaped, so
   * `[label](https://example.com)` cannot be held as literal text by any
   * escaping. The serializer proves it cannot verify and returns the original
   * bytes rather than adding backslashes that fix nothing — the file still
   * round-trips byte-for-byte. Recorded in BACKLOG.md.
   */
  const literal = "[label](https://example.com)";
  assertEqual(serializeLiteralParagraph(literal), `${literal}\n`, "bare URL bytes are untouched");
  assertEqual(
    shapeOf("\\[label\\]\\(https\\:\\/\\/example\\.com\\)\n"),
    'paragraph[text("[label]("), link[text("https://example.com")], text(")")]',
    "a fully escaped bare URL still autolinks"
  );
});

check("marked text keeps its delimiters while literal siblings are escaped", () => {
  // The delimiters a `strong` node emits are structure, not text: escaping them
  // would destroy the mark. Only the plain-text siblings may be escaped.
  const content = serializeParagraph([
    strongNode([textNode("real")]),
    textNode(" and **literal**")
  ]);
  assertEqual(
    shapeOf(content),
    'paragraph[strong[text("real")], text(" and **literal**")]',
    "mixed marked and literal delimiters"
  );
});

check("a literal marker inside a heading survives serialize -> parse", () => {
  const content = serializeBlocks([headingNode(1, [textNode("Title **bold**")])]);
  assertEqual(shapeOf(content), 'heading[text("Title **bold**")]', "heading with literal delimiters");
});

check("a literal marker inside a list item survives serialize -> parse", () => {
  const content = serializeBlocks([
    listNode(false, [listItemNode([paragraphNode([textNode("**bold**")])])])
  ]);
  assertEqual(shapeOf(content), 'list[listItem[paragraph[text("**bold**")]]]', "list item with literal delimiters");
});

check("a literal marker inside a blockquote survives serialize -> parse", () => {
  const content = serializeBlocks([blockquoteNode([paragraphNode([textNode("**bold**")])])]);
  assertEqual(shapeOf(content), 'blockquote[paragraph[text("**bold**")]]', "blockquote with literal delimiters");
});

/* ------------------------------------------------------------------ *
 * Section 2 — the user path end to end: type, one undo, save, reopen.
 * ------------------------------------------------------------------ */

const undoTable = [
  { reopens: 'paragraph[text("#")]', typed: "# " },
  { reopens: 'paragraph[text("3.")]', typed: "3. " },
  { reopens: 'paragraph[text("-")]', typed: "- " },
  { reopens: 'paragraph[text(">")]', typed: "> " },
  { reopens: 'paragraph[text("[]")]', typed: "[] " },
  { reopens: 'paragraph[text("**bold**")]', typed: "**bold**" }
];

for (const row of undoTable) {
  check(`typing ${JSON.stringify(row.typed)} then one undo survives a save`, () => {
    const undone = pressUndo(typeIntoRichState(createRichMarkdownState(""), row.typed));
    const content = serializeRichMarkdownState(undone).content;
    assertEqual(shapeOf(content), row.reopens, `${JSON.stringify(row.typed)} reopened shape`);
  });
}

check("a literal delimiter typed into an existing document survives a save", () => {
  const source = "Intro paragraph.\n\nSecond paragraph.\n\nThird paragraph.\n";
  const edited = replaceParagraphText(source, "Second paragraph.", "a**bold**");
  const content = serializeRichMarkdownState(edited).content;
  assertEqual(
    shapeOf(content),
    'paragraph[text("Intro paragraph.")] | paragraph[text("a**bold**")] | paragraph[text("Third paragraph.")]',
    "edited paragraph inside a real document"
  );
});

check("an edited paragraph does not disturb its untouched neighbours", () => {
  const source = "Intro paragraph.\n\nSecond paragraph.\n\nThird paragraph.\n";
  const content = serializeRichMarkdownState(
    replaceParagraphText(source, "Second paragraph.", "a**bold**")
  ).content;
  assertEqual(
    content,
    "Intro paragraph.\n\na\\**bold**\n\nThird paragraph.\n",
    "neighbour bytes around an escaped edit"
  );
});

check("an undo inside a blockquote survives a save", () => {
  const undone = pressUndo(typeIntoRichState(createRichMarkdownState(""), "> quoted **bold**"));
  assertEqual(
    shapeOf(serializeRichMarkdownState(undone).content),
    'blockquote[paragraph[text("quoted **bold**")]]',
    "blockquote undo reopened shape"
  );
});

check("an undo inside a heading survives a save", () => {
  const heading = selectFirstRichText(createRichMarkdownState("# Title\n"), "Title");
  const typed = typeIntoRichState(caretAt(heading, heading.editorState.selection.to), " **bold**");
  assertEqual(
    shapeOf(serializeRichMarkdownState(pressUndo(typed)).content),
    'heading[text("Title **bold**")]',
    "heading undo reopened shape"
  );
});

check("an undo inside a list keeps both items literal", () => {
  const firstItem = typeIntoRichState(createRichMarkdownState(""), "- item one");
  const secondItem = typeIntoRichState(pressEnter(firstItem), "**bold**");
  assertEqual(
    shapeOf(serializeRichMarkdownState(pressUndo(secondItem)).content),
    'list[listItem[paragraph[text("item one")]], listItem[paragraph[text("**bold**")]]]',
    "list undo reopened shape"
  );
});

/* ------------------------------------------------------------------ *
 * Section 3 — minimality. Text that does not collide must serialize
 * byte-identically to what the serializer produced before the fix.
 * ------------------------------------------------------------------ */

const nonCollidingText = [
  "plain sentence text",
  "a * b",
  "5 * 3 = 15",
  "snake_case_word and another_one_here",
  "#hashtag not a heading",
  "price is $5 (50% off)",
  "don't stop; it's fine",
  "a < b and c > d",
  "see [1] below",
  "C:\\Users\\andrew",
  "call foo(bar) then baz",
  "2026-08-04 10:00",
  "email me at a@b.com",
  "100% + 20% = 120%",
  "an em dash — and an ellipsis …",
  "accents: éàüñô",
  "trailing punctuation!",
  "ratio 3:4",
  "a|b|c not a table",
  "under_score in the middle"
];

for (const text of nonCollidingText) {
  check(`non-colliding text is untouched: ${JSON.stringify(text)}`, () => {
    assertEqual(serializeLiteralParagraph(text), `${text}\n`, "non-colliding paragraph bytes");
  });
}

/* ------------------------------------------------------------------ *
 * Section 4 — the corpus. Every fixture, both directions.
 * ------------------------------------------------------------------ */

const fixtures = await loadFixtures("fixtures");
if (fixtures.length < 40) {
  throw new Error(`Expected at least 40 corpus fixtures, found ${fixtures.length}.`);
}

const corpusBaseline = JSON.parse(
  await readFile("tests/fixtures/model-serializer-corpus-baseline.json", "utf8")
);

for (const fixture of fixtures) {
  check(`corpus model serialization is unchanged: ${fixture.fixtureId}`, () => {
    const expected = corpusBaseline[fixture.fixtureId];
    if (typeof expected !== "string") {
      throw new Error(`No baseline recorded for ${fixture.fixtureId}.`);
    }
    assertEqual(serializeMomentariseDocument(parse(fixture.input)).content, expected, fixture.fixtureId);
  });

  check(`corpus paragraphs and headings survive model serialization: ${fixture.fixtureId}`, () => {
    /*
     * Scoped to the unit this issue owns: every real paragraph and heading in
     * the corpus, serialized on its own through the model serializer, must
     * re-parse to the same block type and the same text. A corpus paragraph
     * that happens to collide (a line starting `+`, a literal `*`) is caught
     * here rather than by a hand-picked example.
     *
     * Deliberately NOT asserted here: whole-document reconstruction. Running
     * this over every block class exposed a separate pre-existing defect —
     * nested todo items are indented by the checkbox width and two list items
     * are destroyed (`003-gfm-task-list`: 5 list items in, 3 out). Measured at
     * `e11b8e8`, unrelated to escaping, recorded in BACKLOG.md.
     */
    const blocks = parse(fixture.input).document.root.children;
    /*
     * `[^ref]` is a footnote reference only when the document also carries its
     * definition, so an isolated paragraph would report every reference as
     * plain text. Carry the definitions along; they are not what is asserted.
     */
    const definitions = blocks.filter(
      (node) => node.kind !== "opaque" && node.type === "footnoteDefinition"
    );
    for (const block of blocks) {
      if (block.kind === "opaque" || (block.type !== "paragraph" && block.type !== "heading")) {
        continue;
      }
      if (block.type === "heading" && inlineTextOfBlocks([block]).includes("\n")) {
        // A multi-line setext heading cannot be an ATX heading and no escape
        // can remove the newline; the serializer drops its second line. Measured
        // at `e11b8e8` on `014-mixed-real-world`, a separate defect from
        // escaping, recorded in BACKLOG.md.
        continue;
      }
      const content = serializeBlocks([block, ...definitions], fixture.input);
      /*
       * The parser reports detected opaque spans (wikilinks, inline HTML, LaTeX,
       * `:::` blocks) as extra root children alongside the block they sit in, so
       * a one-block document legitimately re-parses to more than one root node.
       * Compare the block, not the count.
       */
      const reparsed = parse(content).document.root.children.filter((node) => node.kind !== "opaque");
      assertEqual(
        shapeList(reparsed.slice(0, 1)).join(" | "),
        shapeList([block]).join(" | "),
        `${fixture.fixtureId} ${block.type}\n  bytes: ${JSON.stringify(content)}`
      );
    }
  });

  check(`corpus document is byte-identical when untouched: ${fixture.fixtureId}`, () => {
    const state = createRichMarkdownState(fixture.input);
    assertEqual(serializeRichMarkdownState(state).content, fixture.input, `${fixture.fixtureId} untouched`);
  });
}

if (failures.length > 0) {
  throw new Error([`MME-0120: ${failures.length} case(s) failed.`, ...failures].join("\n\n"));
}

console.log(`MME-0120 serializer escaping: all cases passed (${fixtures.length} fixtures).`);

/* ------------------------------------------------------------------ *
 * Harness.
 * ------------------------------------------------------------------ */

function check(label, run) {
  try {
    run();
  } catch (error) {
    /*
     * A `TypeError`/`ReferenceError` is a broken harness, not a failing
     * assertion. Counting it would let a RED phase report "N failing cases"
     * while actually reporting N crashes.
     */
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

function parse(source) {
  return parser.parse(source, { dialect, path: "memory://mme-0120.md" });
}

function shapeOf(content) {
  return shapeList(parse(content).document.root.children).join(" | ");
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

function inlineTextOfBlocks(nodes) {
  return (nodes ?? [])
    .map((node) => {
      if (node.kind === "opaque") {
        return node.raw;
      }
      const value = node.attributes?.value;
      return typeof value === "string" ? value : inlineTextOfBlocks(node.children);
    })
    .join("\u0000");
}

function modelNode(kind, type, children, attributes) {
  nodeCounter += 1;
  return {
    ...(attributes ? { attributes } : {}),
    ...(children ? { children } : {}),
    id: `mme-0120-${nodeCounter}`,
    kind,
    type
  };
}

function textNode(value) {
  return modelNode("inline", "text", undefined, { value });
}

function strongNode(children) {
  return modelNode("inline", "strong", children);
}

function paragraphNode(children) {
  return modelNode("block", "paragraph", children);
}

function headingNode(depth, children) {
  return modelNode("block", "heading", children, { depth });
}

function blockquoteNode(children) {
  return modelNode("block", "blockquote", children);
}

function listNode(ordered, children) {
  return modelNode("block", "list", children, { ordered });
}

function listItemNode(children) {
  return modelNode("block", "listItem", children);
}

function serializeBlocks(blocks, source = "") {
  // `source` is the document the blocks were parsed from: nodes that serialize
  // from their own source range (footnote definitions, opaque blocks) read it.
  return serializeMomentariseDocument({
    diagnostics: [],
    document: {
      diagnostics: [],
      dialect,
      root: modelNode("root", "document", blocks)
    },
    snapshot: { content: source, dialect, hash: "mme-0120", path: null }
  }).content;
}

function serializeParagraph(inlineChildren) {
  return serializeBlocks([paragraphNode(inlineChildren)]);
}

function serializeLiteralParagraph(text) {
  return serializeParagraph([textNode(text)]);
}

function typeIntoRichState(state, text) {
  let editorState = state.editorState;
  for (const character of text) {
    editorState = editorState.applyTransaction(editorState.tr.insertText(character)).state;
  }
  return { ...state, editorState };
}

function pressKeyInRichState(state, event) {
  let editorState = state.editorState;
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

function pressEnter(state) {
  return pressKeyInRichState(state, { key: "Enter", preventDefault() {} });
}

function pressUndo(state) {
  // `Mod-` is `Meta-` or `Ctrl-` depending on the platform prosemirror-keymap
  // detects; drive whichever one this platform bound.
  for (const modifier of ["metaKey", "ctrlKey"]) {
    const next = pressKeyInRichState(state, {
      altKey: false,
      ctrlKey: modifier === "ctrlKey",
      key: "z",
      metaKey: modifier === "metaKey",
      preventDefault() {},
      shiftKey: false
    });
    if (next.editorState !== state.editorState) {
      return next;
    }
  }
  return state;
}

function caretAt(state, position) {
  return {
    ...state,
    editorState: state.editorState.apply(
      state.editorState.tr.setSelection(TextSelection.create(state.editorState.doc, position))
    )
  };
}

function replaceParagraphText(source, existingText, replacement) {
  const selected = selectFirstRichText(createRichMarkdownState(source), existingText);
  let editorState = selected.editorState;
  const from = editorState.selection.from;
  editorState = editorState.apply(
    editorState.tr.setSelection(TextSelection.create(editorState.doc, from, from + existingText.length))
  );
  editorState = editorState.applyTransaction(editorState.tr.insertText(replacement)).state;
  return { ...selected, editorState };
}

async function loadFixtures(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const ids = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  return Promise.all(
    ids.map(async (fixtureId) => ({
      fixtureId,
      input: await readFile(`${root}/${fixtureId}/input.md`, "utf8")
    }))
  );
}
