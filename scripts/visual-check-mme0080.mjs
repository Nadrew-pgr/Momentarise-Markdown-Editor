import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import puppeteer from "puppeteer";
import { requireChromeExecutable } from "./chrome-helpers.mjs";

const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5174/";
const fixturePath = "fixtures/039-table-spreadsheet-paste/input.md";
const visualDir = "docs/internal/visual-checks/MME-0080";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function screenshot(page, fileName) {
  await page.screenshot({ path: `${visualDir}/${fileName}`, type: "png" });
}

async function paste(page, payload) {
  return page.evaluate((clipboardPayload) => {
    const editor = document.querySelector('[data-testid="rich-editor-host"] .ProseMirror');
    if (!(editor instanceof HTMLElement)) throw new Error("Rich editor DOM unavailable.");
    const transfer = new DataTransfer();
    for (const [mime, text] of Object.entries(clipboardPayload)) transfer.setData(mime, text);
    const event = new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
      clipboardData: transfer
    });
    const dispatched = editor.dispatchEvent(event);
    return { defaultPrevented: event.defaultPrevented, dispatched };
  }, payload);
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
  await rm(visualDir, { force: true, recursive: true });
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
      window.__MME_DEMO_VISUAL_CHECK__.loadWritableMarkdownFileForTest("quoted-csv-paste.md", content);
      window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich");
      window.__MME_DEMO_VISUAL_CHECK__.selectRichTableCellForTest(1, 1, 0);
    }, source);
    await page.waitForSelector('[data-testid="rich-editor-host"] table');
    await screenshot(page, "csv-paste-before.png");

    const csvText = [
      "\uFEFF\"North, Inc.\",\"He said \"\"go\"\"\",,\"=SUM(A1:A2)\"",
      "\"South\",\"[link](https://example.invalid)\",\"A|B\",\"<script>alert(1)</script>\""
    ].join("\r\n") + "\r\n";
    const accepted = await paste(page, { "text/csv": csvText });
    assert(accepted.defaultPrevented && !accepted.dispatched, "Accepted CSV paste must prevent default.");
    await page.waitForFunction(() =>
      window.__MME_DEMO_VISUAL_CHECK__.getMarkdown().includes("| alpha | North, Inc. | He said \"go\" |  | =SUM(A1:A2) |")
    );
    assert(
      JSON.stringify(await selectedTableCell(page)) === JSON.stringify({ columnIndex: 4, rowIndex: 2, tableIndex: 0 }),
      "Selection must land in final CSV cell."
    );
    const literalState = await page.evaluate(() => {
      const table = document.querySelector('[data-testid="rich-editor-host"] table');
      const rows = [...(table?.rows ?? [])];
      return {
        links: table?.querySelectorAll("a").length ?? -1,
        scripts: document.querySelectorAll('[data-testid="rich-editor-host"] script').length,
        text: rows.map((row) => [...row.children].map((cell) => cell.textContent))
      };
    });
    assert(literalState.links === 0 && literalState.scripts === 0, "CSV paste created active link/script DOM.");
    assert(literalState.text.flat().includes("[link](https://example.invalid)"), "Link-shaped CSV text changed.");
    assert(literalState.text.flat().includes("<script>alert(1)</script>"), "HTML-shaped CSV text changed.");
    await screenshot(page, "csv-paste-quoted-literal.png");

    const pastedSource = await markdown(page);
    assert(
      pastedSource.slice(pastedSource.indexOf("\n\nBetween root")) === source.slice(source.indexOf("\n\nBetween root")),
      "Bytes after root table changed."
    );
    await page.evaluate(() => window.__MME_DEMO_VISUAL_CHECK__.pressRichKeyForTest("z", { metaKey: true }));
    await page.waitForFunction((expected) => window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === expected, {}, source);
    await screenshot(page, "csv-paste-undone.png");
    await page.evaluate(() =>
      window.__MME_DEMO_VISUAL_CHECK__.pressRichKeyForTest("z", { metaKey: true, shiftKey: true })
    );
    await page.waitForFunction((expected) => window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === expected, {}, pastedSource);
    await page.waitForFunction(() => window.__MME_DEMO_VISUAL_CHECK__.getSaveState().status === "saved", { timeout: 5000 });
    assert(
      await page.evaluate(() =>
        window.__MME_DEMO_VISUAL_CHECK__.getTestDiskContent() === window.__MME_DEMO_VISUAL_CHECK__.getMarkdown()
      ),
      "Saved disk bytes differ."
    );
    await page.evaluate(() => window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("source"));
    await screenshot(page, "csv-paste-source-saved.png");

    await page.evaluate((content) => {
      window.__MME_DEMO_VISUAL_CHECK__.loadWritableMarkdownFileForTest("plain-comma-paste.md", content);
      window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich");
      window.__MME_DEMO_VISUAL_CHECK__.selectRichTableCellForTest(1, 1, 0);
    }, source);
    await paste(page, { "text/plain": "ordinary, comma prose" });
    await page.waitForFunction(() =>
      window.__MME_DEMO_VISUAL_CHECK__.getMarkdown().includes("ordinary, comma prose")
    );
    const plainShape = await page.$eval(
      '[data-testid="rich-editor-host"] table',
      (table) => [...table.rows].map((row) => row.cells.length)
    );
    assert(JSON.stringify(plainShape) === JSON.stringify([4, 4, 4, 4]), "Plain comma text triggered matrix expansion.");

    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
    await page.evaluate((content) => {
      window.__MME_DEMO_VISUAL_CHECK__.loadWritableMarkdownFileForTest("quoted-csv-wide.md", content);
      window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich");
      window.__MME_DEMO_VISUAL_CHECK__.selectRichTableCellForTest(1, 6, 4);
    }, source);
    assert(
      (await paste(page, { "text/csv": "\"wide, A\",wide B,wide C" })).defaultPrevented,
      "Constrained CSV paste not accepted."
    );
    await page.waitForFunction(() => window.__MME_DEMO_VISUAL_CHECK__.getMarkdown().includes("wide, A | wide B | wide C"));
    const containmentAtStart = await page.evaluate(() => {
      const host = document.querySelector('[data-testid="rich-editor-host"]');
      const table = host?.querySelectorAll("table")[4];
      const scroller = table?.parentElement;
      return {
        pageClientWidth: document.documentElement.clientWidth,
        pageScrollWidth: document.documentElement.scrollWidth,
        pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        tableClientWidth: scroller?.clientWidth ?? null,
        tableScrollLeft: scroller?.scrollLeft ?? null,
        tableScrollWidth: scroller?.scrollWidth ?? null,
        tableScrollable: Boolean(scroller && scroller.scrollWidth > scroller.clientWidth)
      };
    });
    assert(
      !containmentAtStart.pageOverflow && containmentAtStart.tableScrollable,
      "Constrained CSV table containment failed."
    );
    await screenshot(page, "csv-paste-wide-constrained-left.png");
    await page.evaluate(() => {
      const host = document.querySelector('[data-testid="rich-editor-host"]');
      const table = host?.querySelectorAll("table")[4];
      const scroller = table?.parentElement;
      scroller?.scrollTo({ left: scroller.scrollWidth });
    });
    await page.waitForFunction(() => {
      const host = document.querySelector('[data-testid="rich-editor-host"]');
      const table = host?.querySelectorAll("table")[4];
      return (table?.parentElement?.scrollLeft ?? 0) > 0;
    });
    const containmentAtEnd = await page.evaluate(() => {
      const host = document.querySelector('[data-testid="rich-editor-host"]');
      const table = host?.querySelectorAll("table")[4];
      const scroller = table?.parentElement;
      return {
        pageClientWidth: document.documentElement.clientWidth,
        pageScrollWidth: document.documentElement.scrollWidth,
        pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        tableClientWidth: scroller?.clientWidth ?? null,
        tableScrollLeft: scroller?.scrollLeft ?? null,
        tableScrollWidth: scroller?.scrollWidth ?? null,
        tableScrollable: Boolean(scroller && scroller.scrollWidth > scroller.clientWidth)
      };
    });
    assert(
      !containmentAtEnd.pageOverflow &&
        containmentAtEnd.tableScrollable &&
        containmentAtEnd.tableScrollLeft > 0,
      "Constrained CSV table end position failed."
    );
    await screenshot(page, "csv-paste-wide-constrained-right.png");

    const unexpectedResponses = failedResponses.filter(({ url }) => !/\/favicon\.ico(?:\?|$)/.test(url));
    const unexpectedConsoleErrors = consoleErrors.filter(
      (message) =>
        message !== "Failed to load resource: the server responded with a status of 404 (Not Found)" ||
        unexpectedResponses.length > 0
    );
    assert(unexpectedResponses.length === 0, `Failed browser responses:\n${JSON.stringify(unexpectedResponses, null, 2)}`);
    assert(unexpectedConsoleErrors.length === 0, `Browser console errors:\n${unexpectedConsoleErrors.join("\n")}`);
    await writeFile(
      `${visualDir}/result.json`,
      `${JSON.stringify(
        {
          consoleErrors: unexpectedConsoleErrors,
          containment: {
            end: containmentAtEnd,
            start: containmentAtStart
          },
          demoUrl,
          ignoredResponses: failedResponses,
          screenshots: 6,
          status: "passed"
        },
        null,
        2
      )}\n`
    );
  } finally {
    await browser.close();
  }
}

await main();
