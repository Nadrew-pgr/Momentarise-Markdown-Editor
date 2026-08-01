import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createMemorySaveTarget } from "../packages/md-save/dist/index.js";
import { createMarkdownEditorSession } from "../packages/md-editor/dist/index.js";

/**
 * MME-0086 — editor focus and overlay hygiene.
 *
 * Three defects, three groups of assertions:
 *
 *   1. focus      — no rule draws a focus indicator around a whole editing surface;
 *                   keyboard focus stays on the individual control via :focus-visible.
 *   2. lifecycle  — every transient overlay closes on outside pointer, Escape, blur,
 *                   and mode change. The mechanism is a package contract so a consumer
 *                   gets it, not demo wiring.
 *   3. anchoring  — the code language/meta editor is positioned against its own block
 *                   instead of being pinned to the top of the content area.
 *
 * Everything below fails before the implementation lands.
 */

const surface = await import("../packages/md-surface/dist/index.js");
const { JSDOM } = await import("jsdom");

// ---------------------------------------------------------------------------
// exports
// ---------------------------------------------------------------------------

for (const exportName of [
  "anchoredOverlayPlacement",
  "attachSurfaceOverlayDismissListeners",
  "createRichBlockControls",
  "createSurfaceOverlayDismissController"
]) {
  assert(exportName in surface, `@momentarise/md-surface must export ${exportName} (MME-0086).`);
}

const {
  anchoredOverlayPlacement,
  attachSurfaceOverlayDismissListeners,
  createRichBlockControls,
  createSurfaceOverlayDismissController,
  defaultMmeStrings
} = surface;

// ---------------------------------------------------------------------------
// 3. anchoring math — pure, so it is provable without a browser
// ---------------------------------------------------------------------------

const container = { height: 600, left: 100, top: 50, width: 800 };

// A code block sitting low in the document: the overlay must follow it down, not
// return to the top of the container. This is the exact regression MME-0086 closes.
const lowAnchor = { height: 120, left: 180, top: 430, width: 500 };
const lowPlacement = anchoredOverlayPlacement({
  anchor: lowAnchor,
  container,
  overlay: { height: 40, width: 260 }
});
assert.equal(typeof lowPlacement.left, "number");
assert.equal(typeof lowPlacement.top, "number");
assert(
  lowPlacement.top > 300,
  `overlay must follow a low anchor instead of pinning to the content top (got top=${lowPlacement.top}).`
);
assert.equal(lowPlacement.placement, "above", "default placement is above the anchor when it fits.");
// above => anchorTopRelative (380) - overlayHeight (40) - gap (8) = 332
assert.equal(lowPlacement.top, 332, "above placement leaves exactly one gap between overlay and anchor.");
assert.equal(lowPlacement.left, 80, "left is expressed relative to the container, aligned to the anchor.");

// No room above: flip below.
const topAnchor = { height: 100, left: 180, top: 56, width: 500 };
const flipped = anchoredOverlayPlacement({
  anchor: topAnchor,
  container,
  overlay: { height: 40, width: 260 }
});
assert.equal(flipped.placement, "below", "overlay flips below when there is no room above the anchor.");
assert.equal(flipped.top, 6 + 100 + 8, "below placement sits one gap under the anchor.");

// Wide overlay near the right edge is clamped inside the container.
const clamped = anchoredOverlayPlacement({
  anchor: { height: 40, left: 820, top: 300, width: 60 },
  container,
  overlay: { height: 40, width: 300 }
});
assert(clamped.left + 300 <= container.width, "overlay is clamped inside the container's right edge.");
assert(clamped.left >= 0, "overlay never leaves the container's left edge.");

// A container shorter than the overlay must still produce a usable number.
const degenerate = anchoredOverlayPlacement({
  anchor: { height: 10, left: 100, top: 50, width: 10 },
  container: { height: 20, left: 100, top: 50, width: 40 },
  overlay: { height: 200, width: 200 }
});
assert(Number.isFinite(degenerate.left) && Number.isFinite(degenerate.top), "degenerate geometry stays finite.");

// Explicit preference is honoured when it fits.
assert.equal(
  anchoredOverlayPlacement({
    anchor: lowAnchor,
    container,
    overlay: { height: 40, width: 260 },
    preferred: "below"
  }).placement,
  "below",
  "an explicit `below` preference is honoured when there is room."
);

// `align: end` lines the overlay up with the anchor's right edge.
assert.equal(
  anchoredOverlayPlacement({
    align: "end",
    anchor: lowAnchor,
    container,
    overlay: { height: 40, width: 260 }
  }).left,
  80 + 500 - 260,
  "align:end lines the overlay up with the anchor's right edge."
);

// The overlay never covers its own anchor. Since MME-0086 removed the surface
// focus ring, the caret inside the anchored block is the only focus indicator
// left, so covering the anchor is a WCAG 2.4.7 failure.
for (const preferred of ["above", "below"]) {
  const placed = anchoredOverlayPlacement({
    anchor: lowAnchor,
    container,
    overlay: { height: 40, width: 260 },
    preferred
  });
  const anchorTop = lowAnchor.top - container.top;
  const anchorBottom = anchorTop + lowAnchor.height;
  const overlaps = placed.top < anchorBottom && placed.top + 40 > anchorTop;
  assert(!overlaps, `a "${preferred}" overlay must not cover its own anchor (top=${placed.top}).`);
}

// `bounds` is the scrolling viewport, not the positioned ancestor. A block
// scrolled above the viewport leaves no on-screen room beside it, and an
// off-screen overlay is not a placement — so the call reports `fits: false`
// rather than dragging the overlay back over the surrounding chrome.
const scrolled = anchoredOverlayPlacement({
  anchor: { height: 40, left: 180, top: 60, width: 500 },
  // the viewport starts 200px below the positioned ancestor's top edge
  bounds: { height: 400, left: 100, top: 250, width: 800 },
  container,
  overlay: { height: 40, width: 260 },
  preferred: "below"
});
assert.equal(scrolled.fits, false, "an anchor scrolled out of the viewport has no usable placement.");

// The regression the accessibility re-review caught: a block taller than the
// viewport used to have its overlay clamped to the bounds edge, i.e. parked
// *inside* the block, back over its text and the caret.
const tallAnchor = { height: 1000, left: 180, top: -100, width: 500 };
const tallBounds = { height: 600, left: 100, top: 50, width: 800 };
const tall = anchoredOverlayPlacement({
  anchor: tallAnchor,
  bounds: tallBounds,
  container,
  overlay: { height: 40, width: 260 },
  preferred: "below"
});
assert.equal(tall.fits, false, "a block taller than the viewport leaves no room on either side.");

// And when it does fit, the result is guaranteed clear of the anchor.
for (const preferred of ["above", "below"]) {
  const placed = anchoredOverlayPlacement({
    anchor: lowAnchor,
    bounds: container,
    container,
    overlay: { height: 40, width: 260 },
    preferred
  });
  if (!placed.fits) {
    continue;
  }
  const anchorTop = lowAnchor.top - container.top;
  assert(
    placed.top + 40 <= anchorTop || placed.top >= anchorTop + lowAnchor.height,
    `a fitting "${preferred}" placement must be clear of its anchor (top=${placed.top}).`
  );
}

// ---------------------------------------------------------------------------
// 2. overlay dismiss lifecycle
// ---------------------------------------------------------------------------

const dom = new JSDOM("<!doctype html><html><body></body></html>");
const doc = dom.window.document;

const editorRoot = doc.createElement("div");
editorRoot.className = "rich-editor-host";
const editorText = doc.createElement("p");
editorRoot.append(editorText);

const bubbleEl = doc.createElement("div");
const bubbleButton = doc.createElement("button");
bubbleEl.append(bubbleButton);

const slashEl = doc.createElement("div");
const menuEl = doc.createElement("div");
const codeMetaEl = doc.createElement("div");
const outsideEl = doc.createElement("button");
doc.body.append(editorRoot, bubbleEl, slashEl, menuEl, codeMetaEl, outsideEl);

function makeOverlay(id, element, dismissOn) {
  const record = { closed: [], focusReturns: 0, open: true };
  return {
    record,
    registration: {
      close(reason) {
        record.open = false;
        record.closed.push(reason);
      },
      contains(node) {
        return node instanceof dom.window.Node && element.contains(node);
      },
      ...(dismissOn ? { dismissOn } : {}),
      id,
      isOpen() {
        return record.open;
      },
      returnFocus() {
        record.focusReturns += 1;
      }
    }
  };
}

let focusedNode = null;
const controller = createSurfaceOverlayDismissController({
  activeElement: () => focusedNode,
  editorRoots: () => [editorRoot]
});

const bubble = makeOverlay("bubble", bubbleEl);
const slash = makeOverlay("slash", slashEl);
const blockMenu = makeOverlay("block-menu", menuEl);
const codeMeta = makeOverlay("code-meta", codeMetaEl);

const unregisterBubble = controller.register(bubble.registration);
controller.register(slash.registration);
controller.register(blockMenu.registration);
controller.register(codeMeta.registration);

assert.deepEqual(
  [...controller.openOverlayIds()].sort(),
  ["block-menu", "bubble", "code-meta", "slash"],
  "controller reports every registered open overlay."
);

// --- Escape closes everything that is open ---
assert.deepEqual([...controller.dismiss("escape")].sort(), ["block-menu", "bubble", "code-meta", "slash"]);
assert.deepEqual(bubble.record.closed, ["escape"]);
assert.deepEqual(codeMeta.record.closed, ["escape"], "the code-meta editor closes on Escape too.");
assert.deepEqual(controller.openOverlayIds(), [], "nothing stays open after Escape.");
assert.deepEqual(controller.dismiss("escape"), [], "dismiss is idempotent — closed overlays are not closed twice.");

// --- outside pointer closes only the overlays the pointer is outside of ---
for (const overlay of [bubble, slash, blockMenu, codeMeta]) {
  overlay.record.open = true;
  overlay.record.closed.length = 0;
}
const closedByPointer = controller.handlePointerDown(bubbleButton);
assert(!closedByPointer.includes("bubble"), "a pointer inside an overlay never dismisses that overlay.");
assert.deepEqual([...closedByPointer].sort(), ["block-menu", "code-meta", "slash"]);
assert.deepEqual(bubble.record.closed, [], "the pointed-at overlay stays open.");
assert.deepEqual(slash.record.closed, ["outside-pointer"]);

// A pointer landing in the editor content closes the remaining overlay.
assert.deepEqual(controller.handlePointerDown(editorText), ["bubble"]);

// --- blur: focus leaving the editor and every overlay closes them all ---
for (const overlay of [bubble, slash, blockMenu, codeMeta]) {
  overlay.record.open = true;
  overlay.record.closed.length = 0;
}
assert.deepEqual(
  controller.handleFocusChange(editorText),
  [],
  "focus inside the editor is not a blur — overlays survive."
);
assert.deepEqual(
  controller.handleFocusChange(bubbleButton),
  [],
  "focus moving into an overlay is not a blur — reaching a bubble button must not close it."
);
assert.deepEqual([...controller.handleFocusChange(outsideEl)].sort(), ["block-menu", "bubble", "code-meta", "slash"]);
assert.deepEqual(bubble.record.closed, ["blur"]);

// Focus going nowhere at all is still a blur.
for (const overlay of [bubble, slash]) {
  overlay.record.open = true;
  overlay.record.closed.length = 0;
}
assert.deepEqual([...controller.handleFocusChange(null)].sort(), ["bubble", "slash"]);

// --- mode change closes everything ---
for (const overlay of [bubble, slash, blockMenu, codeMeta]) {
  overlay.record.open = true;
  overlay.record.closed.length = 0;
}
assert.deepEqual([...controller.dismiss("mode-change")].sort(), ["block-menu", "bubble", "code-meta", "slash"]);
assert.deepEqual(blockMenu.record.closed, ["mode-change"]);

// --- opt-out is respected ---
const sticky = makeOverlay("sticky", doc.createElement("div"), ["escape"]);
controller.register(sticky.registration);
sticky.record.open = true;
assert(!controller.dismiss("mode-change").includes("sticky"), "an overlay may opt out of a dismiss reason.");
assert(controller.dismiss("escape").includes("sticky"), "the reasons it opts into still close it.");

// --- closing an overlay that holds focus must not strand focus on <body> ---
//
// Hiding an element that contains the active element resets focus to the body:
// no indicator, no document position, and the caret is lost. Escape pressed
// inside the code language field is the real case.
bubble.record.open = true;
bubble.record.closed.length = 0;
bubble.record.focusReturns = 0;
focusedNode = bubbleButton;
controller.dismiss("escape");
assert.equal(bubble.record.focusReturns, 1, "closing an overlay that held focus must hand focus back.");

// An overlay that did not hold focus must NOT steal it.
slash.record.open = true;
slash.record.focusReturns = 0;
focusedNode = bubbleButton;
controller.dismiss("escape");
assert.equal(slash.record.focusReturns, 0, "an overlay that never held focus must not grab it on close.");
focusedNode = null;

// --- unregister + destroy ---
bubble.record.open = true;
unregisterBubble();
assert(!controller.openOverlayIds().includes("bubble"), "unregistered overlays leave the controller.");
controller.destroy();
assert.deepEqual(controller.openOverlayIds(), [], "destroy clears the registry.");

// ---------------------------------------------------------------------------
// 2b. the DOM binding actually reacts to real events
// ---------------------------------------------------------------------------

const liveController = createSurfaceOverlayDismissController({ editorRoots: () => [editorRoot] });
const liveBubble = makeOverlay("bubble", bubbleEl);
liveController.register(liveBubble.registration);
const detach = attachSurfaceOverlayDismissListeners({ controller: liveController, scope: doc });

outsideEl.dispatchEvent(new dom.window.PointerEvent("pointerdown", { bubbles: true }));
assert.deepEqual(liveBubble.record.closed, ["outside-pointer"], "a real pointerdown outside dismisses the overlay.");

liveBubble.record.open = true;
liveBubble.record.closed.length = 0;
doc.dispatchEvent(new dom.window.KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
assert.deepEqual(liveBubble.record.closed, ["escape"], "a real Escape keydown dismisses the overlay.");

liveBubble.record.open = true;
liveBubble.record.closed.length = 0;
outsideEl.dispatchEvent(new dom.window.FocusEvent("focusin", { bubbles: true }));
assert.deepEqual(liveBubble.record.closed, ["blur"], "focus moving to a control outside the editor dismisses the overlay.");

liveBubble.record.open = true;
liveBubble.record.closed.length = 0;
detach();
outsideEl.dispatchEvent(new dom.window.PointerEvent("pointerdown", { bubbles: true }));
assert.deepEqual(liveBubble.record.closed, [], "detaching removes every listener.");

// ---------------------------------------------------------------------------
// 3b. the anchored block-controls surface is package-owned
// ---------------------------------------------------------------------------

const session = createMarkdownEditorSession({
  content: "```ts\nconst a = 1;\n```\n",
  target: createMemorySaveTarget({ initialContent: "```ts\nconst a = 1;\n```\n" })
});

const controlsHost = doc.createElement("div");
doc.body.append(controlsHost);

const languageChanges = [];
const metaChanges = [];
let insertAfterCalls = 0;

const blockControls = createRichBlockControls({
  host: controlsHost,
  preferences: {},
  session,
  state: { anchor: null, canInsertAfter: false, container: null, language: "", meta: "", visible: false },
  strings: defaultMmeStrings,
  onChangeLanguage(value) {
    languageChanges.push(value);
  },
  onChangeMeta(value) {
    metaChanges.push(value);
  },
  onInsertAfter() {
    insertAfterCalls += 1;
  }
});

const controlsRoot = blockControls.root;
assert.equal(controlsRoot.dataset.testid, "rich-block-controls", "the surface keeps the established test id.");
assert(controlsRoot.hidden, "block controls start hidden.");

blockControls.setState({
  anchor: { height: 120, left: 180, top: 430, width: 500 },
  canInsertAfter: true,
  container: { height: 600, left: 100, top: 50, width: 800 },
  language: "ts",
  meta: 'title="demo"',
  visible: true
});

assert(!controlsRoot.hidden, "block controls become visible for a selected code block.");
const codeGroup = controlsRoot.querySelector('[data-testid="code-block-controls"]');
assert(codeGroup, "the code language/meta group is rendered by the package, not by demo HTML.");
const languageInput = controlsRoot.querySelector('[data-testid="code-language-input"]');
const metaInput = controlsRoot.querySelector('[data-testid="code-meta-input"]');
assert(languageInput && metaInput, "language and meta inputs keep their established test ids.");
assert.equal(languageInput.value, "ts");
assert.equal(metaInput.value, 'title="demo"');
assert(
  controlsRoot.querySelector('[data-testid="insert-after-block-button"]'),
  "the insert-after affordance moves into the anchored surface with the code fields."
);

// The whole point: the surface is positioned against the block, not the content
// top. The exact arithmetic is pinned by the `anchoredOverlayPlacement` cases
// above; here the claim is that the surface is wired to it and lands next to its
// anchor. jsdom reports zero layout, so the measured overlay height is the
// surface's documented fallback rather than a real one.
const anchoredTop = Number.parseFloat(controlsRoot.style.getPropertyValue("--mme-block-controls-top"));
const anchorTopRelative = 430 - 50;
const anchorBottomRelative = anchorTopRelative + 120;
assert(Number.isFinite(anchoredTop), "the anchored surface carries a block-relative top offset.");
assert.equal(controlsRoot.dataset.placement, "below");
assert(
  anchoredTop >= anchorBottomRelative,
  "a `below` surface must clear its own block, leaving the block's text and caret visible."
);
assert(
  anchoredTop - anchorBottomRelative <= 24,
  `the surface must sit against its block (block ends at ${anchorBottomRelative}, overlay at ${anchoredTop}).`
);
assert(anchoredTop > 200, "the surface must not fall back to the top of the content area.");
assert.equal(controlsRoot.getAttribute("role"), "group", "the overlay must carry a role that can be named.");
assert.equal(controlsRoot.getAttribute("aria-label"), defaultMmeStrings.blockControls.label);

languageInput.value = "tsx";
languageInput.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
assert.deepEqual(languageChanges, ["tsx"], "language edits reach the host.");
metaInput.value = "";
metaInput.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
assert.deepEqual(metaChanges, [""], "meta edits reach the host, including clearing.");
controlsRoot.querySelector('[data-testid="insert-after-block-button"]').dispatchEvent(
  new dom.window.MouseEvent("click", { bubbles: true })
);
assert.equal(insertAfterCalls, 1);

// A non-code block that can still take a paragraph after it shows only that button.
blockControls.setState({
  anchor: { height: 40, left: 180, top: 200, width: 500 },
  canInsertAfter: true,
  container: { height: 600, left: 100, top: 50, width: 800 },
  language: null,
  meta: null,
  visible: true
});
assert(
  controlsRoot.querySelector('[data-testid="code-block-controls"]').hidden,
  "the code group hides for blocks that carry no fence info string."
);

blockControls.setState({ anchor: null, canInsertAfter: false, container: null, language: "", meta: "", visible: false });
assert(controlsRoot.hidden, "block controls hide again when nothing is selected.");
blockControls.destroy();

// ---------------------------------------------------------------------------
// 1. focus hygiene — enforced statically against both stylesheets
// ---------------------------------------------------------------------------

const demoStyles = readFileSync("apps/md-demo/src/styles.css", "utf8");
const packageStyles = readFileSync("packages/md-theme/src/styles.css", "utf8");

function ruleBlocks(css) {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    body: match[2],
    selector: match[1].trim()
  }));
}

// Any rule whose *subject* is a whole editing surface must not paint a focus
// indicator. `:focus-within` on a container is the exact shape of the defect.
//
// The subject is the last compound of a selector branch, so
// `.ProseMirror:focus-visible .selectedCell::after` is correctly left alone — its
// subject is a table cell, and scoping a cell ring to editor focus is legitimate.
const surfaceSelectors = [
  ".rich-editor-host",
  ".editor-host",
  ".markdown-read-host",
  ".ProseMirror",
  ".cm-editor",
  ".cm-scroller",
  ".editor-region",
  ".workspace"
];

function selectorSubjects(selector) {
  return selector.split(",").map((branch) => {
    const compound = branch.trim().split(/[\s>+~]+/).at(-1) ?? "";
    return { base: compound.replace(/:{1,2}[a-z-]+(\([^)]*\))?/g, ""), compound };
  });
}

const inspectedSurfaceFocusRules = [];
for (const [label, css] of [
  ["demo", demoStyles],
  ["packaged", packageStyles]
]) {
  for (const rule of ruleBlocks(css)) {
    const focusedSurfaceBranch = selectorSubjects(rule.selector).find(
      (subject) => surfaceSelectors.includes(subject.base) && /:focus/.test(subject.compound)
    );
    if (!focusedSurfaceBranch) {
      continue;
    }
    inspectedSurfaceFocusRules.push(rule.selector);
    const paintsIndicator =
      /outline\s*:\s*(?!none)[^;]*\d/.test(rule.body) || /box-shadow\s*:\s*(?!none)[^;]/.test(rule.body);
    assert(
      !paintsIndicator,
      `${label} stylesheet draws a focus indicator around a whole editing surface: "${rule.selector}" { ${rule.body.trim()} } (MME-0086).`
    );
  }
}
// The detector must be looking at something real. Without this the gate would
// report green if a refactor renamed every surface out from under it — the exact
// silent no-op pattern the Block B3 review found three times.
assert(
  inspectedSurfaceFocusRules.includes(".ProseMirror:focus"),
  `the surface-focus detector never matched the known ".ProseMirror:focus" rule; it inspected ${
    inspectedSurfaceFocusRules.length === 0 ? "nothing" : inspectedSurfaceFocusRules.join(", ")
  }, so it is no longer checking what it claims to check.`
);

// The replacement contract: focus stays visible on the controls inside the surface.
// Only package-emitted controls belong here — `.rich-fold-toggle` is demo markup
// today and its gutter work belongs to MME-0087, so it is deliberately absent.
for (const needle of [
  ".rich-block-affordance-button:focus-visible",
  ".ProseMirror [data-todo-toggle]:focus-visible",
  ".code-block-controls input:focus-visible"
]) {
  assert(
    packageStyles.includes(needle),
    `packaged stylesheet must keep keyboard focus visible on ${needle} (WCAG 2.4.7 replacement for the surface outline).`
  );
}

// --- `[hidden]` must actually hide, for consumers and not only for the demo ---
//
// The UA rule loses to any author `display`, so a packaged class that sets one
// leaves `element.hidden = true` cosmetic: still rendered, still tabbable. The
// demo masks this with its own `!important` rule, which ships to nobody.
{
  const stripped = packageStyles.replace(/\/\*[\s\S]*?\*\//g, "");
  const guard = stripped.match(/:where\(([^)]*)\)\[hidden\]\s*\{([^}]*)\}/);
  assert(guard, "packaged stylesheet must carry a scoped `:where(…)[hidden]` rule (MME-0086).");
  assert(
    /display\s*:\s*none\s*!important/.test(guard[2]),
    "the packaged `[hidden]` rule must win against author `display` declarations (`display: none !important`)."
  );

  // A bare `[hidden]` would apply to the consumer's whole document: it would beat
  // their own `[hidden]` overrides at any specificity, and would break
  // `hidden="until-found"`, whose UA behaviour deliberately keeps the element in
  // layout so find-in-page can reveal it.
  assert(
    !/(^|[},;\s])\[hidden\]\s*\{/.test(stripped),
    "the packaged `[hidden]` rule must be scoped to package-owned classes, not applied to the consumer's whole document."
  );

  const guarded = new Set(
    guard[1]
      .split(",")
      .map((entry) => entry.trim().replace(/^\./, ""))
      .filter(Boolean)
  );

  // Every packaged class that sets a visible `display` must be in the list, or
  // `element.hidden = true` is cosmetic for consumers of that surface.
  const classesSettingDisplay = new Set();
  for (const [, selector, body] of stripped.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!/(^|;|\s)display\s*:/.test(body) || /display\s*:\s*none/.test(body)) {
      continue;
    }
    for (const branch of selector.split(",")) {
      const match = branch.trim().match(/^\.([a-z0-9-]+)$/);
      if (match) {
        classesSettingDisplay.add(match[1]);
      }
    }
  }
  assert(
    classesSettingDisplay.size >= 10,
    `the [hidden] guard is only meaningful if packaged classes set a visible display; found ${classesSettingDisplay.size}.`
  );
  const unguarded = [...classesSettingDisplay].filter((name) => !guarded.has(name)).sort();
  assert(
    unguarded.length === 0,
    `these packaged classes set a visible display but are missing from the [hidden] guard, so hiding them does nothing for consumers: ${unguarded.join(", ")}.`
  );
  assert(
    guarded.has("toolbar-button"),
    "`.toolbar-button` is hidden via the hidden attribute by createRichBlockControls; it must stay covered by the [hidden] guard."
  );
}


// The anchored surface is package-owned styling now.
for (const needle of [".rich-block-controls", ".code-block-controls", "--mme-block-controls-top"]) {
  assert(packageStyles.includes(needle), `packaged stylesheet must own ${needle} (MME-0100 ownership rule).`);
}
assert(
  !/(^|\n)\s*\.rich-block-controls[\s,:.[{]/.test(demoStyles),
  "demo stylesheet must not redefine the package-owned .rich-block-controls surface."
);
assert(
  !/(^|\n)\s*\.code-block-controls[\s,:.[{]/.test(demoStyles),
  "demo stylesheet must not redefine the package-owned .code-block-controls surface."
);
assert(
  !packageStyles.includes("grid-row: 2;\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  min-height: 36px;"),
  "the anchored surface must not be reintroduced as a pinned grid row."
);

// ---------------------------------------------------------------------------
// registration
// ---------------------------------------------------------------------------

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
assert.equal(
  packageJson.scripts["test:rich-overlay-hygiene"],
  "npm run build && node tests/rich-overlay-hygiene.test.mjs",
  "Missing test:rich-overlay-hygiene script."
);
assert(
  packageJson.scripts.test.includes("test:rich-overlay-hygiene"),
  "Root npm test must include the overlay hygiene gate."
);
assert.equal(
  packageJson.scripts["visual:mme-0086"],
  "node scripts/visual-check-mme0086.mjs",
  "Missing visual:mme-0086 script."
);

console.log("rich-overlay-hygiene: all assertions passed.");
