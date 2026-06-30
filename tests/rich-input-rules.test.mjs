const rich = await import("../packages/md-rich-prosemirror/dist/index.js");
const { NodeSelection, TextSelection } = await import("prosemirror-state");

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
assertTypedMarkdown("- [ ] Task", "- [ ] Task", "unchecked todo input rule", ["todo_item", "paragraph"]);
assertTypedMarkdown("- [x] Done", "- [x] Done", "checked todo input rule", ["todo_item", "paragraph"]);
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
assertNodePath(continuedTodo, ["todo_item", "paragraph"], "todo Enter first item node shape");
assertRootChildTypes(continuedTodo, ["todo_item", "todo_item"], "todo Enter creates adjacent item");
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

function assertIncludes(content, expected, label) {
  if (!content.includes(expected)) {
    throw new Error(`${label} missing ${JSON.stringify(expected)}.\n${content}`);
  }
}
