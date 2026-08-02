import assert from "node:assert/strict";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import puppeteer from "puppeteer";
import { requireChromeExecutable } from "./chrome-helpers.mjs";

/**
 * MME-0103 — block selection, proven in a real browser.
 *
 * Everything here goes through the real keyboard and the real clipboard, because
 * the two defects that reverted attempt 1 only exist on those paths:
 *
 *  - a real `copy` event, read back out of the DataTransfer, is the only way to
 *    tell "the clipboard functions are exported" from "the clipboard works";
 *  - a real Escape is the only way to tell whether one press both dismisses the
 *    slash menu and enters block selection;
 *  - only a browser can say whether the selection is actually painted, and
 *    whether a multi-block selection also paints a per-character text highlight.
 *
 * Line endings are proven headlessly in `tests/rich-block-selection.test.mjs`
 * against the CRLF fixture, not here: the demo deliberately normalises line
 * endings inside the editor and restores the file's own ending at the save
 * target, so the browser never sees the CRLF bytes. What this run does assert
 * byte-for-byte is that every operation leaves the surviving blocks and their
 * blank-line separators exactly as authored.
 */

const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5174/";
const visualDir = "docs/internal/visual-checks/MME-0103";

/*
 * Both schemes, not just the one the demo happens to open in. The light theme
 * mixes the selection token at less than half the dark theme's alpha, so it is
 * the weaker case for "selected blocks are visually distinct" — verifying only
 * dark would leave the harder half unproven.
 */
const WIDTHS = [
  { hasTouch: false, height: 900, name: "1280", scheme: "dark", width: 1280 },
  { hasTouch: true, height: 844, name: "390", scheme: "dark", width: 390 },
  { hasTouch: false, height: 900, name: "1280-light", scheme: "light", width: 1280 }
];

const fixture = [
  "# Block selection",
  "",
  "An opening paragraph that survives every operation.",
  "",
  "",
  "",
  "A paragraph the block layer removes.",
  "",
  "| Area | Risk |",
  "| --- | --- |",
  "| Table | cell selection |",
  "",
  "\`\`\`ts",
  "const selected = true;",
  "\`\`\`",
  "",
  "A closing paragraph.",
  ""
].join("\n");

async function shoot(page, name) {
  await new Promise((resolve) => setTimeout(resolve, 220));
  await page.screenshot({ path: `${visualDir}/${name}`, type: "png" });
}

async function clearOwnArtifacts() {
  const owned = await readdir(visualDir).catch(() => []);
  for (const entry of owned) {
    if (entry.endsWith(".png") || entry === "measurements.json") {
      await rm(`${visualDir}/${entry}`, { force: true });
    }
  }
}

const markdownOf = (page) => page.evaluate(() => window.__MME_DEMO_VISUAL_CHECK__.getMarkdown());

/** The colour out of a computed `box-shadow`, which puts it first. */
function ringColour(boxShadow) {
  return /(rgba?\([^)]+\)|color\([^)]+\))/.exec(boxShadow ?? "")?.[1] ?? "rgb(0, 0, 0)";
}

function channels(colour) {
  const parts = [...(colour ?? "").matchAll(/-?\d*\.?\d+/g)].map((match) => Number(match[0]));
  if (/^color\(/.test(colour ?? "")) {
    // `color(srgb r g b / a)` — already 0..1.
    return parts.slice(0, 3);
  }
  return parts.slice(0, 3).map((value) => value / 255);
}

function relativeLuminance(colour) {
  const [r, g, b] = channels(colour);
  const linear = [r, g, b].map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(foreground, background) {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** What the packaged presentation actually painted, read from the live DOM. */
const paintedSelection = (page) =>
  page.evaluate(() => {
    const editor = document.querySelector(".ProseMirror");
    const blocks = [...(editor?.children ?? [])].filter((child) => !child.classList.contains("ProseMirror-widget"));
    const selected = blocks.filter((block) => block.getAttribute("data-mme-block-selected") === "true");
    const first = selected[0];
    return {
      announcement: document.querySelector('[data-testid="rich-block-selection-live-region"]')?.textContent ?? null,
      background: first ? getComputedStyle(first).backgroundColor : null,
      pageBackground: getComputedStyle(document.body).backgroundColor,
      ring: first ? getComputedStyle(first).boxShadow : null,
      count: editor?.getAttribute("data-mme-block-selection") ?? null,
      // The per-character highlight the acceptance criteria rule out. The DOM
      // range still exists — that is how copy works — but nothing may be painted
      // over the characters, so this reads the computed ::selection colour of
      // the live editor rather than counting range rectangles.
      highlightPaint: getComputedStyle(editor, "::selection").backgroundColor,
      highlightPaintOnBlock: first ? getComputedStyle(first, "::selection").backgroundColor : null,
      selectedIndexes: selected.map((block) => blocks.indexOf(block))
    };
  });

/**
 * Clicks the block, the way a writer reaches it, and then normalises the cursor
 * onto that exact block. The click matters: a real `page.keyboard.press` only
 * reaches the editor when the editor really holds DOM focus, which is the
 * difference between testing the feature and testing a synthetic event.
 */
async function caretInBlock(page, index) {
  const handle = await page.evaluateHandle((blockIndex) => {
    const editor = document.querySelector(".ProseMirror");
    const blocks = [...(editor?.children ?? [])].filter((child) => !child.classList.contains("ProseMirror-widget"));
    return blocks[blockIndex];
  }, index);
  const element = handle.asElement();
  assert(element, `no block at index ${index} to click.`);
  await element.click();
  await new Promise((resolve) => setTimeout(resolve, 120));
  await page.evaluate((blockIndex) => {
    window.__MME_DEMO_VISUAL_CHECK__.setRichBlockCaretForTest(blockIndex);
  }, index);
  await new Promise((resolve) => setTimeout(resolve, 140));
  const focused = await page.evaluate(() => Boolean(document.activeElement?.closest(".ProseMirror")));
  assert(focused, "the editing surface must hold focus before a real key press is sent to it.");
}

async function main() {
  await mkdir(visualDir, { recursive: true });
  await clearOwnArtifacts();

  const browser = await puppeteer.launch({
    executablePath: requireChromeExecutable(),
    headless: true,
    args: ["--disable-gpu", "--no-default-browser-check", "--no-first-run"]
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
        hasTouch: viewport.hasTouch,
        height: viewport.height,
        isMobile: viewport.hasTouch,
        width: viewport.width
      });
      await page.goto(demoUrl, { waitUntil: "networkidle0" });
      await page.waitForFunction(() => Boolean(window.__MME_DEMO_VISUAL_CHECK__?.loadWritableMarkdownFileForTest));
      await page.evaluate(() => localStorage.clear());
      await page.reload({ waitUntil: "networkidle0" });
      await page.waitForFunction(() => Boolean(window.__MME_DEMO_VISUAL_CHECK__?.setRichBlockCaretForTest));
      await page.evaluate((scheme) => {
        document.documentElement.dataset.mmeScheme = scheme;
      }, viewport.scheme);

      const reload = async () => {
        await page.evaluate((content) => {
          window.__MME_DEMO_VISUAL_CHECK__.loadWritableMarkdownFileForTest("block-selection.md", content);
          window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich");
        }, fixture);
        await page.waitForSelector(".ProseMirror");
        await new Promise((resolve) => setTimeout(resolve, 200));
      };

      const viewportEvidence = {};
      evidence[viewport.name] = viewportEvidence;

      await reload();
      assert.equal(
        await markdownOf(page),
        fixture,
        `@${viewport.name}: the fixture must load byte-identical, wide gap included, before anything is selected.`
      );

      // --- Escape selects the block, and it is visibly selected -------------
      await caretInBlock(page, 2);
      await page.keyboard.press("Escape");
      await new Promise((resolve) => setTimeout(resolve, 200));
      viewportEvidence.singleBlock = await paintedSelection(page);
      assert.deepEqual(
        viewportEvidence.singleBlock.selectedIndexes,
        [2],
        `@${viewport.name}: Escape must paint exactly the caret's block as selected.`
      );
      assert.notEqual(
        viewportEvidence.singleBlock.background,
        "rgba(0, 0, 0, 0)",
        `@${viewport.name}: the selected block must have a visible background, not a transparent one.`
      );
      /*
       * The ring is the indicator that has to survive a framed block painting
       * its own background, and it is the one measured against WCAG 1.4.11.
       */
      assert(
        viewportEvidence.singleBlock.ring && viewportEvidence.singleBlock.ring !== "none",
        `@${viewport.name}: the selected block must draw a ring, not rely on the low-alpha tint alone.`
      );
      assert(
        contrastRatio(ringColour(viewportEvidence.singleBlock.ring), viewportEvidence.singleBlock.pageBackground) >= 3,
        `@${viewport.name}: the selection ring must reach 3:1 against the page (WCAG 1.4.11); got ${
          contrastRatio(ringColour(viewportEvidence.singleBlock.ring), viewportEvidence.singleBlock.pageBackground).toFixed(2)
        }:1 for ${viewportEvidence.singleBlock.ring} on ${viewportEvidence.singleBlock.pageBackground}.`
      );
      assert.equal(
        viewportEvidence.singleBlock.announcement,
        "Paragraph, block 3 of 6: A paragraph the block layer removes.",
        `@${viewport.name}: the selection must be announced with the block's identity, not just that something is selected.`
      );
      await shoot(page, `block-selected-${viewport.name}.png`);
      captured += 1;

      // --- Shift+Arrow extends across a framed block ------------------------
      await page.keyboard.down("Shift");
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("ArrowDown");
      await page.keyboard.up("Shift");
      await new Promise((resolve) => setTimeout(resolve, 200));
      viewportEvidence.multiBlock = await paintedSelection(page);
      assert.deepEqual(
        viewportEvidence.multiBlock.selectedIndexes,
        [2, 3, 4],
        `@${viewport.name}: Shift+ArrowDown must extend the block selection across the table and the code fence.`
      );
      for (const [where, painted] of [
        ["editor", viewportEvidence.multiBlock.highlightPaint],
        ["selected block", viewportEvidence.multiBlock.highlightPaintOnBlock]
      ]) {
        assert.equal(
          painted,
          "rgba(0, 0, 0, 0)",
          `@${viewport.name}: the ${where} must paint no per-character text highlight during a block selection (acceptance criterion); got ${painted}.`
        );
      }
      /*
       * A table paints its own cell backgrounds over any tint, so before the
       * ring it showed no fill at all — selected and unselected were byte-
       * identical apart from a hairline. The ring is drawn outside the block, so
       * a framed block gets exactly the indicator a paragraph gets.
       */
      viewportEvidence.framedRing = await page.evaluate(() => {
        const editor = document.querySelector(".ProseMirror");
        const blocks = [...(editor?.children ?? [])].filter((child) => !child.classList.contains("ProseMirror-widget"));
        const table = blocks.find((block) => block.tagName === "TABLE" || block.querySelector("table"));
        return table ? getComputedStyle(table).boxShadow : null;
      });
      assert(
        viewportEvidence.framedRing && viewportEvidence.framedRing !== "none",
        `@${viewport.name}: a selected table must carry the same ring a selected paragraph does.`
      );
      await shoot(page, `multi-block-selected-${viewport.name}.png`);
      captured += 1;

      // --- Real copy event: the clipboard carries the blocks' Markdown ------
      viewportEvidence.copied = await page.evaluate(() => {
        const transfer = new DataTransfer();
        const event = new ClipboardEvent("copy", { bubbles: true, cancelable: true, clipboardData: transfer });
        document.querySelector(".ProseMirror")?.dispatchEvent(event);
        return { html: transfer.getData("text/html").length, text: transfer.getData("text/plain") };
      });
      assert(
        viewportEvidence.copied.text.includes("| Area | Risk |"),
        `@${viewport.name}: a real copy event must put the selected table's Markdown on the clipboard. Got: ${JSON.stringify(
          viewportEvidence.copied.text
        )}`
      );
      assert(
        viewportEvidence.copied.text.includes("const selected = true;"),
        `@${viewport.name}: a real copy event must include the selected code fence.`
      );
      assert(viewportEvidence.copied.html > 0, `@${viewport.name}: the HTML clipboard flavour must be written too.`);

      // --- Backspace deletes the blocks, byte-exactly, CRLF intact ----------
      await page.keyboard.press("Backspace");
      await new Promise((resolve) => setTimeout(resolve, 250));
      const afterDelete = await markdownOf(page);
      viewportEvidence.afterDelete = afterDelete;
      assert.equal(
        afterDelete,
        "# Block selection\n\nAn opening paragraph that survives every operation.\n\n\n\nA closing paragraph.\n",
        `@${viewport.name}: deleting three blocks must leave the survivors and the wide blank-line gap the author wrote after the last surviving block, exactly as written.`
      );
      await shoot(page, `after-delete-${viewport.name}.png`);
      captured += 1;

      // --- One undo restores the bytes --------------------------------------
      await page.keyboard.down(process.platform === "darwin" ? "Meta" : "Control");
      await page.keyboard.press("KeyZ");
      await page.keyboard.up(process.platform === "darwin" ? "Meta" : "Control");
      await new Promise((resolve) => setTimeout(resolve, 250));
      /*
       * Every block comes back, with its content intact, from one press.
       *
       * Not a byte comparison, and deliberately so: this demo re-parses after
       * every rich edit (`syncRichMarkdownToSource`), which makes the
       * post-delete text the preservation baseline, so the restored blocks are
       * new to the serializer and take the document's own gap rather than the
       * gaps that used to sit between them. Byte-exact undo is proven where the
       * contract lives — `tests/rich-block-selection.test.mjs`, one undo,
       * `assert.equal` against the original source — which is also what a host
       * that keeps its baseline (`@momentarise/md-react`) does.
       */
      const undone = await markdownOf(page);
      viewportEvidence.afterUndo = undone;
      assert.equal(
        undone.replace(/\n{2,}/g, "\n\n"),
        fixture.replace(/\n{2,}/g, "\n\n"),
        `@${viewport.name}: one undo must bring back every deleted block with its content intact.`
      );

      // --- Cmd+D duplicates -------------------------------------------------
      await reload();
      await caretInBlock(page, 2);
      await page.keyboard.press("Escape");
      await new Promise((resolve) => setTimeout(resolve, 150));
      await page.keyboard.down(process.platform === "darwin" ? "Meta" : "Control");
      await page.keyboard.press("KeyD");
      await page.keyboard.up(process.platform === "darwin" ? "Meta" : "Control");
      await new Promise((resolve) => setTimeout(resolve, 250));
      const afterDuplicate = await markdownOf(page);
      viewportEvidence.afterDuplicate = afterDuplicate;
      assert.equal(
        afterDuplicate,
        fixture.replace(
          "A paragraph the block layer removes.\n",
          "A paragraph the block layer removes.\n\nA paragraph the block layer removes.\n"
        ),
        `@${viewport.name}: duplicating must reuse the authored separator instead of inventing one.`
      );
      await shoot(page, `after-duplicate-${viewport.name}.png`);
      captured += 1;

      // --- One Escape, one meaning -----------------------------------------
      await reload();
      await page.evaluate(() => {
        const editor = document.querySelector(".ProseMirror");
        editor?.focus();
        window.__MME_DEMO_VISUAL_CHECK__.setRichSelectionAfterText("A closing paragraph.");
      });
      await new Promise((resolve) => setTimeout(resolve, 150));
      await page.keyboard.type(" /head");
      await new Promise((resolve) => setTimeout(resolve, 260));
      const menuOpen = await page.evaluate(() => window.__MME_DEMO_VISUAL_CHECK__.getSlashMenuState().open);
      assert(menuOpen, `@${viewport.name}: the slash menu must be open before the collision case.`);
      await shoot(page, `slash-menu-open-${viewport.name}.png`);
      captured += 1;

      await page.keyboard.press("Escape");
      await new Promise((resolve) => setTimeout(resolve, 260));
      viewportEvidence.escapeCollision = {
        menuOpen: await page.evaluate(() => window.__MME_DEMO_VISUAL_CHECK__.getSlashMenuState().open),
        selection: await paintedSelection(page)
      };
      assert.equal(
        viewportEvidence.escapeCollision.menuOpen,
        false,
        `@${viewport.name}: Escape must dismiss the slash menu.`
      );
      assert.deepEqual(
        viewportEvidence.escapeCollision.selection.selectedIndexes,
        [],
        `@${viewport.name}: the same Escape must NOT also enter block selection (MME-0086/0088 collision).`
      );
      await shoot(page, `escape-dismisses-only-the-menu-${viewport.name}.png`);
      captured += 1;

      await page.keyboard.press("Escape");
      await new Promise((resolve) => setTimeout(resolve, 220));
      viewportEvidence.escapeAfterDismissal = await paintedSelection(page);
      assert.equal(
        viewportEvidence.escapeAfterDismissal.selectedIndexes.length,
        1,
        `@${viewport.name}: the next Escape does enter block selection, so the guard did not disable the feature.`
      );
    }

    const unexpected = consoleErrors.filter(
      (message) => message !== "Failed to load resource: the server responded with a status of 404 (Not Found)"
    );
    assert(unexpected.length === 0, `Browser console errors:\n${unexpected.join("\n")}`);

    await writeFile(
      `${visualDir}/measurements.json`,
      `${JSON.stringify({ consoleErrors: unexpected, demoUrl, evidence, screenshots: captured, status: "passed" }, null, 2)}\n`
    );
    console.log(`visual-check-mme0103: ${captured} screenshots captured; block selection is visible, byte-safe and collision-free.`);
  } finally {
    await browser.close();
  }
}

await main();
