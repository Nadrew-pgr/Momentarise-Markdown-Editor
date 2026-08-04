import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import puppeteer from "puppeteer";
import { clearGeneratedArtifacts } from "./visual-artifacts.mjs";
import { requireChromeExecutable } from "./chrome-helpers.mjs";

/**
 * MME-0104a — the Markdown input-rule table, proven with a real keyboard.
 *
 * Two reasons this cannot be left to `tests/rich-input-rules.test.mjs`:
 *
 *  1. The headless harness drives `tr.insertText`. A browser types through
 *     `beforeinput` → `handleTextInput` → ProseMirror's own insertion, and the
 *     previous attempt at this issue was undone by exactly that gap — an empty
 *     implementation passed every assertion in an insertText-only harness.
 *  2. `# Title` and `**bold**` serialize identically whether or not the rule
 *     fired. Bytes alone can never say a rule ran, so every row below asserts
 *     the *rendered element* as well as the Markdown. `requires` is what makes
 *     these rows non-vacuous.
 *
 * The parity checklist for benchmark contract 5 (block and inline portions) is
 * generated from this same table, so the published checklist cannot drift from
 * what was actually asserted.
 */

const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5174/";
const visualDir = "docs/internal/visual-checks/MME-0104a";
const undoModifier = process.platform === "darwin" ? "Meta" : "Control";

const WIDTHS = [
  { height: 900, name: "1280", scheme: "dark", width: 1280 },
  { hasTouch: true, height: 844, name: "390", scheme: "dark", width: 390 },
  { height: 900, name: "1280-light", scheme: "light", width: 1280 }
];

/**
 * One row per interaction in contract 5's block and inline portions.
 *
 * `requires` / `forbids` are CSS selectors evaluated inside `.ProseMirror`:
 * they are what distinguishes "the rule fired" from "the characters are still
 * sitting there as literal text that happens to serialize the same way".
 */
const PARITY_ROWS = [
  {
    benchmark: "same as benchmark",
    id: "heading-1",
    markdown: "# Heading one\n",
    note: "Notion: `#` + space at line start.",
    requires: ["h1"],
    typed: "# Heading one"
  },
  {
    benchmark: "same as benchmark",
    id: "heading-2",
    markdown: "## Heading two\n",
    note: "Every level is asserted rather than asserted-by-claim.",
    requires: ["h2"],
    typed: "## Heading two"
  },
  {
    benchmark: "same as benchmark",
    id: "heading-3",
    markdown: "### Heading three\n",
    note: "`#`…`######` all convert.",
    requires: ["h3"],
    typed: "### Heading three"
  },
  {
    benchmark: "same as benchmark",
    id: "heading-6",
    markdown: "###### Heading six\n",
    note: "The deepest level, so the `{1,6}` bound is proven at both ends.",
    requires: ["h6"],
    typed: "###### Heading six"
  },
  {
    benchmark: "same as benchmark",
    id: "bullet-list",
    markdown: "- Bullet\n",
    note: "Hyphen marker.",
    requires: ["ul li"],
    typed: "- Bullet"
  },
  {
    benchmark: "intentionally different",
    id: "bullet-list-asterisk",
    markdown: "- Star\n",
    note: "`*` converts, then serializes with the canonical `-` marker. Same class as `_soft_` → `*soft*`: a newly created node is written canonically; an untouched `* Star` already in a file is not rewritten while its block stays untouched.",
    requires: ["ul li"],
    typed: "* Star"
  },
  {
    benchmark: "intentionally different",
    id: "bullet-list-plus",
    markdown: "- Plus\n",
    note: "`+` converts and serializes with the canonical `-` marker.",
    requires: ["ul li"],
    typed: "+ Plus"
  },
  {
    benchmark: "same as benchmark",
    id: "ordered-list",
    markdown: "1. First\n",
    note: "`1.` + space.",
    requires: ["ol li"],
    typed: "1. First"
  },
  {
    benchmark: "same as benchmark",
    id: "ordered-list-typed-start",
    markdown: "3. Third\n",
    note: "The typed start number is honoured, not reset to 1.",
    requires: ['ol[start="3"] li'],
    typed: "3. Third"
  },
  {
    benchmark: "same as benchmark",
    id: "todo-unchecked",
    markdown: "- [ ] Task\n",
    note: "Bare `[]` + space, Notion's form. The space is the trigger.",
    requires: ['li[data-type="todo-item"][data-checked="false"] button[data-todo-toggle="true"]'],
    typed: "[] Task"
  },
  {
    benchmark: "same as benchmark",
    id: "todo-checked",
    markdown: "- [x] Done\n",
    note: "Bare `[x]` + space.",
    requires: ['li[data-type="todo-item"][data-checked="true"] button[aria-pressed="true"]'],
    typed: "[x] Done"
  },
  {
    benchmark: "same as benchmark",
    id: "blockquote",
    markdown: "> Quote\n",
    note: "`>` + space.",
    requires: ["blockquote"],
    typed: "> Quote"
  },
  {
    benchmark: "same as benchmark",
    id: "thematic-break",
    markdown: "---\n",
    note: "`---` alone on a line.",
    requires: ["hr"],
    typed: "---"
  },
  {
    benchmark: "intentionally different",
    id: "thematic-break-asterisks",
    markdown: "---\n",
    note: "`***` converts and serializes as the canonical `---`.",
    requires: ["hr"],
    typed: "***"
  },
  {
    benchmark: "better",
    id: "link",
    markdown: "see [MME](https://example.com)\n",
    note: "Typing full Markdown link syntax produces a real link. Notion has no equivalent live rule; the destination is checked against the URL-safety allowlist before the mark is applied.",
    requires: ['a[href="https://example.com"]'],
    typed: "see [MME](https://example.com)"
  },
  {
    benchmark: "same as benchmark",
    id: "code-fence-with-language",
    /*
     * A prefix, not an equality. A document whose last block is a fenced code
     * block reaches `session.getContent()` without its final newline, while
     * every other block type keeps one. Measured identical at HEAD before this
     * issue, so it is a pre-existing session-layer wrinkle: asserting equality
     * here would encode that defect into this gate.
     */
    markdownPrefix: "```ts\nconst value = 1;\n```",
    note: "``` + language + space opens the fence with that language.",
    requires: ["pre"],
    typed: "```ts const value = 1;"
  },
  {
    benchmark: "same as benchmark",
    id: "strong",
    markdown: "**bold**\n",
    note: "Applied on the closing delimiter.",
    requires: ["strong"],
    typed: "**bold**"
  },
  {
    benchmark: "same as benchmark",
    id: "emphasis-asterisk",
    markdown: "*italic*\n",
    note: "Applied on the closing delimiter.",
    requires: ["em"],
    typed: "*italic*"
  },
  {
    benchmark: "intentionally different",
    id: "emphasis-underscore",
    markdown: "*soft*\n",
    note: "`_soft_` renders as emphasis but serializes canonically as `*soft*`; an untouched `_soft_` already in a file is never rewritten.",
    requires: ["em"],
    typed: "_soft_"
  },
  {
    benchmark: "same as benchmark",
    id: "inline-code",
    markdown: "`code`\n",
    note: "Backtick pair.",
    requires: ["code"],
    typed: "`code`"
  },
  {
    benchmark: "intentionally different",
    id: "strikethrough",
    markdown: "~~gone~~\n",
    note: "Contract 5 lists Notion's single `~strike~`. MME requires the CommonMark-GFM double `~~`, because that is what the persisted file means; a single `~` stays literal.",
    requires: ["s, del, strike"],
    typed: "~~gone~~"
  },
  {
    benchmark: "intentionally different",
    forbids: ["s", "del", "strike"],
    id: "strikethrough-single-tilde",
    markdown: "~gone~\n",
    note: "The other half of the row above: a single tilde does not convert.",
    typed: "~gone~"
  },
  {
    benchmark: "same as benchmark",
    id: "emphasis-does-not-swallow-strong",
    markdown: "**bold** and *soft*\n",
    note: "Both orderings, in the browser: the finished `**bold**` never matches the emphasis pattern, and mid-typing `**bold*` is suppressed by the word-boundary guard.",
    requires: ["strong", "em"],
    typed: "**bold** and *soft*"
  },
  {
    benchmark: "same as benchmark",
    id: "strong-does-not-swallow-emphasis",
    markdown: "*soft* and **bold**\n",
    note: "The reverse ordering.",
    requires: ["strong", "em"],
    typed: "*soft* and **bold**"
  },
  {
    benchmark: "same as benchmark",
    id: "inline-rule-inside-a-heading",
    markdown: "# Title **bold**\n",
    note: "Block rules are paragraph-only; inline rules run in any safe textblock, so formatting works inside a heading.",
    requires: ["h1 strong"],
    typed: "# Title **bold**"
  },
  {
    benchmark: "intentionally different",
    forbids: ["strong"],
    id: "no-fire-adjacent-to-punctuation",
    markdown: "(**bold**)\n",
    note: "Notion converts this; MME does not. The criterion is 'block start or whitespace', and widening it to allow punctuation reintroduces `*italic*` swallowing `**bold**`, because mid-typing `**bold*` has `*` before the match. Recorded in BACKLOG.md as CommonMark delimiter-run flanking.",
    typed: "(**bold**)"
  },
  {
    benchmark: "same as benchmark",
    forbids: ["strong"],
    id: "no-fire-mid-word",
    markdown: "a**bold**\n",
    // The bytes are identical whether or not the rule fired, so `forbids` is
    // the assertion that carries this row.
    note: "The character before the delimiter must be a block start or whitespace.",
    typed: "a**bold**"
  },
  {
    benchmark: "same as benchmark",
    forbids: ["pre strong", "pre em"],
    id: "no-fire-in-code-block",
    markdownPrefix: "```js\n**bold**\n```",
    note: "No rule fires where richTextInputContext reports an unsafe context.",
    requires: ["pre"],
    typed: "```js **bold**"
  }
];

/**
 * Typing the trigger, then one undo, must leave the literal characters.
 *
 * `markdown` is the **measured** serialization and is asserted, not decorative.
 * Two of these round-trip badly — `#` re-parses as an empty heading, so the
 * characters are lost on save and reopen — and that is a serializer-escaping
 * defect recorded in BACKLOG.md rather than something this gate may hide.
 */
const UNDO_ROWS = [
  { id: "undo-heading", literal: "# ", markdown: "#\n", typed: "# " },
  { id: "undo-strong", literal: "**bold**", markdown: "**bold**\n", typed: "**bold**" },
  { id: "undo-todo", literal: "[] ", markdown: "[]\n", typed: "[] " }
];

/**
 * The preservation fixes are the highest-value change in this issue, so they get
 * browser evidence and not only unit coverage. Before the context gate, typing
 * `> ` at the start of a table cell pulled the cell's paragraph out of the table
 * and left two broken tables behind.
 */
const TABLE_CELL_ROWS = ["# ", "> ", "- ", "**bold**"];
const TABLE_SOURCE = "| A | B |\n| --- | --- |\n| one | two |\n";

const markdownOf = (page) => page.evaluate(() => window.__MME_DEMO_VISUAL_CHECK__.getMarkdown());

const settle = (ms = 180) => new Promise((resolve) => setTimeout(resolve, ms));

async function shoot(page, name) {
  await settle(220);
  await page.screenshot({ path: `${visualDir}/${name}`, type: "png" });
}

async function loadEmptyRichDocument(page) {
  await page.evaluate(() => {
    window.__MME_DEMO_VISUAL_CHECK__.loadWritableMarkdownFileForTest("input-rules.md", "");
    window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich");
  });
  await page.waitForSelector(".ProseMirror");
  await settle();
  await page.click(".ProseMirror");
  await settle(120);
  const focused = await page.evaluate(() => Boolean(document.activeElement?.closest(".ProseMirror")));
  assert(focused, "the editing surface must hold focus before a real key press is sent to it.");
}

const matches = (page, selectors) =>
  page.evaluate((list) => {
    const editor = document.querySelector(".ProseMirror");
    return list.map((selector) => Boolean(editor?.querySelector(selector)));
  }, selectors);

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

      const viewportEvidence = { rows: {}, undo: {} };
      evidence[viewport.name] = viewportEvidence;

      for (const row of PARITY_ROWS) {
        await loadEmptyRichDocument(page);
        await page.keyboard.type(row.typed, { delay: 8 });
        await settle(140);
        const markdown = await markdownOf(page);
        const required = await matches(page, row.requires ?? []);
        const forbidden = await matches(page, row.forbids ?? []);
        viewportEvidence.rows[row.id] = { forbidden, markdown, required };

        if (row.markdownPrefix === undefined) {
          assert.equal(
            markdown,
            row.markdown,
            `@${viewport.name} ${row.id}: typing ${JSON.stringify(row.typed)} must serialize to ${JSON.stringify(row.markdown)}, got ${JSON.stringify(markdown)}.`
          );
        } else {
          assert(
            markdown.startsWith(row.markdownPrefix),
            `@${viewport.name} ${row.id}: typing ${JSON.stringify(row.typed)} must serialize starting with ${JSON.stringify(row.markdownPrefix)}, got ${JSON.stringify(markdown)}.`
          );
        }
        (row.requires ?? []).forEach((selector, index) => {
          assert(
            required[index],
            `@${viewport.name} ${row.id}: the rule did not render — no ${selector} in the editor. Matching bytes alone do not prove a rule fired.`
          );
        });
        (row.forbids ?? []).forEach((selector, index) => {
          assert(
            !forbidden[index],
            `@${viewport.name} ${row.id}: ${selector} must not exist here; the rule fired where it must stay literal.`
          );
        });
      }

      for (const row of UNDO_ROWS) {
        await loadEmptyRichDocument(page);
        await page.keyboard.type(row.typed, { delay: 8 });
        await settle(140);
        await page.keyboard.down(undoModifier);
        await page.keyboard.press("KeyZ");
        await page.keyboard.up(undoModifier);
        await settle(160);
        const after = await page.evaluate(() => {
          const editor = document.querySelector(".ProseMirror");
          const block = [...(editor?.children ?? [])].find(
            (child) => !child.classList.contains("ProseMirror-widget")
          );
          if (!block) {
            return { html: "", tag: "", text: "" };
          }
          /*
           * MME-0087's drag affordance and the fold toggle are ProseMirror
           * widgets rendered *inside* each block, so their labels are part of
           * `textContent` without being document text. Strip them on a clone.
           */
          const clone = block.cloneNode(true);
          for (const widget of clone.querySelectorAll(".ProseMirror-widget")) {
            widget.remove();
          }
          return {
            html: clone.outerHTML,
            tag: block.tagName.toLowerCase(),
            text: clone.textContent ?? ""
          };
        });
        const undoMarkdown = await markdownOf(page);
        viewportEvidence.undo[row.id] = { markdown: undoMarkdown, text: after.text };
        assert.equal(
          undoMarkdown,
          row.markdown,
          `@${viewport.name} ${row.id}: undo must serialize to ${JSON.stringify(row.markdown)}, got ${JSON.stringify(undoMarkdown)}. The published checklist quotes this value, so it must be asserted.`
        );
        assert.equal(
          after.text,
          row.literal,
          `@${viewport.name} ${row.id}: one undo must restore the literal ${JSON.stringify(row.literal)}, got ${JSON.stringify(after.text)}.`
        );
        assert.equal(
          after.tag,
          "p",
          `@${viewport.name} ${row.id}: one undo must return a plain paragraph, got <${after.tag}>.`
        );
        assert(
          !/<h1|<strong|<ul|<ol|<li/i.test(after.html),
          `@${viewport.name} ${row.id}: one undo must leave no converted node behind, got ${after.html}.`
        );
      }

      // --- Preservation, in the browser -----------------------------------
      viewportEvidence.tableCell = {};
      for (const typed of TABLE_CELL_ROWS) {
        await page.evaluate((source) => {
          window.__MME_DEMO_VISUAL_CHECK__.loadWritableMarkdownFileForTest("table.md", source);
          window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich");
        }, TABLE_SOURCE);
        await page.waitForSelector(".ProseMirror table");
        await settle();
        // Click the cell the way a writer reaches it, then put the caret at its
        // very start, which is where the corruption used to happen.
        await page.evaluate(() => {
          window.__MME_DEMO_VISUAL_CHECK__.setRichSelectionForText("one");
        });
        await settle(120);
        await page.keyboard.press("ArrowLeft");
        await settle(80);
        await page.keyboard.type(typed, { delay: 8 });
        await settle(160);
        const markdown = await markdownOf(page);
        const cellText = await page.evaluate(
          () => document.querySelector(".ProseMirror table tbody tr td")?.textContent ?? null
        );
        viewportEvidence.tableCell[typed] = { cellText, markdown };
        /*
         * Structure, not bytes. The cell serializer escapes what it must —
         * `> ` becomes `\> ` — and that escaping is correct, so pinning exact
         * bytes here would assert the wrong thing. What must hold is that the
         * table is still one table with both cells, and that the characters the
         * writer typed are still literal text in the cell.
         */
        assert.match(
          markdown,
          /^\| A \| B \|\n\| --- \| --- \|\n\| .+ \| two \|\n$/u,
          `@${viewport.name} table cell ${JSON.stringify(typed)}: the table must survive as one table, got ${JSON.stringify(markdown)}.`
        );
        assert.equal(
          cellText,
          `${typed}one`,
          `@${viewport.name} table cell ${JSON.stringify(typed)}: the typed characters must stay literal in the cell, got ${JSON.stringify(cellText)}.`
        );
      }

      // --- Untouched neighbours, in the browser ---------------------------
      await page.evaluate(() => {
        window.__MME_DEMO_VISUAL_CHECK__.loadWritableMarkdownFileForTest(
          "neighbours.md",
          "Alpha\n\nBravo\n\nCharlie\n"
        );
        window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich");
      });
      await page.waitForSelector(".ProseMirror");
      await settle();
      await page.evaluate(() => {
        window.__MME_DEMO_VISUAL_CHECK__.setRichSelectionAfterText("Bravo");
      });
      await settle(120);
      await page.keyboard.type(" **loud**", { delay: 8 });
      await settle(160);
      viewportEvidence.neighbours = await markdownOf(page);
      assert.equal(
        viewportEvidence.neighbours,
        "Alpha\n\nBravo **loud**\n\nCharlie\n",
        `@${viewport.name}: the untouched neighbours must stay byte-identical.`
      );
      assert(
        (await matches(page, ["p strong"]))[0],
        `@${viewport.name}: the neighbour case must actually apply the mark, or its byte assertion proves nothing.`
      );

      /*
       * A document exercising the whole table at once, for the screenshots.
       *
       * Each construct is typed into a fresh top-level paragraph. Typing them
       * back to back with Enter keeps the caret inside the list the previous
       * construct created, where `3. ` and `[x] ` correctly stay literal — the
       * screenshot then reads as "the rules are broken" when nothing is. Only
       * the repositioning uses a helper; every rule still fires from the real
       * keyboard. The document is asserted so the screenshot cannot silently
       * show something other than what it claims.
       */
      await loadEmptyRichDocument(page);
      const gallery = [
        "# Input rules",
        "## Inline",
        "Typed **bold**, *italic* and `code` in one line, plus ~~strike~~.",
        "> A quote",
        "---",
        "- Bullet item",
        "3. Third item",
        "[] Open task",
        "[x] Finished task",
        "```ts const value = 1;"
      ];
      for (const [index, line] of gallery.entries()) {
        if (index > 0) {
          await page.evaluate(() => {
            window.__MME_DEMO_VISUAL_CHECK__.selectFinalRichBlockForTest();
            window.__MME_DEMO_VISUAL_CHECK__.insertParagraphAfterCurrentRichBlock();
          });
          await settle(120);
        }
        await page.keyboard.type(line, { delay: 6 });
        await settle(90);
      }
      await settle(220);
      viewportEvidence.gallery = await markdownOf(page);
      /*
       * Trailing newlines are normalised on both sides: the repositioning helper
       * leaves blank paragraphs, and a document ending in a fenced code block
       * loses its final newline (the pre-existing defect recorded in BACKLOG.md).
       * Neither is produced by a rule, so neither is pinned here.
       */
      assert.equal(
        viewportEvidence.gallery.replace(/\n+$/u, ""),
        [
          "# Input rules",
          "",
          "## Inline",
          "",
          "Typed **bold**, *italic* and `code` in one line, plus ~~strike~~.",
          "",
          "> A quote",
          "",
          "---",
          "",
          "- Bullet item",
          "",
          "3. Third item",
          "",
          "- [ ] Open task",
          "",
          "- [x] Finished task",
          "",
          "```ts",
          "const value = 1;",
          "```"
        ].join("\n"),
        `@${viewport.name}: the gallery screenshot must show every rule applied, not a list that swallowed them.`
      );
      await shoot(page, `input-rules-${viewport.name}.png`);
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
          contract: "5 — Markdown-as-you-type input rules (block and inline portions)",
          demoUrl,
          rows: PARITY_ROWS.map((row) => ({
            benchmark: row.benchmark,
            id: row.id,
            markdown: row.markdown ?? `${row.markdownPrefix}…`,
            note: row.note,
            typed: row.typed
          })),
          undoRows: UNDO_ROWS
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
      `visual-check-mme0104a: ${PARITY_ROWS.length} parity rows, ${UNDO_ROWS.length} undo rows, ${TABLE_CELL_ROWS.length} table-cell preservation rows and the neighbour-preservation case proven with a real keyboard across ${WIDTHS.length} viewports; ${captured} screenshots captured.`
    );
  } finally {
    await browser.close();
  }
}

await main();
