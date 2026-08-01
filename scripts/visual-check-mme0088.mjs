import assert from "node:assert/strict";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import puppeteer from "puppeteer";
import { requireChromeExecutable } from "./chrome-helpers.mjs";

/**
 * MME-0088 — the slash menu triggers where Notion triggers it, and nowhere else.
 *
 * Typed for real through the keyboard, not through a test hook: the reported
 * defect is that typing `/` in a fenced code block both inserted the character
 * AND opened the menu, and only real keystrokes exercise that path.
 */

const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5174/";
const visualDir = "docs/internal/visual-checks/MME-0088";

const WIDTHS = [
  { hasTouch: false, height: 900, name: "1280", width: 1280 },
  { hasTouch: true, height: 844, name: "390", width: 390 }
];

const fixture = [
  "# Slash contexts",
  "",
  "A paragraph for the positive case.",
  "",
  "Text with `inline code` inside.",
  "",
  "```ts",
  "const inCode = 1;",
  "```",
  "",
  "| head | other |",
  "| --- | --- |",
  "| cell | text |",
  "",
  "<div>raw html block</div>",
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

const menuOpen = (page) => page.evaluate(() => window.__MME_DEMO_VISUAL_CHECK__.getSlashMenuState().open);
const markdownOf = (page) => page.evaluate(() => window.__MME_DEMO_VISUAL_CHECK__.getMarkdown());

/** Puts the caret after `needle` and types `typed` on the real keyboard. */
async function typeAfter(page, needle, typed) {
  await page.evaluate((text) => {
    document.querySelector(".ProseMirror")?.focus();
    window.__MME_DEMO_VISUAL_CHECK__.setRichSelectionAfterText(text);
  }, needle);
  await new Promise((resolve) => setTimeout(resolve, 120));
  await page.keyboard.type(typed);
  await new Promise((resolve) => setTimeout(resolve, 220));
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
  const evidence = { contexts: {}, dismissal: {}, source: {} };
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
      await page.waitForFunction(() => Boolean(window.__MME_DEMO_VISUAL_CHECK__?.loadWritableMarkdownFileForTest));

      const reload = async () => {
        await page.evaluate((content) => {
          window.__MME_DEMO_VISUAL_CHECK__.loadWritableMarkdownFileForTest("slash-contexts.md", content);
          window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich");
        }, fixture);
        await page.waitForSelector(".ProseMirror");
      };
      await reload();
      const baseline = await markdownOf(page);
      assert.equal(baseline, fixture, `@${viewport.name}: the fixture must load byte-identical before any typing.`);

      const contexts = {};

      // --- positive: a paragraph, after a space -----------------------------
      await typeAfter(page, "A paragraph for the positive case.", " /head");
      contexts.paragraph = await menuOpen(page);
      assert(contexts.paragraph, `@${viewport.name}: "/" after a space in a paragraph must open the menu.`);
      await shoot(page, `paragraph-triggers-${viewport.name}.png`);
      captured += 1;

      // Dismissing with Escape must leave the typed characters exactly as typed.
      await page.keyboard.press("Escape");
      await new Promise((resolve) => setTimeout(resolve, 200));
      const afterEscape = await markdownOf(page);
      evidence.dismissal[viewport.name] = { open: await menuOpen(page) };
      assert.equal(evidence.dismissal[viewport.name].open, false, `@${viewport.name}: Escape must close the slash menu.`);
      assert.equal(
        afterEscape,
        fixture.replace("A paragraph for the positive case.", "A paragraph for the positive case. /head"),
        `@${viewport.name}: dismissing the menu must leave the typed "/head" in the document, byte for byte.`
      );
      evidence.source[`${viewport.name}-after-dismiss`] = afterEscape.split("\n")[2];

      // Escape must STICK: the menu is re-derived from the document on every
      // transaction, so without a memory of the dismissal it reopened on the very
      // next keystroke.
      await reload();
      await typeAfter(page, "A paragraph for the positive case.", " /he");
      assert(await menuOpen(page), `@${viewport.name}: the menu must open before the sticky-Escape case.`);
      await page.keyboard.press("Escape");
      await new Promise((resolve) => setTimeout(resolve, 150));
      await page.keyboard.type("a");
      await new Promise((resolve) => setTimeout(resolve, 220));
      evidence.dismissal[`${viewport.name}-escape-sticky`] = await menuOpen(page);
      assert.equal(
        evidence.dismissal[`${viewport.name}-escape-sticky`],
        false,
        `@${viewport.name}: typing after Escape must not reopen the menu the user just dismissed.`
      );

      // Deleting the `/` closes the menu (an explicit acceptance criterion).
      await reload();
      await typeAfter(page, "A paragraph for the positive case.", " /he");
      assert(await menuOpen(page), `@${viewport.name}: the menu must open before the backspace case.`);
      await page.keyboard.press("Backspace");
      await page.keyboard.press("Backspace");
      await page.keyboard.press("Backspace");
      await new Promise((resolve) => setTimeout(resolve, 220));
      evidence.dismissal[`${viewport.name}-deleted-slash`] = await menuOpen(page);
      assert.equal(
        evidence.dismissal[`${viewport.name}-deleted-slash`],
        false,
        `@${viewport.name}: deleting the "/" must close the menu.`
      );
      assert.equal(
        (await markdownOf(page)).split("\n")[2],
        "A paragraph for the positive case.",
        `@${viewport.name}: backspacing over the trigger must restore the line byte-exactly.`
      );

      // Arrowing past the ends closes the menu instead of wrapping forever.
      await reload();
      await typeAfter(page, "A paragraph for the positive case.", " /");
      assert(await menuOpen(page), `@${viewport.name}: the menu must open before the arrow-bounds case.`);
      await page.keyboard.press("ArrowUp");
      await new Promise((resolve) => setTimeout(resolve, 220));
      evidence.dismissal[`${viewport.name}-arrow-past-start`] = await menuOpen(page);
      assert.equal(
        evidence.dismissal[`${viewport.name}-arrow-past-start`],
        false,
        `@${viewport.name}: ArrowUp at the first item must dismiss the menu, not wrap to the last.`
      );

      // A real outside pointer closes it (a synthetic MouseEvent does not — the
      // shared controller listens for pointerdown on capture).
      await reload();
      await typeAfter(page, "A paragraph for the positive case.", " /he");
      assert(await menuOpen(page), `@${viewport.name}: the menu must open before the outside-click case.`);
      const outside = await page.evaluate(() => {
        const element = document.querySelector('[data-testid="rich-mode-button"]') ?? document.body;
        const rect = element.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      });
      await page.mouse.click(outside.x, outside.y);
      await new Promise((resolve) => setTimeout(resolve, 250));
      evidence.dismissal[`${viewport.name}-outside-click`] = await menuOpen(page);
      assert.equal(
        evidence.dismissal[`${viewport.name}-outside-click`],
        false,
        `@${viewport.name}: clicking outside must dismiss the slash menu.`
      );

      // --- negative contexts, each typed for real ---------------------------
      await reload();
      await typeAfter(page, "const inCode", " /head");
      contexts.codeBlock = await menuOpen(page);
      assert.equal(contexts.codeBlock, false, `@${viewport.name}: "/" inside a fenced code block must NOT open the menu.`);
      const codeMarkdown = await markdownOf(page);
      assert(
        codeMarkdown.includes("const inCode /head = 1;"),
        `@${viewport.name}: the "/" must still be typed into the code block; only the menu is suppressed. Got: ${
          codeMarkdown.split("\n")[7]
        }`
      );
      evidence.source[`${viewport.name}-code`] = codeMarkdown.split("\n")[7];
      await shoot(page, `code-block-no-trigger-${viewport.name}.png`);
      captured += 1;

      await reload();
      // A leading space, so the mid-word rule cannot be what closes the menu —
      // this must exercise the inline-code guard itself.
      await typeAfter(page, "inline co", " /head");
      contexts.inlineCode = await menuOpen(page);
      assert.equal(contexts.inlineCode, false, `@${viewport.name}: "/" inside an inline code mark must NOT open the menu.`);

      await reload();
      await typeAfter(page, "cell", " /head");
      contexts.tableCell = await menuOpen(page);
      assert.equal(contexts.tableCell, false, `@${viewport.name}: "/" inside a table cell must NOT open the menu.`);

      // Mid-word: `and/or`, a path, a fraction.
      await reload();
      await typeAfter(page, "A paragraph for the positive case.", "/head");
      contexts.midWord = await menuOpen(page);
      assert.equal(contexts.midWord, false, `@${viewport.name}: "/" straight after a word character must NOT open the menu.`);

      // Source mode never triggers it.
      await reload();
      await page.evaluate(() => window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("source"));
      await page.waitForSelector(".cm-editor");
      await page.evaluate(() => document.querySelector(".cm-content")?.focus());
      await page.keyboard.type(" /head");
      await new Promise((resolve) => setTimeout(resolve, 220));
      contexts.sourceMode = await menuOpen(page);
      assert.equal(contexts.sourceMode, false, `@${viewport.name}: the slash menu must never open in the source surface.`);
      await page.evaluate(() => window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich"));
      await page.waitForSelector(".ProseMirror");

      // The matrix must contain both outcomes, or it is proving nothing.
      const negatives = Object.entries(contexts).filter(([, open]) => open === false);
      assert(
        contexts.paragraph === true && negatives.length >= 5,
        `@${viewport.name}: the context matrix must show one positive and at least five negatives; got ${JSON.stringify(contexts)}.`
      );
      evidence.contexts[viewport.name] = contexts;

      // --- running a command consumes the "/" -------------------------------
      await reload();
      await typeAfter(page, "A paragraph for the positive case.", " /head");
      assert(await menuOpen(page), `@${viewport.name}: the menu must be open before choosing a command.`);
      await page.keyboard.press("Enter");
      await new Promise((resolve) => setTimeout(resolve, 300));
      const afterCommand = await markdownOf(page);
      assert(
        !afterCommand.includes("/head"),
        `@${viewport.name}: choosing a command must remove the typed "/head" from the document. Got: ${
          afterCommand.split("\n")[2]
        }`
      );
      evidence.source[`${viewport.name}-after-command`] = afterCommand.split("\n").slice(2, 4).join(" | ");
    }

    const unexpected = consoleErrors.filter(
      (message) => message !== "Failed to load resource: the server responded with a status of 404 (Not Found)"
    );
    assert(unexpected.length === 0, `Browser console errors:\n${unexpected.join("\n")}`);

    await writeFile(
      `${visualDir}/measurements.json`,
      `${JSON.stringify({ consoleErrors: unexpected, demoUrl, evidence, screenshots: captured, status: "passed" }, null, 2)}\n`
    );
    console.log(`visual-check-mme0088: ${captured} screenshots captured; the trigger context matrix is green.`);
  } finally {
    await browser.close();
  }
}

await main();
