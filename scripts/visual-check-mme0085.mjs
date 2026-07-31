import { mkdir, rm, writeFile } from "node:fs/promises";
import puppeteer from "puppeteer";
import { requireChromeExecutable } from "./chrome-helpers.mjs";

const exampleUrl = process.env.MME_NEXT_APP_URL ?? "http://127.0.0.1:5179/";
const visualDir = "docs/internal/visual-checks/MME-0085";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function screenshot(page, fileName) {
  await page.screenshot({ path: `${visualDir}/${fileName}`, type: "png" });
}

async function statusText(page) {
  return page.$eval('[data-testid="mme-example-status"]', (el) => el.textContent ?? "");
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
    await page.setViewport({ width: 900, height: 640, deviceScaleFactor: 1 });

    // This navigation itself is the StrictMode-survival proof: Next.js dev mode double-invokes
    // client component effects (mount -> cleanup -> remount) before the page settles. If MME-0081's
    // destroyedRef guard did not hold under React 19 (the workspace's react-strictmode-lifecycle
    // test only proved React 18.3.1), the editor would render dead/blank or throw on first edit.
    await page.goto(exampleUrl, { waitUntil: "networkidle0" });
    await page.waitForSelector(".cm-editor");
    await screenshot(page, "01-mounted-after-strictmode-remount.png");

    const initialStatus = await statusText(page);
    assert(initialStatus.includes("mode: source"), `expected source mode, got: ${initialStatus}`);
    assert(initialStatus.includes("save status: saved"), `expected saved status, got: ${initialStatus}`);
    assert(initialStatus.includes("target: memory-only"), `expected memory-only target, got: ${initialStatus}`);

    const initialContent = await page.$eval(".cm-content", (el) => el.textContent ?? "");
    assert(initialContent.includes("Momentarise Markdown Editor"), "initial document content missing.");

    // Real keystroke path: click into CodeMirror and type, proving the mounted editor
    // (post-StrictMode-remount) still accepts input under React 19.
    await page.click(".cm-content");
    await page.keyboard.press("End");
    const editedMarker = "edited live via React 19 StrictMode in Next.js";
    await page.keyboard.type(` ${editedMarker}`);

    await page.waitForFunction(
      (marker) => document.querySelector(".cm-content")?.textContent?.includes(marker) ?? false,
      {},
      editedMarker
    );
    await screenshot(page, "02-edited-after-strictmode-remount.png");

    const editedContent = await page.$eval(".cm-content", (el) => el.textContent ?? "");
    assert(editedContent.includes(editedMarker), "typed edit did not apply to the live post-remount session.");

    const statusAfterEdit = await statusText(page);
    assert(statusAfterEdit.includes("save status: dirty"), `expected dirty status after editing, got: ${statusAfterEdit}`);
    assert(statusAfterEdit !== initialStatus, "status readout must change after a real edit, proving live session tracking.");

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
          exampleUrl,
          ignoredResponses: failedResponses,
          screenshots: 2,
          statusAfterEdit,
          statusBeforeEdit: initialStatus,
          status: "passed"
        },
        null,
        2
      )}\n`
    );
    console.log("visual-check-mme0085: all assertions passed.");
  } finally {
    await browser.close();
  }
}

await main();
