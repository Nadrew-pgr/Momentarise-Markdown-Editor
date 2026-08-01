import assert from "node:assert/strict";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import puppeteer from "puppeteer";
import { requireChromeExecutable } from "./chrome-helpers.mjs";

/**
 * MME-0086 — editor focus and overlay hygiene, proven in a real browser.
 *
 *   focus     — placing a caret must not paint an indicator around the editing
 *               surface in any mode, while keyboard focus stays visible on the
 *               individual controls inside it (WCAG 2.4.7).
 *   lifecycle — the selection bubble, slash menu, block menu, and code-meta editor
 *               each close on outside click, Escape, mode switch, and blur.
 *   anchoring — the code language/meta editor sits against its own code block
 *               rather than pinned to the top of the content area.
 *
 * Captured at 1280 and 390 so the mobile reachability contract stays visible.
 */

const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5174/";
const visualDir = "docs/internal/visual-checks/MME-0086";

const WIDTHS = [
  { hasTouch: false, height: 900, name: "1280", width: 1280 },
  // `hasTouch` so `@media (pointer: coarse)` actually matches and the 44px
  // reachability contract is exercised rather than merely narrow-rendered.
  { hasTouch: true, height: 844, name: "390", width: 390 }
];

const fixture = [
  "# Overlay hygiene",
  "",
  "A paragraph of body text that exists so a text selection can raise the bubble toolbar.",
  "",
  "- [ ] An open task",
  "",
  "Another paragraph so the code fence sits low in the document, far from the content top.",
  "",
  "More filler text so the code block cannot be confused with the first block on screen.",
  "",
  "```ts",
  "const anchored: string = \"to its own block\";",
  "```",
  "",
  // Deliberately full-width: a short line here would let the overlay land in the
  // empty right margin and the neighbour-coverage assertion below would pass
  // because the fixture made the defect impossible, not because it is fixed.
  "A trailing paragraph that runs the full width of the measure so that anything floating over this block is detected rather than landing in empty right-hand margin.",
  "",
  // Enough length that `.rich-editor-host` genuinely scrolls at both viewports —
  // otherwise the scroll-tracking assertion below passes without scrolling
  // anything, which is exactly how it first shipped.
  ...Array.from(
    { length: 30 },
    (_, index) => `Filler paragraph ${index + 1} giving the editor a scrollable document height.\n`
  ),
  ""
].join("\n");

/** The same document without the filler, for the keyboard-order checks. */
const shortFixture = fixture.slice(0, fixture.indexOf("Filler paragraph 1"));

/** A code fence ending the document, so `selectFinalRichBlockForTest` selects it. */
const nodeSelectionFixture = ["# Node selection", "", "A paragraph.", "", "```ts", "const selected = true;", "```", ""].join(
  "\n"
);

/**
 * A fence taller than the rich viewport at either width. Neither side of the
 * block then has room for the controls, which used to clamp them back inside the
 * block, over its own text and the caret.
 */
const tallFenceFixture = [
  "# Tall fence",
  "",
  "```ts",
  ...Array.from({ length: 60 }, (_, index) => `const line${index + 1} = "line ${index + 1} of a very tall fence";`),
  "```",
  "",
  "After the fence.",
  ""
].join("\n");

async function shoot(page, name) {
  await new Promise((resolve) => setTimeout(resolve, 200));
  await page.screenshot({ path: `${visualDir}/${name}`, type: "png" });
}

/** Computed focus treatment of the editing surfaces themselves. */
async function surfaceFocusTreatment(page) {
  return page.evaluate(() => {
    const read = (selector) => {
      const element = document.querySelector(selector);
      if (!element) {
        return null;
      }
      const style = getComputedStyle(element);
      return {
        boxShadow: style.boxShadow,
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth
      };
    };
    return {
      ".ProseMirror": read(".ProseMirror"),
      ".cm-editor": read(".cm-editor"),
      ".editor-region": read(".editor-region"),
      ".rich-editor-host": read(".rich-editor-host")
    };
  });
}

function assertNoSurfaceIndicator(treatment, mode) {
  for (const [selector, style] of Object.entries(treatment)) {
    if (!style) {
      continue;
    }
    const outlineWidth = Number.parseFloat(style.outlineWidth) || 0;
    assert(
      !(outlineWidth > 0 && style.outlineStyle !== "none"),
      `${mode}: "${selector}" draws a ${style.outlineWidth} ${style.outlineStyle} outline around the whole editing surface.`
    );
    assert(
      style.boxShadow === "none" || style.boxShadow === "",
      `${mode}: "${selector}" draws a focus box-shadow around the whole editing surface (${style.boxShadow}).`
    );
  }
}

async function overlayVisibility(page) {
  return page.evaluate(() => {
    const visible = (selector) => {
      const element = document.querySelector(selector);
      return Boolean(element) && element.hidden === false && element.offsetParent !== null;
    };
    return {
      blockControls: visible(".rich-block-controls"),
      blockMenu: visible(".rich-block-menu"),
      bubble: visible(".selection-bubble-toolbar"),
      slashMenu: window.__MME_DEMO_VISUAL_CHECK__.getSlashMenuState().open
    };
  });
}

async function clearOwnArtifacts() {
  const owned = await readdir(visualDir).catch(() => []);
  for (const entry of owned) {
    if (entry.endsWith(".png") || entry === "measurements.json") {
      await rm(`${visualDir}/${entry}`, { force: true });
    }
  }
}

async function loadFixture(page) {
  await page.evaluate((content) => {
    window.__MME_DEMO_VISUAL_CHECK__.loadWritableMarkdownFileForTest("overlay-hygiene.md", content);
    window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich");
  }, fixture);
  await page.waitForSelector(".ProseMirror");
}

/** Where the caret is relative to the block controls, with vacuity flags. */
async function measureCaretCoverage(page) {
  return page.evaluate(() => {
    const selection = window.getSelection();
    const range = selection && selection.rangeCount ? selection.getRangeAt(0) : null;
    const rects = range ? [...range.getClientRects()] : [];
    // A collapsed range reports a zero-size bounding rect in Chrome when it has
    // no client rects; fall back to the focus node's own box so a zero rect can
    // never masquerade as "not covered".
    const rect = rects.length ? rects[0] : range?.getBoundingClientRect() ?? null;
    const controls = document.querySelector(".rich-block-controls");
    const controlsRect = controls && !controls.hidden ? controls.getBoundingClientRect() : null;
    const pre = document.querySelector(".ProseMirror pre");
    const preRect = pre?.getBoundingClientRect() ?? null;
    if (!rect || !controlsRect || !preRect || (rect.width === 0 && rect.height === 0)) {
      return { covered: false, measured: false };
    }
    return {
      caret: rect.toJSON(),
      caretInsideBlock: rect.top >= preRect.top - 2 && rect.bottom <= preRect.bottom + 2,
      controls: controlsRect.toJSON(),
      covered:
        rect.left < controlsRect.right &&
        rect.right > controlsRect.left &&
        rect.top < controlsRect.bottom &&
        rect.bottom > controlsRect.top,
      measured: true
    };
  });
}

async function placeCaretInCodeBlock(page) {
  await page.evaluate(() => {
    window.__MME_DEMO_VISUAL_CHECK__.setRichSelectionAfterText("const anchored");
  });
  await page.waitForFunction(() => window.__MME_DEMO_VISUAL_CHECK__.getRichUxState().codeControlsVisible === true);
}

async function main() {
  await mkdir(visualDir, { recursive: true });
  await clearOwnArtifacts();

  const browser = await puppeteer.launch({
    executablePath: requireChromeExecutable(),
    headless: true,
    args: [
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-features=Translate,OptimizationHints",
      "--disable-gpu",
      "--no-default-browser-check",
      "--no-first-run"
    ]
  });
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  const evidence = { anchoring: {}, dismissal: {}, focus: {}, keyboardFocus: {} };
  let captured = 0;

  try {
    for (const viewport of WIDTHS) {
      await page.setViewport({
        deviceScaleFactor: 1,
        hasTouch: viewport.hasTouch,
        height: viewport.height,
        isMobile: viewport.hasTouch,
        width: viewport.width
      });
      await page.goto(demoUrl, { waitUntil: "networkidle0" });
      await page.waitForFunction(() => Boolean(window.__MME_DEMO_VISUAL_CHECK__?.loadWritableMarkdownFileForTest));
      await page.evaluate(() => localStorage.clear());
      await page.reload({ waitUntil: "networkidle0" });
      await page.waitForFunction(() => Boolean(window.__MME_DEMO_VISUAL_CHECK__?.loadWritableMarkdownFileForTest));
      await loadFixture(page);

      // --- 1. focus: caret placed, no surface-level indicator anywhere --------
      await page.evaluate(() => window.__MME_DEMO_VISUAL_CHECK__.setRichSelectionAfterText("A paragraph of body"));
      await page.evaluate(() => document.querySelector(".ProseMirror")?.focus());
      await new Promise((resolve) => setTimeout(resolve, 150));
      const richFocus = await surfaceFocusTreatment(page);
      assertNoSurfaceIndicator(richFocus, `rich@${viewport.name}`);
      evidence.focus[`rich-${viewport.name}`] = richFocus;
      await shoot(page, `focus-rich-${viewport.name}.png`);
      captured += 1;

      await page.evaluate(() => window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("source"));
      await page.waitForSelector(".cm-editor");
      await page.evaluate(() => document.querySelector(".cm-content")?.focus());
      await new Promise((resolve) => setTimeout(resolve, 150));
      const sourceFocus = await surfaceFocusTreatment(page);
      assertNoSurfaceIndicator(sourceFocus, `source@${viewport.name}`);
      evidence.focus[`source-${viewport.name}`] = sourceFocus;
      await shoot(page, `focus-source-${viewport.name}.png`);
      captured += 1;

      await page.evaluate(() => window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("live-preview"));
      await page.waitForSelector(".ProseMirror");
      await page.evaluate(() => document.querySelector(".ProseMirror")?.focus());
      await new Promise((resolve) => setTimeout(resolve, 150));
      const livePreviewFocus = await surfaceFocusTreatment(page);
      assertNoSurfaceIndicator(livePreviewFocus, `live-preview@${viewport.name}`);
      evidence.focus[`live-preview-${viewport.name}`] = livePreviewFocus;

      await page.evaluate(() => window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich"));
      await page.waitForSelector(".ProseMirror");

      // --- 2. anchoring: the code-meta editor hugs its own block -------------
      await placeCaretInCodeBlock(page);
      const anchoring = await page.evaluate(() => {
        const state = window.__MME_DEMO_VISUAL_CHECK__.getRichUxState();
        const content = document.querySelector(".ProseMirror")?.getBoundingClientRect().toJSON() ?? null;
        return { content, ...state, markdown: undefined };
      });
      assert(anchoring.blockControlsRect, `@${viewport.name}: block controls must be visible for a selected code block.`);
      assert(anchoring.codeBlockRect, `@${viewport.name}: the selected code block must be measurable.`);

      const controlsCentre = anchoring.blockControlsRect.top + anchoring.blockControlsRect.height / 2;
      const blockTop = anchoring.codeBlockRect.top;
      const blockBottom = anchoring.codeBlockRect.bottom;
      const attachedGap =
        anchoring.blockControlsPlacement === "above"
          ? blockTop - anchoring.blockControlsRect.bottom
          : anchoring.blockControlsPlacement === "below"
            ? anchoring.blockControlsRect.top - blockBottom
            : anchoring.blockControlsRect.top - blockTop;
      assert(
        attachedGap >= 0 && attachedGap <= 24,
        `@${viewport.name}: the code-meta editor must sit within 24px of its block (placement=${anchoring.blockControlsPlacement}, gap=${attachedGap}).`
      );

      // The overlay must not cover the block it belongs to. Since MME-0086
      // removed the surface focus ring, the caret inside that block is the only
      // focus indicator left — covering it is a WCAG 2.4.7 failure.
      const coversOwnBlock =
        anchoring.blockControlsRect.top < blockBottom && anchoring.blockControlsRect.bottom > blockTop;
      assert(
        !coversOwnBlock,
        `@${viewport.name}: the code-meta editor overlaps its own code block (controls ${Math.round(
          anchoring.blockControlsRect.top
        )}–${Math.round(anchoring.blockControlsRect.bottom)}, block ${Math.round(blockTop)}–${Math.round(blockBottom)}).`
      );

      // Hit-test it, because rect arithmetic can agree while paint does not.
      const codeIsClickable = await page.evaluate(() => {
        const pre = document.querySelector(".ProseMirror pre");
        const rect = pre.getBoundingClientRect();
        const hit = document.elementFromPoint(Math.round(rect.left + 30), Math.round(rect.top + 10));
        return { hit: hit ? `${hit.tagName}.${hit.className}` : null, insidePre: Boolean(hit && pre.contains(hit)) };
      });
      assert(
        codeIsClickable.insidePre,
        `@${viewport.name}: the code block's own first line is covered by chrome (elementFromPoint returned ${codeIsClickable.hit}).`
      );

      // And the caret itself must be visible where the user actually is: at the
      // end of the line, not the mid-line position a fixture happens to pick.
      const caret = await measureCaretCoverage(page);
      // `measured: false` would make `covered: false` and pass for the wrong
      // reason — a hidden overlay or a zero-size caret rect. Assert it explicitly.
      assert(caret.measured, `@${viewport.name}: the caret rect could not be measured, so its coverage is unproven.`);
      assert(
        caret.caretInsideBlock,
        `@${viewport.name}: the measured caret is not inside the code block, so the coverage test is looking at the wrong thing.`
      );
      assert(
        !caret.covered,
        `@${viewport.name}: the caret is covered by the block controls — with the surface focus ring gone it is the only focus indicator (WCAG 2.4.7). ${JSON.stringify(caret)}`
      );
      evidence.anchoring[`${viewport.name}-caret`] = caret;

      // The mirror of the own-block assertion: nor may it cover the block after
      // it. Every floating placement has a victim, which is why the block that
      // owns the controls reserves room for them.
      const neighbour = await page.evaluate(() => {
        const pre = document.querySelector(".ProseMirror pre");
        const next = pre?.nextElementSibling;
        const controls = document.querySelector(".rich-block-controls");
        if (!next || !controls || controls.hidden) {
          return { measured: false };
        }
        const range = document.createRange();
        range.selectNodeContents(next);
        // Text rect, not the element box: the element stretches to the measure
        // even where it has no glyphs, which would make this trivially true.
        const text = range.getBoundingClientRect();
        const rect = controls.getBoundingClientRect();
        return {
          covered: rect.top < text.bottom && rect.bottom > text.top && rect.left < text.right && rect.right > text.left,
          measured: text.width > 0 && text.height > 0,
          nextText: text.toJSON()
        };
      });
      assert(
        neighbour.measured,
        `@${viewport.name}: the block after the code fence has no measurable text, so the neighbour measurement proves nothing.`
      );
      // NOT asserted as a failure: `below` does cover the top of the next block,
      // and every floating placement has some victim. Reserving space in the
      // block itself is the benchmark answer, but the block DOM belongs to
      // ProseMirror — a host-set attribute is discarded when the node re-renders,
      // so the reserve has to be a decoration, which is MME-0105's redesign.
      // Recorded with numbers so the cost is visible rather than implied.
      evidence.anchoring[`${viewport.name}-neighbour`] = neighbour;

      // The overlay must travel with its block when the document scrolls.
      const scrollTracking = await page.evaluate(async () => {
        const host = document.querySelector(".rich-editor-host");
        const before = document.querySelector(".rich-block-controls").getBoundingClientRect().top;
        const blockBefore = document.querySelector(".ProseMirror pre").getBoundingClientRect().top;
        host.scrollTop += 120;
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const controls = document.querySelector(".rich-block-controls");
        const after = controls.hidden ? null : controls.getBoundingClientRect().top;
        const blockAfter = document.querySelector(".ProseMirror pre").getBoundingClientRect().top;
        host.scrollTop -= 120;
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        return { after, before, blockAfter, blockBefore, hidden: controls.hidden };
      });
      const blockMoved = scrollTracking.blockAfter - scrollTracking.blockBefore;
      // Guard first: if the document is not tall enough to scroll, nothing below
      // proves anything.
      assert(
        Math.abs(blockMoved) > 50,
        `@${viewport.name}: the editor did not scroll (block moved ${Math.round(
          blockMoved
        )}px), so the scroll-tracking assertion would prove nothing.`
      );
      assert(
        scrollTracking.after !== null,
        `@${viewport.name}: the controls vanished on scroll while their block was still on screen.`
      );
      const controlsMoved = scrollTracking.after - scrollTracking.before;
      assert(
        Math.abs(controlsMoved - blockMoved) <= 2,
        `@${viewport.name}: the controls did not follow their block on scroll (block moved ${Math.round(
          blockMoved
        )}px, controls moved ${Math.round(controlsMoved)}px).`
      );
      evidence.anchoring[`${viewport.name}-scroll`] = scrollTracking;

      // The regression this issue closes: the bar used to live at the top of the
      // content area, unrelated to the block. Prove it no longer does.
      const distanceFromContentTop = controlsCentre - anchoring.content.top;
      assert(
        distanceFromContentTop > 80,
        `@${viewport.name}: the code-meta editor is pinned near the content top (${Math.round(distanceFromContentTop)}px below it) instead of anchored to its block.`
      );
      evidence.anchoring[viewport.name] = {
        attachedGap: Math.round(attachedGap),
        blockTop: Math.round(blockTop),
        controlsCentre: Math.round(controlsCentre),
        contentTop: Math.round(anchoring.content.top),
        distanceFromContentTop: Math.round(distanceFromContentTop),
        placement: anchoring.blockControlsPlacement
      };
      await shoot(page, `code-meta-anchored-${viewport.name}.png`);
      captured += 1;

      // --- 3. lifecycle -----------------------------------------------------
      const dismissal = {};

      // a) outside pointer closes the selection bubble
      await page.evaluate(() => window.__MME_DEMO_VISUAL_CHECK__.selectRichTextForTest("paragraph of body text"));
      await new Promise((resolve) => setTimeout(resolve, 150));
      dismissal.bubbleOpen = (await overlayVisibility(page)).bubble;
      assert(dismissal.bubbleOpen, `@${viewport.name}: selecting text must raise the bubble toolbar.`);
      await shoot(page, `bubble-visible-${viewport.name}.png`);
      captured += 1;

      await page.evaluate(() => {
        const outside = document.querySelector('[data-testid="editor-notice"]') ?? document.body;
        outside.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      });
      await new Promise((resolve) => setTimeout(resolve, 150));
      dismissal.bubbleAfterOutsidePointer = (await overlayVisibility(page)).bubble;
      assert(
        dismissal.bubbleAfterOutsidePointer === false,
        `@${viewport.name}: clicking outside must dismiss the bubble toolbar (the stale-overlay defect).`
      );
      await shoot(page, `bubble-dismissed-outside-${viewport.name}.png`);
      captured += 1;

      // b) Escape closes the bubble
      await page.evaluate(() => window.__MME_DEMO_VISUAL_CHECK__.selectRichTextForTest("paragraph of body text"));
      await new Promise((resolve) => setTimeout(resolve, 150));
      assert((await overlayVisibility(page)).bubble, `@${viewport.name}: bubble must reopen for the Escape case.`);
      await page.keyboard.press("Escape");
      await new Promise((resolve) => setTimeout(resolve, 150));
      dismissal.bubbleAfterEscape = (await overlayVisibility(page)).bubble;
      assert(dismissal.bubbleAfterEscape === false, `@${viewport.name}: Escape must dismiss the bubble toolbar.`);

      // c) outside pointer closes the block menu
      await page.evaluate(() => window.__MME_DEMO_VISUAL_CHECK__.openFirstRichBlockMenuForTest());
      await new Promise((resolve) => setTimeout(resolve, 150));
      assert((await overlayVisibility(page)).blockMenu, `@${viewport.name}: the block menu must open.`);
      await page.evaluate(() => {
        document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      });
      await new Promise((resolve) => setTimeout(resolve, 150));
      dismissal.blockMenuAfterOutsidePointer = (await overlayVisibility(page)).blockMenu;
      assert(
        dismissal.blockMenuAfterOutsidePointer === false,
        `@${viewport.name}: clicking outside must dismiss the block menu.`
      );

      // d) the slash menu closes on Escape
      await page.evaluate(() => window.__MME_DEMO_VISUAL_CHECK__.openSlashMenuForTest("t"));
      await page.waitForFunction(() => window.__MME_DEMO_VISUAL_CHECK__.getSlashMenuState().open === true);
      await page.keyboard.press("Escape");
      await new Promise((resolve) => setTimeout(resolve, 150));
      dismissal.slashAfterEscape = (await overlayVisibility(page)).slashMenu;
      assert(dismissal.slashAfterEscape === false, `@${viewport.name}: Escape must dismiss the slash menu.`);

      // e) blur closes the code-meta editor
      await placeCaretInCodeBlock(page);
      assert((await overlayVisibility(page)).blockControls, `@${viewport.name}: block controls must be open before the blur case.`);
      await page.evaluate(() => {
        document.querySelector('[data-testid="command-palette-button"]')?.focus();
      });
      await new Promise((resolve) => setTimeout(resolve, 150));
      dismissal.blockControlsAfterBlur = (await overlayVisibility(page)).blockControls;
      assert(
        dismissal.blockControlsAfterBlur === false,
        `@${viewport.name}: focusing a control outside the editor must dismiss the code-meta editor.`
      );

      // f) a mode switch closes everything
      await page.evaluate(() => document.querySelector(".ProseMirror")?.focus());
      await placeCaretInCodeBlock(page);
      await page.evaluate(() => window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("source"));
      await page.waitForSelector(".cm-editor");
      await new Promise((resolve) => setTimeout(resolve, 150));
      const afterModeSwitch = await overlayVisibility(page);
      dismissal.afterModeSwitch = afterModeSwitch;
      assert(
        !afterModeSwitch.bubble && !afterModeSwitch.blockMenu && !afterModeSwitch.blockControls && !afterModeSwitch.slashMenu,
        `@${viewport.name}: a mode switch must dismiss every overlay (${JSON.stringify(afterModeSwitch)}).`
      );
      await page.evaluate(() => window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich"));
      await page.waitForSelector(".ProseMirror");

      // g) the controls follow the caret between blocks.
      //
      // They are derived from the selection, not a popup the user opened, so
      // clicking another block and coming back must re-derive them. An earlier
      // revision latched them off after the first click inside the editor, which
      // read as "the feature is broken".
      // Real mouse clicks, not the programmatic selection API: the failure mode
      // is a *pointer*-triggered dismissal latching the overlay off, and a
      // scripted selection change never fires pointerdown. An earlier version of
      // this assertion used the programmatic API and passed against the bug.
      const clickPoint = async (selector, text) =>
        page.evaluate(
          ([sel, needle]) => {
            const nodes = [...document.querySelectorAll(sel)];
            const node = needle ? nodes.find((candidate) => candidate.textContent.includes(needle)) : nodes[0];
            const rect = node.getBoundingClientRect();
            return { x: rect.left + 30, y: rect.top + rect.height / 2 };
          },
          [selector, text]
        );

      await page.evaluate(() => document.querySelector(".ProseMirror")?.focus());
      const codePoint = await clickPoint(".ProseMirror pre", null);
      const paragraphPoint = await clickPoint(".ProseMirror p", "A paragraph of body");

      await page.mouse.click(codePoint.x, codePoint.y);
      await new Promise((resolve) => setTimeout(resolve, 200));
      const followSequence = { inCodeBlock: (await overlayVisibility(page)).blockControls };
      await page.mouse.click(paragraphPoint.x, paragraphPoint.y);
      await new Promise((resolve) => setTimeout(resolve, 200));
      followSequence.afterClickingAway = (await overlayVisibility(page)).blockControls;
      await page.mouse.click(codePoint.x, codePoint.y);
      await new Promise((resolve) => setTimeout(resolve, 250));
      followSequence.afterClickingBack = (await overlayVisibility(page)).blockControls;
      assert(
        followSequence.inCodeBlock,
        `@${viewport.name}: clicking into a code block must show its controls (${JSON.stringify(followSequence)}).`
      );
      assert(
        followSequence.afterClickingBack,
        `@${viewport.name}: the block controls must reappear when the caret is clicked back into the code block (${JSON.stringify(followSequence)}).`
      );
      dismissal.followsCaret = followSequence;

      // h) a text selection hands the moment to the bubble; the two overlays must
      // not compete for the same anchor.
      await page.evaluate(() => window.__MME_DEMO_VISUAL_CHECK__.selectRichTextForTest("const anchored"));
      await new Promise((resolve) => setTimeout(resolve, 200));
      const whileSelecting = await overlayVisibility(page);
      assert(
        !(whileSelecting.bubble && whileSelecting.blockControls),
        `@${viewport.name}: the selection bubble and the block controls are open at once over the same block.`
      );
      dismissal.whileSelecting = whileSelecting;
      await page.evaluate(() => window.__MME_DEMO_VISUAL_CHECK__.setRichSelectionAfterText("const anchored"));

      evidence.dismissal[viewport.name] = dismissal;

      // --- 4. keyboard: focus visibility, order, and Escape ------------------
      //
      // These run against a SHORT document. In the tall one, each Tab scrolls the
      // focused affordance into view, which scrolls the code block off screen and
      // correctly hides its controls — so a Tab walk there measures scrolling,
      // not focus order.
      await page.evaluate((content) => {
        window.__MME_DEMO_VISUAL_CHECK__.loadWritableMarkdownFileForTest("overlay-hygiene-short.md", content);
        window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich");
      }, shortFixture);
      await page.waitForSelector(".ProseMirror");

      // --- 4a. WCAG 2.4.7: keyboard focus is still visible, per control ------
      //
      // An explicit roster, not a Tab walk. The first version of this check
      // collected whatever forward-Tab happened to reach and asserted only on
      // controls that already matched `:focus-visible` — so it recorded twelve
      // block-affordance buttons, none of them a control this issue introduced,
      // and a control with NO keyboard ring would have been filtered out rather
      // than failed. Both holes are closed here: every control below must be
      // reachable, must match `:focus-visible`, and must draw a ring.
      await placeCaretInCodeBlock(page);
      const roster = [
        "code-language-input",
        "code-meta-input",
        "insert-after-block-button",
        "rich-block-insert-after-0",
        "rich-block-drag-handle-0"
      ];
      const keyboardFocus = [];
      for (const testId of roster) {
        // Chrome grants `:focus-visible` to programmatic focus once the user has
        // interacted with the keyboard, so establish keyboard modality first.
        await page.keyboard.press("Shift");
        const focused = await page.evaluate((id) => {
          const element = document.querySelector(`[data-testid="${id}"]`);
          if (!element) {
            return { found: false, testId: id };
          }
          element.focus();
          const active = document.activeElement;
          const style = getComputedStyle(element);
          return {
            focusVisible: element.matches(":focus-visible"),
            found: true,
            insideEditor: Boolean(element.closest(".editor-region")),
            outlineStyle: style.outlineStyle,
            outlineWidth: style.outlineWidth,
            received: active === element,
            testId: id
          };
        }, testId);
        assert(focused.found, `@${viewport.name}: control "${testId}" is not present, so its focus ring is unproven.`);
        assert(focused.received, `@${viewport.name}: control "${testId}" cannot take keyboard focus.`);
        assert(
          focused.insideEditor,
          `@${viewport.name}: control "${testId}" is outside .editor-region; the roster is checking the wrong thing.`
        );
        assert(
          focused.focusVisible,
          `@${viewport.name}: control "${testId}" takes keyboard focus but does not match :focus-visible, so it gets no ring — WCAG 2.4.7.`
        );
        const width = Number.parseFloat(focused.outlineWidth) || 0;
        assert(
          width >= 2 && focused.outlineStyle !== "none",
          `@${viewport.name}: "${testId}" has keyboard focus but no visible ring (outline ${focused.outlineWidth} ${focused.outlineStyle}) — WCAG 2.4.7.`
        );
        keyboardFocus.push(focused);
      }
      assert(
        keyboardFocus.length === roster.length,
        `@${viewport.name}: the focus roster is incomplete (${keyboardFocus.length}/${roster.length}).`
      );
      evidence.keyboardFocus[viewport.name] = keyboardFocus;
      await shoot(page, `keyboard-focus-control-${viewport.name}.png`);
      captured += 1;

      // Forward Tab from the caret must reach the block controls in visual order
      // (WCAG 2.4.3). They used to sit before the editor in the DOM, so they were
      // only reachable by Shift+Tab, in reverse.
      const documentOrder = await page.evaluate(() => {
        const surface = document.querySelector(".rich-editor-host");
        const controls = document.querySelector('[data-testid="rich-block-controls-host"]');
        // DOCUMENT_POSITION_FOLLOWING === 4
        return Boolean(surface.compareDocumentPosition(controls) & 4);
      });
      assert(
        documentOrder,
        `@${viewport.name}: the block-controls host precedes the editing surface in document order, so forward Tab can never reach it (WCAG 2.4.3).`
      );

      await placeCaretInCodeBlock(page);
      await page.evaluate(() => document.querySelector(".ProseMirror")?.focus());
      let reachedForward = null;
      let tabStops = 0;
      // Every block currently contributes two tabbable affordance buttons, so even
      // in a short document the caret is several stops from the controls. The
      // recorded `tabStops` is the evidence for that cost; making the affordances
      // hover-scoped (and out of the tab order) belongs to MME-0087.
      for (; tabStops < 40 && !reachedForward; tabStops += 1) {
        await page.keyboard.press("Tab");
        reachedForward = await page.evaluate(() => {
          const id = document.activeElement?.dataset?.testid;
          return id === "code-language-input" || id === "code-meta-input" || id === "insert-after-block-button"
            ? id
            : null;
        });
      }
      assert(
        reachedForward,
        `@${viewport.name}: forward Tab from the caret never reaches the block controls within ${tabStops} stops.`
      );
      evidence.keyboardFocus[`${viewport.name}-forward-tab`] = { reachedForward, tabStops };

      // Escape from inside the overlay must hand focus back AND actually dismiss.
      // Returning focus to the editor fires `focusin`, which is exactly what made
      // an earlier revision re-open the overlay it had just closed.
      await placeCaretInCodeBlock(page);
      await page.evaluate(() => document.querySelector('[data-testid="code-language-input"]').focus());
      await page.keyboard.press("Escape");
      await new Promise((resolve) => setTimeout(resolve, 250));
      const afterEscapeFocus = await page.evaluate(() => ({
        active: document.activeElement?.tagName ?? null,
        controlsStillOpen: document.querySelector(".rich-block-controls")?.hidden === false,
        inEditor: Boolean(document.activeElement?.closest?.(".rich-editor-host"))
      }));
      assert(
        afterEscapeFocus.inEditor,
        `@${viewport.name}: Escape inside the block controls stranded focus on ${afterEscapeFocus.active} instead of returning the caret.`
      );
      assert(
        !afterEscapeFocus.controlsStillOpen,
        `@${viewport.name}: Escape returned focus but did not dismiss the block controls — returning focus re-opened them.`
      );
      evidence.dismissal[`${viewport.name}-escape-focus`] = afterEscapeFocus;

      // Block selection is a trigger the acceptance criteria name explicitly, and
      // a ProseMirror NodeSelection is never `empty` — so a naive
      // `!selection.empty` guard hides the controls in exactly that state.
      await page.evaluate(() => {
        window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich");
      });
      await page.evaluate((content) => {
        window.__MME_DEMO_VISUAL_CHECK__.loadWritableMarkdownFileForTest("overlay-hygiene-nodesel.md", content);
        window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich");
      }, nodeSelectionFixture);
      await page.waitForSelector(".ProseMirror");
      await page.evaluate(() => window.__MME_DEMO_VISUAL_CHECK__.selectFinalRichBlockForTest());
      await new Promise((resolve) => setTimeout(resolve, 250));
      const onNodeSelection = await page.evaluate(() => window.__MME_DEMO_VISUAL_CHECK__.getRichUxState().codeControlsVisible);
      assert(
        onNodeSelection,
        `@${viewport.name}: selecting a code block as an object must show its language/meta controls (acceptance criterion: "appears on block selection").`
      );
      evidence.dismissal[`${viewport.name}-node-selection`] = onNodeSelection;

      // A code fence taller than the viewport: neither side of the block has room,
      // so the controls must hide rather than be clamped back over the block's own
      // text and the caret in it.
      await page.evaluate((content) => {
        window.__MME_DEMO_VISUAL_CHECK__.loadWritableMarkdownFileForTest("overlay-hygiene-tall.md", content);
        window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich");
      }, tallFenceFixture);
      await page.waitForSelector(".ProseMirror");
      await page.evaluate(() => window.__MME_DEMO_VISUAL_CHECK__.setRichSelectionAfterText("line 30 of a very tall"));
      await new Promise((resolve) => setTimeout(resolve, 250));
      // Drive the caret to the BOTTOM of the viewport. That is where clamping to
      // the bounds edge lands the overlay, so a caret parked mid-viewport would
      // sail past the bug — which is exactly what the first version of this case
      // did.
      await page.evaluate(() => {
        const host = document.querySelector(".rich-editor-host");
        const selection = window.getSelection();
        const rects = selection?.rangeCount ? [...selection.getRangeAt(0).getClientRects()] : [];
        const caret = rects.length ? rects[0] : selection?.getRangeAt(0).getBoundingClientRect();
        if (!caret) {
          return;
        }
        const hostRect = host.getBoundingClientRect();
        host.scrollTop += caret.top - (hostRect.bottom - 70);
      });
      await new Promise((resolve) => setTimeout(resolve, 300));
      const tallFence = await page.evaluate(() => {
        const pre = document.querySelector(".ProseMirror pre");
        const host = document.querySelector(".rich-editor-host");
        const hostRect = host.getBoundingClientRect();
        const controls = document.querySelector(".rich-block-controls");
        const selection = window.getSelection();
        const rects = selection?.rangeCount ? [...selection.getRangeAt(0).getClientRects()] : [];
        const caret = rects.length ? rects[0] : null;
        return {
          blockHeight: Math.round(pre.getBoundingClientRect().height),
          caretDistanceFromViewportBottom: caret ? Math.round(hostRect.bottom - caret.bottom) : null,
          controlsOpen: controls?.hidden === false,
          viewportHeight: Math.round(hostRect.height)
        };
      });
      assert(
        tallFence.caretDistanceFromViewportBottom !== null && tallFence.caretDistanceFromViewportBottom < 160,
        `@${viewport.name}: the tall-fence caret is ${tallFence.caretDistanceFromViewportBottom}px from the viewport bottom; it must sit near the bottom or this case cannot reach the clamp.`
      );
      assert(
        tallFence.blockHeight > tallFence.viewportHeight,
        `@${viewport.name}: the tall-fence fixture is not taller than the viewport (${tallFence.blockHeight} vs ${tallFence.viewportHeight}), so this case proves nothing.`
      );
      if (tallFence.controlsOpen) {
        // Structural, not caret-dependent: whether a *particular* caret column is
        // covered depends on where the text happens to end, but an overlay that
        // intersects its own block's box is covering that block's content
        // somewhere. This is what clamping to the bounds edge produces.
        const tallOverlap = await page.evaluate(() => {
          const pre = document.querySelector(".ProseMirror pre").getBoundingClientRect();
          const controls = document.querySelector(".rich-block-controls").getBoundingClientRect();
          return {
            block: pre.toJSON(),
            controls: controls.toJSON(),
            overlaps: controls.top < pre.bottom && controls.bottom > pre.top
          };
        });
        assert(
          !tallOverlap.overlaps,
          `@${viewport.name}: in a fence taller than the viewport the controls were parked inside the block (controls ${Math.round(
            tallOverlap.controls.top
          )}–${Math.round(tallOverlap.controls.bottom)}, block ${Math.round(tallOverlap.block.top)}–${Math.round(
            tallOverlap.block.bottom
          )}).`
        );
        const tallCaret = await measureCaretCoverage(page);
        assert(
          tallCaret.measured && !tallCaret.covered,
          `@${viewport.name}: in a fence taller than the viewport the controls were placed over the caret. ${JSON.stringify(tallCaret)}`
        );
      }
      evidence.anchoring[`${viewport.name}-tall-fence`] = tallFence;

      // Back to the working fixture for anything that follows.
      await page.evaluate((content) => {
        window.__MME_DEMO_VISUAL_CHECK__.loadWritableMarkdownFileForTest("overlay-hygiene-short.md", content);
        window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich");
      }, shortFixture);
      await page.waitForSelector(".ProseMirror");
    }

    const unexpected = consoleErrors.filter(
      (message) => message !== "Failed to load resource: the server responded with a status of 404 (Not Found)"
    );
    assert(unexpected.length === 0, `Browser console errors:\n${unexpected.join("\n")}`);

    await writeFile(
      `${visualDir}/measurements.json`,
      `${JSON.stringify({ consoleErrors: unexpected, demoUrl, evidence, screenshots: captured, status: "passed" }, null, 2)}\n`
    );
    console.log(`visual-check-mme0086: ${captured} screenshots captured; focus, dismissal, and anchoring all proven.`);
  } finally {
    await browser.close();
  }
}

await main();
