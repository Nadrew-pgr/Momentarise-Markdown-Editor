import { readFile } from "node:fs/promises";

import { JSDOM } from "jsdom";
import { DOMParser as ProseMirrorDOMParser, DOMSerializer, Fragment } from "prosemirror-model";

const rich = await import("../packages/md-rich-prosemirror/dist/index.js");

const source = [
  "- [x] Done",
  "- [ ] Next",
  "  - [x] Nested",
  "",
  "3. [x] Ordered done",
  "4. [ ] Ordered next",
  ""
].join("\n");
const state = rich.createRichMarkdownState(source, { dialect: "momentarise-enhanced" });
const schema = state.editorState.schema;
const dom = new JSDOM("<main></main>");
const root = dom.window.document.querySelector("main");
root.append(DOMSerializer.fromSchema(schema).serializeFragment(state.editorState.doc.content, {
  document: dom.window.document
}));

for (const list of root.querySelectorAll("ul, ol")) {
  const directChildTags = [...list.children].map((child) => child.tagName);
  assert(
    directChildTags.every((tagName) => tagName === "LI"),
    `${list.tagName} direct children must all be LI, got ${directChildTags.join(", ")}`
  );
}

const todoElements = [...root.querySelectorAll('li[data-type="todo-item"]')];
assertEqual(todoElements.length, 5, "all task nodes use native LI roots");
for (const todoElement of todoElements) {
  const button = todoElement.querySelector(':scope > [data-todo-row="true"] > [data-todo-toggle="true"]');
  const content = todoElement.querySelector(':scope > [data-todo-row="true"] > [data-todo-content="true"]');
  assert(button instanceof dom.window.HTMLButtonElement, "task toggle is a direct native button");
  assertEqual(button.getAttribute("type"), "button", "task toggle avoids form submission");
  assertEqual(button.getAttribute("contenteditable"), "false", "task toggle stays outside editable content");
  assert(content instanceof dom.window.HTMLElement, "task content has explicit parse boundary");
}

const globals = {
  HTMLElement: globalThis.HTMLElement,
  HTMLOListElement: globalThis.HTMLOListElement
};
try {
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.HTMLOListElement = dom.window.HTMLOListElement;
  const parsed = ProseMirrorDOMParser.fromSchema(schema).parse(root);
  assertEqual(parsed.textContent, state.editorState.doc.textContent, "DOM parse excludes visual check glyphs");
  assert(!parsed.textContent.includes("\u2713"), "DOM parse never imports check glyph");
  assertEqual(collectNodes(parsed, "todo_item").length, 5, "specialized LI parse rule wins over list_item");
  assertEqual(collectNodes(parsed, "list_item").length, 0, "task LI never degrades into generic list_item");

  const legacyDom = new JSDOM([
    "<main><ul>",
    '<div data-checked="true" data-type="todo-item">',
    '<button aria-label="Mark todo incomplete" aria-pressed="true" data-todo-toggle="true">\u2713</button>',
    '<div data-todo-content="true"><p>Legacy task</p></div>',
    "</div>",
    "</ul></main>"
  ].join(""));
  const legacyRoot = legacyDom.window.document.querySelector("main");
  globalThis.HTMLElement = legacyDom.window.HTMLElement;
  const legacyParsed = ProseMirrorDOMParser.fromSchema(schema).parse(legacyRoot);
  assertNodePath(legacyParsed, ["bullet_list", "todo_item", "paragraph"], "legacy task wrapper");
  assertEqual(legacyParsed.textContent, "Legacy task", "legacy task parse excludes control text");
  assertEqual(legacyParsed.firstChild.firstChild.attrs.checked, true, "legacy task checked state");
} finally {
  globalThis.HTMLElement = globals.HTMLElement;
  globalThis.HTMLOListElement = globals.HTMLOListElement;
}

const commandState = rich.applyRichMarkdownCommand(rich.createRichMarkdownState("Command task\n"), "todo");
assertNodePath(commandState.editorState.doc, ["bullet_list", "todo_item", "paragraph"], "todo command");
assertEqual(rich.serializeRichMarkdownState(commandState).content, "- [ ] Command task\n", "todo command Markdown");

const inputState = typeIntoRichState(rich.createRichMarkdownState(""), "- [x] Typed task");
assertNodePath(inputState.editorState.doc, ["bullet_list", "todo_item", "paragraph"], "todo input rule");
assertEqual(rich.serializeRichMarkdownState(inputState).content, "- [x] Typed task\n", "todo input Markdown");

const orphanTodo = schema.nodes.todo_item.create({ checked: false }, schema.nodes.paragraph.create());
assert(
  !schema.topNodeType.validContent(Fragment.from(orphanTodo)),
  "schema must reject orphan top-level todo_item nodes"
);

for (const fixturePath of [
  "fixtures/018-nested-lists-todos/input.md",
  "fixtures/027-task-list-footnote-editing/input.md"
]) {
  const fixture = await readFile(fixturePath, "utf8");
  const fixtureState = rich.createRichMarkdownState(fixture, { dialect: "momentarise-enhanced" });
  assertEqual(rich.serializeRichMarkdownState(fixtureState).content, fixture, `${fixturePath} source identity`);
}

console.log("MME-0077 rich todo DOM semantics passed.");

function typeIntoRichState(stateValue, text) {
  let editorState = stateValue.editorState;
  for (const character of text) {
    editorState = editorState.applyTransaction(editorState.tr.insertText(character)).state;
  }
  return {
    ...stateValue,
    editorState
  };
}

function collectNodes(node, typeName) {
  const matches = [];
  node.descendants((child) => {
    if (child.type.name === typeName) {
      matches.push(child);
    }
  });
  return matches;
}

function assertNodePath(rootNode, expectedPath, label) {
  let node = rootNode;
  for (const expectedType of expectedPath) {
    node = node.firstChild;
    if (!node || node.type.name !== expectedType) {
      throw new Error(
        `${label} expected ${expectedPath.join(" > ")}.\n${JSON.stringify(rootNode.toJSON(), null, 2)}`
      );
    }
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}.`);
  }
}
