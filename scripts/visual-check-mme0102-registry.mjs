import { mkdir, writeFile } from "node:fs/promises";
import puppeteer from "puppeteer";
import { requireChromeExecutable } from "./chrome-helpers.mjs";

/**
 * MME-0102 registry-parity proof.
 *
 * Runs against examples/next-app installed **purely from the npm registry** (no
 * workspace overlays), and proves that what a stranger gets by running
 * `npm install` is the redesigned, styled editor with working rich mode:
 *
 *   1. the packaged design system is actually applied (16px content on the 708px
 *      measure, 28px controls, ramp-derived surfaces — measured, not asserted
 *      from CSS text);
 *   2. rich mode mounts from the published md-react and the edit round-trips back
 *      into canonical Markdown.
 *
 * Start the example first (its node_modules must come from the registry):
 *   cd examples/next-app && npm install && npm run dev -- --hostname 127.0.0.1 --port 5179
 */

const exampleUrl = process.env.MME_NEXT_APP_URL ?? "http://127.0.0.1:5179/";
const visualDir = "docs/internal/visual-checks/MME-0102/registry";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
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
    await page.setViewport({ deviceScaleFactor: 1, height: 900, width: 1280 });
    await page.goto(exampleUrl, { waitUntil: "networkidle0" });
    await page.waitForSelector(".cm-editor", { timeout: 60_000 });

    // --- 1. the design system is really applied ---
    const chrome = await page.evaluate(() => {
      const read = (selector, property) => {
        const element = document.querySelector(selector);
        return element ? getComputedStyle(element)[property] : null;
      };
      const modeButton = document.querySelector(".mode-button, .mode-switch-label");
      return {
        bodyBg: getComputedStyle(document.body).backgroundColor,
        controlHeight: modeButton ? Math.round(modeButton.getBoundingClientRect().height) : null,
        controlRadius: modeButton ? getComputedStyle(modeButton).borderRadius : null,
        sourceFontFamily: read(".cm-scroller", "fontFamily"),
        tokenAccent: getComputedStyle(document.documentElement).getPropertyValue("--mme-color-accent").trim(),
        tokenContentSize: getComputedStyle(document.documentElement).getPropertyValue("--mme-font-size-content").trim(),
        tokenMeasure: getComputedStyle(document.documentElement).getPropertyValue("--mme-content-measure").trim(),
        tokenNeutral12: getComputedStyle(document.documentElement).getPropertyValue("--mme-neutral-12").trim()
      };
    });

    assert(chrome.tokenContentSize === "16px", `registry theme must set --mme-font-size-content: 16px, got "${chrome.tokenContentSize}".`);
    assert(chrome.tokenMeasure === "708px", `registry theme must set --mme-content-measure: 708px, got "${chrome.tokenMeasure}".`);
    assert(chrome.tokenNeutral12, "registry theme must expose the neutral ramp (--mme-neutral-12 missing) — the stylesheet is not the MME-0102 one.");
    assert(chrome.tokenAccent, "registry theme must resolve --mme-color-accent.");
    assert(chrome.controlHeight === 28, `registry chrome controls must be 28px, got ${chrome.controlHeight}.`);
    assert(chrome.controlRadius === "6px", `registry chrome control radius must be 6px, got "${chrome.controlRadius}".`);
    assert(
      /mono|SF Mono|Menlo|Consolas/i.test(chrome.sourceFontFamily ?? ""),
      `registry source view must use the mono token, got "${chrome.sourceFontFamily}".`
    );

    await page.screenshot({ path: `${visualDir}/registry-source-1280.png`, type: "png" });

    // --- 2. rich mode mounts from the published binding and round-trips ---
    const richButton = await page.evaluateHandle(() =>
      [...document.querySelectorAll("button")].find((button) => /rich/i.test(button.textContent ?? ""))
    );
    assert(richButton.asElement(), "the registry example must offer a Rich mode control.");
    await richButton.asElement().click();
    await page.waitForSelector(".ProseMirror", { timeout: 30_000 });

    const content = await page.evaluate(() => {
      const pm = document.querySelector(".ProseMirror");
      const style = getComputedStyle(pm);
      return {
        fontSize: style.fontSize,
        lineHeightRatio: Number((Number.parseFloat(style.lineHeight) / Number.parseFloat(style.fontSize)).toFixed(2)),
        width: Math.round(pm.getBoundingClientRect().width)
      };
    });
    assert(content.fontSize === "16px", `registry rich content must render at 16px, got ${content.fontSize}.`);
    assert(content.lineHeightRatio === 1.65, `registry rich content line-height must be 1.65, got ${content.lineHeightRatio}.`);
    assert(content.width <= 708, `registry rich content must respect the 708px measure, got ${content.width}.`);

    await page.screenshot({ path: `${visualDir}/registry-rich-1280.png`, type: "png" });

    // Type into the rich surface, switch back to source, and prove the edit survives as Markdown.
    const marker = "Registry parity proof.";
    await page.click(".ProseMirror");
    await page.keyboard.type(marker);
    await page.waitForFunction(
      (needle) => document.querySelector(".ProseMirror")?.textContent?.includes(needle),
      { timeout: 15_000 },
      marker
    );

    const sourceButton = await page.evaluateHandle(() =>
      [...document.querySelectorAll("button")].find((button) => /source/i.test(button.textContent ?? ""))
    );
    assert(sourceButton.asElement(), "the registry example must offer a Source mode control.");
    await sourceButton.asElement().click();
    await page.waitForSelector(".cm-editor", { timeout: 30_000 });
    const sourceText = await page.evaluate(() => document.querySelector(".cm-content")?.textContent ?? "");
    assert(
      sourceText.includes(marker),
      "the rich-mode edit must round-trip into the Markdown source (registry md-react + md-rich-prosemirror)."
    );

    await page.screenshot({ path: `${visualDir}/registry-source-after-rich-edit.png`, type: "png" });

    const unexpected = consoleErrors.filter(
      (message) => message !== "Failed to load resource: the server responded with a status of 404 (Not Found)"
    );
    assert(unexpected.length === 0, `Browser console errors:\n${unexpected.join("\n")}`);

    await writeFile(
      `${visualDir}/result.json`,
      `${JSON.stringify({ chrome, consoleErrors: unexpected, content, exampleUrl, install: "registry-only (no workspace overlays)", roundTripped: true, status: "passed" }, null, 2)}\n`
    );
    console.log("visual-check-mme0102-registry: registry-only install renders the styled editor; rich mode round-trips.");
  } finally {
    await browser.close();
  }
}

await main();
