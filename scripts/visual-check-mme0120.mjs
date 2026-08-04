import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import puppeteer from "puppeteer";
import { clearGeneratedArtifacts } from "./visual-artifacts.mjs";
import { requireChromeExecutable } from "./chrome-helpers.mjs";

/**
 * MME-0120 — an undo must survive a save, proven end to end in a browser.
 *
 * The unit suite proves the serializer. It cannot prove the sentence the issue
 * is actually about, which spans four systems: a real keyboard produces the
 * conversion, a real `Mod+Z` undoes it, the Save Engine writes real bytes to a
 * writable file handle, and re-opening those bytes runs the parser again. Every
 * row below does all four and then asserts the *rendered element*, because the
 * defect's signature is precisely that the bytes look plausible while the
 * reopened document is a different construct:
 *
 *   type `# `, undo -> screen shows `# ` -> file held `#` -> reopened as <h1>,
 *   empty, the characters gone.
 *
 * `reopened.tag` is the assertion that catches that. Asserting the Markdown
 * alone would not: `#` and `\#` are both "the file contains a hash".
 */

const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5174/";
const visualDir = "docs/internal/visual-checks/MME-0120";
const undoModifier = process.platform === "darwin" ? "Meta" : "Control";

const WIDTHS = [
  { height: 900, name: "1280", scheme: "dark", width: 1280 },
  { hasTouch: true, height: 844, name: "390", scheme: "dark", width: 390 },
  { height: 900, name: "1280-light", scheme: "light", width: 1280 }
];

/**
 * `disk` is the measured byte content the Save Engine writes, and `reopened` is
 * what the parser makes of those bytes on the next load.
 *
 * The trailing space of `# ` / `- ` / `> ` does not reach the file: Markdown
 * cannot carry a space at the end of a block, and the serializer trims it — the
 * same normalization the parser applies on the way in. The characters that
 * carry meaning survive, which is what "the characters are gone" was about.
 */
const ROUND_TRIP_ROWS = [
  { disk: "\\#\n", id: "heading-marker", onScreen: "# ", reopened: "#", typed: "# " },
  { disk: "3\\.\n", id: "ordered-marker", onScreen: "3. ", reopened: "3.", typed: "3. " },
  { disk: "\\-\n", id: "bullet-marker", onScreen: "- ", reopened: "-", typed: "- " },
  { disk: "\\>\n", id: "blockquote-marker", onScreen: "> ", reopened: ">", typed: "> " },
  { disk: "[]\n", id: "bare-todo", onScreen: "[] ", reopened: "[]", typed: "[] " },
  {
    disk: "\\**bold**\n",
    id: "strong-delimiters",
    onScreen: "**bold**",
    reopened: "**bold**",
    typed: "**bold**"
  }
];

const NEIGHBOUR_SOURCE = "Alpha\n\nBravo\n\nCharlie\n";

const settle = (ms = 180) => new Promise((resolve) => setTimeout(resolve, ms));

const markdownOf = (page) => page.evaluate(() => window.__MME_DEMO_VISUAL_CHECK__.getMarkdown());

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

/**
 * The first non-widget top-level block, with MME-0087's drag affordance and the
 * fold toggle stripped: they are ProseMirror widgets rendered inside the block,
 * so their labels are part of `textContent` without being document text.
 */
const firstBlock = (page) =>
  page.evaluate(() => {
    const editor = document.querySelector(".ProseMirror");
    const block = [...(editor?.children ?? [])].find(
      (child) => !child.classList.contains("ProseMirror-widget")
    );
    if (!block) {
      return { html: "", tag: "", text: "" };
    }
    const clone = block.cloneNode(true);
    for (const widget of clone.querySelectorAll(".ProseMirror-widget")) {
      widget.remove();
    }
    return { html: clone.outerHTML, tag: block.tagName.toLowerCase(), text: clone.textContent ?? "" };
  });

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
      await page.waitForFunction(() => Boolean(window.__MME_DEMO_VISUAL_CHECK__?.loadWritableMarkdownFileForTest));
      await page.evaluate((scheme) => {
        document.documentElement.dataset.mmeScheme = scheme;
      }, viewport.scheme);

      const viewportEvidence = { rows: {} };
      evidence[viewport.name] = viewportEvidence;

      for (const row of ROUND_TRIP_ROWS) {
        // --- type ---------------------------------------------------------
        await openRichDocument(page, "escaping.md", "");
        await page.keyboard.type(row.typed, { delay: 8 });
        await settle(140);

        // --- undo ---------------------------------------------------------
        await page.keyboard.down(undoModifier);
        await page.keyboard.press("KeyZ");
        await page.keyboard.up(undoModifier);
        await settle(160);
        const onScreen = await firstBlock(page);
        assert.equal(
          onScreen.text,
          row.onScreen,
          `@${viewport.name} ${row.id}: one undo must show the literal ${JSON.stringify(row.onScreen)}, got ${JSON.stringify(onScreen.text)}.`
        );
        assert.equal(
          onScreen.tag,
          "p",
          `@${viewport.name} ${row.id}: one undo must leave a plain paragraph on screen, got <${onScreen.tag}>.`
        );

        // --- save ---------------------------------------------------------
        const disk = await saveToDisk(page);
        assert.equal(
          disk,
          row.disk,
          `@${viewport.name} ${row.id}: the file on disk must hold ${JSON.stringify(row.disk)}, got ${JSON.stringify(disk)}.`
        );

        // --- reload the saved bytes ---------------------------------------
        await openRichDocument(page, "escaping.md", disk);
        const reopened = await firstBlock(page);
        viewportEvidence.rows[row.id] = { disk, onScreen: onScreen.text, reopened: reopened.text, tag: reopened.tag };
        assert.equal(
          reopened.tag,
          "p",
          `@${viewport.name} ${row.id}: re-opening the saved file must give a paragraph, got <${reopened.tag}>. This is the defect: the bytes looked fine and the document came back as a different construct.`
        );
        assert.equal(
          reopened.text,
          row.reopened,
          `@${viewport.name} ${row.id}: re-opening the saved file must show ${JSON.stringify(row.reopened)}, got ${JSON.stringify(reopened.text)}.`
        );
        assert(
          !/<h[1-6]|<strong|<ul|<ol|<li|<blockquote/i.test(reopened.html),
          `@${viewport.name} ${row.id}: re-opening must leave no converted node behind, got ${reopened.html}.`
        );
      }

      // --- an edited paragraph must not disturb its neighbours ------------
      await openRichDocument(page, "neighbours.md", NEIGHBOUR_SOURCE);
      await page.evaluate(() => {
        window.__MME_DEMO_VISUAL_CHECK__.setRichSelectionAfterText("Bravo");
      });
      await settle(120);
      await page.keyboard.type(" a**bold**", { delay: 8 });
      await settle(200);
      const neighbourDisk = await saveToDisk(page);
      assert.equal(
        neighbourDisk,
        "Alpha\n\nBravo a\\**bold**\n\nCharlie\n",
        `@${viewport.name}: the escaped edit must leave both neighbours byte-identical, got ${JSON.stringify(neighbourDisk)}.`
      );
      await openRichDocument(page, "neighbours.md", neighbourDisk);
      const reopenedNeighbours = await page.evaluate(() => {
        const editor = document.querySelector(".ProseMirror");
        return {
          hasStrong: Boolean(editor?.querySelector("strong")),
          texts: [...(editor?.children ?? [])]
            .filter((child) => !child.classList.contains("ProseMirror-widget"))
            .map((child) => {
              const clone = child.cloneNode(true);
              for (const widget of clone.querySelectorAll(".ProseMirror-widget")) {
                widget.remove();
              }
              return clone.textContent ?? "";
            })
        };
      });
      viewportEvidence.neighbours = { disk: neighbourDisk, ...reopenedNeighbours };
      assert.deepEqual(
        reopenedNeighbours.texts,
        ["Alpha", "Bravo a**bold**", "Charlie"],
        `@${viewport.name}: re-opening must show all three paragraphs literally, got ${JSON.stringify(reopenedNeighbours.texts)}.`
      );
      assert(
        !reopenedNeighbours.hasStrong,
        `@${viewport.name}: re-opening must not resurrect the bold the writer undid.`
      );

      // --- the screenshot document ---------------------------------------
      await openRichDocument(
        page,
        "escaping-gallery.md",
        "\\# not a heading\n\n3\\. not a list\n\n\\- not a bullet\n\n\\> not a quote\n\na\\**bold** stays literal\n\nUntouched **bold** still renders.\n"
      );
      await settle(220);
      const gallery = await markdownOf(page);
      viewportEvidence.gallery = gallery;
      assert(
        !(await page.evaluate(() =>
          Boolean(document.querySelector(".ProseMirror h1, .ProseMirror ul, .ProseMirror ol, .ProseMirror blockquote"))
        )),
        `@${viewport.name}: the gallery must show escaped markers as paragraphs, or the screenshot claims something it does not show.`
      );
      assert(
        await page.evaluate(() => Boolean(document.querySelector(".ProseMirror strong"))),
        `@${viewport.name}: the gallery must still render real bold, so the screenshot shows escaping is targeted rather than global.`
      );
      await shoot(page, `escaping-${viewport.name}.png`);
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
      `visual-check-mme0120: ${ROUND_TRIP_ROWS.length} type/undo/save/reopen rows plus the neighbour-preservation case proven with a real keyboard and a real writable file across ${WIDTHS.length} viewports; ${captured} screenshots captured.`
    );
  } finally {
    await browser.close();
  }
}

await main();
