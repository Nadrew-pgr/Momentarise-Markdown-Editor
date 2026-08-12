import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import puppeteer from "puppeteer";
import { clearGeneratedArtifacts } from "./visual-artifacts.mjs";
import { requireChromeExecutable } from "./chrome-helpers.mjs";

/**
 * MME-0117 — the coarse-pointer touch floor, measured rather than asserted.
 *
 * MME-0100 moved the 44px floor out of the demo stylesheet and into
 * `@momentarise/md-theme`. The demo `@import`s the theme first, so its own
 * `.command-palette-button { min-width: 30px }` and
 * `.editor-ai-button { min-width: 34px }` had equal specificity, loaded later,
 * and won — shipping two controls at 30px and 34px against a 44px accessibility
 * contract. `tests/touch-target-floor.test.mjs` enforces the structural rule on
 * every push; this gate proves the rendered result, at both widths the issue
 * names, in a browser that really reports `pointer: coarse`.
 *
 * It measures every interactive control the user can reach, not a sample: a
 * floor proven on one button is not a floor.
 */

const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5174/";
const visualDir = "docs/internal/visual-checks/MME-0117";
const TOUCH_FLOOR_PX = 44;

const VIEWPORTS = [
  { height: 844, name: "390", width: 390 },
  { height: 1024, name: "768", width: 768 }
];

/*
 * Every control a touch user can actually hit. The command surface and rich
 * toolbar are the two scroll containers MME-0078 established; the properties
 * panel is demo chrome the packaged floor does not target, which is exactly the
 * class of control this issue found unprotected.
 */
const CONTROL_SELECTORS = [
  '[data-testid="editor-command-surface"] button',
  '[data-testid="editor-command-surface"] summary',
  '[data-testid="rich-command-toolbar"] button',
  '[data-testid="properties-panel"] button',
  "[data-rich-block-affordance] button",
  // The smallest control in the product, and the one the coarse block never
  // reached until MME-0117.
  ".rich-fold-toggle",
  ".ProseMirror [data-todo-toggle]",
  // Overlay contents. Asserting these from CSS is what the issue's
  // "measured, not asserted" criterion exists to forbid, so the gate opens each
  // surface and measures what is really rendered.
  '[data-testid="toolbar-more-menu"] button',
  '[data-testid="slash-menu"] button',
  '[data-testid="command-palette"] button',
  '[data-testid="command-palette"] input',
  ".document-status-menu button",
  ".rich-block-menu button",
  ".html-preview-details-toggle"
];

/**
 * Selectors that must match something, so the gate cannot pass by measuring
 * nothing. A global "at least 10 controls" total is satisfied by the command
 * surface alone, which would let every other selector rot silently.
 */
const REQUIRED_SELECTORS = [
  '[data-testid="editor-command-surface"] button',
  '[data-testid="rich-command-toolbar"] button',
  ".rich-fold-toggle",
  '[data-testid="toolbar-more-menu"] button'
];

const settle = async (page, ms = 260) => {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Wait for the element's own animations rather than a magic number.
 * `getBoundingClientRect()` returns the transformed box, so a 44px item measured
 * during the overlay's `scale(0.98)` entrance reads 43.12px — the false failure
 * that sent MME-0078 red. Coupling the wait to the animation means a change to
 * `--mme-motion-base` cannot make this flake.
 */
const settleAnimations = async (page, selector) => {
  await page.evaluate(async (target) => {
    const element = document.querySelector(target);
    if (!element) {
      return;
    }
    await Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => {})));
  }, selector);
  await settle(page, 80);
};

async function measure(page) {
  return page.evaluate((selectors) => {
    const visible = [...document.querySelectorAll(selectors.join(","))].filter((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        !element.closest("[hidden]") &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        rect.width > 0 &&
        rect.height > 0
      );
    });
    return {
      coarsePointer: matchMedia("(pointer: coarse)").matches,
      controls: visible.map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          height: Math.round(rect.height * 100) / 100,
          // Every selector it matches, not the first: a More-menu button is also
          // matched by the command-surface selector, and recording only that one
          // would make the per-selector coverage check report a false gap.
          selectors: selectors.filter((candidate) => element.matches(candidate)),
          testid: element.dataset.testid ?? element.className,
          width: Math.round(rect.width * 100) / 100
        };
      }),
      touchToken: getComputedStyle(document.documentElement).getPropertyValue("--mme-touch-target-size").trim()
    };
  }, CONTROL_SELECTORS);
}

async function main() {
  await mkdir(visualDir, { recursive: true });
  await clearGeneratedArtifacts(visualDir);

  const browser = await puppeteer.launch({
    executablePath: requireChromeExecutable(),
    headless: true
  });
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
          "touch-targets.md",
          "# Touch targets\n\nA paragraph so the editor has content.\n"
        )
      );
      await settle(page);

      const source = await measure(page);
      assert.equal(
        source.coarsePointer,
        true,
        `@${viewport.name}: touch emulation must report a coarse pointer, otherwise the floor under test never applies.`
      );
      assert.equal(
        source.touchToken,
        `${TOUCH_FLOOR_PX}px`,
        `@${viewport.name}: --mme-touch-target-size must be ${TOUCH_FLOOR_PX}px; it resolved to "${source.touchToken}".`
      );

      await page.evaluate(() => document.querySelector('[data-testid="rich-mode-button"]')?.click());
      await settle(page);
      const rich = await measure(page);

      /*
       * Open the overlays and measure them. Every class below is named in a
       * coarse-pointer block, but a rule in a stylesheet is not a rendered
       * control — which is precisely the distinction this issue's criterion
       * draws.
       */
      await page.evaluate(() => document.querySelector('[data-testid="toolbar-more-button"]')?.click());
      await settleAnimations(page, '[data-testid="toolbar-more-menu"]');
      const moreMenu = await measure(page);
      await page.evaluate(() => document.querySelector('[data-testid="toolbar-more-button"]')?.click());

      await page.evaluate(() => document.querySelector('[data-testid="editor-status-button"]')?.click());
      await settleAnimations(page, ".document-status-menu");
      const statusMenu = await measure(page);
      await page.evaluate(() => document.querySelector('[data-testid="editor-status-button"]')?.click());

      /*
       * The properties panel lives inside the collapsed diagnostics disclosure;
       * a control nobody can open is not a control anybody can mis-tap. It is
       * opened last: the panel is very tall, and expanding it before the overlay
       * measurements displaces the toolbar those overlays anchor to.
       */
      await page.evaluate(() => {
        const details = document.querySelector('[data-testid="debug-inspector"]');
        if (details && !details.open) {
          details.querySelector("summary")?.click();
        }
      });
      await settle(page);
      const properties = await measure(page);

      const all = [
        ...source.controls,
        ...rich.controls,
        ...moreMenu.controls,
        ...statusMenu.controls,
        ...properties.controls
      ];
      const matched = new Set(all.flatMap((control) => control.selectors));
      for (const selector of REQUIRED_SELECTORS) {
        assert.ok(
          matched.has(selector),
          `@${viewport.name}: \`${selector}\` matched no rendered control. The gate would pass while measuring nothing for it.`
        );
      }
      assert.ok(
        all.length >= 20,
        `@${viewport.name}: only ${all.length} controls were measured; the selectors have stopped matching and this gate would pass vacuously.`
      );

      const undersized = all.filter(
        (control) => control.height < TOUCH_FLOOR_PX || control.width < TOUCH_FLOOR_PX
      );
      assert.deepEqual(
        undersized,
        [],
        `@${viewport.name}: ${undersized.length} control(s) below the ${TOUCH_FLOOR_PX}px coarse-pointer floor: ${JSON.stringify(undersized)}`
      );

      await page.screenshot({ path: `${visualDir}/touch-targets-${viewport.name}.png`, type: "png" });
      evidence[viewport.name] = { controls: all.length, smallest: smallestOf(all), touchToken: source.touchToken };
      await page.close();
    }

    await writeFile(
      `${visualDir}/measurements.json`,
      `${JSON.stringify({ demoUrl, evidence, floorPx: TOUCH_FLOOR_PX, status: "passed" }, null, 2)}\n`
    );
    console.log(
      `visual-check-mme0117: coarse-pointer floor holds at ${VIEWPORTS.map((viewport) => viewport.name).join(" and ")}.`
    );
  } finally {
    await browser.close();
  }
}

function smallestOf(controls) {
  return controls.reduce(
    (smallest, control) =>
      Math.min(control.height, control.width) < Math.min(smallest.height, smallest.width) ? control : smallest,
    controls[0]
  );
}

await main();
