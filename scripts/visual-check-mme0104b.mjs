import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import puppeteer from "puppeteer";
import { clearGeneratedArtifacts } from "./visual-artifacts.mjs";
import { requireChromeExecutable } from "./chrome-helpers.mjs";

/**
 * MME-0104b — smart pairing and paste-URL-to-link, with a real keyboard and a
 * real clipboard event.
 *
 * This gate is the whole reason the issue exists in this shape. Pairing lives in
 * `handleTextInput`, a view-level prop that a `tr.insertText` harness never
 * reaches: the previous attempt's empty implementation passed every assertion it
 * had. Here the characters come from `page.keyboard.type`, so the only way a row
 * passes is if the editor really paired them.
 */

const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5174/";
const visualDir = "docs/internal/visual-checks/MME-0104b";

const WIDTHS = [
  { height: 900, name: "1280", scheme: "dark", width: 1280 },
  { hasTouch: true, height: 844, name: "390", scheme: "dark", width: 390 },
  { height: 900, name: "1280-light", scheme: "light", width: 1280 }
];

/** `text` is the block's text content after typing `typed` with a real keyboard. */
const PAIRING_ROWS = [
  { benchmark: "same as benchmark", id: "pair-paren", note: "Opening character inserts its closer.", text: "()", typed: "(" },
  { benchmark: "same as benchmark", id: "pair-square", note: "Opening character inserts its closer.", text: "[]", typed: "[" },
  { benchmark: "same as benchmark", id: "pair-curly", note: "Opening character inserts its closer.", text: "{}", typed: "{" },
  { benchmark: "same as benchmark", id: "pair-double-quote", note: "Opening character inserts its closer.", text: '""', typed: '"' },
  { benchmark: "same as benchmark", id: "pair-single-quote", note: "Opening character inserts its closer.", text: "''", typed: "'" },
  { benchmark: "same as benchmark", id: "pair-backtick", note: "Opening character inserts its closer.", text: "``", typed: "`" },
  {
    benchmark: "same as benchmark",
    id: "step-over",
    note: "Typing the closing character steps past the auto-inserted one instead of duplicating it.",
    text: "(x)",
    typed: "(x)"
  },
  {
    benchmark: "same as benchmark",
    id: "step-over-after-edits",
    note: "The recorded position is mapped through the keystrokes in between, so `(xyz)` does not become `(xyz))`.",
    text: "(xyz)",
    typed: "(xyz)"
  },
  {
    benchmark: "same as benchmark",
    id: "step-over-nested",
    note: "Nested pairs step over innermost first.",
    text: "([a])",
    typed: "([a])"
  },
  {
    benchmark: "same as benchmark",
    id: "apostrophe-in-a-word",
    note: "A symmetric delimiter never pairs after a word character, or typing English produces `don''t`.",
    text: "don't",
    typed: "don't"
  },
  {
    benchmark: "same as benchmark",
    id: "code-fence-still-typeable",
    note: "A symmetric delimiter never pairs after the same delimiter, which is what keeps ``` from becoming ````.",
    requires: ["pre"],
    text: "const value = 1;",
    typed: "```ts const value = 1;"
  },
  {
    benchmark: "same as benchmark",
    id: "inline-code-through-pairing",
    note: "Stepping over the auto-inserted backtick re-triggers the input rules, so the shipped inline-code rule still fires.",
    requires: ["code"],
    text: "code",
    typed: "`code`"
  }
];

const settle = (ms = 180) => new Promise((resolve) => setTimeout(resolve, ms));

const markdownOf = (page) => page.evaluate(() => window.__MME_DEMO_VISUAL_CHECK__.getMarkdown());

const blockTextOf = (page) =>
  page.evaluate(() => {
    const editor = document.querySelector(".ProseMirror");
    const block = [...(editor?.children ?? [])].find((child) => !child.classList.contains("ProseMirror-widget"));
    if (!block) {
      return "";
    }
    const clone = block.cloneNode(true);
    for (const widget of clone.querySelectorAll(".ProseMirror-widget")) {
      widget.remove();
    }
    return clone.textContent ?? "";
  });

const matches = (page, selectors) =>
  page.evaluate((list) => {
    const editor = document.querySelector(".ProseMirror");
    return list.map((selector) => Boolean(editor?.querySelector(selector)));
  }, selectors);

async function loadEmptyRichDocument(page) {
  await page.evaluate(() => {
    window.__MME_DEMO_VISUAL_CHECK__.loadWritableMarkdownFileForTest("pairing.md", "");
    window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich");
  });
  await page.waitForSelector(".ProseMirror");
  await settle();
  await page.click(".ProseMirror");
  await settle(120);
  const focused = await page.evaluate(() => Boolean(document.activeElement?.closest(".ProseMirror")));
  assert(focused, "the editing surface must hold focus before a real key press is sent to it.");
}

/** A real `paste` event carrying a real DataTransfer, dispatched at the editor. */
async function pasteInto(page, text) {
  await page.evaluate((payload) => {
    const transfer = new DataTransfer();
    transfer.setData("text/plain", payload);
    const editor = document.querySelector(".ProseMirror");
    editor?.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: transfer }));
  }, text);
  await settle(200);
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

      const viewportEvidence = { paste: {}, rows: {} };
      evidence[viewport.name] = viewportEvidence;

      for (const row of PAIRING_ROWS) {
        await loadEmptyRichDocument(page);
        await page.keyboard.type(row.typed, { delay: 10 });
        await settle(160);
        const text = await blockTextOf(page);
        const required = await matches(page, row.requires ?? []);
        viewportEvidence.rows[row.id] = { required, text };
        assert.equal(
          text,
          row.text,
          `@${viewport.name} ${row.id}: typing ${JSON.stringify(row.typed)} must leave ${JSON.stringify(row.text)}, got ${JSON.stringify(text)}.`
        );
        (row.requires ?? []).forEach((selector, index) => {
          assert(required[index], `@${viewport.name} ${row.id}: expected ${selector} in the editor.`);
        });
      }

      // Backspace between an empty pair removes both characters.
      await loadEmptyRichDocument(page);
      await page.keyboard.type("(", { delay: 10 });
      await settle(140);
      assert.equal(await blockTextOf(page), "()", `@${viewport.name}: the pair must exist before Backspace.`);
      await page.keyboard.press("Backspace");
      await settle(160);
      viewportEvidence.backspace = await blockTextOf(page);
      assert.equal(
        viewportEvidence.backspace,
        "",
        `@${viewport.name}: Backspace between an empty pair must delete both characters.`
      );

      // --- paste over a selection ------------------------------------------
      for (const [id, pasted, expected] of [
        ["wrap", "https://example.com", "Read the [docs](https://example.com) today.\n"],
        ["non-url", "manual", "Read the manual today.\n"],
        ["unsafe-scheme", "javascript:alert(1)", null]
      ]) {
        await page.evaluate(() => {
          window.__MME_DEMO_VISUAL_CHECK__.loadWritableMarkdownFileForTest("paste.md", "Read the docs today.\n");
          window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich");
        });
        await page.waitForSelector(".ProseMirror");
        await settle();
        await page.evaluate(() => {
          window.__MME_DEMO_VISUAL_CHECK__.selectRichTextForTest("docs");
        });
        await settle(140);
        await pasteInto(page, pasted);
        const markdown = await markdownOf(page);
        const hasLink = (await matches(page, ['a[href="https://example.com"]']))[0];
        viewportEvidence.paste[id] = { hasLink, markdown };
        if (expected !== null) {
          assert.equal(
            markdown,
            expected,
            `@${viewport.name} paste ${id}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(markdown)}.`
          );
        }
        if (id === "wrap") {
          assert(hasLink, `@${viewport.name} paste wrap: a real anchor must be rendered, not only matching bytes.`);
        }
        if (id === "unsafe-scheme") {
          assert(
            !markdown.includes("]("),
            `@${viewport.name} paste unsafe-scheme: an unsafe scheme must never become a link, got ${JSON.stringify(markdown)}.`
          );
        }
      }

      // A document showing pairing and a pasted link together.
      await page.evaluate(() => {
        window.__MME_DEMO_VISUAL_CHECK__.loadWritableMarkdownFileForTest("pairing.md", "Read the docs today.\n");
        window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich");
      });
      await page.waitForSelector(".ProseMirror");
      await settle();
      await page.evaluate(() => {
        window.__MME_DEMO_VISUAL_CHECK__.selectRichTextForTest("docs");
      });
      await settle(140);
      await pasteInto(page, "https://momentarise.dev");
      await page.evaluate(() => {
        window.__MME_DEMO_VISUAL_CHECK__.selectFinalRichBlockForTest();
        window.__MME_DEMO_VISUAL_CHECK__.insertParagraphAfterCurrentRichBlock();
      });
      await settle(140);
      await page.keyboard.type("Pairs: (parens), [brackets], {braces}, \"quotes\" and `code`.", { delay: 8 });
      await settle(220);
      viewportEvidence.gallery = await markdownOf(page);
      assert.equal(
        viewportEvidence.gallery.replace(/\n+$/u, ""),
        [
          "Read the [docs](https://momentarise.dev) today.",
          "",
          "Pairs: (parens), [brackets], {braces}, \"quotes\" and `code`."
        ].join("\n"),
        `@${viewport.name}: the gallery must show pairing and a pasted link, not a document mangled by either.`
      );
      await settle(200);
      await page.screenshot({ path: `${visualDir}/pairing-${viewport.name}.png`, type: "png" });
      captured += 1;
    }

    const unexpected = consoleErrors.filter(
      (message) => message !== "Failed to load resource: the server responded with a status of 404 (Not Found)"
    );
    assert(unexpected.length === 0, `Browser console errors:\n${unexpected.join("\n")}`);

    await writeFile(
      `${visualDir}/parity-checklist.json`,
      `${JSON.stringify(
        {
          contract: "5 — Markdown-as-you-type (pairing and paste portions)",
          demoUrl,
          pasteDecisions: {
            alreadyLinkedSelection: "not wrapped; falls through to the default replace",
            nonUrl: "falls through to the default replace",
            selectionSpanningBlocks: "not wrapped; a link cannot span two blocks",
            urlDefinition: "a single whitespace-free token with an explicit scheme that passes the http/https/mailto allowlist"
          },
          rows: PAIRING_ROWS.map((row) => ({
            benchmark: row.benchmark,
            id: row.id,
            note: row.note,
            result: row.text,
            typed: row.typed
          }))
        },
        null,
        2
      )}\n`
    );
    await writeFile(
      `${visualDir}/measurements.json`,
      `${JSON.stringify({ consoleErrors: unexpected, demoUrl, evidence, screenshots: captured, status: "passed" }, null, 2)}\n`
    );
    console.log(
      `visual-check-mme0104b: ${PAIRING_ROWS.length} pairing rows, the Backspace pair-collapse and 3 paste rows proven with a real keyboard and a real clipboard event across ${WIDTHS.length} viewports; ${captured} screenshots captured.`
    );
  } finally {
    await browser.close();
  }
}

await main();
