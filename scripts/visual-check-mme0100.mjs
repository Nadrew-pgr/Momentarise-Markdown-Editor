import { mkdir, rm, writeFile } from "node:fs/promises";
import puppeteer from "puppeteer";
import { requireChromeExecutable } from "./chrome-helpers.mjs";

// MME-0100 demo parity capture: screenshots the reference demo at desktop (1280) and mobile
// (390) widths in both Source and Rich modes, exercising the surfaces the packaged stylesheet
// must own (headings, lists, task lists, tables, callouts, code, blockquotes, footnotes).
// Run once before the extraction (MME_MME0100_LABEL=before) and once after (=after); the two
// sets must look identical, proving the move+tokenize did not regress the demo.
const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5174/";
const label = process.env.MME_MME0100_LABEL ?? "after";
const visualDir = `docs/internal/visual-checks/MME-0100/${label}`;

const richDoc = [
  "---",
  "title: Stylesheet Parity Fixture",
  "status: review",
  "---",
  "",
  "# Framework component stylesheet",
  "",
  "A paragraph of body text proving base typography, measure, and color come from tokens.",
  "",
  "## Lists and tasks",
  "",
  "- First bullet",
  "- Second bullet",
  "  - Nested bullet",
  "",
  "- [ ] Open task",
  "- [x] Done task",
  "",
  "## Table",
  "",
  "| Surface | Owner |",
  "| --- | --- |",
  "| Toolbar | md-surface |",
  "| Rich content | md-rich-prosemirror |",
  "",
  "## Callout",
  "",
  "> [!note] Preservation",
  "> Unknown syntax survives as raw source.",
  "",
  "## Code",
  "",
  "```ts",
  'const canonical = "Markdown";',
  "```",
  "",
  "## Quote and footnote",
  "",
  "> Markdown remains the durable source.[^1]",
  "",
  "[^1]: A footnote definition.",
  ""
].join("\n");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function shoot(page, width, name) {
  await page.setViewport({ width, height: width < 500 ? 844 : 900, deviceScaleFactor: 1 });
  await new Promise((resolve) => setTimeout(resolve, 200));
  await page.screenshot({ path: `${visualDir}/${name}`, type: "png" });
}

async function main() {
  await rm(visualDir, { force: true, recursive: true });
  await mkdir(visualDir, { recursive: true });

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
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  try {
    await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
    await page.goto(demoUrl, { waitUntil: "networkidle0" });
    await page.waitForFunction(() => Boolean(window.__MME_DEMO_VISUAL_CHECK__?.loadWritableMarkdownFileForTest));
    await page.evaluate((content) => {
      window.__MME_DEMO_VISUAL_CHECK__.loadWritableMarkdownFileForTest("stylesheet-parity.md", content);
      window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("source");
    }, richDoc);
    await page.waitForSelector(".cm-editor");
    await shoot(page, 1280, "source-1280.png");
    await shoot(page, 390, "source-390.png");

    await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
    await page.evaluate(() => window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich"));
    await page.waitForSelector('[data-testid="rich-editor-host"] .ProseMirror, .rich-editor-host .ProseMirror, .ProseMirror');
    await new Promise((resolve) => setTimeout(resolve, 250));
    await shoot(page, 1280, "rich-1280.png");
    await shoot(page, 390, "rich-390.png");

    const unexpected = consoleErrors.filter(
      (m) => m !== "Failed to load resource: the server responded with a status of 404 (Not Found)"
    );
    assert(unexpected.length === 0, `Browser console errors:\n${unexpected.join("\n")}`);

    await writeFile(
      `${visualDir}/result.json`,
      `${JSON.stringify({ label, demoUrl, screenshots: 4, consoleErrors: unexpected, status: "passed" }, null, 2)}\n`
    );
    console.log(`visual-check-mme0100 (${label}): 4 screenshots captured.`);
  } finally {
    await browser.close();
  }
}

await main();
