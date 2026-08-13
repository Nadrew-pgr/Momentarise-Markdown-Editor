import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import puppeteer from "puppeteer";
import { clearGeneratedArtifacts } from "./visual-artifacts.mjs";
import { requireChromeExecutable } from "./chrome-helpers.mjs";

/**
 * MME-0125 — the React binding, rendered.
 *
 * `@momentarise/md-react` is the primary documented adoption path and had never
 * had a rendering proof: the only two gates touching React consume the published
 * registry build, and every React test is jsdom, which has no layout. Attempt 1
 * shipped through that gap — a permanent bubble host left the rich surface never
 * `:empty`, so a default consumer in source mode got a transparent div swallowing
 * every click meant for CodeMirror, and the suite reported "all checks passed".
 *
 * This gate is that missing proof. It runs against `apps/react-demo`, a
 * workspace-backed host, so it measures the code in this repository rather than
 * the last publish. `examples/next-app` stays a pure registry install; its job is
 * catching workspace-versus-registry drift, and overlaying it would trade a
 * permanent gate for a one-issue convenience.
 *
 * The three assertions that exist because attempt 1 could not see them:
 *
 *   1. In source mode nothing from the rich surface is painted, and a click at
 *      the source editor's centre lands in the source editor.
 *   2. The bubble is anchored in the right coordinate space. The rich host is a
 *      scroller, so a `position: absolute` overlay inside it resolves against the
 *      content origin — measured before the fix, at `scrollTop: 900` the computed
 *      offset was a plausible `105px` while the real `top` was `-746`.
 *   3. The turn-into menu stays inside the viewport.
 */

const hostUrl = process.env.MME_REACT_DEMO_URL ?? "http://127.0.0.1:5175/";
const visualDir = "docs/internal/visual-checks/MME-0125";

const VIEWPORTS = [
  { height: 900, name: "1280", width: 1280 },
  { height: 1024, name: "768", width: 768 },
  { height: 844, name: "390", width: 390 }
];
const SCHEMES = ["dark", "light"];

/** How far down the document the scrolled-anchor case scrolls. */
const SCROLL_TOP = 900;

const settle = async (page, ms = 180) => {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await new Promise((resolve) => setTimeout(resolve, ms));
};

const setScheme = (page, scheme) =>
  page.evaluate((value) => {
    document.documentElement.setAttribute("data-mme-scheme", value);
  }, scheme);

async function enterRich(page) {
  await page.evaluate(() => window.__MME_REACT_HOST__.setMode("rich"));
  await page.waitForFunction(() => Boolean(document.querySelector(".ProseMirror")), { timeout: 8000 });
  await page.waitForFunction(() => Boolean(window.__MME_REACT_HOST__.getRichHandle()), { timeout: 8000 });
  await settle(page, 260);
}

/**
 * Select a word through the view the binding owns.
 *
 * Focus first: an unfocused ProseMirror does not write its selection to the DOM,
 * and the painted highlight is what the bubble is supposed to track.
 */
async function selectWord(page, word) {
  await page.evaluate((needle) => {
    const view = window.__MME_REACT_HOST__.getRichHandle().getEditorView();
    view.focus();
    let found = null;
    view.state.doc.descendants((node, pos) => {
      if (found || !node.isText) {
        return true;
      }
      const index = node.text.indexOf(needle);
      if (index >= 0) {
        found = { from: pos + index, to: pos + index + needle.length };
      }
      return true;
    });
    if (!found) {
      throw new Error(`react-demo fixture does not contain ${JSON.stringify(needle)}`);
    }
    const Selection = view.state.selection.constructor;
    view.dispatch(view.state.tr.setSelection(Selection.create(view.state.doc, found.from, found.to)));
  }, word);
  await settle(page, 240);
}

async function measure(page) {
  return page.evaluate(() => {
    const bubble = document.querySelector('[data-testid="selection-bubble-toolbar"]');
    const richHost = document.querySelector("[data-mme-react-rich]");
    const frame = document.querySelector("[data-mme-react-rich-frame]");
    if (!bubble || bubble.hidden) {
      return { present: Boolean(bubble), visible: false };
    }
    const rect = bubble.getBoundingClientRect();
    const selection = document.getSelection();
    const selectionRect =
      selection && selection.rangeCount > 0 && !selection.isCollapsed
        ? selection.getRangeAt(0).getBoundingClientRect()
        : null;
    const controls = [...bubble.querySelectorAll("button")]
      .filter((node) => !node.hidden)
      .map((node) => ({
        height: node.getBoundingClientRect().height,
        testId: node.dataset.testid ?? node.className,
        width: node.getBoundingClientRect().width
      }));
    /*
     * Reachability, not just presence: a control inside the viewport can still be
     * painted over (MME-0119) or clipped out of its own container (MME-0089).
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
    return {
      bubble: rect.toJSON(),
      controls,
      frameScrolls: frame ? getComputedStyle(frame).overflow : null,
      gapAboveSelection: selectionRect ? selectionRect.top - rect.bottom : null,
      horizontalOffset: selectionRect
        ? rect.left + rect.width / 2 - (selectionRect.left + selectionRect.width / 2)
        : null,
      occluded,
      overflowScroll: { client: bubble.clientWidth, scroll: bubble.scrollWidth },
      present: true,
      richScrollTop: richHost?.scrollTop ?? null,
      selection: selectionRect ? selectionRect.toJSON() : null,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
      visible: true
    };
  });
}

const content = (page) => page.evaluate(() => window.__MME_REACT_HOST__.getContent());

const lineWith = (source, needle) => source.split("\n").find((line) => line.includes(needle)) ?? null;

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
  await settle(page, 240);
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
      await page.goto(hostUrl, { waitUntil: "networkidle0" });
      await page.waitForFunction(() => Boolean(window.__MME_REACT_HOST__), { timeout: 15000 });
      const perViewport = {};

      /* ---- 1. source mode paints nothing from the rich surface --------------- */
      const sourceMode = await page.evaluate(() => {
        const source = document.querySelector("[data-mme-react-source]");
        const frame = document.querySelector("[data-mme-react-rich-frame]");
        const rich = document.querySelector("[data-mme-react-rich]");
        const sourceRect = source?.getBoundingClientRect() ?? null;
        /*
         * The exact gesture attempt 1 broke: a click aimed at the text. If any
         * rich-side element is stretched over the source view it wins the hit
         * test, and CodeMirror never sees the pointer.
         */
        const probe =
          sourceRect && sourceRect.height > 0
            ? document.elementFromPoint(
                sourceRect.left + sourceRect.width / 2,
                sourceRect.top + Math.min(180, sourceRect.height / 2)
              )
            : null;
        return {
          frameConnected: Boolean(frame),
          hitClass: probe ? probe.className : null,
          hitInsideSource: Boolean(probe && source && source.contains(probe)),
          richConnected: Boolean(rich),
          richHeight: rich ? rich.getBoundingClientRect().height : 0,
          sourceMounted: Boolean(source?.querySelector(".cm-editor"))
        };
      });
      assert.equal(
        sourceMode.sourceMounted,
        true,
        `@${viewport.name}: the source editor must be mounted before this check means anything.`
      );
      assert.equal(
        sourceMode.frameConnected,
        false,
        `@${viewport.name}: the rich frame is still in the document in source mode. Attempt 1 left it there, and because it is positioned it painted over the source editor.`
      );
      assert.equal(
        sourceMode.richHeight,
        0,
        `@${viewport.name}: the rich surface occupies ${sourceMode.richHeight}px in source mode; it must claim no space at all.`
      );
      assert.equal(
        sourceMode.hitInsideSource,
        true,
        `@${viewport.name}: a click at the source editor's centre landed on ${JSON.stringify(sourceMode.hitClass)} instead of the source editor — exactly the defect attempt 1 shipped.`
      );
      perViewport.sourceMode = sourceMode;

      /* ---- 2. the bubble is anchored in the right coordinate space ----------- */
      await enterRich(page);
      await selectWord(page, "Continue lists");
      const unscrolled = await measure(page);
      assert.equal(unscrolled.visible, true, `@${viewport.name}: selecting text must raise the bubble.`);
      assert.equal(
        unscrolled.frameScrolls,
        "visible",
        `@${viewport.name}: the bubble's containing block must not be a scroller, or its offsets resolve against the content origin (MME-0119 forbids compensating with the scroll offset).`
      );

      const scrolled = await page.evaluate((top) => {
        const rich = document.querySelector("[data-mme-react-rich]");
        const before = rich.scrollTop;
        rich.scrollTop = top;
        rich.dispatchEvent(new Event("scroll"));
        return { after: rich.scrollTop, before };
      }, SCROLL_TOP);
      await settle(page, 260);
      await selectWord(page, "Filler paragraph 20");
      const afterScroll = await measure(page);
      /*
       * The setup must be real. If the host did not scroll, the defect's own
       * precondition never existed and everything below proves nothing — the
       * failure mode MME-0089's scroll check shipped with.
       */
      assert.ok(
        scrolled.after > scrolled.before + 100,
        `@${viewport.name}: the rich host did not scroll (${scrolled.before} -> ${scrolled.after}), so the coordinate-space defect was never reproduced.`
      );
      assert.equal(
        afterScroll.visible,
        true,
        `@${viewport.name}: the bubble must be visible for a selection made after scrolling.`
      );
      assert.ok(
        afterScroll.bubble.top >= 0 && afterScroll.bubble.bottom <= afterScroll.viewportHeight,
        `@${viewport.name}: at scrollTop ${afterScroll.richScrollTop} the bubble is at top ${Math.round(afterScroll.bubble.top)} in a ${afterScroll.viewportHeight}px viewport — it resolved against the scroller's content origin instead of the frame.`
      );
      assert.ok(
        afterScroll.selection !== null,
        `@${viewport.name}: the painted selection must exist, or the anchor is being measured against nothing.`
      );
      assert.ok(
        Math.abs(afterScroll.gapAboveSelection) <= 24,
        `@${viewport.name}: the bubble sits ${Math.round(afterScroll.gapAboveSelection)}px from its selection after scrolling; it is anchored to the wrong origin.`
      );
      /*
       * Horizontal anchoring, which was measured into `measurements.json` and
       * asserted by nothing — so `align: "center"` reverting to `"start"`, and
       * two off-by-one slips in `selectionRect`, all shifted the bubble off its
       * selection while every other assertion here stayed green.
       *
       * Clamp-aware, like MME-0089's: at narrow widths the bubble is wider than
       * the room beside the selection, so the correct outcome is a clamp to the
       * margin rather than a centre. Both branches are pinned; asserting only the
       * centre would fail legitimately at 390.
       */
      const clampedLeft = afterScroll.bubble.left <= 12.5;
      const clampedRight = afterScroll.bubble.right >= afterScroll.viewportWidth - 12.5;
      if (clampedLeft || clampedRight) {
        assert.ok(
          afterScroll.bubble.right > afterScroll.selection.left &&
            afterScroll.bubble.left < afterScroll.selection.right,
          `@${viewport.name}: the bubble was clamped to the ${clampedLeft ? "left" : "right"} margin and no longer overlaps its selection: ${JSON.stringify({ bubble: afterScroll.bubble, selection: afterScroll.selection })}`
        );
      } else {
        assert.ok(
          Math.abs(afterScroll.horizontalOffset) <= 8,
          `@${viewport.name}: the bubble is ${afterScroll.horizontalOffset.toFixed(1)}px off the selection's centre with room to centre; the contract is 8px.`
        );
      }
      perViewport.centering = {
        clampedLeft,
        clampedRight,
        horizontalOffset: afterScroll.horizontalOffset
      };

      assert.deepEqual(
        afterScroll.occluded,
        [],
        `@${viewport.name}: ${afterScroll.occluded.length} bubble control(s) are painted over: ${JSON.stringify(afterScroll.occluded)}`
      );
      assert.ok(
        afterScroll.overflowScroll.scroll <= afterScroll.overflowScroll.client + 0.5,
        `@${viewport.name}: the bubble needs ${afterScroll.overflowScroll.scroll}px but is capped at ${afterScroll.overflowScroll.client}px, so its trailing controls are unreachable.`
      );
      perViewport.anchoring = { afterScroll, scrolled, unscrolled };

      /* ---- 3. the turn-into menu stays inside the viewport ------------------- */
      await clickControl(page, "selection-bubble-turn-into");
      const menu = await page.evaluate(() => {
        const node = document.querySelector('[data-testid="selection-bubble-turn-into-menu"]');
        if (!node) {
          return { present: false };
        }
        const rect = node.getBoundingClientRect();
        return {
          bottom: rect.bottom,
          height: rect.height,
          itemCount: node.querySelectorAll("[data-turn-into-command]").length,
          left: rect.left,
          present: true,
          right: rect.right,
          top: rect.top,
          viewportHeight: window.innerHeight,
          viewportWidth: window.innerWidth
        };
      });
      assert.equal(menu.present, true, `@${viewport.name}: the turn-into dropdown did not open.`);
      assert.ok(menu.itemCount >= 9, `@${viewport.name}: the dropdown rendered ${menu.itemCount} entries.`);
      assert.ok(
        menu.top >= 0 &&
          menu.left >= 0 &&
          menu.bottom <= menu.viewportHeight + 0.5 &&
          menu.right <= menu.viewportWidth + 0.5,
        `@${viewport.name}: the turn-into menu left the viewport: ${JSON.stringify(menu)}`
      );
      perViewport.menu = menu;
      await page.keyboard.press("Escape");
      await settle(page, 200);

      /* ---- the binding still writes byte-exact Markdown ---------------------- */
      await selectWord(page, "Continue lists");
      const before = await content(page);
      await clickControl(page, "selection-bubble-strikethrough");
      assert.equal(
        lineWith(await content(page), "Continue lists"),
        "- ~~Continue lists~~",
        `@${viewport.name}: the bubble did not write canonical Markdown through the React binding.`
      );
      await selectWord(page, "Continue lists");
      await clickControl(page, "selection-bubble-strikethrough");
      assert.equal(
        await content(page),
        before,
        `@${viewport.name}: removing the mark must return the document to its original bytes.`
      );

      /* ---- the opt-out mounts nothing at all --------------------------------- */
      await page.evaluate(() => window.__MME_REACT_HOST__.setBubbleEnabled(false));
      await settle(page, 400);
      await enterRich(page);
      await selectWord(page, "Continue lists");
      const optedOut = await measure(page);
      assert.equal(
        optedOut.present,
        false,
        `@${viewport.name}: opting out must mount no bubble at all, not a hidden one.`
      );
      await page.evaluate(() => window.__MME_REACT_HOST__.setBubbleEnabled(true));
      await settle(page, 400);
      await enterRich(page);

      /* ---- screenshots, both schemes ---------------------------------------- */
      for (const scheme of SCHEMES) {
        await setScheme(page, scheme);
        await page.evaluate(() => {
          const rich = document.querySelector("[data-mme-react-rich]");
          rich.scrollTop = 0;
          rich.dispatchEvent(new Event("scroll"));
        });
        await selectWord(page, "Continue lists");
        await page.screenshot({ path: `${visualDir}/bubble-${scheme}-${viewport.name}.png`, type: "png" });
        await page.evaluate(() => window.__MME_REACT_HOST__.setMode("source"));
        await settle(page, 320);
        await page.screenshot({ path: `${visualDir}/source-${scheme}-${viewport.name}.png`, type: "png" });
        await enterRich(page);
      }

      evidence[viewport.name] = perViewport;
      await page.close();
    }

    await writeFile(
      `${visualDir}/measurements.json`,
      `${JSON.stringify({ evidence, hostUrl, schemes: SCHEMES, status: "passed" }, null, 2)}\n`
    );
    console.log("visual-check-mme0125: the React binding renders its formatting surface correctly.");
  } finally {
    await browser.close();
  }
}

await main();
