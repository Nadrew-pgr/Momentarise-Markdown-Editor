import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import puppeteer from "puppeteer";
import { clearGeneratedArtifacts } from "./visual-artifacts.mjs";
import { requireChromeExecutable } from "./chrome-helpers.mjs";

/**
 * MME-0115 — composition over a block selection, driven by a real IME.
 *
 * This gate is the primary evidence for this issue, not a supplement. A
 * composition cannot be faithfully simulated: the sequence that destroys the
 * blocks is Chromium's own DOM work, and every headless reproduction of it is a
 * replay of transactions someone believed the browser dispatches. So the
 * composition here is genuine — CDP's `Input.imeSetComposition` drives
 * Chromium's composition pipeline, `Input.insertText` commits it, and
 * `imeSetComposition` with an empty string is the cancel.
 *
 * Four claims per viewport, plus the one attempt 2 could not make:
 *
 *  1. **Cancel restores the blocks.** The selected blocks come back, with their
 *     text, and stay selected. Before this issue they were destroyed outright.
 *  2. **Cancel restores the BYTES.** `getMarkdown()` and the file that reaches
 *     disk are byte-identical to what was opened. This is the claim that
 *     reverted attempt 2: the DOM was already correct there, and the saved file
 *     still gained a blank block, because the host had adopted the
 *     mid-composition document as its serialization baseline.
 *  3. **Commit still conforms.** A dead key committed over one block and over
 *     two blocks replaces exactly the selection, neighbours byte-identical. That
 *     path already worked; this pins it, because the fix touches the same events.
 *  4. **Cancel then undo does not corrupt the document.** The restore joins the
 *     composition's own history event, so one Cmd/Ctrl+Z steps back past the
 *     whole non-event. A restore recorded outside history leaves the
 *     composition's inverse steps behind for undo to replay onto an
 *     already-restored document — measured as a duplicated block.
 *
 * The setup is the part that is easy to get wrong, and it is asserted rather
 * than assumed: an unfocused editor makes the whole run silently test a text
 * selection instead of a block selection, so the painted
 * `data-mme-block-selected` count is checked BEFORE anything composes.
 */

const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5174/";
const visualDir = "docs/internal/visual-checks/MME-0115";

const WIDTHS = [
  { height: 900, name: "1280", scheme: "dark", width: 1280 },
  { hasTouch: true, height: 844, name: "390", scheme: "dark", width: 390 },
  { height: 900, name: "1280-light", scheme: "light", width: 1280 }
];

const SOURCE = "Alpha block.\n\nBravo block.\n\nCharlie block.\n\nDelta block.\n";

/** macOS `option+e` then `e`: the dead key, then the composed character. */
const DEAD_KEY = "´";
const COMPOSED = "é";
/** `option+n` then `n`. A second dead key, because the acceptance criteria name three. */
const TILDE_KEY = "\u02dc";
const TILDE_COMPOSED = "\u00f1";

/*
 * A full IME session with candidate selection, which the acceptance criteria
 * cover alongside dead keys: several composition updates before the outcome,
 * the way a Japanese input method builds a word. It is also the longest window
 * Chromium has to flush DOM work of its own, which is what a single-update dead
 * key barely exercises.
 */
const IME_SESSION = ["\u306b", "\u306b\u307b", "\u306b\u307b\u3093"];
const IME_COMMITTED = "\u65e5\u672c";

const ROWS = [
  {
    /*
     * The control, and the yardstick for every commit row below it. This issue's
     * goal is that a composition replaces a block selection "the way an ordinary
     * keystroke does", so what an ordinary keystroke announces is measured here
     * rather than assumed — asserting a literal string would pin behaviour this
     * host does not actually have. (Measured: the demo re-renders after an edit
     * and its own transaction consumes the block layer's one-shot notice before
     * any assistive technology could observe it. That happens on BOTH paths and
     * predates this issue; the package-level announcement is proven in
     * `tests/rich-composition-baseline.test.mjs`.)
     */
    blocks: ["x", "Bravo block.", "Charlie block.", "Delta block."],
    expected: "x\n\nBravo block.\n\nCharlie block.\n\nDelta block.\n",
    extend: 0,
    id: "plain-keystroke-control",
    outcome: "plain",
    selectedAfter: 0
  },
  {
    blocks: ["Alpha block.", "Bravo block.", "Charlie block.", "Delta block."],
    expected: SOURCE,
    extend: 0,
    id: "cancel-single",
    outcome: "cancel",
    selectedAfter: 1
  },
  {
    blocks: ["Alpha block.", "Bravo block.", "Charlie block.", "Delta block."],
    expected: SOURCE,
    extend: 1,
    id: "cancel-multi",
    outcome: "cancel",
    selectedAfter: 2
  },
  {
    blocks: [COMPOSED, "Bravo block.", "Charlie block.", "Delta block."],
    expected: `${COMPOSED}\n\nBravo block.\n\nCharlie block.\n\nDelta block.\n`,
    extend: 0,
    id: "commit-single",
    outcome: "commit",
    selectedAfter: 0
  },
  {
    blocks: [COMPOSED, "Charlie block.", "Delta block."],
    expected: `${COMPOSED}\n\nCharlie block.\n\nDelta block.\n`,
    extend: 1,
    id: "commit-multi",
    outcome: "commit",
    selectedAfter: 0
  },
  {
    blocks: ["Alpha block.", "Bravo block.", "Charlie block.", "Delta block."],
    expected: SOURCE,
    extend: 0,
    id: "cancel-ime-session",
    outcome: "cancel",
    selectedAfter: 1,
    updates: IME_SESSION
  },
  {
    blocks: [IME_COMMITTED, "Charlie block.", "Delta block."],
    commitText: IME_COMMITTED,
    expected: `${IME_COMMITTED}\n\nCharlie block.\n\nDelta block.\n`,
    extend: 1,
    id: "commit-ime-session",
    outcome: "commit",
    selectedAfter: 0,
    updates: IME_SESSION
  },
  {
    blocks: [TILDE_COMPOSED, "Bravo block.", "Charlie block.", "Delta block."],
    commitText: TILDE_COMPOSED,
    expected: `${TILDE_COMPOSED}\n\nBravo block.\n\nCharlie block.\n\nDelta block.\n`,
    extend: 0,
    id: "commit-tilde",
    outcome: "commit",
    selectedAfter: 0,
    updates: [TILDE_KEY]
  },
  {
    /*
     * The acceptance criterion "one undoable transaction" — and the positive
     * control for the row below it: a Cmd/Ctrl+Z that never reaches the editor
     * fails HERE, where undo has real work to do, instead of passing silently in
     * `cancel-then-undo`, where the document already equals what is expected.
     */
    blocks: ["Alpha block.", "Bravo block.", "Charlie block.", "Delta block."],
    expected: SOURCE,
    extend: 1,
    id: "commit-then-undo",
    outcome: "commit",
    undoAfter: true
  },
  {
    blocks: ["Alpha block.", "Bravo block.", "Charlie block.", "Delta block."],
    expected: SOURCE,
    extend: 0,
    id: "cancel-then-undo",
    outcome: "cancel",
    /*
     * No `selectedAfter`: what an undo leaves selected is `prosemirror-history`'s
     * business — it restores the selection bookmark it stored with the event.
     * The claim this row makes is about the document, not the block layer.
     */
    undoAfter: true
  }
];

const settle = (ms = 200) => new Promise((resolve) => setTimeout(resolve, ms));

async function shoot(page, name) {
  await settle(220);
  await page.screenshot({ path: `${visualDir}/${name}`, type: "png" });
}

const markdownOf = (page) => page.evaluate(() => window.__MME_DEMO_VISUAL_CHECK__.getMarkdown());

/**
 * What the editing surface is actually showing and painting right now.
 *
 * Widgets are stripped from a clone before the text is read: the block
 * affordances render their own labels ("Drag to reorder…") inside the block
 * element, and those are UI, not document content.
 */
const surfaceFacts = (page) =>
  page.evaluate(() => {
    const editor = document.querySelector(".ProseMirror");
    const blocks = [...(editor?.children ?? [])].filter(
      (child) => !child.classList.contains("ProseMirror-widget")
    );
    return {
      /*
       * What a screen reader would hear. The block layer is an announced
       * surface, and the restore is exactly the kind of change that can narrate
       * a state the writer never saw.
       */
      announcement:
        document.querySelector('[data-testid="rich-block-selection-live-region"]')?.textContent ?? null,
      selected: blocks.filter((block) => block.getAttribute("data-mme-block-selected") === "true").length,
      texts: blocks.map((block) => {
        const clone = block.cloneNode(true);
        for (const widget of clone.querySelectorAll(".ProseMirror-widget")) {
          widget.remove();
        }
        return clone.textContent ?? "";
      })
    };
  });

/**
 * Start recording what the live region says.
 *
 * Announcements are events, not state: the block layer's notice is one-shot, so
 * the region's FINAL text is whatever the last unrelated transaction left there.
 * What matters to a screen-reader user is the sequence — and for a cancelled
 * composition, that the sequence is empty.
 */
async function recordAnnouncements(page) {
  await page.evaluate(() => {
    const region = document.querySelector('[data-testid="rich-block-selection-live-region"]');
    if (!region) {
      window.__MME_ANNOUNCEMENTS__ = null;
      return;
    }
    window.__MME_ANNOUNCE_OBSERVER__?.disconnect();
    window.__MME_ANNOUNCEMENTS__ = [];
    const observer = new MutationObserver(() => {
      window.__MME_ANNOUNCEMENTS__.push(region.textContent ?? "");
    });
    observer.observe(region, { characterData: true, childList: true, subtree: true });
    window.__MME_ANNOUNCE_OBSERVER__ = observer;
  });
}

const announcementsOf = (page) =>
  page.evaluate(() => {
    window.__MME_ANNOUNCE_OBSERVER__?.takeRecords?.();
    return window.__MME_ANNOUNCEMENTS__;
  });

async function openRichDocument(page, content) {
  await page.evaluate((source) => {
    window.__MME_DEMO_VISUAL_CHECK__.loadWritableMarkdownFileForTest("composition.md", source);
    window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich");
  }, content);
  await page.waitForSelector(".ProseMirror");
  await settle();
}

/**
 * Enters block selection the way a writer does, and proves it happened.
 *
 * The click is what gives the editing surface real DOM focus; without it the
 * key presses below go to the document and the composition lands somewhere else
 * entirely, which is the failure mode attempt 1 recorded.
 */
async function selectBlocks(page, index, extend) {
  const handle = await page.evaluateHandle((blockIndex) => {
    const editor = document.querySelector(".ProseMirror");
    const blocks = [...(editor?.children ?? [])].filter(
      (child) => !child.classList.contains("ProseMirror-widget")
    );
    return blocks[blockIndex];
  }, index);
  const element = handle.asElement();
  assert(element, `no block at index ${index} to click.`);
  await element.click();
  await settle(120);
  await page.evaluate((blockIndex) => {
    window.__MME_DEMO_VISUAL_CHECK__.setRichBlockCaretForTest(blockIndex);
  }, index);
  await settle(140);
  const focused = await page.evaluate(() => Boolean(document.activeElement?.closest(".ProseMirror")));
  assert(focused, "the editing surface must hold focus before a real key press is sent to it.");
  await page.keyboard.press("Escape");
  await settle(160);
  for (let step = 0; step < extend; step += 1) {
    await page.keyboard.down("Shift");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.up("Shift");
    await settle(120);
  }
  return surfaceFacts(page);
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
      await page.waitForFunction(() => Boolean(window.__MME_DEMO_VISUAL_CHECK__?.setRichBlockCaretForTest));
      await page.evaluate((scheme) => {
        document.documentElement.dataset.mmeScheme = scheme;
      }, viewport.scheme);

      const client = await page.createCDPSession();
      const viewportEvidence = { rows: {} };
      let plainAnnouncement = null;
      evidence[viewport.name] = viewportEvidence;

      for (const row of ROWS) {
        await openRichDocument(page, SOURCE);
        assert.equal(
          await markdownOf(page),
          SOURCE,
          `@${viewport.name} ${row.id}: the document must load byte-identical before anything composes.`
        );

        const before = await selectBlocks(page, 0, row.extend);
        assert.equal(
          before.selected,
          row.extend + 1,
          `@${viewport.name} ${row.id}: ${row.extend + 1} block(s) must be painted as selected BEFORE composing; ` +
            `${before.selected} were. Composing over a text selection proves nothing about this issue.`
        );

        await recordAnnouncements(page);

        if (row.outcome === "plain") {
          // No composition at all: the ordinary keystroke this issue compares to.
          await page.keyboard.type("x");
          await settle(700);
          const control = await surfaceFacts(page);
          const controlDisk = await saveToDisk(page);
          plainAnnouncement = control.announcement;
          viewportEvidence.rows[row.id] = { after: control, disk: controlDisk };
          assert.deepEqual(
            control.texts,
            row.blocks,
            `@${viewport.name} ${row.id}: the control must replace the selected block with the typed character.`
          );
          assert.equal(
            controlDisk,
            row.expected,
            `@${viewport.name} ${row.id}: and write those bytes, or it is no yardstick for the composition rows.`
          );
          continue;
        }

        // --- a real IME composition over the selected blocks ---------------
        let composing = null;
        for (const update of row.updates ?? [DEAD_KEY]) {
          await client.send("Input.imeSetComposition", {
            selectionEnd: update.length,
            selectionStart: update.length,
            text: update
          });
          await settle(160);
          composing ??= await surfaceFacts(page);
        }

        /*
         * The positive control, and the reason every row asserts it. A cancel
         * row's expected document is also the document BEFORE anything
         * composed, so a run where CDP IME never reached the editor — or where
         * this Chrome simply did not destroy the blocks — would pass every
         * cancel row while proving nothing at all. This is the assertion that
         * says the defect was reproduced before it was repaired.
         */
        const firstUpdate = (row.updates ?? [DEAD_KEY])[0];
        assert.equal(
          composing.texts[0],
          firstUpdate,
          `@${viewport.name} ${row.id}: mid-composition the selected block(s) must have been replaced by the ` +
            `composing text. Got ${JSON.stringify(composing.texts)}; if this row cannot destroy anything it ` +
            "cannot prove a restore either."
        );
        assert.equal(
          composing.texts.length,
          row.extend === 1 ? 3 : 4,
          `@${viewport.name} ${row.id}: the composition must have collapsed the whole selection into one block.`
        );

        if (row.outcome === "cancel") {
          // Chromium's cancel: the composition range collapses to nothing.
          await client.send("Input.imeSetComposition", { selectionEnd: 0, selectionStart: 0, text: "" });
        } else {
          await client.send("Input.insertText", { text: row.commitText ?? COMPOSED });
        }
        await settle(700);

        if (row.undoAfter) {
          await page.keyboard.down(process.platform === "darwin" ? "Meta" : "Control");
          await page.keyboard.press("z");
          await page.keyboard.up(process.platform === "darwin" ? "Meta" : "Control");
          await settle(300);
        }

        const after = await surfaceFacts(page);
        const announcements = await announcementsOf(page);
        const markdown = await markdownOf(page);
        const disk = await saveToDisk(page);
        viewportEvidence.rows[row.id] = { after, announcements, composing, disk, markdown };

        // --- the blocks --------------------------------------------------
        assert.deepEqual(
          after.texts,
          row.blocks,
          `@${viewport.name} ${row.id}: the editing surface must show exactly these blocks after the composition.`
        );
        assert(Array.isArray(announcements), `@${viewport.name} ${row.id}: the live region must exist to be measured.`);
        if (row.outcome === "cancel" && !row.undoAfter) {
          /*
           * Nothing happened, so nothing is said. Before this issue a cancel
           * announced "Block selection cleared" — character-for-character what a
           * deliberate Escape says — so a screen-reader user could not tell a
           * cancelled accent from a lost paragraph. The watchdog's repeated
           * re-assertions also made it alternate cleared/selected once per
           * browser flush.
           */
          assert.deepEqual(
            announcements,
            [],
            `@${viewport.name} ${row.id}: a cancelled composition must announce nothing.`
          );
        }
        if (row.outcome === "commit" && !row.undoAfter) {
          /*
           * Parity with the ordinary keystroke, which is what the issue's goal
           * asks for in so many words. Before this issue the two diverged at the
           * package level: a plain replacement carried a "N blocks replaced"
           * notice and a composition carried none.
           */
          assert.equal(
            after.announcement,
            plainAnnouncement,
            `@${viewport.name} ${row.id}: a committed composition must leave the live region saying what an ` +
              `ordinary keystroke leaves it saying (${JSON.stringify(plainAnnouncement)}).`
          );
        }
        if (row.selectedAfter !== undefined) {
          assert.equal(
            after.selected,
            row.selectedAfter,
            `@${viewport.name} ${row.id}: ${row.selectedAfter} block(s) must be selected afterwards.`
          );
        }

        // --- the bytes, in the editor and on disk -------------------------
        assert.equal(
          markdown,
          row.expected,
          `@${viewport.name} ${row.id}: the document's Markdown must be exactly this. A leading blank block is ` +
            "the mid-composition state having been adopted as the serialization baseline (MME-0115 attempt 2).",
        );
        assert.equal(
          disk,
          row.expected,
          `@${viewport.name} ${row.id}: the bytes written to the file must match what the editor shows. ` +
            "Restoring the blocks on screen and saving a different document is the worse defect, not the fix.",
        );

        if (row.id === "cancel-single") {
          // Shot here rather than after the loop: this is the row that ends with
          // the restored document and its block selection still painted.
          await shoot(page, `composition-cancel-${viewport.name}.png`);
          captured += 1;
        }
      }
    }

    const unexpected = consoleErrors.filter(
      (message) => message !== "Failed to load resource: the server responded with a status of 404 (Not Found)"
    );
    assert(unexpected.length === 0, `Browser console errors:\n${unexpected.join("\n")}`);

    await writeFile(
      `${visualDir}/measurements.json`,
      `${JSON.stringify(
        { consoleErrors: unexpected, demoUrl, evidence, screenshots: captured, source: SOURCE, status: "passed" },
        null,
        2
      )}\n`
    );
    console.log(
      `visual-check-mme0115: ${ROWS.length} real-IME rows proven across ${WIDTHS.length} viewports; ` +
        `${captured} screenshots captured.`
    );
  } finally {
    await browser.close();
  }
}

await main();
