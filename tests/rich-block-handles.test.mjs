import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * MME-0087 — Notion-style block handles and empty-block placeholder.
 *
 * Two defects:
 *   1. hover scope — the packaged stylesheet revealed EVERY block's handles as
 *      soon as the pointer entered the editor, because the reveal rule was keyed
 *      on `.ProseMirror:hover` rather than on the hovered block. Measured before
 *      the fix: hovering the first paragraph of a 7-block document made all 7
 *      affordances visible.
 *   2. placeholder — only a document consisting of a single empty paragraph got
 *      one. Notion shows it on whichever empty block has the caret.
 *
 * Plus the gutter contract: fold affordances must occupy reserved space and can
 * never overlap block content. That is not currently violated (measured: an 8px
 * gap at 1280 and at 390), so these assertions are a regression guard, and the
 * geometry itself is proven in the browser rather than here.
 */

const rich = await import("../packages/md-rich-prosemirror/dist/index.js");
const { JSDOM } = await import("jsdom");

const {
  createRichBlockAffordancePlugin,
  createRichMarkdownState,
  createMomentariseRichPlugins,
  serializeRichMarkdownState
} = rich;

const dom = new JSDOM("<!doctype html><html><body></body></html>");
// The affordance widget builds DOM through the ambient `document`.
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;

const packageStyles = readFileSync("packages/md-theme/src/styles.css", "utf8");
const demoStyles = readFileSync("apps/md-demo/src/styles.css", "utf8");

// ---------------------------------------------------------------------------
// 1. hover scope is expressed per block, never per editor
// ---------------------------------------------------------------------------

function ruleBlocks(css) {
  return [...css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    body: match[2],
    selector: match[1].trim()
  }));
}

const revealRules = ruleBlocks(packageStyles).filter(
  (rule) => rule.selector.includes(".rich-block-affordance") && /opacity\s*:\s*1/.test(rule.body)
);
assert(
  revealRules.length > 0,
  "the packaged stylesheet must reveal block affordances somewhere; the detector found no rule and would prove nothing."
);

for (const rule of revealRules) {
  for (const branch of rule.selector.split(",")) {
    const trimmed = branch.trim();
    if (!trimmed.includes(".rich-block-affordance")) {
      continue;
    }
    // `.ProseMirror:hover .rich-block-affordance` reveals every block at once.
    // `.ProseMirror > *:hover .rich-block-affordance` reveals only the hovered
    // block's own affordance, which is the contract.
    assert(
      !/\.ProseMirror:hover(?![\w-])/.test(trimmed),
      `"${trimmed}" reveals every block's handles as soon as the pointer enters the editor (MME-0087).`
    );
    assert(
      !/\.ProseMirror:focus-within(?![\w-])/.test(trimmed),
      `"${trimmed}" reveals every block's handles whenever the editor holds focus (MME-0087).`
    );
  }
}

// Hover is tracked by the plugin, not expressed as a descendant selector: an
// atom block such as raw HTML has its affordance emitted as a SIBLING, so no
// descendant rule can reach it and those blocks showed no handles at all.
assert(
  packageStyles.includes('.rich-block-affordance[data-rich-block-hovered="true"]'),
  "the packaged stylesheet must reveal the affordance the plugin marks as hovered."
);
const richSource = readFileSync("packages/md-rich-prosemirror/src/index.ts", "utf8");
for (const needle of ["markHoveredRichBlockAffordance", "posAtCoords", "richBlockHovered", "mouseleave"]) {
  assert(richSource.includes(needle), `the affordance plugin must track hover itself (missing ${needle}).`);
}

// The fade has to be perceptible but not slow: the issue caps it at 150ms, and
// the motion ladder's `fast` step is the only token at or under that.
const affordanceBase = ruleBlocks(packageStyles).find((rule) => rule.selector === ".rich-block-affordance");
assert(affordanceBase, "the packaged stylesheet must define .rich-block-affordance.");
assert(
  /transition:[^;]*opacity[^;]*var\(--mme-motion-fast\)/.test(affordanceBase.body),
  "the affordance fade must use --mme-motion-fast (100ms), which is the only ladder step at or under the 150ms cap."
);

// Coarse pointers keep the MME-0078 always-visible contract.
const coarseBlock = packageStyles.slice(packageStyles.indexOf("@media (any-pointer: coarse)"));
assert(
  /\.rich-block-affordance\s*\{[^}]*opacity:\s*1/.test(coarseBlock),
  "coarse-pointer devices must keep block affordances visible without hover (MME-0078)."
);

// ---------------------------------------------------------------------------
// 2. the fold gutter is reserved space, owned by the package
// ---------------------------------------------------------------------------

assert(
  packageStyles.includes(".rich-fold-toggle"),
  "fold affordances are package-emitted decorations; their styling belongs in the packaged stylesheet (MME-0100 ownership rule)."
);
assert(
  packageStyles.includes("--mme-fold-gutter-width"),
  "the fold affordance must sit in a named, reserved gutter rather than an ad-hoc negative offset (MME-0087)."
);
assert(
  !/(^|\n)\s*\.rich-fold-toggle[\s,:.[{]/.test(demoStyles),
  "demo stylesheet must not define the package-owned .rich-fold-toggle surface."
);

// The reserved gutter has to actually be reserved: the content padding must be
// at least the gutter width, or the affordance is drawn over the page edge.
const proseMirrorRule = ruleBlocks(packageStyles).find((rule) => rule.selector === ".ProseMirror");
assert(proseMirrorRule, "the packaged stylesheet must define .ProseMirror.");
assert(
  proseMirrorRule.body.includes("--mme-fold-gutter-width"),
  "the content padding must reserve the fold gutter so the affordance never sits over block text."
);

// ---------------------------------------------------------------------------
// 3. the placeholder follows the caret, not the document
// ---------------------------------------------------------------------------


// The decoration adapter the demo passes in; mirrored here so the plugin can be
// exercised without a browser.
const { Decoration, DecorationSet } = await import("prosemirror-view");
const { TextSelection } = await import("prosemirror-state");
const adapter = { Decoration, DecorationSet };

function placeholderBlocks(markdown, caretText) {
  const base = createRichMarkdownState(markdown, { plugins: createMomentariseRichPlugins() });
  let editorState = base.editorState;

  if (caretText !== undefined) {
    let target = null;
    editorState.doc.descendants((node, pos) => {
      if (target !== null) {
        return false;
      }
      if (node.isTextblock && node.textContent === caretText) {
        target = pos + 1;
        return false;
      }
      return true;
    });
    assert(target !== null, `could not find a block whose text is ${JSON.stringify(caretText)} to place the caret in.`);
    editorState = editorState.apply(
      editorState.tr.setSelection(TextSelection.create(editorState.doc, target))
    );
  }

  const withPlugin = editorState.reconfigure({
    plugins: [...editorState.plugins, createRichBlockAffordancePlugin(adapter, {})]
  });
  const set = withPlugin.plugins
    .map((plugin) => plugin.getState?.(withPlugin))
    .find((value) => value instanceof DecorationSet);
  assert(set, "the affordance plugin must expose a DecorationSet.");
  return set
    .find()
    .filter((decoration) => decoration.type?.attrs?.["data-placeholder"] !== undefined)
    .map((decoration) => decoration.from);
}

// An empty document still shows one.
assert.equal(placeholderBlocks("").length, 1, "an empty document shows the placeholder.");

/**
 * Markdown cannot express an empty paragraph, so build one the way a writer
 * does: put the caret at the end of a block and press Enter.
 */
const defaultPlaceholderText = "Write, or press '/' for commands";

function placeholdersAfterPressingEnter(markdown, caretText, { moveCaretAway = false, returnState = false } = {}) {
  const base = createRichMarkdownState(markdown, { plugins: createMomentariseRichPlugins() });
  let editorState = base.editorState;

  let end = null;
  let elsewhere = null;
  editorState.doc.descendants((node, pos) => {
    if (node.isTextblock && node.textContent === caretText && end === null) {
      end = pos + node.nodeSize - 1;
    }
    if (node.isTextblock && node.textContent !== caretText && node.textContent.length > 0 && elsewhere === null) {
      elsewhere = pos + 1;
    }
    return true;
  });
  assert(end !== null, `could not find a block whose text is ${JSON.stringify(caretText)}.`);

  editorState = editorState.apply(editorState.tr.setSelection(TextSelection.create(editorState.doc, end)));
  const paragraph = editorState.schema.nodes.paragraph;
  let transaction = editorState.tr.insert(end + 1, paragraph.create());
  transaction = transaction.setSelection(TextSelection.create(transaction.doc, end + 2));
  editorState = editorState.apply(transaction);

  if (moveCaretAway) {
    assert(elsewhere !== null, "the fixture needs another non-empty block to move the caret to.");
    editorState = editorState.apply(
      editorState.tr.setSelection(TextSelection.create(editorState.doc, elsewhere))
    );
  }

  const withPlugin = editorState.reconfigure({
    plugins: [...editorState.plugins, createRichBlockAffordancePlugin(adapter, {})]
  });
  const set = withPlugin.plugins.map((plugin) => plugin.getState?.(withPlugin)).find((value) => value instanceof DecorationSet);
  assert(set, "the affordance plugin must expose a DecorationSet.");
  const placeholders = set.find().filter((decoration) => decoration.type?.attrs?.["data-placeholder"] !== undefined);
  return returnState ? { placeholders, state: { ...base, editorState } } : placeholders;
}

// The default string is the one the acceptance criteria name.
assert.equal(
  placeholdersAfterPressingEnter("A paragraph.\n", "A paragraph.")[0]?.type?.attrs?.["data-placeholder"],
  defaultPlaceholderText,
  "the placeholder must use the string the acceptance criteria specify."
);

// The regression this issue closes: an empty paragraph in the MIDDLE of a
// document, with the caret in it, must show the placeholder too.
const multi = "# Heading\n\nFirst paragraph.\n\nLast paragraph.\n";
assert.equal(
  placeholdersAfterPressingEnter(multi, "First paragraph.").length,
  1,
  "an empty paragraph holding the caret must show the placeholder even when the document has other content (MME-0087)."
);

// And it must not decorate empty blocks the caret is not in.
assert.equal(
  placeholdersAfterPressingEnter(multi, "First paragraph.", { moveCaretAway: true }).length,
  0,
  "an empty block without the caret must stay quiet; Notion shows the hint only where you are typing."
);

// A block with content never shows one.
assert.equal(placeholderBlocks("Only text.\n", "Only text.").length, 0, "a non-empty block never shows the placeholder.");

// ---------------------------------------------------------------------------
// 4. the placeholder is presentation only — it must never reach Markdown
// ---------------------------------------------------------------------------
//
// The first version of this asserted against a document with no empty paragraph
// at all, no plugin attached, and therefore no decoration: deleting the whole
// placeholder implementation left it green. It now serializes the exact state
// that carries a placeholder decoration.

const roundTripSource = "# Heading\n\nFirst paragraph.\n\nLast paragraph.\n";
const decorated = placeholdersAfterPressingEnter(roundTripSource, "First paragraph.", { returnState: true });
assert.equal(decorated.placeholders.length, 1, "the round-trip fixture must actually carry a placeholder decoration.");
const serialized = serializeRichMarkdownState({ ...decorated.state, editorState: decorated.state.editorState });
const placeholderText = defaultPlaceholderText;
assert(
  !serialized.content.includes(placeholderText),
  `the placeholder ${JSON.stringify(placeholderText)} must never serialize into Markdown.`
);
assert(
  serialized.content.startsWith("# Heading"),
  "serializing a placeholder-decorated state must still produce the document's own Markdown."
);

// ---------------------------------------------------------------------------
// registration
// ---------------------------------------------------------------------------

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
assert.equal(
  packageJson.scripts["test:rich-block-handles"],
  "npm run build && node tests/rich-block-handles.test.mjs",
  "Missing test:rich-block-handles script."
);
assert(packageJson.scripts.test.includes("test:rich-block-handles"), "Root npm test must include the block-handle gate.");
assert.equal(
  packageJson.scripts["visual:mme-0087"],
  "node scripts/visual-check-mme0087.mjs",
  "Missing visual:mme-0087 script."
);

console.log("rich-block-handles: all assertions passed.");
