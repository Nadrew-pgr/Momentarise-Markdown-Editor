import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import puppeteer from "puppeteer";
import { clearGeneratedArtifacts } from "./visual-artifacts.mjs";
import { requireChromeExecutable } from "./chrome-helpers.mjs";

/**
 * MME-0123 — mount fidelity, proven on the writer's own path.
 *
 * The unit suite drives `createRichMarkdownState` directly. This gate proves
 * the same thing where it matters: a real document loaded through a writable
 * file handle, a real keyboard selection, a real toolbar/bubble click, a real
 * save, and the bytes that land on disk.
 *
 * Two claims per viewport:
 *
 *  1. **The neighbour survives.** Bold the FIRST paragraph of a document whose
 *     second paragraph is soft-broken. The soft-broken paragraph is untouched,
 *     so its bytes must be identical — including its two trailing spaces, which
 *     no editor UI can show. This is the acceptance criterion's browser proof.
 *  2. **The break survives its own edit.** Bold the soft-broken paragraph
 *     itself. Before this issue the mount merged its lines, so the save wrote
 *     `**alphabravo**` — one line where the writer had two. The rendered DOM
 *     must hold a real `<br>` inside a single `<strong>`.
 *
 * The DOM assertion matters as much as the bytes: a `<br>` in the paragraph
 * proves the line survived the *mount*, which is where it was being lost.
 * Asserting bytes alone would have passed throughout the defect's life for any
 * document nobody edited, because targeted serialization replays untouched
 * blocks from their source ranges.
 */

const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5174/";
const visualDir = "docs/internal/visual-checks/MME-0123";

const WIDTHS = [
  { height: 900, name: "1280", scheme: "dark", width: 1280 },
  { hasTouch: true, height: 844, name: "390", scheme: "dark", width: 390 },
  { height: 900, name: "1280-light", scheme: "light", width: 1280 }
];

/* The two trailing spaces after `alpha` are the whole point; they are the
 * hard-break syntax, and they are invisible in every screenshot. */
const SOURCE = "Intro paragraph.\n\nalpha  \nbravo\n\nOutro paragraph.\n";

const ROWS = [
  {
    // Edit the neighbour: the soft-broken paragraph must come back untouched.
    blockIndex: 0,
    brInEditedBlock: false,
    disk: "**Intro paragraph.**\n\nalpha  \nbravo\n\nOutro paragraph.\n",
    id: "neighbour-untouched",
    selection: "whole-paragraph"
  },
  {
    // Edit the soft-broken paragraph itself: both lines must survive.
    blockIndex: 1,
    brInEditedBlock: true,
    disk: "Intro paragraph.\n\n**alpha  \nbravo**\n\nOutro paragraph.\n",
    id: "break-survives-its-own-edit",
    selection: "whole-paragraph"
  },
  {
    /*
     * The gesture that MME-0123 made reachable, found by its Test Reviewer:
     * `Home` then `Shift+ArrowDown` selects the first visual line PLUS the hard
     * break. A mark run that ends on a break puts its closing `**` after the
     * break's trailing spaces, where CommonMark stops reading it as a
     * delimiter — measured `**alpha  \n**bravo`, which reopens with two
     * literal asterisks and no bold at all. Before this issue no selection
     * could straddle a break, because the break was not in the document.
     *
     * `selectedText` is asserted first: this row is worthless if the gesture
     * silently selected something else.
     */
    blockIndex: 1,
    brInEditedBlock: false,
    disk: "Intro paragraph.\n\n**alpha**  \nbravo\n\nOutro paragraph.\n",
    id: "run-ending-on-the-break",
    selection: "first-visual-line-and-break",
    selectedText: "alpha"
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

/** Put a collapsed caret at the start of the nth top-level block, by clicking it. */
async function clickBlock(page, blockIndex) {
  const box = await page.evaluate((index) => {
    const editor = document.querySelector(".ProseMirror");
    const blocks = [...(editor?.children ?? [])].filter(
      (child) => !child.classList.contains("ProseMirror-widget")
    );
    const block = blocks[index];
    if (!block) {
      return null;
    }
    const rect = block.getBoundingClientRect();
    return { height: rect.height, left: rect.left, top: rect.top, width: rect.width };
  }, blockIndex);
  assert(box, `block ${blockIndex} must exist in the mounted document.`);
  // Click just inside the block's first line, not its centre: block 1 is two
  // visual lines tall and the centre lands on the second one.
  await page.mouse.click(box.left + 6, box.top + 6);
  await settle(120);
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

const blockFacts = (page, blockIndex) =>
  page.evaluate((index) => {
    const editor = document.querySelector(".ProseMirror");
    const blocks = [...(editor?.children ?? [])].filter(
      (child) => !child.classList.contains("ProseMirror-widget")
    );
    const block = blocks[index];
    if (!block) {
      return null;
    }
    const clone = block.cloneNode(true);
    for (const widget of clone.querySelectorAll(".ProseMirror-widget")) {
      widget.remove();
    }
    return {
      brCount: clone.querySelectorAll("br:not(.ProseMirror-trailingBreak)").length,
      // Containment, not co-occurrence: `<strong>a</strong><br><strong>b</strong>`
      // has one <br> and would satisfy a separate count of each.
      brInsideStrongCount: clone.querySelectorAll("strong br:not(.ProseMirror-trailingBreak)").length,
      html: clone.outerHTML,
      strongCount: clone.querySelectorAll("strong").length,
      text: clone.textContent ?? ""
    };
  }, blockIndex);

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
      await page.evaluate((scheme) => {
        document.documentElement.dataset.mmeScheme = scheme;
      }, viewport.scheme);

      const viewportEvidence = { rows: {} };
      evidence[viewport.name] = viewportEvidence;

      for (const row of ROWS) {
        await openRichDocument(page, "mount-fidelity.md", SOURCE);

        // --- the mount itself: the soft-broken paragraph is TWO lines ------
        const mounted = await blockFacts(page, 1);
        assert(mounted, `@${viewport.name} ${row.id}: the document must mount three blocks.`);
        assert.equal(
          mounted.brCount,
          1,
          `@${viewport.name} ${row.id}: the soft-broken paragraph must mount with a real <br>; ` +
            `dropping the model's lineBreak node is the defect. ${mounted.html}`
        );
        assert.equal(
          mounted.text,
          "alphabravo",
          `@${viewport.name} ${row.id}: the break carries no text of its own. ${mounted.html}`
        );

        // --- select the target paragraph with a real click plus real keys --
        await clickBlock(page, row.blockIndex);
        await page.keyboard.press("Home");
        await page.keyboard.down("Shift");
        if (row.selection === "first-visual-line-and-break") {
          // Down one visual line, staying in column 0: the selection is the
          // first line plus the hard break, and nothing of the second line.
          await page.keyboard.press("ArrowDown");
        } else {
          await page.keyboard.press("End");
          if (row.blockIndex === 1) {
            // Shift+End stops at the end of the visual line; the second line of
            // a soft-broken paragraph needs one more.
            await page.keyboard.press("ArrowDown");
            await page.keyboard.press("End");
          }
        }
        await page.keyboard.up("Shift");
        await settle(120);
        const selectedText = await page.evaluate(() => {
          const selection = window.getSelection();
          return selection && !selection.isCollapsed ? selection.toString() : null;
        });
        assert(
          selectedText !== null,
          `@${viewport.name} ${row.id}: the keyboard selection must not be collapsed.`
        );
        if (row.selectedText !== undefined) {
          // Without this the row could pass while bolding a different range.
          assert.equal(
            selectedText.replace(/\n/g, ""),
            row.selectedText,
            `@${viewport.name} ${row.id}: the gesture must select exactly the first visual line plus the break.`
          );
        }

        // --- press the real button for this surface ------------------------
        const buttonTestId = viewport.hasTouch ? "selection-bubble-bold" : "toolbar-command-bold";
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

        // --- save; the bytes on disk are the claim --------------------------
        const disk = await saveToDisk(page);
        assert.equal(
          disk,
          row.disk,
          `@${viewport.name} ${row.id}: the saved file must keep every line, including the two ` +
            `trailing spaces that ARE the break. Got ${JSON.stringify(disk)}.`
        );

        // --- reopen the saved bytes and assert the rendered structure -------
        await openRichDocument(page, "mount-fidelity.md", disk);
        const reopened = await blockFacts(page, row.blockIndex);
        assert(reopened, `@${viewport.name} ${row.id}: the reopened document must render the block.`);
        viewportEvidence.rows[row.id] = { disk, mounted, reopened };
        assert.equal(
          reopened.strongCount,
          1,
          `@${viewport.name} ${row.id}: the edited paragraph must reopen with exactly one <strong>. ${reopened.html}`
        );
        if (row.brInEditedBlock) {
          assert.equal(
            reopened.brInsideStrongCount,
            1,
            `@${viewport.name} ${row.id}: the break must survive INSIDE the bolded run — ` +
              `a <br> BETWEEN two <strong> elements is the mark-fracture defect, not the fix. ${reopened.html}`
          );
        }
      }

      await shoot(page, `mount-fidelity-${viewport.name}.png`);
      captured += 1;
    }

    const unexpected = consoleErrors.filter(
      (message) => message !== "Failed to load resource: the server responded with a status of 404 (Not Found)"
    );
    assert(unexpected.length === 0, `Browser console errors:\n${unexpected.join("\n")}`);

    await writeFile(
      `${visualDir}/measurements.json`,
      `${JSON.stringify({ consoleErrors: unexpected, demoUrl, evidence, screenshots: captured, source: SOURCE, status: "passed" }, null, 2)}\n`
    );
    console.log(
      `visual-check-mme0123: ${ROWS.length} mount/select/click/save/reopen rows proven across ${WIDTHS.length} viewports; ${captured} screenshots captured.`
    );
  } finally {
    await browser.close();
  }
}

await main();
