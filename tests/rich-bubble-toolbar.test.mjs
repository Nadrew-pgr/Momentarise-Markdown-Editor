/*
 * MME-0089 — the selection bubble is the formatting surface, and the persistent
 * toolbar is off by default.
 *
 * Benchmark contract 4 (`docs/internal/research/editor-ux-benchmark.md`): Notion
 * and BlockNote ship no always-visible formatting toolbar. Formatting lives in
 * the selection bubble and the slash menu. MME shipped a persistent icon row in
 * the header plus a four-button bubble, which is the inverse of both references.
 *
 * What this suite pins, in the order the issue lists it:
 *
 *  1. `toolbar.mode` resolves to `hidden` with no host layer, and a host that
 *     wants the Google-Docs shape opts in explicitly. Both directions matter:
 *     an assertion that only checks the default would pass against a build that
 *     ignored the preference entirely.
 *  2. The bubble's action inventory — turn-into, bold, italic, strikethrough,
 *     inline code, link, AI — with group separators between them, asserted on
 *     the specific elements this issue introduces rather than on a button count.
 *  3. Byte exactness for the two actions the bubble gains that no command path
 *     covered before: strikethrough and link. Applying then removing must return
 *     the original bytes, and neighbours must not move.
 *  4. Centered placement, which is what "anchors centered above the selection"
 *     means numerically. The existing `align: start|end` cannot express it.
 *  5. The contexts the bubble must refuse: code blocks and opaque blocks.
 */

import { readFileSync } from "node:fs";
import { TextSelection } from "prosemirror-state";
import {
  anchoredOverlayPlacement,
  createSelectionBubbleToolbar,
  createToolbar,
  defaultMmeStrings
} from "../packages/md-surface/dist/index.js";
import { DEFAULT_PREFERENCE_SCHEMA, createMarkdownEditorSession, resolvePreferences } from "../packages/md-editor/dist/index.js";
import { createMemorySaveTarget } from "../packages/md-save/dist/index.js";
import {
  applyRichMarkdownCommand,
  createRichMarkdownState,
  richCommandRegistry,
  richSelectionSupportsFormatting,
  selectFirstRichText,
  serializeRichMarkdownState
} from "../packages/md-rich-prosemirror/dist/index.js";

const { JSDOM } = await import("jsdom");

const failures = [];

/* ------------------------------------------------------------------ *
 * Harness
 * ------------------------------------------------------------------ */

const dom = new JSDOM("<!doctype html><html><body></body></html>");
const document = dom.window.document;

const session = createMarkdownEditorSession({
  content: "# Bubble\n",
  target: createMemorySaveTarget({ initialContent: "# Bubble\n" })
});

function surfaceContext(overrides = {}) {
  return {
    host: document.createElement("div"),
    icons: {
      render(name) {
        return `<span data-icon="${name}" aria-hidden="true"></span>`;
      }
    },
    preferences: {
      aiEntryPoints: ["slash", "toolbar", "selection", "command-palette"],
      layoutDensity: "comfortable",
      visibleCommandGroups: ["blocks", "marks", "lists", "insert", "ai", "status"],
      ...overrides
    },
    session,
    strings: defaultMmeStrings
  };
}

function mountBubble(stateOverrides = {}, preferenceOverrides = {}) {
  const context = surfaceContext(preferenceOverrides);
  const component = createSelectionBubbleToolbar({
    ...context,
    onAiSelection() {},
    onLinkSubmit() {},
    onRunToolbarItem() {},
    onTurnInto() {},
    state: { visible: true, ...stateOverrides }
  });
  return { component, host: context.host, root: component.root };
}

/** Resolved preference value with no host/workspace/user layer at all. */
function frameworkDefault(key) {
  const resolved = resolvePreferences({ layers: {}, schema: DEFAULT_PREFERENCE_SCHEMA });
  return resolved.preferences[key]?.value;
}

/* ------------------------------------------------------------------ *
 * Section 1 — the persistent toolbar is off by default (contract 4).
 * ------------------------------------------------------------------ */

check("the framework default for toolbar.mode is hidden", () => {
  assertEqual(
    frameworkDefault("toolbar.mode"),
    "hidden",
    "Contract 4: a consumer that configures nothing must get no persistent formatting toolbar"
  );
});

check("createToolbar renders nothing when the host adds no toolbar preference", () => {
  const context = surfaceContext({ toolbarMode: frameworkDefault("toolbar.mode") });
  const toolbar = createToolbar({
    ...context,
    onAiToolbar() {},
    onRunToolbarItem() {},
    state: { editorMode: "rich", visible: true }
  });
  assertEqual(toolbar.root.hidden, true, "the default-configured toolbar must not paint");
  toolbar.destroy();
});

check("a host can still opt into the persistent toolbar", () => {
  const context = surfaceContext({ toolbarMode: "sticky" });
  const toolbar = createToolbar({
    ...context,
    onAiToolbar() {},
    onRunToolbarItem() {},
    state: { editorMode: "rich", visible: true }
  });
  assertEqual(toolbar.root.hidden, false, "toolbarMode: sticky is the documented Google-Docs-style opt-in");
  toolbar.destroy();
});

/* ------------------------------------------------------------------ *
 * Section 2 — the bubble's action inventory.
 * ------------------------------------------------------------------ */

const BUBBLE_ACTIONS = [
  ["selection-bubble-turn-into", "turn-into dropdown"],
  ["selection-bubble-bold", "bold"],
  ["selection-bubble-italic", "italic"],
  ["selection-bubble-strikethrough", "strikethrough"],
  ["selection-bubble-inline-code", "inline code"],
  ["selection-bubble-link", "link"],
  ["selected-text-ai-bubble-action", "AI entry"]
];

for (const [testId, label] of BUBBLE_ACTIONS) {
  check(`the bubble offers ${label}`, () => {
    const { root, component } = mountBubble();
    const button = root.querySelector(`[data-testid="${testId}"]`);
    assert(
      button !== null,
      `the selection bubble must expose ${label} as [data-testid="${testId}"]; ` +
        `it renders ${JSON.stringify([...root.querySelectorAll("[data-testid]")].map((node) => node.dataset.testid))}`
    );
    /*
     * Presence is not availability. `selectionBubbleAiButton` already computes
     * `hidden` from the preferences, so a wrong condition anywhere here would
     * ship a permanently invisible control with this gate green.
     */
    assert(button.hidden === false, `${label} is present but hidden, so no writer can reach it`);
    component.destroy();
  });
}

check("turn-into entries use a role that can carry a checked state", () => {
  const { root, component } = mountBubble({ activeBlockCommand: "heading2", turnIntoOpen: true });
  const entry = root.querySelector('[data-turn-into-command="heading2"]');
  assert(entry !== null, "turn-into must render a heading2 entry");
  assertEqual(
    entry.getAttribute("role"),
    "menuitemradio",
    "aria-checked is not mapped on role=menuitem, so the current block type would be announced to nobody"
  );
  assertEqual(entry.getAttribute("aria-checked"), "true", "the block the caret is in must be the checked entry");
  component.destroy();
});

check("the turn-into control's accessible name contains its visible caption", () => {
  const { root, component } = mountBubble({ activeBlockCommand: "heading2" });
  const button = root.querySelector('[data-testid="selection-bubble-turn-into"]');
  const caption = button.querySelector(".selection-bubble-turn-into-label")?.textContent ?? "";
  const name = button.getAttribute("aria-label") ?? "";
  assert(caption.length > 0, "the control must show the current block type");
  assert(
    name.includes(caption),
    `WCAG 2.5.3: the accessible name ${JSON.stringify(name)} must contain the visible caption ${JSON.stringify(caption)}, ` +
      "or a speech-input user saying what they can see activates nothing"
  );
  component.destroy();
});

check("the bubble exposes exactly one tab stop", () => {
  const { root, component } = mountBubble();
  const stops = [...root.querySelectorAll("button, input")].filter((node) => node.tabIndex === 0);
  assertEqual(
    stops.map((node) => node.dataset.testid).join(","),
    "selection-bubble-turn-into",
    "role=toolbar promises a single tab stop; more than one means Tab lands inside the bubble twice"
  );
  component.destroy();
});

check("the link field accepts the destinations a Markdown writer types", () => {
  const { root, component } = mountBubble({ linkEditor: { href: "", open: true } });
  const input = root.querySelector('[data-testid="selection-bubble-link-input"]');
  assert(input !== null, "link editing must render a URL field");
  /*
   * `type="url"` refuses `./notes.md`, `#section` and `example.com` through
   * constraint validation — the three commonest destinations in a Markdown vault,
   * in a product whose thesis is that Markdown is the real source.
   */
  assertEqual(input.type, "text", "the link field must not apply absolute-URL constraint validation");
  assertEqual(input.closest("form").noValidate, true, "the link form must not block submission on constraint validation");
});

check("the bubble groups its actions with separators", () => {
  const { root, component } = mountBubble();
  const separators = root.querySelectorAll('[role="separator"]');
  assert(
    separators.length >= 2,
    `turn-into | marks | link+AI needs at least two separators; found ${separators.length}`
  );
  component.destroy();
});

check("the turn-into dropdown lists the benchmark's block types", () => {
  const { root, component } = mountBubble({ turnIntoOpen: true });
  const offered = [...root.querySelectorAll("[data-turn-into-command]")].map((node) => node.dataset.turnIntoCommand);
  for (const commandId of [
    "paragraph",
    "heading1",
    "heading2",
    "heading3",
    "bulletList",
    "orderedList",
    "todo",
    "blockquote",
    "codeBlock"
  ]) {
    assert(offered.includes(commandId), `turn-into must offer ${commandId}; it offers ${JSON.stringify(offered)}`);
  }
  component.destroy();
});

check("turn-into entries dispatch the rich command they name", () => {
  const dispatched = [];
  const context = surfaceContext();
  const component = createSelectionBubbleToolbar({
    ...context,
    onAiSelection() {},
    onLinkSubmit() {},
    onRunToolbarItem() {},
    onTurnInto(commandId) {
      dispatched.push(commandId);
    },
    state: { turnIntoOpen: true, visible: true }
  });
  const entry = component.root.querySelector('[data-turn-into-command="heading2"]');
  assert(entry !== null, "turn-into must render a heading2 entry to click");
  entry.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  assertEqual(dispatched.join(","), "heading2", "clicking a turn-into entry runs that command");
  component.destroy();
});

check("the link action opens a popover that writes a real destination", () => {
  const submitted = [];
  const context = surfaceContext();
  const component = createSelectionBubbleToolbar({
    ...context,
    onAiSelection() {},
    onLinkSubmit(value) {
      submitted.push(value);
    },
    onRunToolbarItem() {},
    onTurnInto() {},
    state: { linkEditor: { href: "", open: true }, visible: true }
  });
  const input = component.root.querySelector('[data-testid="selection-bubble-link-input"]');
  assert(input !== null, "opening link editing must render a URL input");
  input.value = "https://momentarise.dev";
  const form = input.closest("form");
  assert(form !== null, "the link input must live in a form so Enter submits it");
  form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
  assertEqual(submitted.join(","), "https://momentarise.dev", "submitting the link popover reports the typed URL");
  component.destroy();
});

check("every bubble command carries an icon and an accessible name", () => {
  const { root, component } = mountBubble();
  const unnamed = [...root.querySelectorAll("button")]
    .filter((button) => !button.getAttribute("aria-label"))
    .map((button) => button.dataset.testid ?? button.className);
  assertEqual(unnamed.join(","), "", "every bubble button needs an accessible name");
  const iconless = [...root.querySelectorAll("button")]
    .filter((button) => !button.querySelector("[data-icon]"))
    .map((button) => button.dataset.testid ?? button.className);
  assertEqual(iconless.join(","), "", "every bubble button needs an icon from the md-theme set");
  component.destroy();
});

/* ------------------------------------------------------------------ *
 * Section 3 — byte exactness for the actions the bubble gains.
 * ------------------------------------------------------------------ */

check("strikethrough is a rich command the bubble can dispatch", () => {
  const ids = richCommandRegistry.map((command) => command.id);
  assert(ids.includes("strikethrough"), `richCommandRegistry must expose strikethrough; it exposes ${ids.join(",")}`);
});

check("strikethrough wraps the selection in ~~", () => {
  const source = "Intro paragraph.\n\nalpha bravo charlie\n\nOutro paragraph.\n";
  const state = applyRichMarkdownCommand(selectFirstRichText(createRichMarkdownState(source), "bravo"), "strikethrough");
  assertEqual(
    serializeRichMarkdownState(state).content,
    "Intro paragraph.\n\nalpha ~~bravo~~ charlie\n\nOutro paragraph.\n",
    "strikethrough bytes, with neighbours untouched"
  );
});

/*
 * Apply-then-remove from a PLAIN document, for every mark the bubble offers.
 *
 * Starting from already-marked source and asserting the plain result proves only
 * the removal half; the criterion is that a writer who applies a mark and changes
 * their mind is left with the bytes they started with. `mount with no edit` was
 * deleted rather than kept: nothing this issue introduced could make it fail.
 */
for (const [commandId, expected] of [
  ["strikethrough", "alpha ~~bravo~~ charlie\n"],
  ["bold", "alpha **bravo** charlie\n"],
  ["italic", "alpha *bravo* charlie\n"],
  ["inlineCode", "alpha `bravo` charlie\n"]
]) {
  check(`${commandId} applies and removes leaving the original bytes`, () => {
    const source = "alpha bravo charlie\n";
    const applied = applyRichMarkdownCommand(selectFirstRichText(createRichMarkdownState(source), "bravo"), commandId);
    assertEqual(serializeRichMarkdownState(applied).content, expected, `${commandId} applied bytes`);
    const removed = applyRichMarkdownCommand(selectFirstRichText(applied, "bravo"), commandId);
    assertEqual(serializeRichMarkdownState(removed).content, source, `${commandId} removed bytes`);
  });
}

check("the link action writes a real Markdown destination", () => {
  const source = "Intro paragraph.\n\nalpha bravo charlie\n\nOutro paragraph.\n";
  const state = applyRichMarkdownCommand(selectFirstRichText(createRichMarkdownState(source), "bravo"), "link", {
    href: "https://momentarise.dev"
  });
  assertEqual(
    serializeRichMarkdownState(state).content,
    "Intro paragraph.\n\nalpha [bravo](https://momentarise.dev) charlie\n\nOutro paragraph.\n",
    "link bytes, with neighbours untouched"
  );
});

check("removing a link returns the original bytes", () => {
  const source = "alpha [bravo](https://momentarise.dev) charlie\n";
  let state = createRichMarkdownState(source);
  state = selectFirstRichText(state, "bravo");
  state = applyRichMarkdownCommand(state, "link", { href: "https://momentarise.dev" });
  assertEqual(serializeRichMarkdownState(state).content, "alpha bravo charlie\n", "link toggle-off bytes");
});

/* ------------------------------------------------------------------ *
 * Section 4 — centered placement.
 * ------------------------------------------------------------------ */

check("anchoredOverlayPlacement centers an overlay on its anchor", () => {
  const placement = anchoredOverlayPlacement({
    align: "center",
    anchor: { height: 20, left: 400, top: 300, width: 100 },
    container: { height: 800, left: 0, top: 0, width: 1000 },
    overlay: { height: 40, width: 300 }
  });
  assertEqual(placement.left, 300, "a 300px overlay centered on a 100px anchor at x=400 starts at x=300");
  assertEqual(placement.placement, "above", "the bubble prefers to sit above the selection");
  assertEqual(placement.top, 252, "8px of gap between the overlay's bottom and the anchor's top");
});

check("a centered overlay is still clamped inside its bounds", () => {
  const placement = anchoredOverlayPlacement({
    align: "center",
    anchor: { height: 20, left: 10, top: 300, width: 40 },
    container: { height: 800, left: 0, top: 0, width: 1000 },
    overlay: { height: 40, width: 300 }
  });
  assertEqual(placement.left, 12, "centering must not push the overlay past the left margin");
});

check("a centered overlay flips below when there is no room above", () => {
  const placement = anchoredOverlayPlacement({
    align: "center",
    anchor: { height: 20, left: 400, top: 10, width: 100 },
    container: { height: 800, left: 0, top: 0, width: 1000 },
    overlay: { height: 40, width: 300 }
  });
  assertEqual(placement.placement, "below", "a selection near the top of the viewport gets the bubble underneath");
});

/* ------------------------------------------------------------------ *
 * Section 5 — the contexts the bubble refuses.
 * ------------------------------------------------------------------ */

check("the bubble reports itself unavailable inside a code block", () => {
  const state = selectFirstRichText(createRichMarkdownState("```js\nconst a = 1;\n```\n"), "const");
  assertEqual(
    selectionBubbleAvailability(state),
    false,
    "a selection inside a fenced code block must not raise the formatting bubble"
  );
});

check("the bubble reports itself unavailable inside an opaque block", () => {
  const state = createRichMarkdownState("<div data-x>raw</div>\n");
  assertEqual(
    selectionBubbleAvailability(state),
    false,
    "an opaque/raw block carries source bytes the bubble must never mark up"
  );
});

check("the bubble is available in paragraphs, headings, lists, todos and quotes", () => {
  const cases = [
    ["paragraph", "alpha bravo charlie\n", "bravo"],
    ["heading", "# alpha bravo\n", "bravo"],
    ["bullet list", "- alpha bravo\n", "bravo"],
    ["todo", "- [ ] alpha bravo\n", "bravo"],
    ["quote", "> alpha bravo\n", "bravo"]
  ];
  for (const [label, source, needle] of cases) {
    const state = selectFirstRichText(createRichMarkdownState(source), needle);
    assertEqual(selectionBubbleAvailability(state), true, `the bubble must be available in a ${label}`);
  }
});

/* ------------------------------------------------------------------ *
 * Section 6 — registration and packaged styling.
 * ------------------------------------------------------------------ */

check("this suite runs inside npm test", () => {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
  assertEqual(
    packageJson.scripts["test:rich-bubble-toolbar"],
    "npm run build && node tests/rich-bubble-toolbar.test.mjs",
    "the gate needs its own focused script"
  );
  assert(packageJson.scripts.test.includes("test:rich-bubble-toolbar"), "npm test must run this gate");
});

check("the bubble's styling ships in the packaged stylesheet", () => {
  const packaged = readFileSync("packages/md-theme/src/styles.css", "utf8");
  const demo = readFileSync("apps/md-demo/src/styles.css", "utf8");
  for (const selector of [".selection-bubble-turn-into-menu", ".selection-bubble-link-editor"]) {
    assert(packaged.includes(selector), `${selector} must ship in packages/md-theme/src/styles.css`);
    assert(!demo.includes(selector), `${selector} must not be demo-only styling`);
  }
});

/* ------------------------------------------------------------------ *
 * Report
 * ------------------------------------------------------------------ */

if (failures.length > 0) {
  console.error(`rich-bubble-toolbar: ${failures.length} failing check(s)`);
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  process.exit(1);
}
console.log("rich-bubble-toolbar: all checks passed.");

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function check(label, body) {
  try {
    body();
  } catch (error) {
    failures.push(`[${label}] ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
  }
}

/**
 * The package's own answer to "may the formatting bubble open here?".
 *
 * Asserting this through the export rather than re-deriving it in the test is
 * the point: the demo, the React binding, and any other host must all get the
 * same refusal, which is the reachability rule.
 */
function selectionBubbleAvailability(state) {
  return richSelectionSupportsFormatting(state);
}

void TextSelection;
