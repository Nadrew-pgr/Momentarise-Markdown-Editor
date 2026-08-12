import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import puppeteer from "puppeteer";
import { clearGeneratedArtifacts } from "./visual-artifacts.mjs";
import { requireChromeExecutable } from "./chrome-helpers.mjs";

/**
 * MME-0119 — the toolbar overlay stays in the viewport at any scroll position.
 *
 * `.rich-command-toolbar` carries `backdrop-filter` (MME-0102's glass), which
 * made it the containing block for the More menu's `position: fixed`. The menu's
 * coordinates were computed correctly against the viewport and then re-resolved
 * against the toolbar, displacing it by exactly the toolbar's `scrollLeft`:
 * measured `left: -178` for an inline `left: 126px` at `scrollLeft: 304`, and
 * `bottom: 936` against an 844px viewport. On a phone the toolbar always
 * scrolls, so the More menu was unreachable.
 *
 * The one assertion that matters is geometric, and it is checked at several
 * scroll offsets rather than one: a single measurement at `scrollLeft: 0` would
 * have passed against the broken build, because the displacement IS the scroll
 * offset. `MME-0078` checks the same overlay once; this gate is the sweep.
 */

const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5174/";
const visualDir = "docs/internal/visual-checks/MME-0119";

const VIEWPORTS = [
  { height: 844, name: "390", width: 390 },
  { height: 1024, name: "768", width: 768 }
];

/** Fractions of the toolbar's maximum scroll to test the overlay against. */
const SCROLL_FRACTIONS = [0, 0.5, 1];

const settle = async (page, ms = 200) => {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await new Promise((resolve) => setTimeout(resolve, ms));
};

async function openMoreMenu(page) {
  await page.evaluate(() => document.querySelector('[data-testid="toolbar-more-button"]')?.click());
  await page.evaluate(async () => {
    const menu = document.querySelector('[data-testid="toolbar-more-menu"]');
    if (menu) {
      await Promise.all(menu.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => {})));
    }
  });
  await settle(page, 120);
}

async function measureOverlay(page) {
  return page.evaluate(() => {
    const menu = document.querySelector('[data-testid="toolbar-more-menu"]');
    const toolbar = document.querySelector('[data-testid="rich-command-toolbar"]');
    if (!menu || !toolbar) {
      return { present: false };
    }
    const rect = menu.getBoundingClientRect();
    /*
     * The structural fact behind the geometry: no ancestor may establish a
     * containing block for fixed positioning, or the coordinates below are
     * resolved against that ancestor instead of the viewport.
     */
    const capturing = [];
    for (let element = menu.parentElement; element; element = element.parentElement) {
      const style = getComputedStyle(element);
      const properties = [];
      if (style.transform !== "none") properties.push("transform");
      if (style.filter !== "none") properties.push("filter");
      if (style.backdropFilter && style.backdropFilter !== "none") properties.push("backdrop-filter");
      if (style.perspective !== "none") properties.push("perspective");
      if (style.contain && !["none", "style"].includes(style.contain)) properties.push("contain");
      if (style.willChange && style.willChange !== "auto") properties.push("will-change");
      if (properties.length > 0) {
        capturing.push({ classes: element.className, properties });
      }
    }
    /*
     * The assertion the first version of this gate was missing. A rect inside
     * the viewport says nothing about whether anything is painted on top of it:
     * the demo topbar (z-index 50) and the packaged debug inspector (z-index 65)
     * were both covering the menu at phone width, hiding three of eighteen
     * commands behind a check that passed.
     */
    const items = [...menu.querySelectorAll("button")];
    const occluded = items
      .map((item, index) => {
        const box = item.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) {
          return { index, reason: "zero-size" };
        }
        const x = Math.round(box.left + box.width / 2);
        const y = Math.round(box.top + box.height / 2);
        const hit = document.elementFromPoint(x, y);
        return hit && (item === hit || item.contains(hit)) ? null : { at: `${x},${y}`, index, label: item.textContent?.trim() };
      })
      .filter(Boolean);

    return {
      bottom: Math.round(rect.bottom),
      itemCount: items.length,
      occludedItems: occluded,
      capturingAncestors: capturing,
      hidden: menu.hidden,
      inOverlayLayer: Boolean(menu.closest("[data-mme-overlay-layer]")),
      left: Math.round(rect.left),
      present: true,
      right: Math.round(rect.right),
      toolbarScrollLeft: Math.round(toolbar.scrollLeft),
      top: Math.round(rect.top),
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth
    };
  });
}

async function main() {
  await mkdir(visualDir, { recursive: true });
  await clearGeneratedArtifacts(visualDir);

  const browser = await puppeteer.launch({ executablePath: requireChromeExecutable(), headless: true });
  const evidence = {};

  try {
    for (const viewport of VIEWPORTS) {
      const page = await browser.newPage();
      await page.setViewport({
        deviceScaleFactor: 1,
        hasTouch: true,
        height: viewport.height,
        isMobile: true,
        width: viewport.width
      });
      await page.goto(demoUrl, { waitUntil: "networkidle0" });
      await page.waitForFunction(() => Boolean(window.__MME_DEMO_VISUAL_CHECK__));
      /*
       * MME-0089 turned the persistent formatting toolbar off by default
       * (benchmark contract 4): formatting now lives in the selection bubble and
       * the slash menu. This gate exercises the toolbar, so it opts in the way a
       * Google-Docs-style host would, and the opt-in itself is proven by
       * `visual:mme-0089`.
       */
      await page.evaluate(() =>
        window.__MME_DEMO_VISUAL_CHECK__.setReferenceSurfacePreferencesForTest({ toolbarMode: "sticky" })
      );
      await page.evaluate(() =>
        window.__MME_DEMO_VISUAL_CHECK__.loadWritableMarkdownFileForTest(
          "overlay-anchoring.md",
          "# Overlay anchoring\n\nA paragraph so the rich toolbar has a document.\n"
        )
      );
      await settle(page);
      await page.evaluate(() => document.querySelector('[data-testid="rich-mode-button"]')?.click());
      await settle(page);

      const scrollRange = await page.evaluate(() => {
        const toolbar = document.querySelector('[data-testid="rich-command-toolbar"]');
        return toolbar ? toolbar.scrollWidth - toolbar.clientWidth : 0;
      });

      const measurements = [];
      for (const fraction of SCROLL_FRACTIONS) {
        const target = Math.round(scrollRange * fraction);
        await page.evaluate((scrollLeft) => {
          const toolbar = document.querySelector('[data-testid="rich-command-toolbar"]');
          if (toolbar) {
            toolbar.scrollLeft = scrollLeft;
          }
        }, target);
        await settle(page, 80);
        await openMoreMenu(page);

        const overlay = await measureOverlay(page);
        assert.equal(overlay.present, true, `@${viewport.name}: the More menu and toolbar must both exist.`);
        assert.equal(overlay.hidden, false, `@${viewport.name}: clicking More must reveal the menu.`);
        assert.equal(
          overlay.inOverlayLayer,
          true,
          `@${viewport.name}: the More menu must render inside [data-mme-overlay-layer]. ${JSON.stringify(overlay)}`
        );
        assert.deepEqual(
          overlay.capturingAncestors,
          [],
          `@${viewport.name} (scrollLeft ${overlay.toolbarScrollLeft}): an ancestor of the More menu establishes a containing block ` +
            `for fixed positioning, so its viewport coordinates are resolved against that ancestor: ${JSON.stringify(overlay)}`
        );

        // The geometry itself, which is what a user experiences.
        assert.ok(
          overlay.itemCount >= 3,
          `@${viewport.name}: the menu rendered ${overlay.itemCount} items; a menu with nothing in it satisfies every geometric check below.`
        );
        assert.ok(
          overlay.right - overlay.left > 0 && overlay.bottom - overlay.top > 0,
          `@${viewport.name}: the menu has a degenerate rect: ${JSON.stringify(overlay)}`
        );
        assert.deepEqual(
          overlay.occludedItems,
          [],
          `@${viewport.name} (scrollLeft ${overlay.toolbarScrollLeft}): ${overlay.occludedItems.length} menu item(s) are painted over by other chrome ` +
            `and cannot be tapped: ${JSON.stringify(overlay.occludedItems)}`
        );
        assert.ok(
          overlay.left >= 0 &&
            overlay.top >= 0 &&
            overlay.right <= overlay.viewportWidth &&
            overlay.bottom <= overlay.viewportHeight,
          `@${viewport.name}: the More menu left the viewport at scrollLeft ${overlay.toolbarScrollLeft}: ${JSON.stringify(overlay)}`
        );

        measurements.push(overlay);
        await page.screenshot({
          path: `${visualDir}/more-menu-${viewport.name}-scroll-${Math.round(fraction * 100)}.png`,
          type: "png"
        });
        await page.evaluate(() => document.querySelector('[data-testid="toolbar-more-button"]')?.click());
        await settle(page, 80);
      }

      /*
       * The sweep has to be a real sweep. If the toolbar does not scroll at this
       * width, every measurement is the `scrollLeft: 0` case that passed even
       * against the broken build, and this gate proves nothing here.
       */
      const offsets = new Set(measurements.map((measurement) => measurement.toolbarScrollLeft));
      if (viewport.width === 390) {
        assert.ok(
          offsets.size >= 2 && Math.max(...offsets) > 0,
          `@${viewport.name}: the toolbar never scrolled (offsets ${[...offsets].join(", ")}), so the defect's own condition was never reproduced.`
        );
      }

      evidence[viewport.name] = { measurements, scrollRange };
      await page.close();
    }

    await writeFile(
      `${visualDir}/measurements.json`,
      `${JSON.stringify({ demoUrl, evidence, scrollFractions: SCROLL_FRACTIONS, status: "passed" }, null, 2)}\n`
    );
    console.log("visual-check-mme0119: More menu stays in the viewport at every toolbar scroll offset.");
  } finally {
    await browser.close();
  }
}

await main();
