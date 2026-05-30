const rich = await import("../packages/md-rich-prosemirror/dist/index.js");

const requiredExports = [
  "momentariseRichProseMirrorPackage",
  "createMomentariseRichSchema",
  "createRichMarkdownState",
  "replaceFirstRichText",
  "serializeRichMarkdownState"
];

for (const exportName of requiredExports) {
  if (!(exportName in rich)) {
    throw new Error(`Missing rich ProseMirror export: ${exportName}`);
  }
}

if (rich.momentariseRichProseMirrorPackage.packageName !== "@momentarise/md-rich-prosemirror") {
  throw new Error("Rich ProseMirror package contract has the wrong package name.");
}

const source = `---
title: Rich Fixture
---

# Original Heading

Original paragraph.

- [ ] Carry task marker

10. Preserve ordered start

\`\`\`ts title="demo"
const before = true;
\`\`\`

:::momentarise-card kind="decision"
Keep custom extension raw.
:::
`;

const state = rich.createRichMarkdownState(source, {
  dialect: "momentarise-enhanced"
});

if (state.diagnostics.length === 0) {
  throw new Error("Rich state should include diagnostics proving parse/bridge work.");
}

const editedHeading = rich.replaceFirstRichText(state, "Original Heading", "Edited Heading");
const editedParagraph = rich.replaceFirstRichText(editedHeading, "Original paragraph.", "Edited paragraph.");
const editedCode = rich.replaceFirstRichText(editedParagraph, "const before = true;", "const after = true;");
const serialized = rich.serializeRichMarkdownState(editedCode);

for (const expected of [
  "---\ntitle: Rich Fixture\n---",
  "# Edited Heading",
  "Edited paragraph.",
  "- [ ] Carry task marker",
  "10. Preserve ordered start",
  "```ts title=\"demo\"\nconst after = true;\n```",
  ":::momentarise-card kind=\"decision\"\nKeep custom extension raw.\n:::"
]) {
  if (!serialized.content.includes(expected)) {
    throw new Error(`Serialized rich Markdown missing ${JSON.stringify(expected)}.\n${serialized.content}`);
  }
}

const unsupportedOccurrences = serialized.content.match(/:::momentarise-card/g)?.length ?? 0;
if (unsupportedOccurrences !== 1) {
  throw new Error(`Unsupported extension syntax should appear exactly once, got ${unsupportedOccurrences}.\n${serialized.content}`);
}
