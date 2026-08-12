import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import puppeteer from "puppeteer";
import { clearGeneratedArtifacts } from "./visual-artifacts.mjs";
import { requireChromeExecutable } from "./chrome-helpers.mjs";

/**
 * MME-0121 — one delimiter pair per mark run, proven end to end in a browser.
 *
 * The unit suite drives `applyRichMarkdownCommand` directly. This gate walks
 * the writer's own path: a real keyboard selection (Home, Shift+End), a real
 * pointer click on the toolbar's bold button, a real save through a writable
 * file handle, and a reload of the saved bytes. The defect's signature was
 * `**a ****`x`**** b**` on disk — plausible-looking bytes that reopened as
 * nested strong-inside-strong — so each row asserts the disk bytes AND the
 * reopened DOM: exactly one <strong> in the paragraph, with the inner
 * construct alive inside it.
 */

const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5174/";
const visualDir = "docs/internal/visual-checks/MME-0121";

const WIDTHS = [
  { height: 900, name: "1280", scheme: "dark", width: 1280 },
  { hasTouch: true, height: 844, name: "390", scheme: "dark", width: 390 },
  { height: 900, name: "1280-light", scheme: "light", width: 1280 }
];

/**
 * `disk` is the measured byte content the Save Engine writes after the click.
 * `inner` is the selector that must exist INSIDE the single <strong>/<em> of
 * the reopened paragraph, proving the run wrapped around it rather than
 * fracturing at its boundary.
 *
 * Each viewport uses the surface a writer actually touches there: the sticky
 * toolbar button on desktop, the selection bubble's button at the coarse-
 * pointer width — where the bubble floats over the sticky toolbar and its
 * padding would swallow a tap aimed at the covered button underneath
 * (measured; recorded in BACKLOG.md).
 */
const ROWS = [
  {
    bubbleButton: "selection-bubble-bold",
    disk: "**a `x` b**\n",
    id: "bold-across-code",
    inner: "strong code",
    outer: "strong",
    source: "a `x` b\n",
    toolbarButton: "toolbar-command-bold"
  },
  {
    bubbleButton: "selection-bubble-italic",
    disk: "*a **b** c*\n",
    id: "italic-across-bold",
    inner: "em strong",
    outer: "em",
    source: "a **b** c\n",
    toolbarButton: "toolbar-command-italic"
  }
];

const settle = (ms = 180) => new Promise((resolve) => setTimeout(resolve, ms));

async function shoot(page, name) {
  await settle(220);
  await page.screenshot({ path: `${visualDir}/${name}`, type: "png" });
}

async function openRichDocument(page, fileName, content) {
  await page.evaluate(
    ({ file, source }) => {
      window.__MME_DEMO_VISUAL_CHECK__.loadWritableMarkdownFileForTest(file, source);
      window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich");
    },
    { file: fileName, source: content }
  );
  await page.waitForSelector(".ProseMirror");
  await settle();
  await page.click(".ProseMirror");
  await settle(120);
  const focused = await page.evaluate(() => Boolean(document.activeElement?.closest(".ProseMirror")));
  assert(focused, "the editing surface must hold focus before a real key press is sent to it.");
}

async function saveToDisk(page) {
  await page.evaluate(async () => {
    await window.__MME_DEMO_VISUAL_CHECK__.flushSave("manual");
  });
  await settle(200);
  const disk = await page.evaluate(() => window.__MME_DEMO_VISUAL_CHECK__.getTestDiskContent());
  assert(typeof disk === "string", "the writable test handle must report the bytes it holds.");
  return disk;
}

const paragraphFacts = (page) =>
  page.evaluate(() => {
    const editor = document.querySelector(".ProseMirror");
    const block = [...(editor?.children ?? [])].find(
      (child) => !child.classList.contains("ProseMirror-widget")
    );
    if (!block) {
      return null;
    }
    const clone = block.cloneNode(true);
    for (const widget of clone.querySelectorAll(".ProseMirror-widget")) {
      widget.remove();
    }
    return {
      emCount: clone.querySelectorAll("em").length,
      html: clone.outerHTML,
      strongCount: clone.querySelectorAll("strong").length,
      text: clone.textContent ?? ""
    };
  });

async function main() {
  await mkdir(visualDir, { recursive: true });
  await clearGeneratedArtifacts(visualDir);

  const browser = await puppeteer.launch({
    args: ["--disable-gpu", "--no-default-browser-check", "--no-first-run"],
    executablePath: requireChromeExecutable(),
    headless: true
  });
  const consoleErrors = [];
  let page = null;
  const evidence = {};
  let captured = 0;

  try {
    for (const viewport of WIDTHS) {
      await page?.close();
      page = await browser.newPage();
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });
      page.on("pageerror", (error) => consoleErrors.push(error.message));
      await page.setViewport({
        deviceScaleFactor: 1,
        hasTouch: Boolean(viewport.hasTouch),
        height: viewport.height,
        isMobile: Boolean(viewport.hasTouch),
        width: viewport.width
      });
      await page.goto(demoUrl, { waitUntil: "networkidle0" });
      await page.waitForFunction(() => Boolean(window.__MME_DEMO_VISUAL_CHECK__?.loadWritableMarkdownFileForTest));
      await page.evaluate(() => localStorage.clear());
      await page.reload({ waitUntil: "networkidle0" });
      await page.waitForFunction(() => Boolean(window.__MME_DEMO_VISUAL_CHECK__?.loadWritableMarkdownFileForTest));
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
      await page.evaluate((scheme) => {
        document.documentElement.dataset.mmeScheme = scheme;
      }, viewport.scheme);

      const viewportEvidence = { rows: {} };
      evidence[viewport.name] = viewportEvidence;

      for (const row of ROWS) {
        // --- select the whole paragraph with real keys -------------------
        await openRichDocument(page, "mark-runs.md", row.source);
        await page.keyboard.press("Home");
        await page.keyboard.down("Shift");
        await page.keyboard.press("End");
        await page.keyboard.up("Shift");
        await settle(120);
        const selectionSpansParagraph = await page.evaluate(() => {
          const selection = window.getSelection();
          return Boolean(selection && !selection.isCollapsed);
        });
        assert(selectionSpansParagraph, `@${viewport.name} ${row.id}: the keyboard selection must not be collapsed.`);

        // --- press the real button for this surface ----------------------
        const buttonTestId = viewport.hasTouch ? row.bubbleButton : row.toolbarButton;
        const button = await page.$(`[data-testid="${buttonTestId}"]`);
        assert(button, `@${viewport.name} ${row.id}: the surface must render ${buttonTestId}.`);
        assert(
          await button.boundingBox(),
          `@${viewport.name} ${row.id}: ${buttonTestId} must be visible to a real pointer.`
        );
        if (viewport.hasTouch) {
          await button.tap();
        } else {
          await button.click();
        }
        await settle(200);

        // --- save; the bytes on disk are the claim -----------------------
        const disk = await saveToDisk(page);
        assert.equal(
          disk,
          row.disk,
          `@${viewport.name} ${row.id}: the file must hold one delimiter pair per run, got ${JSON.stringify(disk)}.`
        );

        // --- reload the saved bytes and assert the rendered structure ----
        await openRichDocument(page, "mark-runs.md", disk);
        const facts = await paragraphFacts(page);
        assert(facts, `@${viewport.name} ${row.id}: the reopened document must render a block.`);
        viewportEvidence.rows[row.id] = { disk, ...facts };
        const outerCount = row.outer === "strong" ? facts.strongCount : facts.emCount;
        assert.equal(
          outerCount,
          1,
          `@${viewport.name} ${row.id}: the reopened paragraph must hold exactly one <${row.outer}>, got ${outerCount}. Nested pairs are the defect. ${facts.html}`
        );
        assert(
          await page.evaluate(
            (selector) => Boolean(document.querySelector(`.ProseMirror ${selector}`)),
            row.inner
          ),
          `@${viewport.name} ${row.id}: the inner construct must survive inside the run (${row.inner}). ${facts.html}`
        );
      }

      await shoot(page, `mark-runs-${viewport.name}.png`);
      captured += 1;
    }

    const unexpected = consoleErrors.filter(
      (message) => message !== "Failed to load resource: the server responded with a status of 404 (Not Found)"
    );
    assert(unexpected.length === 0, `Browser console errors:\n${unexpected.join("\n")}`);

    await writeFile(
      `${visualDir}/measurements.json`,
      `${JSON.stringify({ consoleErrors: unexpected, demoUrl, evidence, screenshots: captured, status: "passed" }, null, 2)}\n`
    );
    console.log(
      `visual-check-mme0121: ${ROWS.length} select/click/save/reopen rows proven with a real keyboard selection and a real toolbar click across ${WIDTHS.length} viewports; ${captured} screenshots captured.`
    );
  } finally {
    await browser.close();
  }
}

await main();
