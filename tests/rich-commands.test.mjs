const rich = await import("../packages/md-rich-prosemirror/dist/index.js");

const requiredExports = [
  "applyRichMarkdownCommand",
  "filterRichMarkdownCommands",
  "richCommandRegistry",
  "runRichMarkdownCommand",
  "selectFirstRichText"
];

for (const exportName of requiredExports) {
  if (!(exportName in rich)) {
    throw new Error(`Missing rich command export: ${exportName}`);
  }
}

const commandIds = new Set(rich.richCommandRegistry.map((command) => command.id));
for (const id of [
  "paragraph",
  "heading1",
  "heading2",
  "heading3",
  "todo",
  "bulletList",
  "orderedList",
  "blockquote",
  "codeBlock",
  "callout",
  "image",
  "divider",
  "bold",
  "italic",
  "inlineCode",
  "link"
]) {
  if (!commandIds.has(id)) {
    throw new Error(`Missing V0 rich command: ${id}`);
  }
}

assertMatchIds("/h1", ["heading1"]);
assertMatchIds("H1", ["heading1"]);
assertMatchIds("heading", ["heading1", "heading2", "heading3"]);
assertMatchIds("/todo", ["todo"]);

const headingState = rich.applyRichMarkdownCommand(rich.createRichMarkdownState("Title\n"), "heading1");
assertIncludes(rich.serializeRichMarkdownState(headingState).content, "# Title", "heading command output");

const heading2State = rich.applyRichMarkdownCommand(rich.createRichMarkdownState("Subtitle\n"), "heading2");
assertIncludes(rich.serializeRichMarkdownState(heading2State).content, "## Subtitle", "heading2 command output");

const heading3State = rich.applyRichMarkdownCommand(rich.createRichMarkdownState("Minor\n"), "heading3");
assertIncludes(rich.serializeRichMarkdownState(heading3State).content, "### Minor", "heading3 command output");

const paragraphState = rich.applyRichMarkdownCommand(heading3State, "paragraph");
assertIncludes(rich.serializeRichMarkdownState(paragraphState).content, "Minor", "paragraph command output");

const todoState = rich.applyRichMarkdownCommand(rich.createRichMarkdownState("Task body\n"), "todo");
assertIncludes(rich.serializeRichMarkdownState(todoState).content, "- [ ] Task body", "todo command output");

const bulletState = rich.applyRichMarkdownCommand(rich.createRichMarkdownState("Bullet body\n"), "bulletList");
assertIncludes(rich.serializeRichMarkdownState(bulletState).content, "- Bullet body", "bullet command output");

const orderedState = rich.applyRichMarkdownCommand(rich.createRichMarkdownState("Ordered body\n"), "orderedList");
assertIncludes(rich.serializeRichMarkdownState(orderedState).content, "1. Ordered body", "ordered command output");

const quoteState = rich.applyRichMarkdownCommand(rich.createRichMarkdownState("Quoted body\n"), "blockquote");
assertIncludes(rich.serializeRichMarkdownState(quoteState).content, "> Quoted body", "blockquote command output");

const codeState = rich.applyRichMarkdownCommand(rich.createRichMarkdownState("const value = 1;\n"), "codeBlock", {
  language: "ts"
});
assertIncludes(rich.serializeRichMarkdownState(codeState).content, "```ts\nconst value = 1;\n```", "code block output");

const dividerState = rich.applyRichMarkdownCommand(rich.createRichMarkdownState("Paragraph\n"), "divider");
assertIncludes(rich.serializeRichMarkdownState(dividerState).content, "---", "divider output");

const calloutState = rich.applyRichMarkdownCommand(rich.createRichMarkdownState("Remember this\n"), "callout");
assertIncludes(rich.serializeRichMarkdownState(calloutState).content, "> [!NOTE] Remember this", "callout output");

const imageState = rich.applyRichMarkdownCommand(rich.createRichMarkdownState("Image caption\n"), "image", {
  alt: "Diagram",
  src: "diagram.png"
});
assertIncludes(rich.serializeRichMarkdownState(imageState).content, "![Diagram](diagram.png)", "image output");

const selectedBold = rich.selectFirstRichText(rich.createRichMarkdownState("Make bold text\n"), "bold");
const boldState = rich.applyRichMarkdownCommand(selectedBold, "bold");
assertIncludes(rich.serializeRichMarkdownState(boldState).content, "Make **bold** text", "bold command output");

const selectedItalic = rich.selectFirstRichText(rich.createRichMarkdownState("Make italic text\n"), "italic");
const italicState = rich.applyRichMarkdownCommand(selectedItalic, "italic");
assertIncludes(rich.serializeRichMarkdownState(italicState).content, "Make *italic* text", "italic command output");

const selectedInlineCode = rich.selectFirstRichText(rich.createRichMarkdownState("Use code text\n"), "code");
const inlineCodeState = rich.applyRichMarkdownCommand(selectedInlineCode, "inlineCode");
assertIncludes(rich.serializeRichMarkdownState(inlineCodeState).content, "Use `code` text", "inline code command output");

const selectedLink = rich.selectFirstRichText(rich.createRichMarkdownState("Open docs\n"), "docs");
const linkState = rich.applyRichMarkdownCommand(selectedLink, "link", {
  href: "https://example.invalid/docs"
});
assertIncludes(
  rich.serializeRichMarkdownState(linkState).content,
  "[docs](https://example.invalid/docs)",
  "link command output"
);

const codeBlockForNoop = rich.createRichMarkdownState("```ts\nconst stable = true;\n```\n");
const unsupportedCommand = rich.runRichMarkdownCommand(codeBlockForNoop, "bold");
if (unsupportedCommand.handled === true) {
  throw new Error("Unavailable command inside a code block must report handled=false.");
}
if (unsupportedCommand.state !== codeBlockForNoop) {
  throw new Error("No-op command must return the original rich state object.");
}

const listStateForNoop = rich.selectFirstRichText(rich.createRichMarkdownState("- Parent item\n"), "Parent");
const invalidListReplacement = rich.runRichMarkdownCommand(listStateForNoop, "divider");
if (invalidListReplacement.handled === true) {
  throw new Error("Block replacement inside an unsafe list context must report handled=false.");
}
if (invalidListReplacement.state !== listStateForNoop) {
  throw new Error("Unsafe list replacement must return the original rich state object.");
}

function assertMatchIds(query, expectedIds) {
  const actual = rich.filterRichMarkdownCommands(query).map((command) => command.id);
  for (const expected of expectedIds) {
    if (!actual.includes(expected)) {
      throw new Error(`Expected query ${JSON.stringify(query)} to include ${expected}; got ${actual.join(", ")}`);
    }
  }
}

function assertIncludes(content, expected, label) {
  if (!content.includes(expected)) {
    throw new Error(`${label} missing ${JSON.stringify(expected)}.\n${content}`);
  }
}
