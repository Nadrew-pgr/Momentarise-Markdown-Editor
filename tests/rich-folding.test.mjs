const rich = await import("../packages/md-rich-prosemirror/dist/index.js");

const requiredExports = [
  "getRichFoldVisibility",
  "getRichHeadingFoldItems",
  "toggleRichHeadingFold"
];

for (const exportName of requiredExports) {
  if (!(exportName in rich)) {
    throw new Error(`Missing MME-0014 rich folding export: ${exportName}`);
  }
}

const source = `# Root

Root intro.

## Alpha

Alpha body.

### Alpha child

Alpha child body.

#### Alpha deep

Alpha deep body.

##### Alpha deeper

Alpha deeper body.

###### Alpha deepest

Alpha deepest body.

## Beta

Beta body.

# Next root

Next root body.
`;

const state = rich.createRichMarkdownState(source);
const initialItems = rich.getRichHeadingFoldItems(state, []);
assertHeading(initialItems, "Root", 1);
assertHeading(initialItems, "Alpha", 2);
assertHeading(initialItems, "Alpha child", 3);
assertHeading(initialItems, "Alpha deep", 4);
assertHeading(initialItems, "Alpha deeper", 5);
assertHeading(initialItems, "Alpha deepest", 6);
assertHeading(initialItems, "Beta", 2);
assertHeading(initialItems, "Next root", 1);

const alpha = findHeading(initialItems, "Alpha");
const alphaFolds = rich.toggleRichHeadingFold([], alpha.nodeId);
const alphaVisibility = rich.getRichFoldVisibility(state, alphaFolds);
assertHidden(alphaVisibility, "Alpha body.");
assertHidden(alphaVisibility, "Alpha child");
assertHidden(alphaVisibility, "Alpha deepest body.");
assertVisible(alphaVisibility, "Alpha");
assertVisible(alphaVisibility, "Beta");
assertVisible(alphaVisibility, "Beta body.");
assertVisible(alphaVisibility, "Next root");

const root = findHeading(initialItems, "Root");
const rootFolds = rich.toggleRichHeadingFold([], root.nodeId);
const rootVisibility = rich.getRichFoldVisibility(state, rootFolds);
assertHidden(rootVisibility, "Root intro.");
assertHidden(rootVisibility, "Alpha");
assertHidden(rootVisibility, "Alpha deepest");
assertHidden(rootVisibility, "Beta body.");
assertVisible(rootVisibility, "Root");
assertVisible(rootVisibility, "Next root");
assertVisible(rootVisibility, "Next root body.");

const alphaChild = findHeading(initialItems, "Alpha child");
const childFolds = rich.toggleRichHeadingFold([], alphaChild.nodeId);
const childVisibility = rich.getRichFoldVisibility(state, childFolds);
assertVisible(childVisibility, "Alpha");
assertVisible(childVisibility, "Alpha body.");
assertVisible(childVisibility, "Alpha child");
assertHidden(childVisibility, "Alpha deep");
assertHidden(childVisibility, "Alpha deepest body.");
assertVisible(childVisibility, "Beta");

const nestedFolds = rich.toggleRichHeadingFold(childFolds, alpha.nodeId);
const nestedParentCollapsed = rich.getRichFoldVisibility(state, nestedFolds);
assertHidden(nestedParentCollapsed, "Alpha child");
assertHidden(nestedParentCollapsed, "Alpha deepest body.");
assertVisible(nestedParentCollapsed, "Beta");
const nestedParentOpen = rich.getRichFoldVisibility(state, rich.toggleRichHeadingFold(nestedFolds, alpha.nodeId));
assertVisible(nestedParentOpen, "Alpha child");
assertHidden(nestedParentOpen, "Alpha deep");
assertHidden(nestedParentOpen, "Alpha deepest body.");

const alphaDeep = findHeading(initialItems, "Alpha deep");
const h4Visibility = rich.getRichFoldVisibility(state, rich.toggleRichHeadingFold([], alphaDeep.nodeId));
assertVisible(h4Visibility, "Alpha child");
assertHidden(h4Visibility, "Alpha deeper");
assertHidden(h4Visibility, "Alpha deepest body.");
assertVisible(h4Visibility, "Beta");

const alphaDeeper = findHeading(initialItems, "Alpha deeper");
const h5Visibility = rich.getRichFoldVisibility(state, rich.toggleRichHeadingFold([], alphaDeeper.nodeId));
assertVisible(h5Visibility, "Alpha deep");
assertHidden(h5Visibility, "Alpha deepest");
assertHidden(h5Visibility, "Alpha deepest body.");
assertVisible(h5Visibility, "Beta");

const alphaDeepest = findHeading(initialItems, "Alpha deepest");
const h6Visibility = rich.getRichFoldVisibility(state, rich.toggleRichHeadingFold([], alphaDeepest.nodeId));
assertVisible(h6Visibility, "Alpha deepest");
assertHidden(h6Visibility, "Alpha deepest body.");
assertVisible(h6Visibility, "Beta");

const sourceWithInsertedSibling = source.replace(
  "## Alpha",
  "## Inserted before Alpha\n\nInserted body.\n\n## Alpha"
);
const changedState = rich.createRichMarkdownState(sourceWithInsertedSibling);
const changedVisibility = rich.getRichFoldVisibility(changedState, alphaFolds);
assertVisible(changedVisibility, "Inserted before Alpha");
assertVisible(changedVisibility, "Inserted body.");
assertVisible(changedVisibility, "Alpha");
assertHidden(changedVisibility, "Alpha body.");
assertHidden(changedVisibility, "Alpha child");
assertVisible(changedVisibility, "Beta");

const serializedBefore = rich.serializeRichMarkdownState(state).content;
rich.getRichFoldVisibility(state, rootFolds);
const serializedAfter = rich.serializeRichMarkdownState(state).content;
if (serializedAfter !== serializedBefore) {
  throw new Error("Folding visibility must not mutate serialized Markdown.");
}
if (serializedAfter.includes("<details>")) {
  throw new Error("Heading folding must not emit toggle block details markup.");
}

const toggleBlock = rich.applyRichMarkdownCommand(rich.createRichMarkdownState("Toggle label\n"), "toggleBlock");
const toggleMarkdown = rich.serializeRichMarkdownState(toggleBlock).content;
assertIncludes(toggleMarkdown, "<details>", "explicit toggle block opening tag");
assertIncludes(toggleMarkdown, "<summary>Toggle label</summary>", "explicit toggle block summary");
assertIncludes(toggleMarkdown, "</details>", "explicit toggle block closing tag");

function findHeading(items, text) {
  const item = items.find((candidate) => candidate.text === text);
  if (!item) {
    throw new Error(`Missing heading fold item: ${text}`);
  }
  return item;
}

function assertHeading(items, text, level) {
  const item = findHeading(items, text);
  if (item.level !== level) {
    throw new Error(`Expected heading ${text} to be H${level}, got H${item.level}.`);
  }
}

function assertHidden(visibility, text) {
  const block = visibility.blocks.find((candidate) => candidate.text === text);
  if (!block) {
    throw new Error(`Missing block for hidden assertion: ${text}`);
  }
  if (!block.hidden) {
    throw new Error(`Expected block to be hidden: ${text}\n${JSON.stringify(visibility.blocks, null, 2)}`);
  }
}

function assertVisible(visibility, text) {
  const block = visibility.blocks.find((candidate) => candidate.text === text);
  if (!block) {
    throw new Error(`Missing block for visible assertion: ${text}`);
  }
  if (block.hidden) {
    throw new Error(`Expected block to be visible: ${text}\n${JSON.stringify(visibility.blocks, null, 2)}`);
  }
}

function assertIncludes(content, expected, label) {
  if (!content.includes(expected)) {
    throw new Error(`${label} missing ${JSON.stringify(expected)}.\n${content}`);
  }
}
