import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import puppeteer from "puppeteer";
import { requireChromeExecutable } from "./chrome-helpers.mjs";

/**
 * MME-0102 — design foundation proof.
 *
 * Captures the redesigned surfaces at 1280 / 768 / 390 in both schemes, and
 * records the computed values that the benchmark comparison is judged on:
 *
 *   content  — document typography vs Notion (16px text, real heading scale, 708px measure)
 *   chrome   — controls vs Linear/Vercel (28px controls, hairlines, quiet elevation)
 *   menu     — the slash menu vs BlockNote (10px radius, 6px padding, 32px items, elevation-3)
 *   source   — the CodeMirror surface under the same tokens
 *
 * The measurements.json this writes is the objective half of the comparison: the
 * benchmarks' published geometry is documented in the README, and these are the
 * numbers MME actually renders. No competitor assets, CSS, or screenshots are
 * used or reproduced — the benchmarks are a visual reference only.
 */

const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5174/";
const visualDir = "docs/internal/visual-checks/MME-0102";

const WIDTHS = [
  { height: 900, name: "1280", width: 1280 },
  { height: 1024, name: "768", width: 768 },
  { height: 844, name: "390", width: 390 }
];
const SCHEMES = ["dark", "light"];

const showcase = [
  "---",
  "title: Design Foundation",
  "status: review",
  "---",
  "",
  "# Momentarise Markdown Editor",
  "",
  "Markdown remains the durable source. Rich views, HTML, AI suggestions, and host integrations are derived layers. This paragraph exists to show the measure, the line height, and the color of body text at the content size.",
  "",
  "## A real heading scale",
  "",
  "Headings are sized in em relative to the content size, with negative tracking that tightens as the size grows.",
  "",
  "### Third level",
  "",
  "- First bullet in a list",
  "- Second bullet, slightly longer, to show wrapping inside the measure",
  "  - A nested bullet",
  "",
  "- [ ] An open task",
  "- [x] A completed task",
  "",
  "## Table",
  "",
  "| Surface | Owner |",
  "| --- | --- |",
  "| Toolbar | md-surface |",
  "| Rich content | md-rich-prosemirror |",
  "",
  "## Code",
  "",
  "```ts",
  'const canonical: string = "Markdown";',
  "```",
  "",
  "> A blockquote carries the muted text color and a hairline rail.[^1]",
  "",
  "[^1]: A footnote definition.",
  ""
].join("\n");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function setScheme(page, scheme) {
  await page.evaluate((value) => {
    document.documentElement.setAttribute("data-mme-scheme", value);
  }, scheme);
  await new Promise((resolve) => setTimeout(resolve, 120));
}

async function shoot(page, name) {
  await new Promise((resolve) => setTimeout(resolve, 200));
  await page.screenshot({ path: `${visualDir}/${name}`, type: "png" });
}

/** The geometry the benchmark comparison is judged on. */
async function measure(page) {
  return page.evaluate(() => {
    const px = (value) => Number.parseFloat(value);
    const pm = document.querySelector(".ProseMirror");
    const body = pm?.querySelector("p");
    const h1 = pm?.querySelector("h1");
    const h2 = pm?.querySelector("h2");
    const h3 = pm?.querySelector("h3");
    const toolbarButton = document.querySelector(".rich-command-toolbar .toolbar-button");
    const toolbar = document.querySelector(".rich-command-toolbar");
    const menu = document.querySelector(".slash-command-menu");
    const menuItem = document.querySelector(".slash-command-item");
    const read = (element, property) => (element ? getComputedStyle(element)[property] : null);
    return {
      chrome: {
        toolbarBorderBottomWidth: read(toolbar, "borderBottomWidth"),
        toolbarButtonHeight: toolbarButton ? Math.round(toolbarButton.getBoundingClientRect().height) : null,
        toolbarButtonRadius: read(toolbarButton, "borderRadius"),
        toolbarHeight: toolbar ? Math.round(toolbar.getBoundingClientRect().height) : null
      },
      content: {
        bodyFontSize: read(body, "fontSize"),
        bodyLineHeightRatio: body ? Number((px(read(body, "lineHeight")) / px(read(body, "fontSize"))).toFixed(2)) : null,
        h1FontSize: read(h1, "fontSize"),
        h1LetterSpacing: read(h1, "letterSpacing"),
        h1Weight: read(h1, "fontWeight"),
        h2FontSize: read(h2, "fontSize"),
        h3FontSize: read(h3, "fontSize"),
        measureWidth: pm ? Math.round(pm.getBoundingClientRect().width) : null,
        paddingTop: read(pm, "paddingTop")
      },
      menu: {
        itemHeight: menuItem ? Math.round(menuItem.getBoundingClientRect().height) : null,
        itemRadius: read(menuItem, "borderRadius"),
        menuPadding: read(menu, "padding"),
        menuRadius: read(menu, "borderRadius"),
        menuShadowLayers: menu ? (read(menu, "boxShadow") || "").split(/,(?![^(]*\))/).length : null
      },
      smallestFontSize: (() => {
        let smallest = Infinity;
        for (const element of document.querySelectorAll("body *")) {
          const size = px(getComputedStyle(element).fontSize);
          if (Number.isFinite(size) && size > 0 && element.textContent?.trim()) {
            smallest = Math.min(smallest, size);
          }
        }
        return Number.isFinite(smallest) ? smallest : null;
      })()
    };
  });
}

/**
 * Clears only the artifacts this script owns.
 *
 * This deliberately does NOT wipe `visualDir`: that folder also holds the
 * hand-written README.md and the `registry/` proof from the sibling script, and
 * an earlier `rm -rf` of the whole directory silently destroyed both between a
 * re-run and the commit. A capture script may delete its own output and nothing
 * else.
 */
async function clearOwnArtifacts() {
  const owned = await readdir(visualDir).catch(() => []);
  for (const entry of owned) {
    if (/^(content|content-blocks|menu|source)-(dark|light)-(1280|768|390)\.png$/.test(entry) || entry === "measurements.json") {
      await rm(`${visualDir}/${entry}`, { force: true });
    }
  }
}

async function main() {
  await mkdir(visualDir, { recursive: true });
  await clearOwnArtifacts();

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

  const measurements = {};
  let captured = 0;

  try {
    await page.setViewport({ deviceScaleFactor: 1, height: 900, width: 1280 });
    await page.goto(demoUrl, { waitUntil: "networkidle0" });
    await page.waitForFunction(() => Boolean(window.__MME_DEMO_VISUAL_CHECK__?.loadWritableMarkdownFileForTest));
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "networkidle0" });
    await page.waitForFunction(() => Boolean(window.__MME_DEMO_VISUAL_CHECK__?.loadWritableMarkdownFileForTest));
    /*
     * MME-0089 turned the persistent formatting toolbar off by default
     * (benchmark contract 4): formatting now lives in the selection bubble and
     * the slash menu. This gate exercises the toolbar, so it opts in the way a
     * Google-Docs-style host would, and the opt-in itself is proven by
     * `visual:mme-0089`.
     */
    await page.evaluate(() =>
      window.__MME_DEMO_VISUAL_CHECK__.setReferenceSurfacePreferencesForTest({ toolbarMode: "sticky" })
    );

    await page.evaluate((content) => {
      window.__MME_DEMO_VISUAL_CHECK__.loadWritableMarkdownFileForTest("design-foundation.md", content);
      window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich");
    }, showcase);
    await page.waitForSelector(".ProseMirror");

    for (const scheme of SCHEMES) {
      await setScheme(page, scheme);
      for (const viewport of WIDTHS) {
        await page.setViewport({ deviceScaleFactor: 1, height: viewport.height, width: viewport.width });
        await new Promise((resolve) => setTimeout(resolve, 200));

        // content — vs Notion
        await page.evaluate(() => {
          const host = document.querySelector(".rich-editor-host");
          if (host) host.scrollTop = 0;
        });
        await shoot(page, `content-${scheme}-${viewport.name}.png`);
        captured += 1;

        // content, lower blocks — table, code, blockquote, footnote
        await page.evaluate(() => {
          const host = document.querySelector(".rich-editor-host");
          if (host) host.scrollTop = host.scrollHeight;
        });
        await shoot(page, `content-blocks-${scheme}-${viewport.name}.png`);
        captured += 1;
        await page.evaluate(() => {
          const host = document.querySelector(".rich-editor-host");
          if (host) host.scrollTop = 0;
        });

        // menus — vs BlockNote
        await page.evaluate(() => window.__MME_DEMO_VISUAL_CHECK__.openSlashMenuForTest("t"));
        await page.waitForFunction(() => window.__MME_DEMO_VISUAL_CHECK__.getSlashMenuState().open === true);
        await shoot(page, `menu-${scheme}-${viewport.name}.png`);
        captured += 1;

        if (viewport.name === "1280") {
          measurements[scheme] = await measure(page);
        }

        await page.evaluate(() => window.__MME_DEMO_VISUAL_CHECK__.openSlashMenuForTest("zzz-none"));

        // source mode — the same tokens under CodeMirror
        await page.evaluate(() => window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("source"));
        await page.waitForSelector(".cm-editor");
        await shoot(page, `source-${scheme}-${viewport.name}.png`);
        captured += 1;
        await page.evaluate(() => window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich"));
        await page.waitForSelector(".ProseMirror");
      }
    }

    // --- the numbers the benchmark comparison is judged on ---
    for (const scheme of SCHEMES) {
      const m = measurements[scheme];
      assert(m.content.bodyFontSize === "16px", `${scheme}: content text must be 16px, got ${m.content.bodyFontSize}.`);
      assert(m.content.bodyLineHeightRatio === 1.65, `${scheme}: content line-height must be 1.65, got ${m.content.bodyLineHeightRatio}.`);
      assert(m.content.h1FontSize === "30px", `${scheme}: H1 must be 1.875em of 16px = 30px, got ${m.content.h1FontSize}.`);
      assert(m.content.h2FontSize === "24px", `${scheme}: H2 must be 1.5em = 24px, got ${m.content.h2FontSize}.`);
      assert(m.content.h3FontSize === "20px", `${scheme}: H3 must be 1.25em = 20px, got ${m.content.h3FontSize}.`);
      assert(m.content.measureWidth === 708, `${scheme}: content measure must be 708px, got ${m.content.measureWidth}.`);
      assert(m.content.paddingTop === "64px", `${scheme}: desktop content padding-top must be 64px, got ${m.content.paddingTop}.`);
      assert(m.chrome.toolbarButtonHeight === 28, `${scheme}: controls must be 28px, got ${m.chrome.toolbarButtonHeight}.`);
      assert(m.chrome.toolbarButtonRadius === "6px", `${scheme}: control radius must be 6px, got ${m.chrome.toolbarButtonRadius}.`);
      assert(m.chrome.toolbarHeight === 48, `${scheme}: the toolbar must be 48px, got ${m.chrome.toolbarHeight}.`);
      assert(m.chrome.toolbarBorderBottomWidth === "1px", `${scheme}: the toolbar must sit on a 1px hairline, got ${m.chrome.toolbarBorderBottomWidth}.`);
      assert(m.menu.menuRadius === "10px", `${scheme}: menu radius must be 10px, got ${m.menu.menuRadius}.`);
      assert(m.menu.menuPadding === "6px", `${scheme}: menu container padding must be 6px, got ${m.menu.menuPadding}.`);
      assert(m.menu.itemHeight >= 32, `${scheme}: menu items must be at least 32px, got ${m.menu.itemHeight}.`);
      assert(m.menu.itemRadius === "6px", `${scheme}: menu item radius must be 6px, got ${m.menu.itemRadius}.`);
      assert(m.menu.menuShadowLayers >= 3, `${scheme}: menus must use the three-layer elevation-3 shadow, got ${m.menu.menuShadowLayers}.`);
      assert(m.smallestFontSize >= 11, `${scheme}: nothing may render below 11px, got ${m.smallestFontSize}px.`);
    }

    const unexpected = consoleErrors.filter(
      (message) => message !== "Failed to load resource: the server responded with a status of 404 (Not Found)"
    );
    assert(unexpected.length === 0, `Browser console errors:\n${unexpected.join("\n")}`);

    await writeFile(
      `${visualDir}/measurements.json`,
      `${JSON.stringify({ consoleErrors: unexpected, demoUrl, measurements, screenshots: captured, status: "passed" }, null, 2)}\n`
    );
    console.log(`visual-check-mme0102: ${captured} screenshots captured; every benchmark measurement met.`);
  } finally {
    await browser.close();
  }
}

await main();
