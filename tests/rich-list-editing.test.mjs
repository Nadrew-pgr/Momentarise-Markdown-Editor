const rich = await import("../packages/md-rich-prosemirror/dist/index.js");
const { TextSelection } = await import("prosemirror-state");
const { readFileSync } = await import("node:fs");

const bullet = typeIntoRichState(rich.createRichMarkdownState(""), "- Alpha");
const bulletContinued = pressKeyInRichState(bullet, "Enter");
assertSerializedIncludes(bulletContinued, "- Alpha\n-", "Enter in bullet item creates a sibling bullet item");
assertListChildTypes(bulletContinued, ["list_item", "list_item"], "bullet Enter sibling shape");
assertFirstListItemParagraphCount(bulletContinued, 1, "bullet Enter must not create a second paragraph inside the same item");
assertSelectionInListItem(bulletContinued, {
  itemIndex: 1,
  label: "bullet Enter places the caret in the new sibling item",
  parentOffset: 0
});

const bulletBeforeHeading = pressKeyInRichState(setCursorAfterText(rich.createRichMarkdownState("- Alpha\n## Next\n"), "Alpha"), "Enter");
assertSerializedIncludes(bulletBeforeHeading, "- Alpha\n-\n## Next", "Enter before a following heading creates an empty sibling before the heading");
assertSelectionInListItem(bulletBeforeHeading, {
  itemIndex: 1,
  label: "bullet Enter before heading keeps caret in the new empty item",
  parentOffset: 0
});

const bulletMidText = setCursorAfterText(rich.createRichMarkdownState("- Alpha beta\n"), "Alpha ");
const bulletMidSplit = pressKeyInRichState(bulletMidText, "Enter");
assertSerializedIncludes(bulletMidSplit, "- Alpha\n- beta", "Enter in middle of bullet item carries trailing text to sibling item");
assertSelectionInListItem(bulletMidSplit, {
  itemIndex: 1,
  label: "bullet mid-item Enter places caret before the carried trailing text",
  parentOffset: 0
});

const bulletExit = pressKeyInRichState(bulletContinued, "Enter");
assertRootChildTypes(bulletExit, ["bullet_list", "paragraph"], "Enter on empty bullet exits the list");

const ordered = typeIntoRichState(rich.createRichMarkdownState(""), "1. One");
const orderedContinued = pressKeyInRichState(ordered, "Enter");
assertSerializedIncludes(orderedContinued, "1. One\n2.", "Enter in ordered item creates numbered sibling item");
assertListChildTypes(orderedContinued, ["list_item", "list_item"], "ordered Enter sibling shape");

const checkedTodo = typeIntoRichState(rich.createRichMarkdownState(""), "- [x] Done");
const checkedTodoContinued = pressKeyInRichState(checkedTodo, "Enter");
assertSerializedIncludes(checkedTodoContinued, "- [x] Done\n- [ ]", "Enter after checked todo creates unchecked sibling todo");
assertRootChildTypes(checkedTodoContinued, ["todo_item", "todo_item"], "todo Enter sibling shape");
assertSelectionInListItem(checkedTodoContinued, {
  itemIndex: 1,
  itemType: "todo_item",
  label: "todo Enter places the caret in the new unchecked todo item",
  parentOffset: 0
});

const nestedBullet = pressKeyInRichState(setCursorAfterText(rich.createRichMarkdownState("- Alpha\n- Beta\n"), "Beta"), "Tab");
assertSerializedIncludes(nestedBullet, "- Alpha\n  - Beta", "Tab nests bullet item under previous sibling");
assertRoundTrips(nestedBullet, "nested bullet after Tab");

const nestedEmptyBullet = pressKeyInRichState(bulletContinued, "Tab");
assertSerializedIncludes(nestedEmptyBullet, "- Alpha\n  -", "Tab nests an empty bullet item under previous sibling");
assertSelectionInListItemAtPath(nestedEmptyBullet, {
  itemPath: [0, 0],
  label: "Tab on empty second bullet keeps caret inside nested empty item",
  parentOffset: 0
});

const typedNestedEmptyBullet = typeIntoRichState(nestedEmptyBullet, "regftez");
const nextNestedEmptyBullet = pressKeyInRichState(typedNestedEmptyBullet, "Enter");
assertSerializedIncludes(nextNestedEmptyBullet, "- Alpha\n  - regftez\n  -", "Enter in nested bullet creates same-level nested sibling");
assertSelectionInListItemAtPath(nextNestedEmptyBullet, {
  itemPath: [0, 1],
  label: "Enter after nested bullet text keeps caret inside next nested item",
  parentOffset: 0
});

const exitedNestedEmptyBullet = pressKeyInRichState(nextNestedEmptyBullet, "Enter");
assertSerializedIncludes(exitedNestedEmptyBullet, "- Alpha\n  - regftez\n-", "Enter on empty nested bullet exits to parent list level");
assertSelectionInListItemAtPath(exitedNestedEmptyBullet, {
  itemPath: [1],
  label: "Enter on empty nested bullet keeps caret in parent-level empty item",
  parentOffset: 0
});

const backspaceAfterNestedExit = pressKeyInRichState(exitedNestedEmptyBullet, "Backspace");
assertSerializedIncludes(backspaceAfterNestedExit, "- Alpha\n  - regftez", "Backspace after nested exit preserves nested list content");
assertRootChildTypes(backspaceAfterNestedExit, ["bullet_list"], "Backspace after nested exit keeps the list");
assertSelectionInListItemAtPath(backspaceAfterNestedExit, {
  itemPath: [0, 0],
  label: "Backspace at empty parent after nested list leaves caret at the end of the nested child",
  parentOffset: "regftez".length
});

const deepNestedFromTyping = typeIntoRichState(
  pressKeyInRichState(
    typeIntoRichState(
      pressKeyInRichState(
        pressKeyInRichState(
          typeIntoRichState(
            pressKeyInRichState(
              pressKeyInRichState(typeIntoRichState(rich.createRichMarkdownState(""), "- Parent"), "Enter"),
              "Tab"
            ),
            "Child"
          ),
          "Enter"
        ),
        "Tab"
      ),
      "Grandchild"
    ),
    "Enter"
  ),
  "Next grandchild"
);
assertSerializedIncludes(
  deepNestedFromTyping,
  "- Parent\n  - Child\n    - Grandchild\n    - Next grandchild",
  "typing flow creates a grandchild list under a child item"
);

const deepGrandchildTextDeleted = pressKeyInRichState(selectText(deepNestedFromTyping, "Next grandchild"), "Backspace");
assertSerializedIncludes(
  deepGrandchildTextDeleted,
  "- Parent\n  - Child\n    - Grandchild\n    -",
  "deleting grandchild text leaves only that grandchild item empty"
);
assertSelectionInListItemAtPath(deepGrandchildTextDeleted, {
  itemPath: [0, 0, 1],
  label: "deleting grandchild text keeps caret in the emptied grandchild item",
  parentOffset: 0
});

const deepGrandchildRemoved = pressKeyInRichState(deepGrandchildTextDeleted, "Backspace");
assertSerializedIncludes(
  deepGrandchildRemoved,
  "- Parent\n  - Child\n    - Grandchild",
  "Backspace on empty grandchild removes only that grandchild item"
);
assertSelectionInListItemAtPath(deepGrandchildRemoved, {
  itemPath: [0, 0, 0],
  label: "Backspace on empty grandchild places caret at previous grandchild",
  parentOffset: "Grandchild".length
});
assertRoundTrips(deepGrandchildRemoved, "deep grandchild deletion round-trip");

const singleDeepNestedFromTyping = typeIntoRichState(
  pressKeyInRichState(
    pressKeyInRichState(
      typeIntoRichState(
        pressKeyInRichState(
          pressKeyInRichState(typeIntoRichState(rich.createRichMarkdownState(""), "- Parent"), "Enter"),
          "Tab"
        ),
        "Child"
      ),
      "Enter"
    ),
    "Tab"
  ),
  "Only grandchild"
);
assertSerializedIncludes(
  singleDeepNestedFromTyping,
  "- Parent\n  - Child\n    - Only grandchild",
  "typing flow creates a single grandchild item"
);

const singleGrandchildTextDeleted = pressKeyInRichState(selectText(singleDeepNestedFromTyping, "Only grandchild"), "Backspace");
assertSerializedIncludes(
  singleGrandchildTextDeleted,
  "- Parent\n  - Child\n    -",
  "deleting only grandchild text leaves only that grandchild item empty"
);

const singleGrandchildRemoved = pressKeyInRichState(singleGrandchildTextDeleted, "Backspace");
assertSerializedIncludes(
  singleGrandchildRemoved,
  "- Parent\n  - Child",
  "Backspace on the only empty grandchild removes only the child list"
);
assertSelectionInListItemAtPath(singleGrandchildRemoved, {
  itemPath: [0, 0],
  label: "Backspace on only empty grandchild places caret at the parent child",
  parentOffset: "Child".length
});
assertRoundTrips(singleGrandchildRemoved, "single deep grandchild deletion round-trip");

const nestedOrdered = pressKeyInRichState(setCursorAfterText(rich.createRichMarkdownState("1. One\n2. Two\n"), "Two"), "Tab");
assertSerializedIncludes(nestedOrdered, "1. One\n   1. Two", "Tab nests ordered item under previous sibling");
assertRoundTrips(nestedOrdered, "nested ordered after Tab");

const nestedTodo = pressKeyInRichState(setCursorAfterText(rich.createRichMarkdownState("- Parent\n- [ ] Child\n"), "Child"), "Tab");
assertSerializedIncludes(nestedTodo, "- Parent\n  - [ ] Child", "Tab nests todo item under previous list item");
assertRoundTrips(nestedTodo, "nested todo after Tab");

const outdentedBullet = pressKeyInRichState(setCursorAfterText(rich.createRichMarkdownState("- Alpha\n  - Beta\n"), "Beta"), "Shift-Tab");
assertSerializedIncludes(outdentedBullet, "- Alpha\n- Beta", "Shift+Tab outdents nested bullet item");

const outdentedTodo = pressKeyInRichState(setCursorAfterText(rich.createRichMarkdownState("- Parent\n  - [ ] Child\n"), "Child"), "Shift-Tab");
assertSerializedIncludes(outdentedTodo, "- Parent\n- [ ] Child", "Shift+Tab outdents nested todo item");

const liftedFirstBullet = pressKeyInRichState(setCursorBeforeText(rich.createRichMarkdownState("- Alpha\n- Beta\n"), "Alpha"), "Backspace");
assertRootChildTypes(liftedFirstBullet, ["paragraph", "bullet_list"], "Backspace at first item start lifts item out of list");
assertSerializedIncludes(liftedFirstBullet, "Alpha\n\n- Beta", "Backspace lifted first item serialization");
assertSelectionInParagraph(liftedFirstBullet, {
  label: "Backspace at first item start leaves the caret in the lifted paragraph",
  parentOffset: 0,
  textContent: "Alpha"
});

const mergedSecondBullet = pressKeyInRichState(setCursorBeforeText(rich.createRichMarkdownState("- Alpha\n- Beta\n"), "Beta"), "Backspace");
assertSerializedIncludes(mergedSecondBullet, "- AlphaBeta", "Backspace at later item start merges with previous item");
assertSelectionInListItem(mergedSecondBullet, {
  itemIndex: 0,
  label: "Backspace merge leaves the caret at the merge boundary",
  parentOffset: "Alpha".length
});

for (const [input, expectedPath, label] of [
  ["#### Details", ["heading"], "heading 4 input rule"],
  ["##### Details", ["heading"], "heading 5 input rule"],
  ["###### Details", ["heading"], "heading 6 input rule"],
  ["* Alt bullet", ["bullet_list", "list_item", "paragraph"], "asterisk bullet input rule"],
  ["+ Plus bullet", ["bullet_list", "list_item", "paragraph"], "plus bullet input rule"]
]) {
  const state = typeIntoRichState(rich.createRichMarkdownState(""), input);
  assertNodePath(state, expectedPath, label);
}

const dashBeforeExistingWord = typeIntoRichState(setCursorBeforeText(rich.createRichMarkdownState("Existing\n"), "Existing"), "- ");
assertSerializedIncludes(dashBeforeExistingWord, "- Existing", "dash-space before an existing line turns it into a bullet item");
assertSelectionInListItemAtPath(dashBeforeExistingWord, {
  itemPath: [0],
  label: "dash-space before existing text keeps caret before the existing word",
  parentOffset: 0
});

const undoHeading = pressUndoInRichState(typeIntoRichState(rich.createRichMarkdownState(""), "#### "));
assertTextContent(undoHeading, "#### ", "Undo after heading input rule restores literal prefix");
assertNodePath(undoHeading, ["paragraph"], "Undo after heading input rule paragraph shape");

const undoBullet = pressUndoInRichState(typeIntoRichState(rich.createRichMarkdownState(""), "* "));
assertTextContent(undoBullet, "* ", "Undo after bullet input rule restores literal prefix");
assertNodePath(undoBullet, ["paragraph"], "Undo after bullet input rule paragraph shape");

const nestedFixture = rich.createRichMarkdownState(readFixture("fixtures/018-nested-lists-todos/input.md"));
assertRoundTrips(nestedFixture, "nested fixture initial round-trip");

function readFixture(path) {
  return readFileSync(path, "utf8");
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
    ctrlKey: false,
    keyCode: 90,
    metaKey: true,
    which: 90
  });
}

function setCursorAfterText(state, search) {
  return setCursorRelativeToText(state, search, search.length);
}

function setCursorBeforeText(state, search) {
  return setCursorRelativeToText(state, search, 0);
}

function selectText(state, search) {
  let from = null;
  state.editorState.doc.descendants((node, pos) => {
    if (!node.isText || typeof node.text !== "string") {
      return true;
    }
    const index = node.text.indexOf(search);
    if (index < 0) {
      return true;
    }
    from = pos + index;
    return false;
  });
  if (from === null) {
    throw new Error(`Could not find text for selection: ${search}`);
  }
  return {
    ...state,
    editorState: state.editorState.apply(
      state.editorState.tr.setSelection(TextSelection.create(state.editorState.doc, from, from + search.length))
    )
  };
}

function setCursorRelativeToText(state, search, offset) {
  let position = null;
  state.editorState.doc.descendants((node, pos) => {
    if (!node.isText || typeof node.text !== "string") {
      return true;
    }
    const index = node.text.indexOf(search);
    if (index < 0) {
      return true;
    }
    position = pos + index + offset;
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

function assertSerializedIncludes(state, expected, label) {
  const content = rich.serializeRichMarkdownState(state).content;
  if (!content.includes(expected)) {
    throw new Error(`${label} missing ${JSON.stringify(expected)}.\n${content}\n${JSON.stringify(state.editorState.doc.toJSON(), null, 2)}`);
  }
}

function assertTextContent(state, expected, label) {
  const actual = state.editorState.doc.textContent;
  if (actual !== expected) {
    throw new Error(`${label} expected text ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}.\n${JSON.stringify(state.editorState.doc.toJSON(), null, 2)}`);
  }
}

function assertRootChildTypes(state, expectedTypes, label) {
  const actualTypes = [];
  state.editorState.doc.forEach((child) => {
    actualTypes.push(child.type.name);
  });
  if (actualTypes.join(",") !== expectedTypes.join(",")) {
    throw new Error(`${label} expected ${expectedTypes.join(",")}.\n${actualTypes.join(",")}\n${JSON.stringify(state.editorState.doc.toJSON(), null, 2)}`);
  }
}

function assertListChildTypes(state, expectedTypes, label) {
  const list = state.editorState.doc.firstChild;
  if (!list || !["bullet_list", "ordered_list"].includes(list.type.name)) {
    throw new Error(`${label} expected root list.\n${JSON.stringify(state.editorState.doc.toJSON(), null, 2)}`);
  }
  const actualTypes = [];
  list.forEach((child) => {
    actualTypes.push(child.type.name);
  });
  if (actualTypes.join(",") !== expectedTypes.join(",")) {
    throw new Error(`${label} expected ${expectedTypes.join(",")}.\n${actualTypes.join(",")}\n${JSON.stringify(state.editorState.doc.toJSON(), null, 2)}`);
  }
}

function assertFirstListItemParagraphCount(state, expectedCount, label) {
  const list = state.editorState.doc.firstChild;
  const item = list?.firstChild;
  if (!item) {
    throw new Error(`${label} expected first list item.\n${JSON.stringify(state.editorState.doc.toJSON(), null, 2)}`);
  }
  let paragraphCount = 0;
  item.forEach((child) => {
    if (child.type.name === "paragraph") {
      paragraphCount += 1;
    }
  });
  if (paragraphCount !== expectedCount) {
    throw new Error(`${label} expected ${expectedCount} paragraphs in first item, got ${paragraphCount}.\n${JSON.stringify(state.editorState.doc.toJSON(), null, 2)}`);
  }
}

function assertSelectionInListItem(state, options) {
  const {
    itemIndex,
    itemType = "list_item",
    label,
    parentOffset
  } = options;
  const { $from } = state.editorState.selection;
  const actual = selectionPath($from);
  if ($from.parent.type.name !== "paragraph" || $from.parentOffset !== parentOffset) {
    throw new Error(`${label} expected paragraph offset ${parentOffset}, got ${$from.parent.type.name} offset ${$from.parentOffset}.\n${actual}\n${JSON.stringify(state.editorState.doc.toJSON(), null, 2)}`);
  }
  let found = false;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === itemType && $from.index(depth - 1) === itemIndex) {
      found = true;
      break;
    }
  }
  if (!found) {
    throw new Error(`${label} expected selection inside ${itemType} at index ${itemIndex}.\n${actual}\n${JSON.stringify(state.editorState.doc.toJSON(), null, 2)}`);
  }
}

function assertSelectionInListItemAtPath(state, options) {
  const {
    itemPath,
    itemType = "list_item",
    label,
    parentOffset
  } = options;
  const { $from } = state.editorState.selection;
  const actualPath = selectionItemPath($from);
  if ($from.parent.type.name !== "paragraph" || $from.parentOffset !== parentOffset) {
    throw new Error(`${label} expected paragraph offset ${parentOffset}, got ${$from.parent.type.name} offset ${$from.parentOffset}.\n${selectionPath($from)}\nitem path ${JSON.stringify(actualPath)}\n${JSON.stringify(state.editorState.doc.toJSON(), null, 2)}`);
  }
  const selectedItemType = selectedListItemType($from);
  if (selectedItemType !== itemType || actualPath.join(",") !== itemPath.join(",")) {
    throw new Error(`${label} expected selection inside ${itemType} path ${JSON.stringify(itemPath)}, got ${selectedItemType ?? "none"} path ${JSON.stringify(actualPath)}.\n${selectionPath($from)}\n${JSON.stringify(state.editorState.doc.toJSON(), null, 2)}`);
  }
}

function selectionItemPath($from) {
  const itemPath = [];
  for (let depth = 1; depth <= $from.depth; depth += 1) {
    const node = $from.node(depth);
    const parent = $from.node(depth - 1);
    if ((node.type.name === "list_item" || node.type.name === "todo_item") && (parent.type.name === "bullet_list" || parent.type.name === "ordered_list")) {
      itemPath.push($from.index(depth - 1));
    }
  }
  return itemPath;
}

function selectedListItemType($from) {
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type.name === "list_item" || node.type.name === "todo_item") {
      return node.type.name;
    }
  }
  return null;
}

function assertSelectionInParagraph(state, options) {
  const { label, parentOffset, textContent } = options;
  const { $from } = state.editorState.selection;
  if ($from.parent.type.name !== "paragraph" || $from.parentOffset !== parentOffset || $from.parent.textContent !== textContent) {
    throw new Error(`${label} expected paragraph ${JSON.stringify(textContent)} offset ${parentOffset}, got ${$from.parent.type.name} ${JSON.stringify($from.parent.textContent)} offset ${$from.parentOffset}.\n${selectionPath($from)}\n${JSON.stringify(state.editorState.doc.toJSON(), null, 2)}`);
  }
}

function selectionPath($from) {
  const parts = [];
  for (let depth = 0; depth <= $from.depth; depth += 1) {
    parts.push(`${depth}:${$from.node(depth).type.name}[${$from.index(depth)}]`);
  }
  return parts.join(" > ");
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

function assertRoundTrips(state, label) {
  const serialized = rich.serializeRichMarkdownState(state).content;
  const reparsed = rich.createRichMarkdownState(serialized, {
    schema: state.schema
  });
  if (!state.editorState.doc.eq(reparsed.editorState.doc)) {
    throw new Error(`${label} must round-trip through rich serialization.\n${serialized}\nOriginal:\n${JSON.stringify(state.editorState.doc.toJSON(), null, 2)}\nReparsed:\n${JSON.stringify(reparsed.editorState.doc.toJSON(), null, 2)}`);
  }
}
