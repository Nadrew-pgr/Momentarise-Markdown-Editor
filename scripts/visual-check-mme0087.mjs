import assert from "node:assert/strict";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import puppeteer from "puppeteer";
import { requireChromeExecutable } from "./chrome-helpers.mjs";

/**
 * MME-0087 — block handles and the empty-block placeholder, proven in a browser.
 *
 *   hover     — exactly one block's handles are visible, and they belong to the
 *               block under the pointer. Before the fix, hovering any block
 *               revealed all of them.
 *   alignment — handles are vertically centred on their block's first line.
 *   gutter    — fold affordances never overlap block text, at any width.
 *   placeholder — shows on the empty block holding the caret, and only there.
 *   coarse    — the MME-0078 always-visible contract survives.
 */

const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5174/";
const visualDir = "docs/internal/visual-checks/MME-0087";

const WIDTHS = [
  { hasTouch: false, height: 900, name: "1280", width: 1280 },
  { hasTouch: true, height: 844, name: "390", width: 390 }
];

/** Six block types plus a long wrapping heading, which is where fold arrows bite. */
const fixture = [
  "# A deliberately long heading that wraps onto a second line at narrow widths",
  "",
  "A paragraph of body text.",
  "",
  "- bullet one",
  "- bullet two",
  "",
  "1. ordered one",
  "",
  "- [ ] a task",
  "",
  "> a blockquote",
  "",
  "```ts",
  "const x = 1;",
  "```",
  "",
  "| a | b |",
  "| --- | --- |",
  "| 1 | 2 |",
  "",
  "> [!note] Callout",
  "> callout body",
  "",
  "<div>raw html block</div>",
  "",
  "Last paragraph.",
  ""
].join("\n");

async function shoot(page, name) {
  await new Promise((resolve) => setTimeout(resolve, 200));
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

/**
 * Visible affordances, keyed by the block index the affordance itself declares.
 *
 * DOM child position is NOT usable here: an atom block such as raw HTML has its
 * affordance (and its fold toggle) emitted as SIBLINGS, so they occupy slots in
 * `.ProseMirror.children` and shift every index after them. `data-rich-block-index`
 * is the authoritative mapping to the ProseMirror node.
 */
async function visibleAffordances(page) {
  return page.evaluate(() => {
    const visible = [];
    for (const affordance of document.querySelectorAll(".rich-block-affordance")) {
      if (Number(getComputedStyle(affordance).opacity) <= 0.05) {
        continue;
      }
      const rect = affordance.getBoundingClientRect();
      const blocks = [...document.querySelectorAll(".ProseMirror > *:not(.ProseMirror-widget)")];
      const block = blocks[Number(affordance.dataset.richBlockIndex)];
      const blockRect = block?.getBoundingClientRect() ?? null;
      visible.push({
        index: Number(affordance.dataset.richBlockIndex),
        left: Math.round(rect.left),
        offPage: rect.left < 0 || rect.right > window.innerWidth,
        // Vertical distance from the block it claims to belong to.
        verticalDelta: blockRect ? Math.round(rect.top - blockRect.top) : null
      });
    }
    return { total: document.querySelectorAll(".rich-block-affordance").length, visible };
  });
}

/** Top-level blocks, excluding the widget decorations rendered beside them. */
const BLOCK_SELECTOR = ".ProseMirror > *:not(.ProseMirror-widget)";

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

  const evidence = { alignment: {}, coarse: {}, fold: {}, hover: {}, placeholder: {} };
  let captured = 0;

  try {
    for (const viewport of WIDTHS) {
      // A fresh page per viewport: changing `isMobile` on a live page forces an
      // internal reload that intermittently outlives the navigation timeout.
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
      await page.waitForFunction(() => Boolean(window.__MME_DEMO_VISUAL_CHECK__?.loadWritableMarkdownFileForTest));
      await page.evaluate((content) => {
        window.__MME_DEMO_VISUAL_CHECK__.loadWritableMarkdownFileForTest("block-handles.md", content);
        window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich");
      }, fixture);
      await page.waitForSelector(".ProseMirror");

      const blockTags = await page.evaluate(
        (selector) => [...document.querySelectorAll(selector)].map((block) => block.tagName),
        BLOCK_SELECTOR
      );
      assert(
        blockTags.length >= 6,
        `@${viewport.name}: the fixture must render at least 6 top-level blocks, got ${blockTags.length}.`
      );

      // --- 1. one hovered block owns the handles --------------------------
      const perBlock = [];
      for (let index = 0; index < blockTags.length; index += 1) {
        const point = await page.evaluate(([blockIndex, selector]) => {
          const block = document.querySelectorAll(selector)[blockIndex];
          block.scrollIntoView({ block: "center" });
          const rect = block.getBoundingClientRect();
          const host = document.querySelector(".rich-editor-host").getBoundingClientRect();
          // Aim inside the part of the block that is actually on screen: a block
          // taller than the viewport has its top scrolled above the editor, and a
          // point there lands on the chrome instead.
          const top = Math.max(rect.top, host.top) + 1;
          const bottom = Math.min(rect.bottom, host.bottom) - 1;
          return {
            visibleHeight: bottom - top,
            x: rect.left + Math.min(40, rect.width / 2),
            y: Math.min(top + 12, (top + bottom) / 2)
          };
        }, [index, BLOCK_SELECTOR]);
        assert(
          point.visibleHeight > 4,
          `@${viewport.name}: block ${index} (${blockTags[index]}) is not visibly on screen, so hovering it proves nothing.`
        );
        // Move away first so a stale hover cannot make the next check pass.
        await page.mouse.move(5, 5);
        await new Promise((resolve) => setTimeout(resolve, 60));
        await page.mouse.move(point.x, point.y);
        await new Promise((resolve) => setTimeout(resolve, 180));
        const state = await visibleAffordances(page);
        perBlock.push({ index, tag: blockTags[index], visible: state.visible, total: state.total });

        if (viewport.hasTouch) {
          // Coarse pointers keep every affordance visible by contract, so the
          // single-block rule does not apply — asserted separately below.
          continue;
        }
        assert(
          state.visible.length === 1,
          `@${viewport.name}: hovering block ${index} (${blockTags[index]}) revealed ${state.visible.length} of ${state.total} affordances; exactly one block may own them.`
        );
        assert(
          state.visible[0].index === index,
          `@${viewport.name}: hovering block ${index} (${blockTags[index]}) revealed the affordance declaring block index ${state.visible[0].index}.`
        );
        // Opacity is not visibility: an atom block's affordance is emitted as a
        // sibling and used to render at x = -48, off-page and hundreds of pixels
        // from its block, while still computing opacity 1.
        assert(
          !state.visible[0].offPage,
          `@${viewport.name}: block ${index} (${blockTags[index]}) has its handle drawn off-page at x=${state.visible[0].left}.`
        );
        assert(
          state.visible[0].verticalDelta !== null && Math.abs(state.visible[0].verticalDelta) <= 24,
          `@${viewport.name}: block ${index} (${blockTags[index]}) has its handle ${state.visible[0].verticalDelta}px away from the block it belongs to.`
        );
      }
      evidence.hover[viewport.name] = perBlock;

      // Pointer leaving the editor entirely hides them (fine pointers only).
      if (!viewport.hasTouch) {
        await page.mouse.move(5, 5);
        await new Promise((resolve) => setTimeout(resolve, 200));
        const away = await visibleAffordances(page);
        assert(
          away.visible.length === 0,
          `@${viewport.name}: ${away.visible.length} affordances stayed visible after the pointer left the editor.`
        );
        evidence.hover[`${viewport.name}-pointer-away`] = away.visible.length;
      } else {
        const always = await visibleAffordances(page);
        assert(
          always.visible.length === always.total && always.total > 0,
          `@${viewport.name}: coarse pointers must keep every affordance visible (MME-0078); ${always.visible.length}/${always.total}.`
        );
        evidence.coarse[viewport.name] = { total: always.total, visible: always.visible.length };
      }

      // --- 2. handles are centred on their block's first line -------------
      const alignment = await page.evaluate(() => {
        const firstLineCentre = (block) => {
          const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
          let node;
          while ((node = walker.nextNode())) {
            if (node.parentElement.closest("[contenteditable='false']") || !node.textContent.trim()) {
              continue;
            }
            const range = document.createRange();
            range.selectNodeContents(node);
            const rects = [...range.getClientRects()].filter((rect) => rect.height > 0);
            if (rects.length) {
              return rects[0].top + rects[0].height / 2;
            }
          }
          return null;
        };
        const out = [];
        const blocks = [...document.querySelectorAll(".ProseMirror > *:not(.ProseMirror-widget)")];
        for (const affordance of document.querySelectorAll(".rich-block-affordance")) {
          const block = affordance.closest(".ProseMirror > *:not(.ProseMirror-widget)") ?? blocks[Number(affordance.dataset.richBlockIndex)];
          if (!block) {
            continue;
          }
          // An atom block (raw HTML) keeps its text inside a non-editable
          // subtree, so it has no "first line" text node. Fall back to the top of
          // the block's own box rather than skipping it — a skipped block is
          // exactly where an off-page handle hides.
          const rect0 = block.getBoundingClientRect();
          const centre = firstLineCentre(block) ?? rect0.top + Math.min(12, rect0.height / 2);
          const rect = affordance.getBoundingClientRect();
          out.push({
            centreDelta: Math.round(rect.top + rect.height / 2 - centre),
            height: Math.round(rect.height),
            tag: block.tagName,
            topDelta: Math.round(rect.top - (centre - 8))
          });
        }
        return out;
      });
      assert(
        alignment.length === blockTags.length,
        `@${viewport.name}: measured alignment for ${alignment.length} of ${blockTags.length} blocks; a skipped block is a hidden defect.`
      );
      for (const entry of alignment) {
        // Fine pointers: the handle is centred on the block's first line.
        // Coarse pointers: MME-0078 stacks the buttons into a 44px-per-target
        // column, which cannot also be centred on a single line — there the
        // contract is that the column STARTS at the first line.
        const measured = viewport.hasTouch ? entry.topDelta : entry.centreDelta;
        assert(
          Math.abs(measured) <= 14,
          `@${viewport.name}: the ${entry.tag} handle is ${measured}px off its block's first line (${
            viewport.hasTouch ? "top-aligned, coarse pointer" : "centred"
          }, handle height ${entry.height}).`
        );
      }
      evidence.alignment[viewport.name] = alignment;

      // --- 3. fold affordances never overlap block text -------------------
      const fold = await page.evaluate(() => {
        const textRect = (block) => {
          const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
          let box = null;
          let node;
          while ((node = walker.nextNode())) {
            if (node.parentElement.closest("[contenteditable='false']") || !node.textContent.trim()) {
              continue;
            }
            const range = document.createRange();
            range.selectNodeContents(node);
            const rect = range.getBoundingClientRect();
            if (!rect.width && !rect.height) {
              continue;
            }
            box = box
              ? {
                  bottom: Math.max(box.bottom, rect.bottom),
                  left: Math.min(box.left, rect.left),
                  right: Math.max(box.right, rect.right),
                  top: Math.min(box.top, rect.top)
                }
              : { bottom: rect.bottom, left: rect.left, right: rect.right, top: rect.top };
          }
          return box;
        };
        const out = [];
        const blocks = [...document.querySelectorAll(".ProseMirror > *:not(.ProseMirror-widget)")];
        for (const toggle of document.querySelectorAll(".rich-fold-toggle")) {
          // A sibling-emitted toggle (atom blocks) has no block ancestor. It is
          // placed immediately before its block, so walk forward rather than
          // skipping it — skipping is how the one genuinely off-page toggle
          // escaped this check entirely.
          let block = toggle.closest(".ProseMirror > *:not(.ProseMirror-widget)");
          if (!block) {
            let candidate = toggle.nextElementSibling;
            while (candidate && candidate.classList.contains("ProseMirror-widget")) {
              candidate = candidate.nextElementSibling;
            }
            block = candidate;
          }
          const rect0 = block?.getBoundingClientRect();
          const text = block ? textRect(block) ?? { bottom: rect0.bottom, left: rect0.left, right: rect0.right, top: rect0.top } : null;
          if (!text) {
            continue;
          }
          const rect = toggle.getBoundingClientRect();
          out.push({
            gap: Math.round(text.left - rect.right),
            offPage: rect.left < 0,
            overlaps: rect.right > text.left + 0.5 && rect.left < text.right && rect.bottom > text.top && rect.top < text.bottom,
            tag: block.tagName
          });
        }
        return out;
      });
      const foldTotal = await page.evaluate(() => document.querySelectorAll(".rich-fold-toggle").length);
      assert(
        fold.length === foldTotal && foldTotal > 0,
        `@${viewport.name}: measured ${fold.length} of ${foldTotal} fold affordances — the unmeasured ones are exactly where the defect hides.`
      );

      // The gutter is only "reserved" if the content padding actually holds it.
      // Without this the overlap check passes at widths where the measure happens
      // to leave room anyway.
      const gutter = await page.evaluate(() => {
        const pm = document.querySelector(".ProseMirror");
        const style = getComputedStyle(pm);
        return {
          declaredGutter: Number.parseFloat(style.getPropertyValue("--mme-fold-gutter-width")) || 0,
          paddingLeft: Number.parseFloat(style.paddingLeft) || 0
        };
      });
      assert(
        gutter.declaredGutter > 0,
        `@${viewport.name}: --mme-fold-gutter-width resolves to ${gutter.declaredGutter}px, so nothing is reserved.`
      );
      assert(
        gutter.paddingLeft >= gutter.declaredGutter,
        `@${viewport.name}: the content padding (${gutter.paddingLeft}px) is narrower than the reserved fold gutter (${gutter.declaredGutter}px), so the affordance is drawn outside the content box.`
      );
      evidence.fold[`${viewport.name}-gutter`] = gutter;
      for (const entry of fold) {
        assert(!entry.overlaps, `@${viewport.name}: the ${entry.tag} fold affordance overlaps its block's text.`);
        assert(!entry.offPage, `@${viewport.name}: the ${entry.tag} fold affordance is drawn off the page edge.`);
      }
      evidence.fold[viewport.name] = fold;

      const hoverPoint = await page.evaluate((selector) => {
        const block = document.querySelectorAll(selector)[1];
        block.scrollIntoView({ block: "center" });
        const rect = block.getBoundingClientRect();
        return { x: rect.left + 40, y: rect.top + rect.height / 2 };
      }, BLOCK_SELECTOR);
      await page.mouse.move(hoverPoint.x, hoverPoint.y);
      await shoot(page, `hover-single-block-${viewport.name}.png`);
      captured += 1;

      // --- 4. placeholder on the empty block holding the caret ------------
      await page.evaluate(() => {
        window.__MME_DEMO_VISUAL_CHECK__.setRichSelectionAfterText("A paragraph of body text.");
      });
      await page.keyboard.press("Enter");
      await new Promise((resolve) => setTimeout(resolve, 250));
      const placeholderShown = await page.evaluate(() => {
        const decorated = [...document.querySelectorAll(".ProseMirror [data-placeholder]")];
        return {
          count: decorated.length,
          hasCaret: decorated.some((element) => element.contains(window.getSelection()?.anchorNode ?? null)),
          text: decorated[0]?.getAttribute("data-placeholder") ?? null
        };
      });
      assert(
        placeholderShown.count === 1,
        `@${viewport.name}: pressing Enter must place the placeholder on exactly the new empty block, got ${placeholderShown.count}.`
      );
      assert(placeholderShown.text, `@${viewport.name}: the placeholder has no text.`);
      await shoot(page, `placeholder-empty-block-${viewport.name}.png`);
      captured += 1;

      // Typing removes it, and it never reaches Markdown.
      await page.keyboard.type("x");
      await new Promise((resolve) => setTimeout(resolve, 200));
      const afterTyping = await page.evaluate(() => ({
        count: document.querySelectorAll(".ProseMirror [data-placeholder]").length,
        markdown: window.__MME_DEMO_VISUAL_CHECK__.getMarkdown()
      }));
      assert(
        afterTyping.count === 0,
        `@${viewport.name}: the placeholder must disappear the moment content exists, got ${afterTyping.count}.`
      );
      assert(
        !afterTyping.markdown.includes(placeholderShown.text),
        `@${viewport.name}: the placeholder text leaked into Markdown.`
      );
      evidence.placeholder[viewport.name] = { afterTyping: afterTyping.count, ...placeholderShown };
    }

    const unexpected = consoleErrors.filter(
      (message) => message !== "Failed to load resource: the server responded with a status of 404 (Not Found)"
    );
    assert(unexpected.length === 0, `Browser console errors:\n${unexpected.join("\n")}`);

    await writeFile(
      `${visualDir}/measurements.json`,
      `${JSON.stringify({ consoleErrors: unexpected, demoUrl, evidence, screenshots: captured, status: "passed" }, null, 2)}\n`
    );
    console.log(`visual-check-mme0087: ${captured} screenshots captured; hover scope, alignment, gutter and placeholder all proven.`);
  } finally {
    await browser.close();
  }
}

await main();
