/**
 * MME-0119 — a viewport-positioned overlay may not live inside a containing block.
 *
 * `position: fixed` resolves against the viewport only while no ancestor
 * establishes a containing block for fixed descendants. `transform`, `filter`,
 * `backdrop-filter`, `perspective`, `will-change` and `contain` all do.
 *
 * MME-0102 gave `.rich-command-toolbar` `backdrop-filter: var(--mme-blur-chrome)`
 * for its glass treatment. The More menu was a child of that toolbar and set
 * `position: fixed`, so its coordinates — correctly computed against the viewport
 * by `positionToolbarMoreMenu` — were then resolved against the toolbar instead,
 * displacing the menu by exactly the toolbar's `scrollLeft`. Measured at 390x844
 * with a real coarse pointer: `left: -178` for an inline `left: 126px` at
 * `scrollLeft: 304`, and `bottom: 936` against an 844px viewport. On a phone the
 * toolbar always scrolls, so the More menu was unreachable.
 *
 * The rule this file enforces is the surface contract, not a patch for one menu:
 * an overlay that positions against the viewport is rendered in the portal layer,
 * outside every ancestor that could capture it. A `scrollLeft` compensation is
 * forbidden — it treats the symptom and breaks again on the next scroll
 * container.
 *
 * Structure is asserted here in a real DOM; the rendered geometry is proven by
 * `visual-check-mme0119` and `visual-check-mme0078` in a browser.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(join(repoRoot, relativePath), "utf8");

const surface = await import("../packages/md-surface/dist/index.js");

/** Properties that make an element a containing block for `position: fixed`. */
const CONTAINING_BLOCK_PROPERTIES = [
  "backdrop-filter",
  "contain",
  "filter",
  "perspective",
  "transform",
  "will-change"
];

const dom = new JSDOM("<!doctype html><html><body></body></html>");
const { document } = dom.window;

const host = document.createElement("div");
document.body.append(host);

/** The toolbar only needs the session to subscribe to destroy/state events. */
const session = {
  on() {
    return () => {};
  }
};

const toolbar = surface.createToolbar({
  host,
  session,
  icons: {
    render(name) {
      return `<span data-icon="${name}" aria-hidden="true"></span>`;
    }
  },
  // A full preference object: the toolbar reads aiEntryPoints and the visible
  // command groups directly, so a partial one produces a TypeError rather than
  // the assertion failure this file is here to observe.
  preferences: {
    aiEntryPoints: ["toolbar", "slash", "palette"],
    layoutDensity: "comfortable",
    modeControl: "segmented",
    slashEnabled: true,
    slashGroups: ["format", "insert", "ai"],
    toolbarMode: "sticky",
    toolbarStyle: "glass",
    visibleCommandGroups: ["format", "insert", "ai"]
  },
  state: {
    activeCommands: [],
    editorMode: "rich",
    visible: true
  },
  strings: surface.defaultMmeStrings,
  onAiToolbar() {},
  onRunToolbarItem() {}
});

toolbar.setMoreOpen(true);

/* ------------------------------------------------------------------ *
 * 1. The overlay is reachable at all.
 * ------------------------------------------------------------------ */

const menu = document.querySelector('[data-testid="toolbar-more-menu"]');
assert.ok(
  menu,
  "The More menu must exist in the document after setMoreOpen(true). " +
    "If this fails the assertions below prove nothing, because they would all pass against a missing element."
);
assert.equal(menu.hidden, false, "setMoreOpen(true) must reveal the menu.");
assert.ok(
  menu.querySelectorAll("button").length >= 3,
  `The More menu must contain its commands; found ${menu.querySelectorAll("button").length}.`
);

/* ------------------------------------------------------------------ *
 * 2. It is portalled: not inside the toolbar, and not inside anything
 *    the packaged stylesheet gives a containing-block property.
 * ------------------------------------------------------------------ */

assert.equal(
  toolbar.root.contains(menu),
  false,
  "The More menu must not be a descendant of `.rich-command-toolbar`. " +
    "The toolbar carries `backdrop-filter` for MME-0102's glass treatment, which makes it the containing block for " +
    "`position: fixed` descendants — so a menu inside it is displaced by the toolbar's scroll offset and leaves the viewport."
);

const theme = read("packages/md-theme/src/styles.css").replace(/\/\*[\s\S]*?\*\//g, "");

/** Class names the packaged stylesheet gives a containing-block property. */
const capturingClasses = new Set();
/** Attribute names a capturing rule selects on. */
const capturingAttributes = new Set();
for (const [, prelude, body] of theme.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  const declares = CONTAINING_BLOCK_PROPERTIES.some((property) =>
    new RegExp(`(^|;|\\s)${property}\\s*:\\s*(?!none)`).test(body)
  );
  if (!declares) {
    continue;
  }
  for (const [, name] of prelude.matchAll(/\.([a-zA-Z0-9_-]+)/g)) {
    capturingClasses.add(name);
  }
  /*
   * Attribute selectors count too. The first version of this scan only harvested
   * `.class` tokens, so moving the layer's rules to
   * `[data-mme-overlay-layer] { backdrop-filter: … }` reintroduced the whole
   * defect while every assertion still passed.
   */
  for (const [, attribute] of prelude.matchAll(/\[([a-zA-Z0-9_-]+)[^\]]*\]/g)) {
    capturingAttributes.add(attribute);
  }
}

assert.ok(
  capturingClasses.has("rich-command-toolbar"),
  "`.rich-command-toolbar` must still be recognised as carrying a containing-block property. " +
    "If it stops, the glass treatment was removed — which MME-0119 explicitly rejected as the fix — or this scan has broken."
);

const ancestry = [];
for (let element = menu.parentElement; element; element = element.parentElement) {
  ancestry.push(element);
  const captured = [
    ...[...element.classList].filter((name) => capturingClasses.has(name)),
    ...[...element.attributes]
      .map((attribute) => attribute.name)
      .filter((name) => capturingAttributes.has(name)),
    // An inline style is the third way in, and no stylesheet scan would see it.
    ...CONTAINING_BLOCK_PROPERTIES.filter((property) => {
      const inline = element.style.getPropertyValue(property);
      return inline && inline !== "none";
    })
  ];
  assert.deepEqual(
    captured,
    [],
    `\`${element.tagName.toLowerCase()}.${[...element.classList].join(".")}\` is an ancestor of the More menu and the packaged ` +
      `stylesheet gives it ${captured.join(", ")}, which establishes a containing block for fixed positioning. ` +
      "Render the overlay in the portal layer instead."
  );
}

assert.ok(
  ancestry.at(-1) === document.documentElement,
  "The overlay's ancestor chain must reach the document root; a detached overlay is not rendered at all."
);

/* ------------------------------------------------------------------ *
 * 3. The portal layer is a real, declared thing — not an accident.
 * ------------------------------------------------------------------ */

const layer = document.querySelector("[data-mme-overlay-layer]");
assert.ok(
  layer,
  "A `[data-mme-overlay-layer]` element must exist. The contract is that viewport-positioned overlays render there, " +
    "so `document.body.append(menu)` scattered per component is not the fix."
);
assert.ok(layer.contains(menu), "The More menu must be rendered inside the overlay layer.");
assert.equal(layer.parentElement, document.body, "The overlay layer must be a direct child of <body>.");

/* ------------------------------------------------------------------ *
 * 4. The position is computed against the viewport, not compensated.
 * ------------------------------------------------------------------ */

const positioning = read("packages/md-surface/src/index.ts");
const positionFunction = positioning.slice(
  positioning.indexOf("function positionToolbarMoreMenu"),
  positioning.indexOf("function findIconButton")
);
assert.ok(positionFunction.length > 100, "positionToolbarMoreMenu must still exist; this check reads its body.");
assert.equal(
  /scrollLeft|scrollTop|scrollX|scrollY/.test(positionFunction),
  false,
  "Overlay positioning must not read a scroll offset. Compensating for the containing block treats the symptom, " +
    "and breaks again the moment the overlay is placed in a different scroll container (MME-0119)."
);
assert.match(
  positionFunction,
  /innerWidth|innerHeight/,
  "Overlay positioning must clamp to the viewport."
);

/* ------------------------------------------------------------------ *
 * 4b. Re-rendering replaces the portalled node instead of stacking copies.
 *
 * `root.replaceChildren()` clears the toolbar's own children on every update,
 * but it cannot clear a node that lives in the overlay layer. Without an explicit
 * replace, each state change would leave another menu behind in <body>.
 * ------------------------------------------------------------------ */

toolbar.setState({ activeCommands: [], editorMode: "rich", visible: true });
toolbar.setState({ activeCommands: [], editorMode: "rich", visible: true });
assert.equal(
  document.querySelectorAll('[data-testid="toolbar-more-menu"]').length,
  1,
  "Re-rendering the toolbar must replace the portalled menu, not add another. " +
    "A portalled node survives `root.replaceChildren()`, so every state change would otherwise leak one into <body>."
);

/* ------------------------------------------------------------------ *
 * 5. Destroying the surface removes the portalled node.
 *
 * A portalled overlay outlives its component's own subtree, so cleanup is not
 * automatic the way it was when the node lived inside the toolbar.
 * ------------------------------------------------------------------ */

toolbar.destroy();
assert.equal(
  document.querySelector('[data-testid="toolbar-more-menu"]'),
  null,
  "Destroying the toolbar must remove its portalled overlay. Otherwise every re-render leaks a menu into <body>."
);

/* ------------------------------------------------------------------ *
 * 6. Portalling must not cost the overlay its accessibility.
 *
 * Every assertion above passes against a menu inside
 * `<div data-mme-overlay-layer aria-hidden="true">` — structurally perfect and
 * invisible to every screen reader. Review found the same class of gap in the
 * real change: the menu was portalled out of Tab order with nothing to replace
 * the adjacency it lost.
 * ------------------------------------------------------------------ */

const reopened = surface.createToolbar({
  host: (() => {
    const next = document.createElement("div");
    document.body.append(next);
    return next;
  })(),
  session,
  icons: { render: (name) => `<span data-icon="${name}"></span>` },
  preferences: {
    aiEntryPoints: ["toolbar"],
    layoutDensity: "comfortable",
    modeControl: "segmented",
    slashEnabled: true,
    slashGroups: ["format"],
    toolbarMode: "sticky",
    toolbarStyle: "glass",
    visibleCommandGroups: ["format", "insert", "ai"]
  },
  state: { activeCommands: [], editorMode: "rich", visible: true },
  strings: surface.defaultMmeStrings,
  onAiToolbar() {},
  onRunToolbarItem() {}
});

const liveMenu = () => document.querySelector('[data-testid="toolbar-more-menu"]');
const liveTrigger = () => reopened.root.querySelector('[data-testid="toolbar-more-button"]');

for (const element of [liveMenu(), liveMenu()?.closest("[data-mme-overlay-layer]")]) {
  assert.notEqual(
    element?.getAttribute("aria-hidden"),
    "true",
    "Neither the overlay layer nor the menu may be aria-hidden. A structurally perfect portal that no screen reader can see is not a fix."
  );
}

assert.equal(liveMenu().getAttribute("role"), "menu", "The portalled overlay must expose a menu role.");
assert.ok(
  liveMenu().getAttribute("aria-label") || liveMenu().getAttribute("aria-labelledby"),
  "A `role=\"menu\"` with no accessible name is announced as an unnamed group."
);
for (const item of liveMenu().querySelectorAll("button")) {
  assert.match(
    item.getAttribute("role") ?? "",
    /^menuitem(checkbox|radio)?$/,
    "`role=\"menu\"` may only own menuitem-family roles; plain buttons drop NVDA and JAWS out of menu mode."
  );
  assert.equal(
    item.hasAttribute("aria-pressed"),
    false,
    "`aria-pressed` is not valid on a menuitem role; use aria-checked."
  );
}

reopened.setMoreOpen(true);
assert.equal(
  document.activeElement,
  liveMenu().querySelector("button:not([disabled])"),
  "Opening the menu must move focus into it. The portalled menu is last in the document, so Tab no longer reaches it — " +
    "focus management is what replaces the DOM adjacency the portal removed."
);

reopened.setMoreOpen(false);
assert.equal(
  document.activeElement,
  liveTrigger(),
  "Closing the menu must return focus to its trigger, or a keyboard user is dropped at the end of the document."
);

// A hidden toolbar takes its menu with it; `[hidden] { display: none }` used to
// do this for free when the menu was a child of the toolbar.
reopened.setMoreOpen(true, { focus: false });
reopened.setState({ activeCommands: [], editorMode: "rich", visible: false });
assert.equal(
  liveMenu().hidden,
  true,
  "Hiding the toolbar must hide its portalled menu; otherwise it floats over the editor with no toolbar beneath it."
);

reopened.destroy();
console.log("overlay-containing-block: More menu portalled out of every containing block, cleanup verified.");
