const { readFile } = await import("node:fs/promises");
const rich = await import("../packages/md-rich-prosemirror/dist/index.js");
const { NodeSelection, TextSelection } = await import("prosemirror-state");

// A `callout` node accepts `paragraph+` only. It is reachable from this fixture,
// inside a footnote definition, and nowhere simpler.
const calloutFixtureSource = await readFile("fixtures/033-callout-footnote-editing/input.md", "utf8");
const CALLOUT_BODY_TEXT = "Edit top callout body.";

const requiredExports = [
  "canInsertParagraphAfterCurrentBlock",
  "getCurrentCodeBlockInfo",
  "insertParagraphAfterCurrentBlock",
  "setCurrentCodeBlockInfo",
  "toggleCurrentTodoItem"
];

for (const exportName of requiredExports) {
  if (!(exportName in rich)) {
    throw new Error(`Missing MME-0013.5 rich UX export: ${exportName}`);
  }
}

assertTypedMarkdown("# Reco", "# Reco", "heading 1 input rule", ["heading"]);
assertTypedMarkdown("## Details", "## Details", "heading 2 input rule", ["heading"]);
assertTypedMarkdown("### Fine", "### Fine", "heading 3 input rule", ["heading"]);
assertTypedMarkdown("- Bullet", "- Bullet", "bullet list input rule", ["bullet_list", "list_item", "paragraph"]);
assertTypedMarkdown("1. Ordered", "1. Ordered", "ordered list input rule", ["ordered_list", "list_item", "paragraph"]);
assertTypedMarkdown("> Quote", "> Quote", "blockquote input rule", ["blockquote", "paragraph"]);
assertTypedMarkdown("- [ ] Task", "- [ ] Task", "unchecked todo input rule", ["bullet_list", "todo_item", "paragraph"]);
assertTypedMarkdown("- [x] Done", "- [x] Done", "checked todo input rule", ["bullet_list", "todo_item", "paragraph"]);
assertTypedMarkdown("```ts const value = 1;", "```ts\nconst value = 1;\n```", "code fence space input rule", [
  "code_block"
]);

assertTypedMarkdownPrefix("- ", "-", "bullet list prefix input rule", ["bullet_list", "list_item", "paragraph"]);
assertTypedMarkdownPrefix("1. ", "1.", "ordered list prefix input rule", ["ordered_list", "list_item", "paragraph"]);
assertTypedMarkdownPrefix("> ", ">", "blockquote prefix input rule", ["blockquote", "paragraph"]);

const codeFenceEnterState = pressEnterInRichState(typeIntoRichState(rich.createRichMarkdownState(""), "```ts"));
assertNodePath(codeFenceEnterState, ["code_block"], "code fence enter node shape");
assertIncludes(
  rich.serializeRichMarkdownState(codeFenceEnterState).content,
  "```ts\n\n```",
  "code fence enter input rule"
);
const codeFenceWithContent = typeIntoRichState(codeFenceEnterState, "const value = 1;");
const codeFenceWithBlankLine = pressEnterInRichState(codeFenceWithContent);
assertRootChildTypes(codeFenceWithBlankLine, ["code_block"], "first Enter in code block stays inside code");
const exitedCodeFenceWithEnter = pressEnterInRichState(codeFenceWithBlankLine);
assertRootChildTypes(exitedCodeFenceWithEnter, ["code_block", "paragraph"], "second Enter on final blank code line exits code block");
assertSelectionInParagraph(exitedCodeFenceWithEnter, {
  label: "second Enter from final blank code line places caret in paragraph after code",
  parentOffset: 0
});
const exitedCodeFenceWithArrowDown = pressKeyInRichState(codeFenceWithContent, "ArrowDown");
assertRootChildTypes(exitedCodeFenceWithArrowDown, ["code_block", "paragraph"], "ArrowDown at final code position exits code block");
const exitedCodeFenceWithArrowRight = pressKeyInRichState(codeFenceWithContent, "ArrowRight");
assertRootChildTypes(exitedCodeFenceWithArrowRight, ["code_block", "paragraph"], "ArrowRight at final code position exits code block");

const uncheckedTodo = typeIntoRichState(rich.createRichMarkdownState(""), "- [ ] Ship it");
const continuedTodo = pressEnterInRichState(uncheckedTodo);
assertIncludes(rich.serializeRichMarkdownState(continuedTodo).content, "- [ ] Ship it\n- [ ]", "todo Enter continuation");
assertNodePath(continuedTodo, ["bullet_list", "todo_item", "paragraph"], "todo Enter first item node shape");
assertRootChildTypes(continuedTodo, ["bullet_list"], "todo Enter stays inside one semantic list");
assertFirstListChildTypes(continuedTodo, ["todo_item", "todo_item"], "todo Enter creates adjacent item");
const checkedTodo = rich.toggleCurrentTodoItem(uncheckedTodo);
assertIncludes(rich.serializeRichMarkdownState(checkedTodo).content, "- [x] Ship it", "todo toggle checked");
const uncheckedAgain = rich.toggleCurrentTodoItem(checkedTodo);
assertIncludes(rich.serializeRichMarkdownState(uncheckedAgain).content, "- [ ] Ship it", "todo toggle unchecked");

const existingTodo = rich.selectFirstRichText(rich.createRichMarkdownState("- [ ] Existing task\n"), "Existing");
const toggledExistingTodo = rich.toggleCurrentTodoItem(existingTodo);
assertIncludes(
  rich.serializeRichMarkdownState(toggledExistingTodo).content,
  "- [x] Existing task",
  "existing todo toggle"
);

const selectedCode = rich.selectFirstRichText(
  rich.createRichMarkdownState("```js title=\"demo\"\nconst value = true;\n```\n"),
  "value"
);
const initialCodeInfo = rich.getCurrentCodeBlockInfo(selectedCode);
if (!initialCodeInfo || initialCodeInfo.language !== "js" || initialCodeInfo.meta !== 'title="demo"') {
  throw new Error(`Unexpected initial code info: ${JSON.stringify(initialCodeInfo)}`);
}
const updatedCode = rich.setCurrentCodeBlockInfo(selectedCode, {
  language: "ts",
  meta: 'title="final"'
});
assertIncludes(
  rich.serializeRichMarkdownState(updatedCode).content,
  "```ts title=\"final\"\nconst value = true;\n```",
  "code block info update"
);
const updatedLanguageOnly = rich.setCurrentCodeBlockInfo(updatedCode, {
  language: "tsx"
});
assertIncludes(
  rich.serializeRichMarkdownState(updatedLanguageOnly).content,
  "```tsx title=\"final\"\nconst value = true;\n```",
  "code block partial info update"
);

const codeAtEnd = rich.selectFirstRichText(rich.createRichMarkdownState("```ts\nconst final = true;\n```\n"), "final");
const withParagraphAfterCode = rich.insertParagraphAfterCurrentBlock(codeAtEnd, "Next paragraph");
assertIncludes(
  rich.serializeRichMarkdownState(withParagraphAfterCode).content,
  "```\n\nNext paragraph",
  "paragraph after final code block"
);
if (!rich.canInsertParagraphAfterCurrentBlock(codeAtEnd)) {
  throw new Error("Code block selection should allow inserting a paragraph after the block.");
}

const calloutBlock = rich.applyRichMarkdownCommand(rich.createRichMarkdownState("Callout body\n"), "callout");
const selectedCalloutBlock = {
  ...calloutBlock,
  editorState: calloutBlock.editorState.apply(
    calloutBlock.editorState.tr.setSelection(NodeSelection.create(calloutBlock.editorState.doc, 0))
  )
};
const withParagraphAfterCallout = rich.insertParagraphAfterCurrentBlock(selectedCalloutBlock, "After callout");
assertIncludes(
  rich.serializeRichMarkdownState(withParagraphAfterCallout).content,
  "After callout",
  "paragraph after selected opaque/callout block"
);
if (!rich.canInsertParagraphAfterCurrentBlock(selectedCalloutBlock)) {
  throw new Error("Selected opaque/callout block should allow inserting a paragraph after the block.");
}

// ---------------------------------------------------------------------------
// MME-0104a — block and inline input rules (benchmark contract 5)
//
// Failures are collected rather than thrown so one run reports the whole gap.
//
// Every undo case asserts node shape and marks: `# Title` and `**bold**`
// serialize identically whether or not the rule fired, so a bytes-only undo
// assertion is vacuous.
//
// The same trap applies to every `assertSerializedMarkdown` below: taken alone
// each one passes with all rules disabled. Each is rescued only by sharing its
// `check()` body with an `assertInlineNodes`/`assertNodePath`/`assertTodoChecked`
// call. If a case is ever split, the byte half must not be left on its own.
// ---------------------------------------------------------------------------

const inputRuleFailures = [];

check("strong inline rule fires", () => {
  const state = typeIntoRichState(rich.createRichMarkdownState(""), "**bold**");
  assertInlineNodes(state, [["bold", ["strong"]]], "strong inline rule");
  assertSerializedMarkdown(state, "**bold**\n", "strong inline rule");
});

check("asterisk emphasis inline rule fires", () => {
  const state = typeIntoRichState(rich.createRichMarkdownState(""), "*italic*");
  assertInlineNodes(state, [["italic", ["em"]]], "asterisk emphasis inline rule");
  assertSerializedMarkdown(state, "*italic*\n", "asterisk emphasis inline rule");
});

check("underscore emphasis inline rule fires and serializes canonically", () => {
  const state = typeIntoRichState(rich.createRichMarkdownState(""), "_soft_");
  assertInlineNodes(state, [["soft", ["em"]]], "underscore emphasis inline rule");
  // A newly created em node serializes in the canonical asterisk form. An
  // untouched `_soft_` already in a document is never re-serialized.
  assertSerializedMarkdown(state, "*soft*\n", "underscore emphasis inline rule");
});

check("strikethrough inline rule fires", () => {
  const state = typeIntoRichState(rich.createRichMarkdownState(""), "~~gone~~");
  assertInlineNodes(state, [["gone", ["strike"]]], "strikethrough inline rule");
  assertSerializedMarkdown(state, "~~gone~~\n", "strikethrough inline rule");
});

check("emphasis does not swallow strong, bold typed first", () => {
  const state = typeIntoRichState(rich.createRichMarkdownState(""), "**bold** and *soft*");
  assertInlineNodes(
    state,
    [
      ["bold", ["strong"]],
      [" and ", []],
      ["soft", ["em"]]
    ],
    "strong before emphasis"
  );
  assertSerializedMarkdown(state, "**bold** and *soft*\n", "strong before emphasis");
});

check("emphasis does not swallow strong, italic typed first", () => {
  const state = typeIntoRichState(rich.createRichMarkdownState(""), "*soft* and **bold**");
  assertInlineNodes(
    state,
    [
      ["soft", ["em"]],
      [" and ", []],
      ["bold", ["strong"]]
    ],
    "emphasis before strong"
  );
  assertSerializedMarkdown(state, "*soft* and **bold**\n", "emphasis before strong");
});

check("inline rules keep marks already inside the match", () => {
  // Node shape only, deliberately. The mark rule must delete its delimiters and
  // mark what is left rather than replacing the range with fresh text, which
  // would destroy the code span the inline-code rule just created.
  //
  // The Markdown for this doc is *not* asserted: adjacent runs sharing an outer
  // mark serialize one delimiter pair each (`**a ****`x`**** b**`). That is a
  // pre-existing `wrapMomentariseTextMarks` defect, reachable today with no
  // input rule at all by running the `bold` command across a code span, and it
  // is recorded in BACKLOG.md rather than asserted here.
  const state = typeIntoRichState(rich.createRichMarkdownState(""), "**a `x` b**");
  assertInlineNodes(
    state,
    [
      ["a ", ["strong"]],
      ["x", ["code", "strong"]],
      [" b", ["strong"]]
    ],
    "strong over an existing code span"
  );
});

check("strong inline rule does not fire mid-word", () => {
  const state = typeIntoRichState(rich.createRichMarkdownState(""), "a**bold**");
  assertParagraphLiteral(state, "a**bold**", "strong mid-word");
});

check("underscore emphasis does not fire mid-word", () => {
  const state = typeIntoRichState(rich.createRichMarkdownState(""), "snake_case_name");
  assertParagraphLiteral(state, "snake_case_name", "underscore emphasis mid-word");
});

check("strikethrough does not fire mid-word", () => {
  const state = typeIntoRichState(rich.createRichMarkdownState(""), "a~~gone~~");
  assertParagraphLiteral(state, "a~~gone~~", "strikethrough mid-word");
});

check("inline code does not fire mid-word", () => {
  const state = typeIntoRichState(rich.createRichMarkdownState(""), "x`code`");
  assertParagraphLiteral(state, "x`code`", "inline code mid-word");
});

check("the link rule does not fire mid-word", () => {
  const state = typeIntoRichState(rich.createRichMarkdownState(""), "see[MME](https://example.com)");
  assertParagraphLiteral(state, "see[MME](https://example.com)", "link mid-word");
});

check("the link rule fires at a word boundary", () => {
  const state = typeIntoRichState(rich.createRichMarkdownState(""), "see [MME](https://example.com)");
  assertInlineNodes(state, [["see ", []], ["MME", ["link"]]], "link at a boundary");
  assertSerializedMarkdown(state, "see [MME](https://example.com)\n", "link at a boundary");
});

check("inline rules do not fire inside a fenced code block", () => {
  const fence = typeIntoRichState(rich.createRichMarkdownState(""), "```js ");
  const state = typeIntoRichState(fence, "**bold**");
  assertRootChildTypes(state, ["code_block"], "strong inside a fence");
  assertSerializedMarkdown(state, "```js\n**bold**\n```\n", "strong inside a fence");
});

check("block rules do not fire inside a fenced code block", () => {
  const fence = typeIntoRichState(rich.createRichMarkdownState(""), "```js ");
  const state = typeIntoRichState(fence, "# Title");
  assertRootChildTypes(state, ["code_block"], "heading inside a fence");
  assertSerializedMarkdown(state, "```js\n# Title\n```\n", "heading inside a fence");
});

check("inline rules do not fire inside an inline code span", () => {
  // The caret sits after a space so the word-boundary guard is satisfied: the
  // context contract is then the only thing keeping this literal.
  const selected = rich.selectFirstRichText(rich.createRichMarkdownState("`abc def`\n"), "abc def");
  const caret = caretAtRichPosition(selected, selected.editorState.selection.from + 4);
  const state = typeIntoRichState(caret, "**b**");
  assertInlineNodes(state, [["abc **b**def", ["code"]]], "strong inside inline code");
  assertSerializedMarkdown(state, "`abc **b**def`\n", "strong inside inline code");
});

for (const [typed, expectedCellText] of [
  ["# ", "# one"],
  ["> ", "> one"],
  ["- ", "- one"],
  ["1. ", "1. one"],
  ["**bold**", "**bold**one"]
]) {
  check(`no rule fires in a table cell: ${JSON.stringify(typed)}`, () => {
    const state = typeAtFirstTableCellStart(typed);
    assertRootChildTypes(state, ["table"], `table cell ${JSON.stringify(typed)}`);
    assertFirstTableCellText(state, expectedCellText, `table cell ${JSON.stringify(typed)}`);
  });
}

for (const typed of ["# ", "- ", "> "]) {
  check(`no block rule eats its prefix in a callout body: ${JSON.stringify(typed)}`, () => {
    // A callout accepts paragraphs only, so `setBlockType` and `replaceWith` are
    // both silent no-ops here. Without the conversion check the prefix delete
    // would stand alone and swallow what the user typed.
    const state = typeAtCalloutBodyStart(typed);
    const callout = firstNodeOfType(state, "callout");
    if (!callout) {
      throw new Error(`callout ${JSON.stringify(typed)} expected the callout to survive.\n${docJson(state)}`);
    }
    const actual = callout.firstChild?.textContent;
    const expected = `${typed}${CALLOUT_BODY_TEXT}`;
    if (actual !== expected) {
      throw new Error(
        `callout ${JSON.stringify(typed)} expected body ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}.`
      );
    }
  });
}

check("bare todo input rule fires on the trailing space", () => {
  const state = typeIntoRichState(rich.createRichMarkdownState(""), "[] Task");
  assertNodePath(state, ["bullet_list", "todo_item", "paragraph"], "bare todo");
  assertTodoChecked(state, false, "bare todo");
  // Exact, not `includes`: converting on `]` leaves the user's space as content
  // and produces `- [ ]  Task`.
  assertSerializedMarkdown(state, "- [ ] Task\n", "bare todo");
});

check("bare checked todo input rule fires", () => {
  const state = typeIntoRichState(rich.createRichMarkdownState(""), "[x] Done");
  assertNodePath(state, ["bullet_list", "todo_item", "paragraph"], "bare checked todo");
  assertTodoChecked(state, true, "bare checked todo");
  assertSerializedMarkdown(state, "- [x] Done\n", "bare checked todo");
});

check("bracket-space todo falls through to the paragraph rule outside a list", () => {
  // `todoInputRuleForListItemText` matches this text first and returns nothing
  // outside a list; it must fall through instead of aborting the rule pass.
  const state = typeIntoRichState(rich.createRichMarkdownState(""), "[ ] Task");
  assertNodePath(state, ["bullet_list", "todo_item", "paragraph"], "bracket-space todo");
  assertTodoChecked(state, false, "bracket-space todo");
  assertSerializedMarkdown(state, "- [ ] Task\n", "bracket-space todo");
});

check("the bare todo rule is anchored to the block start", () => {
  // Named for what it proves: the `todo` pattern is `^`-anchored, so this is an
  // anchor test, not a word-boundary test.
  const state = typeIntoRichState(rich.createRichMarkdownState(""), "see [] Task");
  assertParagraphLiteral(state, "see [] Task", "bare todo away from the block start");
});

check("ordered list input rule honours the typed start number", () => {
  const state = typeIntoRichState(rich.createRichMarkdownState(""), "3. Third");
  assertNodePath(state, ["ordered_list", "list_item", "paragraph"], "ordered list start");
  assertOrderedListStart(state, 3, "ordered list start");
  assertSerializedMarkdown(state, "3. Third\n", "ordered list start");
});

check("one undo after a strong conversion restores the literal syntax", () => {
  const converted = typeIntoRichState(rich.createRichMarkdownState(""), "**bold**");
  assertInlineNodes(converted, [["bold", ["strong"]]], "strong before undo");
  assertParagraphLiteral(pressUndoInRichState(converted), "**bold**", "strong after one undo");
});

check("one undo after a heading conversion restores the literal syntax", () => {
  // Immediately after the conversion, per the criterion: characters typed after
  // the trigger are their own history event and undo them, not the conversion.
  const converted = typeIntoRichState(rich.createRichMarkdownState(""), "# ");
  assertNodePath(converted, ["heading"], "heading before undo");
  assertParagraphLiteral(pressUndoInRichState(converted), "# ", "heading after one undo");
});

check("one undo after a bare todo conversion restores the literal syntax", () => {
  const converted = typeIntoRichState(rich.createRichMarkdownState(""), "[] ");
  assertNodePath(converted, ["bullet_list", "todo_item", "paragraph"], "bare todo before undo");
  assertParagraphLiteral(pressUndoInRichState(converted), "[] ", "bare todo after one undo");
});

check("one undo after an ordered list conversion restores the literal syntax", () => {
  const converted = typeIntoRichState(rich.createRichMarkdownState(""), "3. ");
  assertNodePath(converted, ["ordered_list", "list_item", "paragraph"], "ordered list before undo");
  assertParagraphLiteral(pressUndoInRichState(converted), "3. ", "ordered list after one undo");
});

check("undo after an inline rule inside a list keeps the sibling items", () => {
  // The defect this replaces: undo replaced `$from.before(1)`..`$from.after(1)`
  // — the whole list — with one paragraph, so `item one` was destroyed.
  const firstItem = typeIntoRichState(rich.createRichMarkdownState(""), "- item one");
  const secondItem = typeIntoRichState(pressEnterInRichState(firstItem), "**bold**");
  assertSerializedMarkdown(secondItem, "- item one\n- **bold**\n", "list before undo");
  const undone = pressUndoInRichState(secondItem);
  assertRootChildTypes(undone, ["bullet_list"], "undo inside a list keeps the list");
  assertFirstListChildTypes(undone, ["list_item", "list_item"], "undo inside a list keeps both items");
  assertSerializedMarkdown(undone, "- item one\n- **bold**\n", "undo inside a list restores only the literal");
});

check("undo after an inline rule inside a blockquote keeps the blockquote", () => {
  const quoted = typeIntoRichState(rich.createRichMarkdownState(""), "> quoted **bold**");
  assertRootChildTypes(quoted, ["blockquote"], "blockquote before undo");
  const undone = pressUndoInRichState(quoted);
  assertRootChildTypes(undone, ["blockquote"], "undo inside a blockquote keeps the blockquote");
  assertSerializedMarkdown(undone, "> quoted **bold**\n", "undo inside a blockquote restores only the literal");
});

check("undo after an inline rule inside a heading keeps the heading", () => {
  const heading = rich.selectFirstRichText(rich.createRichMarkdownState("# Title\n"), "Title");
  const typed = typeIntoRichState(caretAtRichPosition(heading, heading.editorState.selection.to), " **bold**");
  assertNodePath(typed, ["heading"], "heading before undo");
  const undone = pressUndoInRichState(typed);
  assertNodePath(undone, ["heading"], "undo inside a heading keeps the heading");
  assertSerializedMarkdown(undone, "# Title **bold**\n", "undo inside a heading restores only the literal");
});

check("a second undo reaches the history instead of replaying the restore", () => {
  const converted = typeIntoRichState(rich.createRichMarkdownState(""), "**bold**");
  const once = pressUndoInRichState(converted);
  assertParagraphLiteral(once, "**bold**", "first undo");
  /*
   * Asserted on the document, not on object identity. When the plugin state is
   * not cleared, the second press re-runs the same restore and still produces a
   * new `editorState`, so an identity check passes while the writer's undo
   * history is dead.
   */
  const twice = pressUndoInRichState(once);
  assertParagraphLiteral(twice, "", "second undo removes the typed characters");
});

check("untouched neighbours stay byte-identical after an inline rule", () => {
  const source = "Alpha\n\nBravo\n\nCharlie\n";
  const selected = rich.selectFirstRichText(rich.createRichMarkdownState(source), "Bravo");
  const caret = caretAtRichPosition(selected, selected.editorState.selection.to);
  const state = typeIntoRichState(caret, " **loud**");
  /*
   * The mark assertion is not decoration. `**loud**` serializes identically
   * whether or not the rule fired, so the byte assertion below passes with
   * every rule disabled — it can only prove preservation once something else
   * proves the rule ran.
   */
  const edited = state.editorState.doc.child(1);
  const editedInline = [];
  edited.forEach((child) => {
    editedInline.push([child.text, child.marks.map((mark) => mark.type.name)]);
  });
  if (JSON.stringify(editedInline) !== JSON.stringify([["Bravo ", []], ["loud", ["strong"]]])) {
    throw new Error(`neighbour preservation expected the edited paragraph to carry strong, got ${JSON.stringify(editedInline)}.`);
  }
  assertSerializedMarkdown(state, "Alpha\n\nBravo **loud**\n\nCharlie\n", "neighbour preservation");
});

check("the input rule set is discoverable", () => {
  if (!Array.isArray(rich.richInputRuleIds)) {
    throw new Error(
      `Expected richInputRuleIds to be an exported array, got ${JSON.stringify(rich.richInputRuleIds)}.`
    );
  }
  const required = [
    "blockquote",
    "bulletList",
    "codeFence",
    "emphasis",
    "heading",
    "horizontalRule",
    "inlineCode",
    "link",
    "listTodo",
    "orderedList",
    "strikethrough",
    "strong",
    "todo"
  ];
  const missing = required.filter((id) => !rich.richInputRuleIds.includes(id));
  if (missing.length > 0) {
    throw new Error(`richInputRuleIds is missing ${missing.join(", ")}. Got ${rich.richInputRuleIds.join(", ")}.`);
  }
});

check("every advertised rule id is a real rule", () => {
  /*
   * Ties `richInputRuleIds` to the rule set behaviourally. Without this, a typo
   * or a renamed built-in leaves the id advertised while `disable` silently
   * stops working for it, and only one of the thirteen ids would be covered.
   */
  const preferences = { inputRules: { disable: [...rich.richInputRuleIds] } };
  for (const [typed, literal] of [
    ["# Heading", "# Heading"],
    ["**bold**", "**bold**"],
    ["*soft*", "*soft*"],
    ["~~gone~~", "~~gone~~"],
    ["`code`", "`code`"],
    ["- Bullet", "- Bullet"],
    ["3. Third", "3. Third"],
    ["[] Task", "[] Task"],
    ["> Quote", "> Quote"],
    ["---", "---"],
    ["see [MME](https://example.com)", "see [MME](https://example.com)"]
  ]) {
    const state = typeIntoRichState(rich.createRichMarkdownState("", { preferences }), typed);
    assertParagraphLiteral(state, literal, `disabling every id leaves ${JSON.stringify(typed)} literal`);
  }
});

check("a host can disable one rule without disabling the others", () => {
  const preferences = { inputRules: { disable: ["strong"] } };
  const disabled = typeIntoRichState(rich.createRichMarkdownState("", { preferences }), "**bold**");
  assertParagraphLiteral(disabled, "**bold**", "disabled strong rule");
  const untouched = typeIntoRichState(rich.createRichMarkdownState("", { preferences }), "*soft*");
  assertInlineNodes(untouched, [["soft", ["em"]]], "emphasis with strong disabled");
});

check("a host can extend the rule set without forking internals", () => {
  const preferences = {
    inputRules: {
      extend: [
        {
          id: "host-arrow",
          match: /->$/u,
          run: ({ from, state, to }) => state.tr.insertText("→", from, to)
        }
      ]
    }
  };
  const state = typeIntoRichState(rich.createRichMarkdownState("", { preferences }), "a -> b");
  assertParagraphLiteral(state, "a → b", "host-supplied input rule");
});

check("a host rule cannot fire where the context is unsafe", () => {
  const preferences = {
    inputRules: {
      extend: [
        {
          id: "host-arrow",
          match: /->$/u,
          run: ({ from, state, to }) => state.tr.insertText("→", from, to)
        }
      ]
    }
  };
  const selected = rich.selectFirstRichText(
    rich.createRichMarkdownState("| A |\n| --- |\n| one |\n", { preferences }),
    "one"
  );
  const caret = caretAtRichPosition(selected, selected.editorState.selection.to);
  const state = typeIntoRichState(caret, "->");
  assertFirstTableCellText(state, "one->", "host rule in a table cell");
});

if (inputRuleFailures.length > 0) {
  throw new Error(
    [`MME-0104a: ${inputRuleFailures.length} input-rule case(s) failed.`, ...inputRuleFailures].join("\n\n")
  );
}

function check(label, run) {
  try {
    run();
  } catch (error) {
    /*
     * A `TypeError`/`ReferenceError` means the harness is broken, not that an
     * assertion failed. Collecting it would let a RED phase report "N failing
     * cases" while actually reporting N crashes, which the repository's RED
     * rule exists to forbid — so it stops the run instead of being counted.
     */
    if (error instanceof TypeError || error instanceof ReferenceError) {
      throw new Error(`[${label}] harness fault, not an assertion failure: ${error.stack}`);
    }
    inputRuleFailures.push(`[${label}] ${error.message}`);
  }
}

function caretAtRichPosition(state, position) {
  return {
    ...state,
    editorState: state.editorState.apply(
      state.editorState.tr.setSelection(TextSelection.create(state.editorState.doc, position))
    )
  };
}

function typeAtCalloutBodyStart(typed) {
  const state = rich.createRichMarkdownState(calloutFixtureSource, { dialect: "momentarise-enhanced" });
  const selected = rich.selectFirstRichText(state, CALLOUT_BODY_TEXT);
  return typeIntoRichState(caretAtRichPosition(selected, selected.editorState.selection.from), typed);
}

function firstNodeOfType(state, typeName) {
  let found = null;
  state.editorState.doc.descendants((node) => {
    if (found !== null) {
      return false;
    }
    if (node.type.name === typeName) {
      found = node;
      return false;
    }
    return true;
  });
  return found;
}

function typeAtFirstTableCellStart(typed) {
  const selected = rich.selectFirstRichText(
    rich.createRichMarkdownState("| A | B |\n| --- | --- |\n| one | two |\n"),
    "one"
  );
  return typeIntoRichState(caretAtRichPosition(selected, selected.editorState.selection.from), typed);
}

function pressUndoInRichState(state) {
  // `Mod-` resolves to `Meta-` or `Ctrl-` depending on the platform detected by
  // prosemirror-keymap; drive whichever one this platform binds.
  for (const modifier of ["metaKey", "ctrlKey"]) {
    const next = pressKeyChordInRichState(state, "z", modifier);
    if (next.editorState !== state.editorState) {
      return next;
    }
  }
  return state;
}

function pressKeyChordInRichState(state, key, modifier) {
  let editorState = state.editorState;
  const event = {
    altKey: false,
    ctrlKey: modifier === "ctrlKey",
    key,
    metaKey: modifier === "metaKey",
    preventDefault() {},
    shiftKey: false
  };
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

function assertSerializedMarkdown(state, expected, label) {
  const actual = rich.serializeRichMarkdownState(state).content;
  if (actual !== expected) {
    throw new Error(`${label} expected Markdown ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}.`);
  }
}

function assertInlineNodes(state, expected, label) {
  const paragraph = state.editorState.doc.firstChild;
  if (!paragraph) {
    throw new Error(`${label} expected a first block.\n${docJson(state)}`);
  }
  const actual = [];
  paragraph.forEach((child) => {
    actual.push([child.text ?? `<${child.type.name}>`, child.marks.map((mark) => mark.type.name).sort()]);
  });
  const normalizedExpected = expected.map(([text, marks]) => [text, [...marks].sort()]);
  if (JSON.stringify(actual) !== JSON.stringify(normalizedExpected)) {
    throw new Error(
      `${label} expected inline nodes ${JSON.stringify(normalizedExpected)}, got ${JSON.stringify(actual)}.\n${docJson(state)}`
    );
  }
}

function assertParagraphLiteral(state, expectedText, label) {
  const { doc } = state.editorState;
  if (doc.childCount !== 1 || doc.firstChild.type.name !== "paragraph") {
    throw new Error(`${label} expected a single paragraph.\n${docJson(state)}`);
  }
  assertInlineNodes(state, expectedText ? [[expectedText, []]] : [], label);
}

function assertTodoChecked(state, expected, label) {
  const todoItem = state.editorState.doc.firstChild?.firstChild;
  if (!todoItem || todoItem.type.name !== "todo_item") {
    throw new Error(`${label} expected a todo_item.\n${docJson(state)}`);
  }
  if (todoItem.attrs.checked !== expected) {
    throw new Error(`${label} expected checked=${expected}, got ${todoItem.attrs.checked}.\n${docJson(state)}`);
  }
}

function assertOrderedListStart(state, expected, label) {
  const list = state.editorState.doc.firstChild;
  if (!list || list.type.name !== "ordered_list") {
    throw new Error(`${label} expected an ordered_list.\n${docJson(state)}`);
  }
  if (list.attrs.order !== expected) {
    throw new Error(`${label} expected order=${expected}, got ${list.attrs.order}.\n${docJson(state)}`);
  }
}

function assertFirstTableCellText(state, expected, label) {
  let actual = null;
  state.editorState.doc.descendants((node) => {
    if (actual !== null) {
      return false;
    }
    if (node.type.name === "table_cell") {
      actual = node.textContent;
      return false;
    }
    return true;
  });
  if (actual !== expected) {
    throw new Error(`${label} expected cell text ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}.\n${docJson(state)}`);
  }
}

function docJson(state) {
  return JSON.stringify(state.editorState.doc.toJSON(), null, 2);
}

function assertTypedMarkdown(input, expected, label, expectedPath) {
  const state = typeIntoRichState(rich.createRichMarkdownState(""), input);
  assertIncludes(rich.serializeRichMarkdownState(state).content, expected, label);
  assertNodePath(state, expectedPath, `${label} node shape`);
}

function assertTypedMarkdownPrefix(input, expected, label, expectedPath) {
  const state = typeIntoRichState(rich.createRichMarkdownState(""), input);
  assertIncludes(rich.serializeRichMarkdownState(state).content, expected, label);
  assertNodePath(state, expectedPath, `${label} node shape`);
}

function typeIntoRichState(state, text) {
  let editorState = state.editorState;
  for (const character of text) {
    const transaction = editorState.tr.insertText(character);
    const result = editorState.applyTransaction(transaction);
    editorState = result.state;
  }
  return {
    ...state,
    editorState
  };
}

function pressEnterInRichState(state) {
  return pressKeyInRichState(state, "Enter");
}

function pressKeyInRichState(state, key) {
  let editorState = state.editorState;
  const event = {
    key,
    preventDefault() {}
  };
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
  return {
    ...state,
    editorState
  };
}

function assertSelectionInParagraph(state, { label, parentOffset }) {
  const selection = state.editorState.selection;
  if (!(selection instanceof TextSelection)) {
    throw new Error(`${label} expected a text selection.\n${JSON.stringify(state.editorState.doc.toJSON(), null, 2)}`);
  }
  if (selection.$from.parent.type.name !== "paragraph" || selection.$from.parentOffset !== parentOffset) {
    throw new Error(
      `${label} expected paragraph offset ${parentOffset}, got ${selection.$from.parent.type.name} offset ${selection.$from.parentOffset}.\n${JSON.stringify(
        state.editorState.doc.toJSON(),
        null,
        2
      )}`
    );
  }
}

function assertNodePath(state, expectedPath, label) {
  let node = state.editorState.doc;
  for (const expectedType of expectedPath) {
    node = node.firstChild;
    if (!node || node.type.name !== expectedType) {
      throw new Error(`${label} expected path ${expectedPath.join(" > ")}.\n${JSON.stringify(state.editorState.doc.toJSON(), null, 2)}`);
    }
  }
}

function assertRootChildTypes(state, expectedTypes, label) {
  const actualTypes = [];
  state.editorState.doc.forEach((child) => {
    actualTypes.push(child.type.name);
  });
  if (actualTypes.join(",") !== expectedTypes.join(",")) {
    throw new Error(`${label} expected root children ${expectedTypes.join(",")}.\n${JSON.stringify(state.editorState.doc.toJSON(), null, 2)}`);
  }
}

function assertFirstListChildTypes(state, expectedTypes, label) {
  const actualTypes = [];
  state.editorState.doc.firstChild?.forEach((child) => {
    actualTypes.push(child.type.name);
  });
  if (actualTypes.join(",") !== expectedTypes.join(",")) {
    throw new Error(`${label} expected list children ${expectedTypes.join(",")}.\n${JSON.stringify(state.editorState.doc.toJSON(), null, 2)}`);
  }
}

function assertIncludes(content, expected, label) {
  if (!content.includes(expected)) {
    throw new Error(`${label} missing ${JSON.stringify(expected)}.\n${content}`);
  }
}
