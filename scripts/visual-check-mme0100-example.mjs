import { mkdir, writeFile } from "node:fs/promises";
import puppeteer from "puppeteer";
import { requireChromeExecutable } from "./chrome-helpers.mjs";
import { clearGeneratedArtifacts } from "./visual-artifacts.mjs";

// MME-0100: captures the registry-consumer example (Next.js) at desktop + mobile
// widths, proving the packaged @momentarise/md-theme stylesheet makes a consumer
// app render the reference editor (not unstyled browser defaults). Compare against
// docs/internal/visual-checks/MME-0100/demo-* — they should look like the same product.
const exampleUrl = process.env.MME_NEXT_APP_URL ?? "http://127.0.0.1:5179/";
const visualDir = "docs/internal/visual-checks/MME-0100/example";

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
    await new Promise((r) => setTimeout(r, 250));
    await page.screenshot({ path: `${visualDir}/example-1280.png`, type: "png" });

    // Prove the surfaces are actually themed by tokens (not browser defaults).
    const themed = await page.evaluate(() => {
      const btn = document.querySelector(".mode-button");
      const bg = btn ? getComputedStyle(btn).borderRadius : "";
      const shell = getComputedStyle(document.body).backgroundColor;
      return { modeButtonRadius: bg, bodyBg: shell };
    });
    assert(themed.modeButtonRadius && themed.modeButtonRadius !== "0px", `mode button must be themed (radius=${themed.modeButtonRadius}).`);

    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
    await new Promise((r) => setTimeout(r, 250));
    await page.screenshot({ path: `${visualDir}/example-390.png`, type: "png" });

    const unexpected = consoleErrors.filter((m) => m !== "Failed to load resource: the server responded with a status of 404 (Not Found)");
    assert(unexpected.length === 0, `console errors:\n${unexpected.join("\n")}`);
    await writeFile(`${visualDir}/result.json`, `${JSON.stringify({ exampleUrl, themed, consoleErrors: unexpected, status: "passed" }, null, 2)}\n`);
    console.log("visual-check-mme0100-example: captured, surfaces themed.");
  } finally {
    await browser.close();
  }
}
await main();
