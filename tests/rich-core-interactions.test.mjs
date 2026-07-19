const rich = await import("../packages/md-rich-prosemirror/dist/index.js");
const { NodeSelection, TextSelection } = await import("prosemirror-state");

const requiredExports = [
  "canInsertParagraphAfterFinalBlock",
  "insertParagraphAfterFinalBlock"
];

for (const exportName of requiredExports) {
  if (typeof rich[exportName] !== "function") {
    throw new Error(`Missing MME-0042 rich interaction export: ${exportName}`);
  }
}

const finalInsertionFixtures = [
  {
    label: "final code fence",
    source: ["# Code boundary", "", "```ts", "console.log(1)", "```", ""].join("\n"),
    preserved: "```ts\nconsole.log(1)\n```"
  },
  {
    label: "final preserved table",
    source: ["# Table boundary", "", "| Feature | State |", "| -- | -- |", "| Final table | preserved |", ""].join("\n"),
    preserved: "| Feature | State |\n| -- | -- |\n| Final table | preserved |"
  },
  {
    label: "final callout opaque block",
    source: ["# Callout boundary", "", "> [!NOTE] Boundary", "> Stay raw.", ""].join("\n"),
    preserved: "> [!NOTE] Boundary\n> Stay raw."
  },
  {
    label: "final raw HTML block",
    source: ["# HTML boundary", "", '<section data-safe="true">', "Raw HTML block", "</section>", ""].join("\n"),
    preserved: '<section data-safe="true">\nRaw HTML block\n</section>'
  },
  {
    label: "final inserted media placeholder",
    source: ["# Media boundary", "", "![Hero](./hero.png)", ""].join("\n"),
    preserved: "![Hero](./hero.png)"
  }
];

for (const fixture of finalInsertionFixtures) {
  const state = rich.createRichMarkdownState(fixture.source, {
    dialect: "momentarise-enhanced"
  });
  if (!rich.canInsertParagraphAfterFinalBlock(state)) {
    throw new Error(`${fixture.label} should allow final paragraph insertion.`);
  }
  const inserted = rich.insertParagraphAfterFinalBlock(state, "After final block");
  const output = rich.serializeRichMarkdownState(inserted).content;
  assertIncludes(output, fixture.preserved, `${fixture.label} must preserve original final block bytes`);
  assertIncludes(output, "After final block", `${fixture.label} must append a paragraph after the final block`);
  assertSelectionInParagraph(inserted, {
    label: `${fixture.label} final insertion selection`,
    parentOffset: "After final block".length,
    textContent: "After final block"
  });
  assertAppendsParagraphWithoutChangingPrefix(fixture.source, output, fixture.label);
}

for (const fixture of finalInsertionFixtures.filter((item) => item.label !== "final code fence")) {
  const selected = selectFinalTopLevelBlock(
    rich.createRichMarkdownState(fixture.source, {
      dialect: "momentarise-enhanced"
    })
  );
  const moved = pressKeyInRichState(selected, "ArrowDown");
  const output = rich.serializeRichMarkdownState(moved).content;
  assertIncludes(output, fixture.preserved, `${fixture.label} ArrowDown must preserve original block bytes`);
  assertRootChildType(moved, "paragraph", `${fixture.label} ArrowDown must insert a final paragraph`);
  assertSelectionInParagraph(moved, {
    label: `${fixture.label} ArrowDown selection`,
    parentOffset: 0,
    textContent: ""
  });
}

const pastedTodoState = setCursorAfterText(
  rich.createRichMarkdownState(["- Parent", "  - [ ] Child", ""].join("\n")),
  "Child"
);
const pastedTodo = pastePlainTextIntoRichState(pastedTodoState, " pasted");
assertIncludes(
  rich.serializeRichMarkdownState(pastedTodo).content,
  "- Parent\n  - [ ] Child pasted",
  "plain-text paste inside nested todo must preserve todo nesting"
);
const continuedTodo = pressKeyInRichState(pastedTodo, "Enter");
assertIncludes(
  rich.serializeRichMarkdownState(continuedTodo).content,
  "- Parent\n  - [ ] Child pasted\n  - [ ]",
  "Enter after pasted nested todo keeps same nested todo level"
);
const undoneTodoPaste = pressUndoInRichState(pastedTodo);
assertIncludes(
  rich.serializeRichMarkdownState(undoneTodoPaste).content,
  "- Parent\n  - [ ] Child",
  "Undo after nested todo paste restores previous content"
);
const redoneTodoPaste = pressRedoInRichState(undoneTodoPaste);
assertIncludes(
  rich.serializeRichMarkdownState(redoneTodoPaste).content,
  "- Parent\n  - [ ] Child pasted",
  "Redo after nested todo paste reapplies pasted content"
);

const pasteTransform = rich
  .createMomentariseRichPlugins()
  .map((plugin) => plugin.props.transformPastedHTML)
  .find((transform) => typeof transform === "function");
if (!pasteTransform) {
  throw new Error("Rich plugins must keep transformPastedHTML for paste sanitization.");
}
const sanitizedPaste = pasteTransform('<p onclick="bad()">Keep <strong>text</strong></p><script>alert(1)</script>');
if (/<script/i.test(sanitizedPaste) || /\son[a-z]+\s*=/i.test(sanitizedPaste) || !sanitizedPaste.includes("Keep")) {
  throw new Error(`Rich paste sanitizer must preserve safe text and strip executable HTML:\n${sanitizedPaste}`);
}

function pastePlainTextIntoRichState(state, text) {
  const transaction = state.editorState.tr.insertText(text).setMeta("paste", true);
  return {
    ...state,
    editorState: state.editorState.apply(transaction)
  };
}

function pressKeyInRichState(state, key, eventOverrides = {}) {
  let editorState = state.editorState;
  const event = {
    altKey: false,
    ctrlKey: false,
    key,
    metaKey: false,
    preventDefault() {},
    shiftKey: false
  };
  Object.assign(event, eventOverrides);
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

function pressUndoInRichState(state) {
  return pressKeyInRichState(state, "z", {
    keyCode: 90,
    metaKey: true,
    which: 90
  });
}

function pressRedoInRichState(state) {
  return pressKeyInRichState(state, "Z", {
    keyCode: 90,
    metaKey: true,
    shiftKey: true,
    which: 90
  });
}

function selectFinalTopLevelBlock(state) {
  const ranges = rich.richTopLevelBlockRanges(state.editorState);
  const finalRange = ranges.at(-1);
  if (!finalRange) {
    throw new Error("Expected a final top-level block.");
  }
  return {
    ...state,
    editorState: state.editorState.apply(
      state.editorState.tr.setSelection(NodeSelection.create(state.editorState.doc, finalRange.from))
    )
  };
}

function setCursorAfterText(state, search) {
  let position = null;
  state.editorState.doc.descendants((node, pos) => {
    if (!node.isText || typeof node.text !== "string") {
      return true;
    }
    const index = node.text.indexOf(search);
    if (index < 0) {
      return true;
    }
    position = pos + index + search.length;
    return false;
  });
  if (position === null) {
    throw new Error(`Could not find text for cursor placement: ${search}`);
  }
  return {
    ...state,
    editorState: state.editorState.apply(
      state.editorState.tr.setSelection(TextSelection.create(state.editorState.doc, position))
    )
  };
}

function assertAppendsParagraphWithoutChangingPrefix(source, output, label) {
  const expectedPrefix = source.trimEnd();
  if (!output.startsWith(expectedPrefix)) {
    throw new Error(`${label} changed bytes before the inserted paragraph.\nExpected prefix:\n${expectedPrefix}\nOutput:\n${output}`);
  }
  const suffix = output.slice(expectedPrefix.length);
  if (!/^\n\nAfter final block\n?$/.test(suffix)) {
    throw new Error(`${label} must only append one paragraph after the preserved prefix.\nSuffix:\n${JSON.stringify(suffix)}\nOutput:\n${output}`);
  }
}

function assertIncludes(content, expected, label) {
  if (!content.includes(expected)) {
    throw new Error(`${label} missing ${JSON.stringify(expected)}.\n${content}`);
  }
}

function assertRootChildType(state, expectedType, label) {
  const finalChild = state.editorState.doc.lastChild;
  if (!finalChild || finalChild.type.name !== expectedType) {
    throw new Error(`${label} expected final root child ${expectedType}.\n${JSON.stringify(state.editorState.doc.toJSON(), null, 2)}`);
  }
}

function assertSelectionInParagraph(state, options) {
  const { label, parentOffset, textContent } = options;
  const selection = state.editorState.selection;
  if (!(selection instanceof TextSelection)) {
    throw new Error(`${label} expected TextSelection.\n${JSON.stringify(state.editorState.doc.toJSON(), null, 2)}`);
  }
  if (selection.$from.parent.type.name !== "paragraph" || selection.$from.parentOffset !== parentOffset || selection.$from.parent.textContent !== textContent) {
    throw new Error(
      `${label} expected paragraph ${JSON.stringify(textContent)} offset ${parentOffset}, got ${selection.$from.parent.type.name} ${JSON.stringify(
        selection.$from.parent.textContent
      )} offset ${selection.$from.parentOffset}.\n${JSON.stringify(state.editorState.doc.toJSON(), null, 2)}`
    );
  }
}
