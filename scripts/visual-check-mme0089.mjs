import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import puppeteer from "puppeteer";
import { clearGeneratedArtifacts } from "./visual-artifacts.mjs";
import { requireChromeExecutable } from "./chrome-helpers.mjs";

/**
 * MME-0089 — the selection bubble is the formatting surface.
 *
 * Benchmark contract 4 (`docs/internal/research/editor-ux-benchmark.md`): Notion
 * and BlockNote ship no always-visible formatting toolbar. Two things therefore
 * have to be true in a real browser, and neither can be proven from a unit test:
 *
 *   1. A consumer who configures nothing gets no persistent toolbar — while a
 *      host that opts in still does. Both directions are checked, because an
 *      assertion that only checked "hidden" would also pass against a build that
 *      deleted the component.
 *   2. The bubble is *centered* on the selection within 8px, flips below near the
 *      top of the viewport, travels with the document on scroll, disappears on
 *      the first keystroke, and refuses code blocks. The old bubble lined its
 *      left edge up with the selection's start, so the longer the selection the
 *      further the affordance drifted from it — a geometric defect, measured
 *      geometrically.
 *
 * The action assertions are byte assertions, not click-registered assertions:
 * every one reads `getMarkdown()` after the real pointer interaction, so a
 * control that renders but writes the wrong Markdown fails here.
 */

const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5174/";
const visualDir = "docs/internal/visual-checks/MME-0089";

const VIEWPORTS = [
  { height: 900, name: "1280", width: 1280 },
  { height: 1024, name: "768", width: 768 },
  { height: 844, name: "390", width: 390 }
];
const SCHEMES = ["dark", "light"];

/** Every control the issue requires the bubble to carry, in render order. */
const REQUIRED_CONTROLS = [
  "selection-bubble-turn-into",
  "selection-bubble-bold",
  "selection-bubble-italic",
  "selection-bubble-strikethrough",
  "selection-bubble-inline-code",
  "selection-bubble-link",
  "selected-text-ai-bubble-action"
];

const TOUCH_FLOOR_PX = 44;

/*
 * The gate loads its own fixture rather than using the six-line built-in demo
 * document. Two criteria depend on it: the scroll-repositioning check needs a
 * document that actually overflows `.rich-editor-host` at 1280x900 (the built-in
 * one does not, so `scrollTop += 60` was a no-op and the only assertion for that
 * criterion silently never ran), and "works across paragraph, heading, list,
 * todo, quote" needs a blockquote, which the built-in document has none of.
 */
const FIXTURE = [
  "# Momentarise source mode",
  "",
  "This built-in fixture is memory-only and not written to disk.",
  "",
  "- Write Markdown",
  "- Continue lists",
  "- [ ] Continue todos",
  "",
  "> Quoted guidance for the writer",
  "",
  "```ts",
  'const canonical = "Markdown";',
  "```",
  "",
  ...Array.from({ length: 40 }, (unused, index) => `Filler paragraph ${index + 1} exists so the editor host really scrolls.\n`)
].join("\n");

const settle = async (page, ms = 160) => {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await new Promise((resolve) => setTimeout(resolve, ms));
};

async function setScheme(page, scheme) {
  await page.evaluate((value) => {
    document.documentElement.setAttribute("data-mme-scheme", value);
  }, scheme);
}

async function enterRichMode(page) {
  await page.evaluate(() => window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich"));
  await settle(page, 320);
}

async function selectText(page, needle) {
  await page.evaluate((value) => window.__MME_DEMO_VISUAL_CHECK__.selectRichTextForTest(value), needle);
  await settle(page, 160);
}

/**
 * The bubble's rect, the selection's rect, and the derived geometry the contract
 * is stated in. Reading the DOM selection rather than ProseMirror's own
 * `coordsAtPos` is deliberate: it is what the user sees highlighted, so a
 * placement that agrees with ProseMirror but not with the painted highlight is
 * still wrong.
 */
async function measureBubble(page) {
  return page.evaluate(() => {
    const bubble = document.querySelector('[data-testid="selection-bubble-toolbar"]');
    if (!bubble || bubble.hidden) {
      return { visible: false };
    }
    const rect = bubble.getBoundingClientRect();
    const selection = document.getSelection();
    const selectionRect =
      selection && selection.rangeCount > 0 && !selection.isCollapsed
        ? selection.getRangeAt(0).getBoundingClientRect()
        : null;
    /*
     * Visible controls only. Presence in the DOM is not availability: the AI
     * entry already computes `hidden` from preferences, so a wrong condition
     * anywhere here would ship an invisible control with the gate green.
     */
    const controls = [...bubble.querySelectorAll("[data-testid]")]
      .filter((node) => !node.hidden && node.getBoundingClientRect().width > 0)
      .map((node) => node.dataset.testid);
    /*
     * A rect inside the viewport says nothing about whether the bubble is
     * reachable: MME-0119 shipped an overlay that measured correctly and was
     * painted over. Hit-test the centre of every control.
     */
    const occluded = [];
    for (const node of bubble.querySelectorAll("button")) {
      if (node.hidden || node.disabled) {
        continue;
      }
      const box = node.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      if (hit && !node.contains(hit) && !hit.contains(node)) {
        occluded.push({ paintedBy: hit.className, testId: node.dataset.testid ?? node.className });
      }
    }
    /*
     * A control can be inside the viewport, unoccluded, and still unreachable:
     * the bubble's own `max-width` clipped its last button out of its box at
     * 375px, which every rect-of-the-bubble check happily passed. Overflow is
     * therefore measured on the container and on each child.
     */
    const overflowing = [...bubble.querySelectorAll("button")]
      .filter((node) => !node.hidden)
      .map((node) => ({ box: node.getBoundingClientRect(), node }))
      .filter(({ box }) => box.right > rect.right + 0.5 || box.left < rect.left - 0.5 || box.right > window.innerWidth)
      .map(({ box, node }) => ({ left: box.left, right: box.right, testId: node.dataset.testid ?? node.className }));
    const undersized = [...bubble.querySelectorAll("button")]
      .filter((node) => !node.hidden)
      .map((node) => {
        const box = node.getBoundingClientRect();
        return { height: box.height, testId: node.dataset.testid ?? node.className, width: box.width };
      });
    return {
      bubble: rect.toJSON(),
      controls,
      gapAboveSelection: selectionRect ? selectionRect.top - rect.bottom : null,
      gapBelowSelection: selectionRect ? rect.top - selectionRect.bottom : null,
      horizontalOffset: selectionRect
        ? rect.left + rect.width / 2 - (selectionRect.left + selectionRect.width / 2)
        : null,
      occluded,
      overflowing,
      overflowScroll: { client: bubble.clientWidth, scroll: bubble.scrollWidth },
      placement: bubble.dataset.placement ?? null,
      selection: selectionRect ? selectionRect.toJSON() : null,
      sizes: undersized,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
      visible: true
    };
  });
}

const markdown = (page) => page.evaluate(() => window.__MME_DEMO_VISUAL_CHECK__.getMarkdown());

const lineWith = (source, needle) => source.split("\n").find((line) => line.includes(needle)) ?? null;

/** Click a bubble control through a real pointer event at its own centre. */
async function clickControl(page, testId) {
  const box = await page.evaluate((id) => {
    const node = document.querySelector(`[data-testid="${id}"]`);
    if (!node) {
      return null;
    }
    const rect = node.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, testId);
  assert.ok(box, `control ${testId} is not in the document, so it cannot be clicked`);
  await page.mouse.click(box.x, box.y);
  await settle(page, 220);
}

async function main() {
  await mkdir(visualDir, { recursive: true });
  await clearGeneratedArtifacts(visualDir);
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
    executablePath: requireChromeExecutable(),
    headless: "new"
  });

  const evidence = {};
  try {
    for (const viewport of VIEWPORTS) {
      const page = await browser.newPage();
      const coarse = viewport.width === 390;
      await page.setViewport({
        deviceScaleFactor: 1,
        hasTouch: coarse,
        height: viewport.height,
        isMobile: coarse,
        width: viewport.width
      });
      await page.goto(demoUrl, { waitUntil: "networkidle0" });
      await page.waitForSelector('[data-testid="selection-bubble-toolbar"]');
      await page.evaluate(
        (content) => window.__MME_DEMO_VISUAL_CHECK__.loadWritableMarkdownFileForTest("bubble-fixture.md", content),
        FIXTURE
      );
      await settle(page, 220);
      const perViewport = {};

      /* ---- contract 4: no persistent toolbar for a default consumer -------- */
      await enterRichMode(page);
      const toolbarByDefault = await page.evaluate(() => {
        const toolbar = document.querySelector('[data-testid="rich-command-toolbar"]');
        return {
          hidden: toolbar?.hidden ?? null,
          height: toolbar ? toolbar.getBoundingClientRect().height : null,
          mode: document.querySelector("#app")?.dataset.toolbarMode ?? null,
          present: Boolean(toolbar)
        };
      });
      assert.equal(
        toolbarByDefault.present,
        true,
        `@${viewport.name}: the toolbar component must still exist — contract 4 turns it off, it does not delete it.`
      );
      assert.equal(
        toolbarByDefault.mode,
        "hidden",
        `@${viewport.name}: a demo configuring no toolbar preference must resolve toolbar.mode to "hidden"; got ${toolbarByDefault.mode}.`
      );
      assert.equal(
        toolbarByDefault.hidden,
        true,
        `@${viewport.name}: the persistent formatting toolbar painted ${toolbarByDefault.height}px tall with no host opt-in.`
      );

      /* The opt-in half. Without this the assertion above is satisfied by a
       * component that can never appear, which is not what the issue decided. */
      await page.evaluate(() =>
        window.__MME_DEMO_VISUAL_CHECK__.setReferenceSurfacePreferencesForTest({ toolbarMode: "sticky" })
      );
      await settle(page, 200);
      const toolbarOptedIn = await page.evaluate(() => {
        const toolbar = document.querySelector('[data-testid="rich-command-toolbar"]');
        return { height: toolbar ? toolbar.getBoundingClientRect().height : 0, hidden: toolbar?.hidden ?? null };
      });
      assert.equal(
        toolbarOptedIn.hidden,
        false,
        `@${viewport.name}: toolbarMode "sticky" is the documented Google-Docs-style opt-in and it did not appear.`
      );
      assert.ok(
        toolbarOptedIn.height > 0,
        `@${viewport.name}: the opted-in toolbar reported hidden=false but painted ${toolbarOptedIn.height}px.`
      );
      await page.evaluate(() =>
        window.__MME_DEMO_VISUAL_CHECK__.setReferenceSurfacePreferencesForTest({ toolbarMode: "hidden" })
      );
      await settle(page, 200);
      perViewport.toolbar = { byDefault: toolbarByDefault, optedIn: toolbarOptedIn };

      /* ---- the bubble's inventory and geometry ---------------------------- */
      await selectText(page, "Continue lists");
      const anchored = await measureBubble(page);
      assert.equal(anchored.visible, true, `@${viewport.name}: selecting text did not raise the selection bubble.`);
      for (const control of REQUIRED_CONTROLS) {
        assert.ok(
          anchored.controls.includes(control),
          `@${viewport.name}: the bubble is missing ${control}; it rendered ${JSON.stringify(anchored.controls)}.`
        );
      }
      assert.deepEqual(
        anchored.overflowing,
        [],
        `@${viewport.name}: ${anchored.overflowing.length} bubble control(s) are clipped out of the bubble or off the viewport (client ${anchored.overflowScroll.client} vs scroll ${anchored.overflowScroll.scroll}): ${JSON.stringify(anchored.overflowing)}`
      );
      assert.ok(
        anchored.overflowScroll.scroll <= anchored.overflowScroll.client + 0.5,
        `@${viewport.name}: the bubble needs ${anchored.overflowScroll.scroll}px but is capped at ${anchored.overflowScroll.client}px, so its trailing controls are unreachable.`
      );
      assert.deepEqual(
        anchored.occluded,
        [],
        `@${viewport.name}: ${anchored.occluded.length} bubble control(s) are painted over and cannot be clicked: ${JSON.stringify(anchored.occluded)}`
      );
      /*
       * Centered, unless centering would push the bubble out of the region — at
       * 768 the bubble is wider than the distance from the selection to the left
       * edge, so `anchoredOverlayPlacement` clamps it to the margin. That is the
       * correct outcome, and pretending otherwise would mean asserting a
       * placement that cannot exist. The clamped case still has to keep the
       * bubble horizontally over its own selection, which is the property
       * "centered" was standing in for.
       */
      const clampedLeft = anchored.bubble.left <= 12.5;
      const clampedRight = anchored.bubble.right >= anchored.viewportWidth - 12.5;
      if (clampedLeft || clampedRight) {
        assert.ok(
          anchored.bubble.right > anchored.selection.left && anchored.bubble.left < anchored.selection.right,
          `@${viewport.name}: the bubble was clamped to the ${clampedLeft ? "left" : "right"} margin and no longer overlaps its selection: ${JSON.stringify(anchored.selection)} / ${JSON.stringify(anchored.bubble)}`
        );
      } else {
        assert.ok(
          Math.abs(anchored.horizontalOffset) <= 8,
          `@${viewport.name}: the bubble is ${anchored.horizontalOffset.toFixed(1)}px off the selection's centre with room to centre; the contract is 8px. ${JSON.stringify(anchored.selection)} / ${JSON.stringify(anchored.bubble)}`
        );
      }
      perViewport.centering = { clampedLeft, clampedRight, horizontalOffset: anchored.horizontalOffset };
      const gap = anchored.placement === "above" ? anchored.gapAboveSelection : anchored.gapBelowSelection;
      assert.ok(
        gap >= 0 && gap <= 12,
        `@${viewport.name}: the bubble sits ${gap?.toFixed(1)}px from the selection (${anchored.placement}); the contract is an 8px gap.`
      );
      assert.ok(
        anchored.bubble.left >= 0 &&
          anchored.bubble.top >= 0 &&
          anchored.bubble.right <= anchored.viewportWidth &&
          anchored.bubble.bottom <= anchored.viewportHeight,
        `@${viewport.name}: the bubble left the viewport: ${JSON.stringify(anchored.bubble)}`
      );
      if (coarse) {
        /*
         * Every control, with no waiver. The first version of this check excused
         * `selection-bubble-turn-into` because its caption made it wider than the
         * floor — but the filter it was excused from tested height OR width, so
         * the waiver hid its height too. The caption is now hidden at this width
         * and the control is a 44px square like the rest.
         */
        const small = anchored.sizes.filter(
          (size) => size.height < TOUCH_FLOOR_PX - 0.5 || size.width < TOUCH_FLOOR_PX - 0.5
        );
        assert.deepEqual(
          small,
          [],
          `@${viewport.name}: ${small.length} bubble control(s) are under the ${TOUCH_FLOOR_PX}px touch floor: ${JSON.stringify(small)}`
        );
      }
      perViewport.anchored = anchored;

      /* ---- it flips below when the selection is near the top -------------- */
      await selectText(page, "Momentarise source mode");
      await page.evaluate(() => {
        document.querySelector(".rich-editor-host")?.scrollTo({ top: 0 });
      });
      await settle(page, 200);
      const flipped = await measureBubble(page);
      if (flipped.visible && flipped.bubble.top < 120) {
        assert.ok(
          flipped.placement === "below" || flipped.gapAboveSelection >= 0,
          `@${viewport.name}: a selection near the top of the region produced an overlapping placement: ${JSON.stringify(flipped)}`
        );
      }
      perViewport.nearTop = flipped;

      /* ---- it travels with the document on scroll ------------------------- */
      await selectText(page, "Continue lists");
      const beforeScroll = await measureBubble(page);
      const scrolled = await page.evaluate(() => {
        const host = document.querySelector(".rich-editor-host");
        if (!host) {
          return { after: 0, before: 0 };
        }
        const before = host.scrollTop;
        host.scrollTop += 60;
        host.dispatchEvent(new Event("scroll"));
        return { after: host.scrollTop, before };
      });
      await settle(page, 300);
      const afterScroll = await measureBubble(page);
      /*
       * The setup has to be proven, not assumed. The first version of this check
       * ran against the six-line built-in document, which never overflows: the
       * scroll was a no-op, `selectionMoved` was 0, and the only assertion for
       * this criterion sat inside an `if` that never ran. Deleting the scroll
       * listener from the host left the gate green.
       */
      assert.ok(
        scrolled.after > scrolled.before,
        `@${viewport.name}: the editor host did not scroll (${scrolled.before} -> ${scrolled.after}), so the repositioning criterion was never exercised.`
      );
      assert.ok(
        beforeScroll.visible && afterScroll.visible && beforeScroll.selection && afterScroll.selection,
        `@${viewport.name}: the bubble must survive a scroll; before=${beforeScroll.visible} after=${afterScroll.visible}`
      );
      const selectionMoved = Math.abs(afterScroll.selection.top - beforeScroll.selection.top);
      assert.ok(
        selectionMoved > 2,
        `@${viewport.name}: the selection did not move on scroll (${selectionMoved.toFixed(1)}px), so travelling with it proves nothing.`
      );
      assert.ok(
        Math.abs(afterScroll.gapAboveSelection - beforeScroll.gapAboveSelection) <= 4,
        `@${viewport.name}: the selection moved ${selectionMoved.toFixed(1)}px on scroll but the bubble's gap changed from ${beforeScroll.gapAboveSelection?.toFixed(1)} to ${afterScroll.gapAboveSelection?.toFixed(1)} — it did not travel with its selection.`
      );
      perViewport.scroll = { after: afterScroll, before: beforeScroll, scrolled, selectionMoved };

      /* Repositioning on resize, which had no coverage at all. */
      await selectText(page, "Continue lists");
      const beforeResize = await measureBubble(page);
      await page.setViewport({
        deviceScaleFactor: 1,
        hasTouch: coarse,
        height: viewport.height - 120,
        isMobile: coarse,
        width: viewport.width
      });
      await settle(page, 320);
      const afterResize = await measureBubble(page);
      assert.ok(
        afterResize.visible && Math.abs(afterResize.gapAboveSelection - beforeResize.gapAboveSelection) <= 6,
        `@${viewport.name}: the bubble did not re-anchor after a viewport resize: ${JSON.stringify({ after: afterResize.gapAboveSelection, before: beforeResize.gapAboveSelection })}`
      );
      await page.setViewport({
        deviceScaleFactor: 1,
        hasTouch: coarse,
        height: viewport.height,
        isMobile: coarse,
        width: viewport.width
      });
      await settle(page, 320);

      /* ---- the actions write real Markdown -------------------------------- */
      await selectText(page, "Write Markdown");
      const beforeStrike = await markdown(page);
      await clickControl(page, "selection-bubble-strikethrough");
      const struck = await markdown(page);
      assert.equal(
        lineWith(struck, "Write Markdown"),
        "- ~~Write Markdown~~",
        `@${viewport.name}: the strikethrough control did not write ~~ around the selection.`
      );
      await selectText(page, "Write Markdown");
      await clickControl(page, "selection-bubble-strikethrough");
      assert.equal(
        await markdown(page),
        beforeStrike,
        `@${viewport.name}: removing strikethrough did not return the document to its original bytes.`
      );

      await selectText(page, "Continue lists");
      const beforeLink = await markdown(page);
      await clickControl(page, "selection-bubble-link");
      await page.evaluate(() => {
        const input = document.querySelector('[data-testid="selection-bubble-link-input"]');
        input.value = "https://momentarise.dev";
        input.closest("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      });
      await settle(page, 260);
      const linked = await markdown(page);
      assert.equal(
        lineWith(linked, "Continue lists"),
        "- [Continue lists](https://momentarise.dev)",
        `@${viewport.name}: the link popover did not write a real Markdown destination.`
      );
      await selectText(page, "Continue lists");
      await clickControl(page, "selection-bubble-link");
      await clickControl(page, "selection-bubble-link-remove");
      assert.equal(
        await markdown(page),
        beforeLink,
        `@${viewport.name}: removing the link did not return the document to its original bytes.`
      );

      /*
       * The two keyboard criteria. `Mod-k` is shared with the command palette,
       * so both halves are checked: with a selection it must open link editing,
       * and the palette must stay shut; Escape must close that panel without
       * taking the bubble — and therefore the selection — with it.
       */
      await selectText(page, "Continue lists");
      await page.keyboard.down(process.platform === "darwin" ? "Meta" : "Control");
      await page.keyboard.press("k");
      await page.keyboard.up(process.platform === "darwin" ? "Meta" : "Control");
      await settle(page, 240);
      const afterHotkey = await page.evaluate(() => ({
        bubble: window.__MME_DEMO_VISUAL_CHECK__.getSelectionBubbleState(),
        linkInput: Boolean(document.querySelector('[data-testid="selection-bubble-link-input"]')),
        paletteOpen: document.querySelector('[data-testid="command-palette"]')?.hidden === false,
        range: window.__MME_DEMO_VISUAL_CHECK__.getSelectionRange?.() ?? null
      }));
      assert.equal(
        afterHotkey.linkInput,
        true,
        `@${viewport.name}: Cmd/Ctrl+K over a selection must open link editing; it did not. ${JSON.stringify(afterHotkey)}`
      );
      assert.equal(
        afterHotkey.paletteOpen,
        false,
        `@${viewport.name}: Cmd/Ctrl+K over a selection opened the command palette instead of the link field.`
      );
      await page.keyboard.press("Escape");
      await settle(page, 240);
      const afterEscape = await measureBubble(page);
      const escapeDiagnostic = await page.evaluate(() => {
        const bubble = document.querySelector('[data-testid="selection-bubble-toolbar"]');
        return {
          bubbleHidden: bubble?.hidden ?? null,
          linkInput: Boolean(document.querySelector('[data-testid="selection-bubble-link-input"]')),
          selection: window.__MME_DEMO_VISUAL_CHECK__.getSelectionBubbleState(),
          selectionRange: window.__MME_DEMO_VISUAL_CHECK__.getSelectionRange?.() ?? null
        };
      });
      assert.equal(
        afterEscape.visible,
        true,
        `@${viewport.name}: Escape closed the whole bubble instead of just the link panel, discarding the selection. ${JSON.stringify(escapeDiagnostic)}`
      );
      assert.ok(
        !afterEscape.controls.includes("selection-bubble-link-input"),
        `@${viewport.name}: Escape left the link panel open.`
      );
      /*
       * The other half of "dismissable": the SECOND Escape takes the bubble. The
       * demo's old document-level branch was deleted in favour of the dismiss
       * controller, so this is the only thing standing between the criterion and
       * an affordance that cannot be closed.
       */
      await page.keyboard.press("Escape");
      await settle(page, 260);
      assert.equal(
        (await measureBubble(page)).visible,
        false,
        `@${viewport.name}: a second Escape must dismiss the bubble itself.`
      );

      /*
       * With no formattable selection the same chord still belongs to the
       * command palette — tested with a COLLAPSED CARET IN RICH MODE, which is
       * the implemented condition. Switching to Source mode instead conflated
       * "no selection" with "not in Rich mode" and left the real branch untested.
       */
      await page.evaluate(() => window.__MME_DEMO_VISUAL_CHECK__.setRichSelectionAfterText("Continue lists"));
      await settle(page, 240);
      assert.equal(
        (await measureBubble(page)).visible,
        false,
        `@${viewport.name}: a collapsed caret must not raise the selection bubble.`
      );
      await page.keyboard.down(process.platform === "darwin" ? "Meta" : "Control");
      await page.keyboard.press("k");
      await page.keyboard.up(process.platform === "darwin" ? "Meta" : "Control");
      await settle(page, 240);
      assert.equal(
        await page.evaluate(() => document.querySelector('[data-testid="command-palette"]')?.hidden === false),
        true,
        `@${viewport.name}: with no formattable selection Cmd/Ctrl+K must still open the command palette.`
      );
      await page.keyboard.press("Escape");
      await settle(page, 200);

      /* ---- the bubble must not exist in Source mode at all --------------- */
      await page.evaluate(() => window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("source"));
      await settle(page, 320);
      await page.evaluate(() => window.__MME_DEMO_VISUAL_CHECK__.setSelection?.(0, 24));
      await settle(page, 240);
      assert.equal(
        (await measureBubble(page)).visible,
        false,
        `@${viewport.name}: the formatting bubble appeared over the Source surface, where none of its actions apply.`
      );
      await enterRichMode(page);

      await selectText(page, "memory-only");
      await clickControl(page, "selection-bubble-turn-into");
      const turnIntoOpen = await page.evaluate(() =>
        [...document.querySelectorAll("[data-turn-into-command]")].map((node) => ({
          disabled: node.disabled,
          id: node.dataset.turnIntoCommand
        }))
      );
      assert.ok(
        turnIntoOpen.some((entry) => entry.id === "heading2" && !entry.disabled),
        `@${viewport.name}: the turn-into dropdown did not offer a runnable Heading 2 on a paragraph; it offered ${JSON.stringify(turnIntoOpen)}.`
      );
      assert.ok(
        turnIntoOpen.some((entry) => entry.id === "paragraph" && entry.disabled),
        `@${viewport.name}: converting a paragraph to a paragraph is a no-op and must be offered as unavailable, not as an inert control.`
      );
      await clickControl(page, "selection-bubble-turn-into-heading2");
      const converted = await markdown(page);
      assert.equal(
        lineWith(converted, "memory-only"),
        "## This built-in fixture is memory-only and not written to disk.",
        `@${viewport.name}: turn-into → Heading 2 did not serialize canonical Markdown.`
      );
      await page.evaluate(() => window.__MME_DEMO_VISUAL_CHECK__.pressRichKeyForTest("z", { metaKey: true }));
      await settle(page, 260);
      assert.equal(
        lineWith(await markdown(page), "memory-only"),
        "This built-in fixture is memory-only and not written to disk.",
        `@${viewport.name}: one undo must step back past the whole conversion.`
      );

      /*
       * The honest state inside a list, pinned rather than hidden. Measured
       * 2026-08-12: no block command can lift a list item out of its list, so
       * every conversion reports unavailable and the control is disabled instead
       * of doing nothing when pressed. MME-0105 owns making these conversions
       * work; when it lands this assertion goes red and should be rewritten to
       * expect a runnable dropdown, not deleted.
       */
      await selectText(page, "Continue lists");
      const turnIntoInList = await page.evaluate(() => {
        const button = document.querySelector('[data-testid="selection-bubble-turn-into"]');
        return { disabled: button?.disabled ?? null, present: Boolean(button) };
      });
      assert.equal(
        turnIntoInList.disabled,
        true,
        `@${viewport.name}: inside a list item no block conversion can run, so the turn-into control must be disabled rather than inert (MME-0105 owns the conversion itself).`
      );

      /* ---- the bubble is usable from the keyboard ------------------------- */

      /*
       * The pointer path is protected by cancelling `mousedown`, so no bubble
       * control ever takes focus there. The keyboard path is the exact inverse:
       * the control DOES hold focus, and `replaceChildren` deletes it mid-render
       * — after which focus falls to `<body>`, the host's DOM observer reads an
       * empty document selection, and the bubble hides itself. Every bubble
       * action became single-shot with the selection lost, on the surface that is
       * now the ONLY formatting surface by default.
       */
      await selectText(page, "Continue lists");
      const beforeKeyboard = await markdown(page);
      await page.evaluate(() => {
        document.querySelector('[data-testid="selection-bubble-bold"]')?.focus();
      });
      await settle(page, 160);
      await page.keyboard.press("Enter");
      await settle(page, 300);
      const afterFirstPress = await measureBubble(page);
      assert.equal(
        afterFirstPress.visible,
        true,
        `@${viewport.name}: activating a bubble control from the keyboard dismissed the bubble and discarded the selection.`
      );
      assert.equal(
        await page.evaluate(() => document.activeElement?.dataset?.testid ?? document.activeElement?.tagName ?? null),
        "selection-bubble-bold",
        `@${viewport.name}: the re-render destroyed the focused control instead of restoring focus to its replacement. active=${JSON.stringify(await page.evaluate(() => ({ tag: document.activeElement?.tagName, cls: document.activeElement?.className, id: document.activeElement?.dataset?.testid })))}`
      );
      await page.keyboard.press("Enter");
      await settle(page, 300);
      assert.equal(
        await markdown(page),
        beforeKeyboard,
        `@${viewport.name}: a second keyboard activation must toggle the mark back off — it could not, because the first one lost the selection.`
      );
      await page.keyboard.press("Escape");
      await settle(page, 220);

      /* ---- what the writer types into the link field survives a re-render -- */
      await selectText(page, "Continue lists");
      await clickControl(page, "selection-bubble-link");
      await page.evaluate(() => {
        const input = document.querySelector('[data-testid="selection-bubble-link-input"]');
        input.value = "./notes.md";
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await page.evaluate(() => {
        // Any host re-render: scroll, resize, or an editor transaction. On a
        // phone the on-screen keyboard opening fires exactly this.
        window.dispatchEvent(new Event("resize"));
      });
      await settle(page, 300);
      assert.equal(
        await page.evaluate(() => document.querySelector('[data-testid="selection-bubble-link-input"]')?.value ?? null),
        "./notes.md",
        `@${viewport.name}: a re-render wiped the destination the writer was typing.`
      );
      assert.equal(
        await page.evaluate(() => document.activeElement?.dataset?.testid ?? document.activeElement?.tagName ?? null),
        "selection-bubble-link-input",
        `@${viewport.name}: the re-render kept the typed text but moved focus out of the field, so the writer cannot carry on typing it. ${JSON.stringify(await page.evaluate(() => ({ active: document.activeElement?.className || document.activeElement?.tagName, id: document.activeElement?.dataset?.testid, mode: document.querySelector('[data-testid="selection-bubble-toolbar"]')?.dataset.mode })))}`
      );
      /*
       * And a relative Markdown destination must be accepted. `type="url"`
       * refused `./notes.md`, `#section` and `example.com` through constraint
       * validation — the commonest destinations in a Markdown vault.
       */
      /*
       * Submitted with a real Enter, not a dispatched `submit` event. A
       * programmatic event skips constraint validation altogether, so this
       * assertion passed even with `type="url"` restored — the mutant that
       * revealed it. Enter is also what the writer actually presses.
       */
      await page.evaluate(() => document.querySelector('[data-testid="selection-bubble-link-input"]')?.focus());
      await page.keyboard.press("Enter");
      await settle(page, 320);
      assert.equal(
        lineWith(await markdown(page), "Continue lists"),
        "- [Continue lists](./notes.md)",
        `@${viewport.name}: a relative Markdown destination was refused by the link field.`
      );
      await page.evaluate(() => window.__MME_DEMO_VISUAL_CHECK__.pressRichKeyForTest("z", { metaKey: true }));
      await settle(page, 260);

      /* ---- the turn-into control reports the block the caret is in -------- */
      for (const [needle, expected] of [
        ["Momentarise source mode", "Heading 1"],
        ["Continue todos", "Todo"],
        ["Quoted guidance", "Quote"],
        ["memory-only", "Paragraph"]
      ]) {
        await selectText(page, needle);
        const reported = await page.evaluate(() => {
          const button = document.querySelector('[data-testid="selection-bubble-turn-into"]');
          return {
            caption: button?.querySelector(".selection-bubble-turn-into-label")?.textContent ?? null,
            name: button?.getAttribute("aria-label") ?? null,
            visible: document.querySelector('[data-testid="selection-bubble-toolbar"]')?.hidden === false
          };
        });
        assert.equal(
          reported.visible,
          true,
          `@${viewport.name}: the bubble must be available in "${needle}" (${expected}); the criterion names paragraph, heading, list, todo and quote.`
        );
        assert.equal(
          reported.caption,
          expected,
          `@${viewport.name}: the turn-into control reported the wrong block type for "${needle}".`
        );
        assert.ok(
          reported.name?.includes(expected),
          `@${viewport.name}: WCAG 2.5.3 — the accessible name ${JSON.stringify(reported.name)} must contain the visible caption ${JSON.stringify(expected)}.`
        );
      }

      /* ---- the contexts the bubble refuses, and the typing rule ----------- */
      await selectText(page, "canonical");
      const inCode = await measureBubble(page);
      assert.equal(
        inCode.visible,
        false,
        `@${viewport.name}: the bubble opened over a fenced code block, where its actions cannot run.`
      );
      await selectText(page, "Continue todos");
      const beforeTyping = await measureBubble(page);
      assert.equal(beforeTyping.visible, true, `@${viewport.name}: the bubble must be up before the typing check.`);
      /*
       * A real keystroke. `typeRichTextForTest` applies `tr.insertText` and calls
       * `updateState`, bypassing `dispatchTransaction` — which is exactly where
       * the host re-renders the bubble, i.e. the code this criterion is about.
       */
      await page.keyboard.type("Z");
      await settle(page, 300);
      const whileTyping = await measureBubble(page);
      assert.equal(
        whileTyping.visible,
        false,
        `@${viewport.name}: the bubble stayed up through a keystroke; it must disappear while the writer types.`
      );

      /* ---- screenshots, both schemes -------------------------------------- */
      for (const scheme of SCHEMES) {
        await setScheme(page, scheme);
        await selectText(page, "memory-only");
        await settle(page, 200);
        await page.screenshot({ path: `${visualDir}/bubble-${scheme}-${viewport.name}.png`, type: "png" });
        await clickControl(page, "selection-bubble-turn-into");
        await page.screenshot({ path: `${visualDir}/turn-into-${scheme}-${viewport.name}.png`, type: "png" });
        await clickControl(page, "selection-bubble-turn-into");
        await selectText(page, "memory-only");
        await clickControl(page, "selection-bubble-link");
        await page.screenshot({ path: `${visualDir}/link-${scheme}-${viewport.name}.png`, type: "png" });
        await page.keyboard.press("Escape");
        await settle(page, 160);
      }

      evidence[viewport.name] = perViewport;
      await page.close();
    }

    await writeFile(
      `${visualDir}/measurements.json`,
      `${JSON.stringify({ demoUrl, evidence, schemes: SCHEMES, status: "passed" }, null, 2)}\n`
    );
    console.log("visual-check-mme0089: no persistent toolbar by default; the bubble is centered, complete, and byte-exact.");
  } finally {
    await browser.close();
  }
}

await main();
