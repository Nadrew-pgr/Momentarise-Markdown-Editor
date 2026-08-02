import { mkdir, readFile, writeFile } from "node:fs/promises";
import puppeteer from "puppeteer";
import { requireChromeExecutable } from "./chrome-helpers.mjs";
import { clearGeneratedArtifacts } from "./visual-artifacts.mjs";

const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5174/";
const fixturePath = "fixtures/039-table-spreadsheet-paste/input.md";
const visualDir = "docs/internal/visual-checks/MME-0075";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function screenshot(page, fileName) {
  await page.screenshot({ path: `${visualDir}/${fileName}`, type: "png" });
}

async function pasteMatrix(page, text, mime = "text/plain") {
  return page.evaluate(({ mime, text }) => {
    const editor = document.querySelector('[data-testid="rich-editor-host"] .ProseMirror');
    if (!(editor instanceof HTMLElement)) throw new Error("Rich editor DOM unavailable.");
    const transfer = new DataTransfer();
    transfer.setData(mime, text);
    const event = new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
      clipboardData: transfer
    });
    const dispatched = editor.dispatchEvent(event);
    return { defaultPrevented: event.defaultPrevented, dispatched };
  }, { mime, text });
}

async function markdown(page) {
  return page.evaluate(() => window.__MME_DEMO_VISUAL_CHECK__.getMarkdown());
}

async function selectedTableCell(page) {
  return page.evaluate(() => {
    const selection = window.getSelection();
    const node = selection?.anchorNode;
    const element = node instanceof Element ? node : node?.parentElement;
    const cell = element?.closest("td, th");
    const row = cell?.parentElement;
    const table = row?.closest("table");
    if (!cell || !row || !table) return null;
    const tables = [...document.querySelectorAll('[data-testid="rich-editor-host"] table')];
    return {
      columnIndex: [...row.children].indexOf(cell),
      rowIndex: [...table.rows].indexOf(row),
      tableIndex: tables.indexOf(table)
    };
  });
}

async function main() {
  /*
   * MME-0114: clear only what this gate regenerates. The previous
   * `rm(visualDir, { recursive: true })` also deleted the committed README.md
   * that Gate 0.8 requires whenever the gate failed after clearing.
   */
  await clearGeneratedArtifacts(visualDir);
  await mkdir(visualDir, { recursive: true });
  const source = await readFile(fixturePath, "utf8");
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
    await page.setViewport({ width: 1360, height: 900, deviceScaleFactor: 1 });
    await page.goto(demoUrl, { waitUntil: "networkidle0" });
    await page.waitForFunction(() => Boolean(window.__MME_DEMO_VISUAL_CHECK__?.loadWritableMarkdownFileForTest));
    await page.evaluate((content) => {
      window.__MME_DEMO_VISUAL_CHECK__.loadWritableMarkdownFileForTest("spreadsheet-paste.md", content);
      window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich");
    }, source);
    await page.waitForSelector('[data-testid="rich-editor-host"] table');
    assert(await page.$$eval('[data-testid="rich-editor-host"] table', (tables) => tables.length) === 5, "Expected five semantic tables.");
    await screenshot(page, "table-paste-before.png");

    await page.evaluate(() => window.__MME_DEMO_VISUAL_CHECK__.selectRichTableCellForTest(2, 3, 0));
    const expandedEvent = await pasteMatrix(page, "north\t\tsouth\r\n10\t20\t30\r\n40\t50\t60\r\n");
    assert(expandedEvent.defaultPrevented && !expandedEvent.dispatched, "Accepted matrix paste must prevent default.");
    await page.waitForFunction(() => window.__MME_DEMO_VISUAL_CHECK__.getMarkdown().includes("|  |  |  | 40 | 50 | 60 |"));
    assert(
      JSON.stringify(await selectedTableCell(page)) === JSON.stringify({ columnIndex: 5, rowIndex: 4, tableIndex: 0 }),
      "Selection must land in final pasted cell."
    );
    await screenshot(page, "table-paste-expanded.png");
    const expandedSource = await markdown(page);
    assert(expandedSource.slice(expandedSource.indexOf("\n\nBetween root")) === source.slice(source.indexOf("\n\nBetween root")), "Bytes after root table changed.");

    await page.evaluate(() => window.__MME_DEMO_VISUAL_CHECK__.pressRichKeyForTest("z", { metaKey: true }));
    await page.waitForFunction((expected) => window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === expected, {}, source);
    await screenshot(page, "table-paste-undone.png");
    await page.evaluate(() => window.__MME_DEMO_VISUAL_CHECK__.pressRichKeyForTest("z", { metaKey: true, shiftKey: true }));
    await page.waitForFunction((expected) => window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === expected, {}, expandedSource);

    await page.evaluate((content) => {
      window.__MME_DEMO_VISUAL_CHECK__.loadWritableMarkdownFileForTest("spreadsheet-literal.md", content);
      window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich");
      window.__MME_DEMO_VISUAL_CHECK__.selectRichTableCellForTest(1, 1, 0);
    }, source);
    const literalText = "A|B\t*literal*\t[link](https://example.invalid)\t<script>alert(1)</script>\t`code`\t~~strike~~\tback\\slash";
    assert((await pasteMatrix(page, literalText, "text/tab-separated-values")).defaultPrevented, "TSV MIME paste not accepted.");
    await page.waitForFunction(() => window.__MME_DEMO_VISUAL_CHECK__.getMarkdown().includes("https&#58;//example.invalid"));
    const literalState = await page.evaluate(() => {
      const table = document.querySelector('[data-testid="rich-editor-host"] table');
      const row = table?.rows[1];
      return {
        links: row?.querySelectorAll("a").length ?? -1,
        scripts: document.querySelectorAll('[data-testid="rich-editor-host"] script').length,
        text: [...(row?.children ?? [])].map((cell) => cell.textContent)
      };
    });
    assert(literalState.links === 0 && literalState.scripts === 0, "Literal paste created active link/script DOM.");
    assert(literalState.text.includes("[link](https://example.invalid)"), "Literal link-shaped text changed.");
    await screenshot(page, "table-paste-literal.png");

    await page.evaluate((content) => {
      window.__MME_DEMO_VISUAL_CHECK__.loadWritableMarkdownFileForTest("spreadsheet-nested.md", content);
      window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich");
      window.__MME_DEMO_VISUAL_CHECK__.selectRichTableCellForTest(1, 1, 3);
    }, source);
    assert((await pasteMatrix(page, "nested A\tnested B\nnext A\tnext B")).defaultPrevented, "Nested matrix paste not accepted.");
    await page.waitForFunction(() => window.__MME_DEMO_VISUAL_CHECK__.getMarkdown().includes("      | task one | nested A | nested B |"));
    await screenshot(page, "table-paste-nested.png");
    await page.waitForFunction(() => window.__MME_DEMO_VISUAL_CHECK__.getSaveState().status === "saved", { timeout: 5000 });
    assert(await page.evaluate(() => window.__MME_DEMO_VISUAL_CHECK__.getTestDiskContent() === window.__MME_DEMO_VISUAL_CHECK__.getMarkdown()), "Saved disk bytes differ.");
    await screenshot(page, "table-paste-saved.png");
    await page.evaluate(() => window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("source"));
    await screenshot(page, "table-paste-source.png");

    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
    await page.evaluate((content) => {
      window.__MME_DEMO_VISUAL_CHECK__.loadWritableMarkdownFileForTest("spreadsheet-wide.md", content);
      window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich");
      window.__MME_DEMO_VISUAL_CHECK__.selectRichTableCellForTest(1, 6, 4);
    }, source);
    assert((await pasteMatrix(page, "wide A\twide B\twide C")).defaultPrevented, "Wide matrix paste not accepted.");
    await page.waitForFunction(() => window.__MME_DEMO_VISUAL_CHECK__.getMarkdown().includes("wide A | wide B | wide C"));
    const containment = await page.evaluate(() => {
      const host = document.querySelector('[data-testid="rich-editor-host"]');
      const table = host?.querySelectorAll("table")[4];
      const scroller = table?.parentElement;
      scroller?.scrollTo({ left: scroller.scrollWidth });
      return {
        pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        tableScrollable: Boolean(scroller && scroller.scrollWidth > scroller.clientWidth)
      };
    });
    assert(!containment.pageOverflow && containment.tableScrollable, "Constrained wide-table containment failed.");
    await screenshot(page, "table-paste-wide-constrained.png");

    const unexpectedResponses = failedResponses.filter(({ url }) => !/\/favicon\.ico(?:\?|$)/.test(url));
    const unexpectedConsoleErrors = consoleErrors.filter(
      (message) => message !== "Failed to load resource: the server responded with a status of 404 (Not Found)" || unexpectedResponses.length > 0
    );
    assert(unexpectedResponses.length === 0, `Failed browser responses:\n${JSON.stringify(unexpectedResponses, null, 2)}`);
    assert(unexpectedConsoleErrors.length === 0, `Browser console errors:\n${unexpectedConsoleErrors.join("\n")}`);
    await writeFile(
      `${visualDir}/result.json`,
      `${JSON.stringify({ consoleErrors: unexpectedConsoleErrors, demoUrl, ignoredResponses: failedResponses, screenshots: 8, status: "passed" }, null, 2)}\n`
    );
  } finally {
    await browser.close();
  }
}

await main();
