import { mkdir, writeFile } from "node:fs/promises";
import puppeteer from "puppeteer";
import { requireChromeExecutable } from "./chrome-helpers.mjs";
import { clearGeneratedArtifacts } from "./visual-artifacts.mjs";

// MME-0101: proves the published-shape React binding mounts a real rich editing surface in the
// Next.js example — click Rich, type into ProseMirror, switch back to Source, and confirm the edit
// round-tripped into canonical Markdown. Also confirms the binding offers no inert Live Preview.
const exampleUrl = process.env.MME_NEXT_APP_URL ?? "http://127.0.0.1:5179/";
const visualDir = "docs/internal/visual-checks/MME-0101";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  /*
   * MME-0114: clear only what this gate regenerates. The previous
   * `rm(visualDir, { recursive: true })` also deleted the committed README.md
   * that Gate 0.8 requires whenever the gate failed after clearing.
   */
  await clearGeneratedArtifacts(visualDir);
  await mkdir(visualDir, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: requireChromeExecutable(),
    headless: true,
    args: ["--disable-gpu", "--no-first-run", "--no-default-browser-check"]
  });
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => consoleErrors.push(e.message));
  try {
    await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
    await page.goto(exampleUrl, { waitUntil: "networkidle0" });
    await page.waitForSelector(".cm-editor");

    // No inert control: the binding offers only source + rich.
    const modes = await page.$$eval("[data-mme-react-mode] [data-editor-mode]", (els) => els.map((e) => e.dataset.editorMode));
    assert(modes.includes("source") && modes.includes("rich"), `mode control must offer source and rich (got ${modes.join(",")}).`);
    assert(!modes.includes("live-preview"), "mode control must not offer an inert live-preview button.");

    // Click Rich -> rich surface mounts (dynamically imported).
    await page.$$eval("[data-mme-react-mode] [data-editor-mode]", (els) => {
      els.find((e) => e.dataset.editorMode === "rich")?.click();
    });
    await page.waitForSelector(".ProseMirror");
    assert(await page.$(".cm-editor") === null, "source view must unmount when rich mounts.");
    await new Promise((r) => setTimeout(r, 200));
    await page.screenshot({ path: `${visualDir}/rich-mode.png`, type: "png" });

    // Type into the rich view.
    const marker = " Edited in rich mode via ProseMirror.";
    await page.focus(".ProseMirror");
    await page.evaluate(() => {
      const pm = document.querySelector(".ProseMirror");
      const sel = window.getSelection();
      const range = document.createRange();
      const firstPara = pm.querySelector("p") ?? pm.firstElementChild;
      range.selectNodeContents(firstPara);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    });
    await page.keyboard.type(marker);

    // Switch back to Source and confirm the edit round-tripped into canonical Markdown.
    await page.$$eval("[data-mme-react-mode] [data-editor-mode]", (els) => {
      els.find((e) => e.dataset.editorMode === "source")?.click();
    });
    await page.waitForSelector(".cm-editor");
    assert(await page.$(".ProseMirror") === null, "rich view must unmount when switching back to source.");
    await new Promise((r) => setTimeout(r, 150));
    const sourceText = await page.$eval(".cm-content", (el) => el.textContent ?? "");
    assert(sourceText.includes("Edited in rich mode via ProseMirror."), `rich edit must round-trip into Markdown source (source was: ${sourceText.slice(0, 200)}).`);
    await page.screenshot({ path: `${visualDir}/source-after-rich-edit.png`, type: "png" });

    const unexpected = consoleErrors.filter((m) => m !== "Failed to load resource: the server responded with a status of 404 (Not Found)");
    assert(unexpected.length === 0, `console errors:\n${unexpected.join("\n")}`);
    await writeFile(`${visualDir}/result.json`, `${JSON.stringify({ exampleUrl, modesOffered: modes, roundTripped: true, consoleErrors: unexpected, status: "passed" }, null, 2)}\n`);
    console.log("visual-check-mme0101: rich mounts, edits round-trip to Markdown, no inert live-preview.");
  } finally {
    await browser.close();
  }
}
await main();
