import { mkdir, writeFile } from "node:fs/promises";

import puppeteer from "puppeteer";

import { requireChromeExecutable } from "./chrome-helpers.mjs";
import { clearGeneratedArtifacts } from "./visual-artifacts.mjs";

const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5174/";
const visualDir = "docs/internal/visual-checks/MME-0078";
const source = [
  "# Touch viewport proof",
  "",
  "Edit this Markdown without replacing the durable source.",
  "",
  "- [ ] Reach task controls",
  "",
  "```ts",
  "const viewport = \"host-owned\";",
  "```",
  "",
  "| Surface | State |",
  "| --- | --- |",
  "| Mobile | reachable |",
  "",
  "> [!NOTE] Final boundary",
  "> Keep this source exact.",
  ""
].join("\n");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function screenshot(page, fileName) {
  await page.screenshot({ path: `${visualDir}/${fileName}`, type: "png" });
}

async function screenshotElement(page, selector, fileName) {
  const element = await page.$(selector);
  assert(element, `Missing screenshot element: ${selector}`);
  await element.screenshot({ path: `${visualDir}/${fileName}`, type: "png" });
}

async function settlePaint(page) {
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      })
  );
}

async function setTouchViewport(page, width, height) {
  await page.setViewport({
    deviceScaleFactor: 1,
    hasTouch: true,
    height,
    isMobile: true,
    width
  });
}

async function surfaceSnapshot(page) {
  return page.evaluate(() => {
    const root = document.querySelector('[data-testid="reference-editor-shell"]');
    const shellRect = root?.getBoundingClientRect();
    const visibleControls = [
      ...document.querySelectorAll(
        [
          '[data-testid="editor-command-surface"] button',
          '[data-testid="editor-command-surface"] summary',
          '[data-testid="rich-command-toolbar"] button',
          '[data-rich-block-affordance] button'
        ].join(",")
      )
    ].filter((element) => {
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
    const targetSizes = visibleControls.map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        height: Math.round(rect.height),
        testid: element.dataset.testid ?? element.getAttribute("aria-label") ?? element.tagName,
        width: Math.round(rect.width)
      };
    });
    const blockAffordance = document.querySelector("[data-rich-block-affordance]");
    const topbar = document.querySelector('[data-testid="editor-command-surface"]');
    const brand = document.querySelector(".brand-lockup");
    const brandRect = brand?.getBoundingClientRect();
    return {
      activeElement: document.activeElement?.className || document.activeElement?.tagName || null,
      blockAffordanceOpacity: blockAffordance ? Number.parseFloat(getComputedStyle(blockAffordance).opacity) : null,
      brandRect: brandRect
        ? {
            left: Math.round(brandRect.left),
            width: Math.round(brandRect.width)
          }
        : null,
      coarsePointer: matchMedia("(pointer: coarse)").matches,
      cssKeyboardInset: root ? getComputedStyle(root).getPropertyValue("--mme-keyboard-inset").trim() : null,
      cssVisualHeight: root ? getComputedStyle(root).getPropertyValue("--mme-visual-viewport-height").trim() : null,
      documentOverflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      documentOverflowY: document.documentElement.scrollHeight > document.documentElement.clientHeight + 1,
      keyboardOpen: root?.dataset.mmeKeyboardOpen ?? null,
      markdown: window.__MME_DEMO_VISUAL_CHECK__.getMarkdown(),
      shellHeight: shellRect ? Math.round(shellRect.height) : null,
      shellScrollLeft: root?.scrollLeft ?? null,
      targetSizes,
      topbarClientWidth: topbar?.clientWidth ?? null,
      topbarScrollLeft: topbar?.scrollLeft ?? null,
      topbarScrollWidth: topbar?.scrollWidth ?? null,
      topbarScrollable: Boolean(topbar && topbar.scrollWidth >= topbar.clientWidth),
      viewportHeight: window.innerHeight,
      viewportMode: root?.dataset.mmeViewportMode ?? null,
      viewportWidth: window.innerWidth
    };
  });
}

async function assertScrollableControlReachability(page, selectors) {
  return page.evaluate((requestedSelectors) => {
    const failures = [];
    for (const selector of requestedSelectors) {
      const element = document.querySelector(selector);
      if (!element) {
        failures.push({ reason: "missing", selector });
        continue;
      }
      const localScroller = element.closest(
        '[data-testid="editor-command-surface"], [data-testid="rich-command-toolbar"]'
      );
      if (localScroller) {
        const elementRect = element.getBoundingClientRect();
        const scrollerRect = localScroller.getBoundingClientRect();
        localScroller.scrollLeft += elementRect.left - scrollerRect.left - 8;
      } else {
        element.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
      const rect = element.getBoundingClientRect();
      const center = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      if (
        rect.left < -1 ||
        rect.right > window.innerWidth + 1 ||
        rect.top < -1 ||
        rect.bottom > window.innerHeight + 1 ||
        !element.contains(center)
      ) {
        failures.push({
          bottom: Math.round(rect.bottom),
          left: Math.round(rect.left),
          reason: "not-reachable",
          right: Math.round(rect.right),
          scrollerClientWidth: localScroller?.clientWidth ?? null,
          scrollerScrollLeft: localScroller?.scrollLeft ?? null,
          scrollerScrollWidth: localScroller?.scrollWidth ?? null,
          selector,
          top: Math.round(rect.top)
        });
      }
    }
    return failures;
  }, selectors);
}

async function main() {
  /*
   * MME-0114: clear only what this gate regenerates. The previous
   * `rm(visualDir, { recursive: true })` also deleted the committed README.md
   * that Gate 0.8 requires whenever the gate failed after clearing.
   */
  await clearGeneratedArtifacts(visualDir);
  await mkdir(visualDir, { recursive: true });
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
  const failedResponses = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) failedResponses.push({ status: response.status(), url: response.url() });
  });

  try {
    await setTouchViewport(page, 390, 844);
    await page.goto(demoUrl, { waitUntil: "networkidle0" });
    await page.waitForFunction(() => Boolean(window.__MME_DEMO_VISUAL_CHECK__?.setSurfaceViewportMeasurementForTest));
    await page.evaluate((content) => {
      window.__MME_DEMO_VISUAL_CHECK__.loadWritableMarkdownFileForTest("mobile-viewport.md", content);
      window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich");
    }, source);
    await page.waitForSelector('[data-testid="rich-editor-host"] .ProseMirror');
    await settlePaint(page);

    const mobile = await surfaceSnapshot(page);
    assert(mobile.coarsePointer, `Touch emulation did not expose coarse pointer: ${JSON.stringify(mobile)}`);
    assert(!mobile.documentOverflowX && !mobile.documentOverflowY, `Mobile page overflow: ${JSON.stringify(mobile)}`);
    assert(mobile.viewportMode === "visual", `Visual viewport wiring absent: ${JSON.stringify(mobile)}`);
    assert(
      mobile.targetSizes.length > 8 &&
        mobile.targetSizes.every(({ height, width }) => height >= 44 && width >= 44),
      `Coarse-pointer target below 44px: ${JSON.stringify(mobile.targetSizes)}`
    );
    assert((mobile.blockAffordanceOpacity ?? 0) >= 0.9, `Touch block affordance remains hover-only: ${JSON.stringify(mobile)}`);
    await screenshot(page, "mobile-touch-rich.png");

    const mobileReachability = await assertScrollableControlReachability(page, [
      '[data-testid="new-file-button"]',
      '[data-testid="open-file-button"]',
      '[data-testid="save-as-button"]',
      '[data-testid="mode-control"] button',
      '[data-testid="command-palette-button"]',
      '[data-testid="editor-status-button"]',
      '[data-testid="toolbar-more-button"]',
      '[data-testid="memory-save-button"]'
    ]);
    assert(mobileReachability.length === 0, `Mobile required controls unreachable: ${JSON.stringify(mobileReachability)}`);

    const statusOverlay = await page.evaluate(() => {
      const button = document.querySelector('[data-testid="editor-status-button"]');
      const scroller = button?.closest('[data-testid="editor-command-surface"]');
      if (button && scroller) {
        const buttonRect = button.getBoundingClientRect();
        const scrollerRect = scroller.getBoundingClientRect();
        scroller.scrollLeft += buttonRect.left - scrollerRect.left - 8;
        button.click();
      }
      const details = document.querySelector('[data-testid="document-status-popover"]');
      const menu = document.querySelector(".document-status-menu");
      const rect = menu?.getBoundingClientRect();
      return {
        bottom: rect ? Math.round(rect.bottom) : null,
        left: rect ? Math.round(rect.left) : null,
        open: details?.open ?? false,
        right: rect ? Math.round(rect.right) : null,
        top: rect ? Math.round(rect.top) : null
      };
    });
    assert(
      statusOverlay.open &&
        statusOverlay.left !== null &&
        statusOverlay.left >= -1 &&
        statusOverlay.right <= 391 &&
        statusOverlay.top >= -1 &&
        statusOverlay.bottom <= 845,
      `Mobile status overlay unreachable: ${JSON.stringify(statusOverlay)}`
    );
    await page.click('[data-testid="editor-status-button"]');

    const moreOverlay = await page.evaluate(() => {
      const button = document.querySelector('[data-testid="toolbar-more-button"]');
      const scroller = button?.closest('[data-testid="rich-command-toolbar"]');
      if (button && scroller) {
        const buttonRect = button.getBoundingClientRect();
        const scrollerRect = scroller.getBoundingClientRect();
        scroller.scrollLeft += buttonRect.left - scrollerRect.left - 8;
        button.click();
      }
      const menu = document.querySelector('[data-testid="toolbar-more-menu"]');
      const rect = menu?.getBoundingClientRect();
      const targets = menu
        ? [...menu.querySelectorAll("button")].map((target) => {
            const targetRect = target.getBoundingClientRect();
            return {
              height: Math.round(targetRect.height),
              width: Math.round(targetRect.width)
            };
          })
        : [];
      return {
        bottom: rect ? Math.round(rect.bottom) : null,
        left: rect ? Math.round(rect.left) : null,
        open: Boolean(menu && !menu.hidden),
        right: rect ? Math.round(rect.right) : null,
        targets,
        top: rect ? Math.round(rect.top) : null
      };
    });
    assert(
      moreOverlay.open &&
        moreOverlay.left !== null &&
        moreOverlay.left >= -1 &&
        moreOverlay.right <= 391 &&
        moreOverlay.top >= -1 &&
        moreOverlay.bottom <= 845 &&
        moreOverlay.targets.length > 0 &&
        moreOverlay.targets.every(({ height, width }) => height >= 44 && width >= 44),
      `Mobile More overlay unreachable: ${JSON.stringify(moreOverlay)}`
    );
    await page.click('[data-testid="toolbar-more-button"]');

    await page.evaluate(() => window.__MME_DEMO_VISUAL_CHECK__.openFirstRichBlockMenuForTest());
    const blockOverlay = await page.evaluate(() => {
      const menu = document.querySelector('[data-testid="rich-block-menu"]');
      const rect = menu?.getBoundingClientRect();
      const targets = menu
        ? [...menu.querySelectorAll("button")].map((target) => {
            const targetRect = target.getBoundingClientRect();
            return {
              height: Math.round(targetRect.height),
              width: Math.round(targetRect.width)
            };
          })
        : [];
      return {
        bottom: rect ? Math.round(rect.bottom) : null,
        left: rect ? Math.round(rect.left) : null,
        open: window.__MME_DEMO_VISUAL_CHECK__.getBlockAffordanceState().menuOpen,
        right: rect ? Math.round(rect.right) : null,
        targets,
        top: rect ? Math.round(rect.top) : null
      };
    });
    assert(
      blockOverlay.open &&
        blockOverlay.left !== null &&
        blockOverlay.left >= -1 &&
        blockOverlay.right <= 391 &&
        blockOverlay.top >= -1 &&
        blockOverlay.bottom <= 845 &&
        blockOverlay.targets.length === 3 &&
        blockOverlay.targets.every(({ height, width }) => height >= 44 && width >= 44),
      `Mobile block overlay unreachable: ${JSON.stringify(blockOverlay)}`
    );
    await page.keyboard.press("Escape");

    await page.evaluate(() => window.__MME_DEMO_VISUAL_CHECK__.openSlashMenuForTest("table"));
    await page.waitForSelector('[data-testid="slash-command-menu"]:not([hidden])');
    await page.evaluate(() => {
      const toolbar = document.querySelector('[data-testid="editor-command-surface"]');
      if (toolbar) toolbar.scrollLeft = 0;
    });
    await settlePaint(page);
    const slashRect = await page.evaluate(() => {
      const menu = document.querySelector('[data-testid="slash-command-menu"]');
      const rect = menu?.getBoundingClientRect();
      return rect
        ? {
            bottom: Math.round(rect.bottom),
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            top: Math.round(rect.top),
            viewportHeight: window.innerHeight,
            viewportWidth: window.innerWidth
          }
        : null;
    });
    assert(
      slashRect &&
        slashRect.left >= -1 &&
        slashRect.right <= slashRect.viewportWidth + 1 &&
        slashRect.top >= -1 &&
        slashRect.bottom <= slashRect.viewportHeight + 1,
      `Mobile slash menu escaped the visible viewport: ${JSON.stringify(slashRect)}`
    );
    const commands = await surfaceSnapshot(page);
    await screenshotElement(page, ".editor-region", "mobile-touch-commands.png");

    await setTouchViewport(page, 768, 1024);
    await page.evaluate((content) => {
      window.__MME_DEMO_VISUAL_CHECK__.setSurfaceViewportMeasurementForTest(null);
      window.__MME_DEMO_VISUAL_CHECK__.loadWritableMarkdownFileForTest("tablet-viewport.md", content);
      window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich");
    }, source);
    const tablet = await surfaceSnapshot(page);
    assert(!tablet.documentOverflowX && !tablet.documentOverflowY, `Tablet page overflow: ${JSON.stringify(tablet)}`);
    await screenshot(page, "tablet-touch-rich.png");

    await setTouchViewport(page, 390, 844);
    await page.evaluate((content) => {
      window.__MME_DEMO_VISUAL_CHECK__.loadWritableMarkdownFileForTest("keyboard-viewport.md", content);
      window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich");
      window.__MME_DEMO_VISUAL_CHECK__.setRichSelectionAfterText(
        "Edit this Markdown without replacing the durable source."
      );
      window.__MME_DEMO_VISUAL_CHECK__.setSurfaceViewportMeasurementForTest({
        layoutHeight: 844,
        layoutWidth: 390,
        visualHeight: 460,
        visualOffsetTop: 0,
        visualWidth: 390
      });
      document.querySelector('[data-testid="rich-editor-host"] .ProseMirror')?.focus();
    }, source);
    await page.keyboard.type("Rich touch edit.");
    const richExpected = source.replace(
      "Edit this Markdown without replacing the durable source.",
      "Edit this Markdown without replacing the durable source.Rich touch edit."
    );
    await page.waitForFunction((expected) => window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === expected, {}, richExpected);
    const reducedRich = await surfaceSnapshot(page);
    assert(
      reducedRich.keyboardOpen === "true" &&
        reducedRich.cssVisualHeight === "460px" &&
        reducedRich.cssKeyboardInset === "384px" &&
        Math.abs(reducedRich.shellHeight - 460) <= 1,
      `Reduced Rich viewport state failed: ${JSON.stringify(reducedRich)}`
    );
    assert(String(reducedRich.activeElement).includes("ProseMirror"), `Rich focus lost: ${JSON.stringify(reducedRich)}`);
    await screenshot(page, "mobile-keyboard-rich.png");

    await page.evaluate(() => {
      window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("source");
      window.__MME_DEMO_VISUAL_CHECK__.setCursorToEnd();
    });
    await page.keyboard.type("\nSource touch edit.");
    const sourceExpected = `${richExpected}\nSource touch edit.`;
    await page.waitForFunction((expected) => window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === expected, {}, sourceExpected);
    const reducedSource = await surfaceSnapshot(page);
    assert(String(reducedSource.activeElement).includes("cm-content"), `Source focus lost: ${JSON.stringify(reducedSource)}`);
    await page.evaluate(() => window.__MME_DEMO_VISUAL_CHECK__.memorySave("button"));
    await page.waitForFunction(
      (expected) => {
        const api = window.__MME_DEMO_VISUAL_CHECK__;
        return api.getSaveState().status === "saved" && api.getTestDiskContent() === expected;
      },
      {},
      sourceExpected
    );
    assert(
      await page.evaluate((expected) => window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === expected, sourceExpected),
      "Mobile Source/Rich editing changed unexpected Markdown."
    );
    await page.evaluate(() => {
      window.__MME_DEMO_VISUAL_CHECK__.setSelection(0, 0);
    });
    await settlePaint(page);
    const sourceScrollTop = await page.evaluate(() => {
      const scroller = document.querySelector('[data-testid="editor-host"] .cm-scroller');
      if (!scroller) return null;
      scroller.scrollTop = 0;
      return scroller.scrollTop;
    });
    assert(sourceScrollTop === 0, `Source evidence did not return to line 1: ${sourceScrollTop}`);
    await screenshot(page, "mobile-keyboard-source.png");

    const unexpectedResponses = failedResponses.filter(({ url }) => !/\/favicon\.ico(?:\?|$)/.test(url));
    const unexpectedConsoleErrors = consoleErrors.filter(
      (message) =>
        message !== "Failed to load resource: the server responded with a status of 404 (Not Found)" ||
        unexpectedResponses.length > 0
    );
    assert(unexpectedResponses.length === 0, `Failed browser responses:\n${JSON.stringify(unexpectedResponses, null, 2)}`);
    assert(unexpectedConsoleErrors.length === 0, `Browser console errors:\n${unexpectedConsoleErrors.join("\n")}`);
    await writeFile(
      `${visualDir}/result.json`,
      `${JSON.stringify(
        {
          consoleErrors: unexpectedConsoleErrors,
          blockOverlay,
          commands,
          demoUrl,
          failedResponses: unexpectedResponses,
          mobile,
          reducedRich,
          reducedSource,
          screenshots: 5,
          statusOverlay,
          status: "passed",
          moreOverlay,
          tablet
        },
        null,
        2
      )}\n`
    );
    await writeFile(
      `${visualDir}/README.md`,
      [
        "# MME-0078 visual proof",
        "",
        "- Phone and tablet touch emulation keep page scroll ownership and horizontal containment stable.",
        "- Essential coarse-pointer controls and block affordances expose at least 44px hit targets.",
        "- Topbar and toolbar actions remain reachable through bounded local scrolling.",
        "- Status disclosure, toolbar More, and block menus remain contained with 44px touch rows.",
        "- The editor-region command artifact keeps slash UI inside the visible phone viewport.",
        "- Simulated reduced visual viewport keeps Rich and Source focused/editable and reports truthful keyboard inset.",
        "- Rich/Source edits save exact Markdown to the writable test target.",
        "",
        "Human review: final mobile composition and real OS keyboard feel remain queued.",
        ""
      ].join("\n")
    );
  } finally {
    await browser.close();
  }
}

await main();
