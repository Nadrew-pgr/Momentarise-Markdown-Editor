import { mkdir, rm, writeFile } from "node:fs/promises";

import puppeteer from "puppeteer";

import { requireChromeExecutable } from "./chrome-helpers.mjs";

const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5174/";
const visualDir = "docs/internal/visual-checks/MME-0077";
const source = [
  "# Semantic tasks",
  "",
  "- [ ] Ship valid list DOM",
  "- [x] Preserve checked state",
  "- Parent list item",
  "  - [ ] Keep nested tasks",
  "",
  "3. [x] Preserve ordered number",
  "4. [ ] Keep ordered task",
  ""
].join("\n");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function screenshot(page, fileName) {
  await page.screenshot({ path: `${visualDir}/${fileName}`, type: "png" });
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
      window.__MME_DEMO_VISUAL_CHECK__.loadWritableMarkdownFileForTest("semantic-tasks.md", content);
      window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich");
    }, source);
    await page.waitForSelector('[data-testid="rich-editor-host"] li[data-type="todo-item"]');

    const mounted = await page.evaluate(() => {
      const host = document.querySelector('[data-testid="rich-editor-host"]');
      const lists = [...(host?.querySelectorAll("ul, ol") ?? [])];
      const tasks = [...(host?.querySelectorAll('li[data-type="todo-item"]') ?? [])];
      const unorderedTask = host?.querySelector('ul > li[data-type="todo-item"]');
      const orderedTask = host?.querySelector('ol > li[data-type="todo-item"]');
      return {
        allListChildrenNative: lists.every((list) => [...list.children].every((child) => child.tagName === "LI")),
        invalidLists: lists
          .map((list) => ({ tag: list.tagName, children: [...list.children].map((child) => child.tagName) }))
          .filter((list) => list.children.some((tagName) => tagName !== "LI")),
        contentHasGlyph: tasks.some((task) => task.querySelector("[data-todo-content]")?.textContent?.includes("\u2713")),
        directTaskDivs: lists.reduce(
          (count, list) => count + [...list.children].filter((child) => child.tagName === "DIV").length,
          0
        ),
        orderedListStyle: orderedTask ? getComputedStyle(orderedTask).listStyleType : null,
        orderedStart: host?.querySelector("ol")?.getAttribute("start") ?? null,
        taskCount: tasks.length,
        unorderedListStyle: unorderedTask ? getComputedStyle(unorderedTask).listStyleType : null
      };
    });
    assert(mounted.allListChildrenNative && mounted.directTaskDivs === 0, `Invalid list DOM: ${JSON.stringify(mounted)}`);
    assert(mounted.taskCount === 5 && !mounted.contentHasGlyph, `Task content boundary failed: ${JSON.stringify(mounted)}`);
    assert(mounted.unorderedListStyle === "none", `Unordered task marker visible: ${JSON.stringify(mounted)}`);
    assert(mounted.orderedListStyle === "decimal" && mounted.orderedStart === "3", `Ordered numbering lost: ${JSON.stringify(mounted)}`);
    assert(
      await page.evaluate((expected) => window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === expected, source),
      "Untouched rich mount changed Markdown."
    );
    await screenshot(page, "todo-semantic-lists-desktop.png");

    const firstButton = '[data-testid="rich-editor-host"] li[data-type="todo-item"] [data-todo-toggle]';
    await page.click(firstButton);
    const toggledSource = source.replace("- [ ] Ship valid list DOM", "- [x] Ship valid list DOM");
    await new Promise((resolve) => setTimeout(resolve, 150));
    const pointerState = await page.evaluate(() => ({
      ariaPressed: document.querySelector('[data-testid="rich-editor-host"] li[data-type="todo-item"] [data-todo-toggle]')?.getAttribute("aria-pressed"),
      markdown: window.__MME_DEMO_VISUAL_CHECK__.getMarkdown()
    }));
    assert(pointerState.markdown === toggledSource, `Pointer toggle failed: ${JSON.stringify(pointerState)}`);
    await page.focus(firstButton);
    assert(await page.evaluate(() => document.activeElement?.hasAttribute("data-todo-toggle")), "Task button cannot receive focus.");
    await screenshot(page, "todo-semantic-toggle-focused.png");
    await page.keyboard.press("Enter");
    await page.waitForFunction((expected) => window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === expected, {}, source);
    await page.focus(firstButton);
    await page.keyboard.press("Space");
    await page.waitForFunction((expected) => window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === expected, {}, toggledSource);
    await page.focus(firstButton);
    await page.keyboard.press("Space");
    await page.waitForFunction((expected) => window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === expected, {}, source);

    await page.evaluate(() => {
      window.__MME_DEMO_VISUAL_CHECK__.loadWritableMarkdownFileForTest("command-task.md", "Command task\n");
      window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich");
      window.__MME_DEMO_VISUAL_CHECK__.selectRichTextForTest("Command task");
      window.__MME_DEMO_VISUAL_CHECK__.runRichCommand("todo");
    });
    await page.waitForFunction(() => window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === "- [ ] Command task\n");
    assert(
      await page.evaluate(() => Boolean(document.querySelector('[data-testid="rich-editor-host"] ul > li[data-type="todo-item"]'))),
      "Todo command did not create bullet_list > todo_item."
    );
    await screenshot(page, "todo-semantic-command.png");

    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
    await page.evaluate((content) => {
      window.__MME_DEMO_VISUAL_CHECK__.loadWritableMarkdownFileForTest("semantic-tasks-narrow.md", content);
      window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich");
    }, source);
    const constrained = await page.evaluate(() => {
      const host = document.querySelector('[data-testid="rich-editor-host"]');
      const tasks = [...(host?.querySelectorAll('li[data-type="todo-item"]') ?? [])];
      const hostRect = host?.getBoundingClientRect();
      return {
        contained: Boolean(
          hostRect &&
          tasks.every((task) => {
            const rect = task.getBoundingClientRect();
            return rect.left >= hostRect.left - 1 && rect.right <= hostRect.right + 1;
          })
        ),
        pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
      };
    });
    assert(constrained.contained && !constrained.pageOverflow, `Narrow containment failed: ${JSON.stringify(constrained)}`);
    await screenshot(page, "todo-semantic-constrained.png");

    await page.setViewport({ width: 1360, height: 900, deviceScaleFactor: 1 });
    await page.evaluate(() => window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("source"));
    await page.waitForFunction(() => window.__MME_DEMO_VISUAL_CHECK__.getEditorMode() === "source");
    assert(
      await page.evaluate((expected) => window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === expected, source),
      "Source handoff changed Markdown."
    );
    await screenshot(page, "todo-semantic-source.png");

    const unexpectedResponses = failedResponses.filter(({ url }) => !/\/favicon\.ico(?:\?|$)/.test(url));
    const unexpectedConsoleErrors = consoleErrors.filter(
      (message) => message !== "Failed to load resource: the server responded with a status of 404 (Not Found)" || unexpectedResponses.length > 0
    );
    assert(unexpectedResponses.length === 0, `Failed browser responses:\n${JSON.stringify(unexpectedResponses, null, 2)}`);
    assert(unexpectedConsoleErrors.length === 0, `Browser console errors:\n${unexpectedConsoleErrors.join("\n")}`);
    const result = {
      consoleErrors: unexpectedConsoleErrors,
      demoUrl,
      failedResponses: unexpectedResponses,
      mounted,
      screenshots: 5,
      status: "passed"
    };
    await writeFile(`${visualDir}/result.json`, `${JSON.stringify(result, null, 2)}\n`);
    await writeFile(
      `${visualDir}/README.md`,
      [
        "# MME-0077 visual proof",
        "",
        "- Native `LI` task roots under bullet, ordered, and nested lists.",
        "- Unordered task marker hidden; ordered numbering starts at 3 and remains visible.",
        "- Pointer, Enter, and Space toggle paths preserve Markdown and focus.",
        "- Todo command creates `bullet_list > todo_item`.",
        "- 390px viewport contains all task rows without page overflow.",
        "- Source handoff preserves exact Markdown.",
        "",
        "Human visual review: queued for Andrew's consolidated end-of-run review.",
        ""
      ].join("\n")
    );
  } finally {
    await browser.close();
  }
}

await main();
