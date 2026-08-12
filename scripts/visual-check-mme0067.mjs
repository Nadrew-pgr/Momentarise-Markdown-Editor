import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { requireChromeExecutable } from "./chrome-helpers.mjs";
import { assertFootnoteMembership } from "./visual-footnote-membership.mjs";

const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5174/";
const visualDir = "docs/internal/visual-checks/MME-0067";
const port = 20000 + Math.floor(Math.random() * 500);
const userDataDir = `/tmp/mme-visual-0067-${Date.now()}`;

class CdpClient {
  static async connect(url) {
    const socket = new WebSocket(url);
    const client = new CdpClient(socket);
    await new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", reject, { once: true });
    });
    return client;
  }

  constructor(socket) {
    this.handlers = new Map();
    this.nextId = 1;
    this.pending = new Map();
    this.socket = socket;
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const pending = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result ?? {});
        return;
      }
      const handlers = this.handlers.get(message.method);
      if (handlers?.length) handlers.shift()(message.params ?? {});
    });
  }

  close() {
    this.socket.close();
  }

  once(method) {
    return new Promise((resolve) => {
      const handlers = this.handlers.get(method) ?? [];
      handlers.push(resolve);
      this.handlers.set(method, handlers);
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { reject, resolve }));
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForJson(url, chrome, stderr) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 30000) {
    if (chrome.exitCode !== null || chrome.signalCode !== null) {
      throw new Error(`Chrome exited before CDP became available.\n${stderr()}`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch {}
    await wait(100);
  }
  throw new Error(`Timed out waiting for ${url}.`);
}

async function evaluate(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", {
    awaitPromise: true,
    expression,
    returnByValue: true
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  }
  return result.result.value;
}

async function waitFor(cdp, expression, label) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 8000) {
    if (await evaluate(cdp, expression)) return;
    await wait(100);
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

async function screenshot(cdp, name) {
  const result = await cdp.send("Page.captureScreenshot", {
    captureBeyondViewport: false,
    format: "png",
    fromSurface: true
  });
  await writeFile(join(visualDir, name), Buffer.from(result.data, "base64"));
}

async function pressUndo(cdp, redo = false) {
  const modifiers = 4 | (redo ? 8 : 0);
  const params = {
    code: "KeyZ",
    key: "z",
    modifiers,
    nativeVirtualKeyCode: 90,
    windowsVirtualKeyCode: 90
  };
  await cdp.send("Input.dispatchKeyEvent", { ...params, type: "rawKeyDown" });
  await cdp.send("Input.dispatchKeyEvent", { ...params, type: "keyUp" });
}

async function main() {
  await mkdir(visualDir, { recursive: true });
  const source = await readFile("fixtures/031-indented-code-footnote-editing/input.md", "utf8");
  const editedSource = source.replace("const editList = 1;", "const editedList = 2;");
  const chrome = spawn(requireChromeExecutable(), [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    "--window-size=1360,900",
    "about:blank"
  ], { stdio: ["ignore", "ignore", "pipe"] });
  const chromeExit = new Promise((resolve) => chrome.once("exit", resolve));
  let stderr = "";
  chrome.stderr.on("data", (chunk) => { stderr += chunk.toString(); });

  try {
    const version = await waitForJson(`http://127.0.0.1:${port}/json/version`, chrome, () => stderr);
    const browser = await CdpClient.connect(version.webSocketDebuggerUrl);
    const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" });
    browser.close();
    const targets = await waitForJson(`http://127.0.0.1:${port}/json/list`, chrome, () => stderr);
    const target = targets.find((candidate) => candidate.id === targetId);
    assert(target?.webSocketDebuggerUrl, "Page target unavailable.");
    const cdp = await CdpClient.connect(target.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    const loaded = cdp.once("Page.loadEventFired");
    await cdp.send("Page.navigate", { url: demoUrl });
    await loaded;
    await waitFor(cdp, "Boolean(window.__MME_DEMO_VISUAL_CHECK__?.typeRichTextForTest)", "demo hooks");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.loadWritableMarkdownFileForTest("indented-code-footnotes.md", ${JSON.stringify(source)})`);
    await evaluate(cdp, 'window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich")');
    await waitFor(cdp, `document.querySelector('[data-testid="rich-editor-host"] .ProseMirror')?.textContent?.includes("const editList = 1;")`, "indented-code Rich content");
    const mounted = await evaluate(cdp, `(() => {
      const editor = document.querySelector('[data-testid="rich-editor-host"] .ProseMirror');
      const top = editor?.querySelector('[data-mme-footnote-definition="true"][data-mme-footnote-identifier="indent-top"]');
      const ordered = editor?.querySelector('[data-mme-footnote-definition="true"][data-mme-footnote-identifier="indent-list"]');
      const task = editor?.querySelector('[data-mme-footnote-definition="true"][data-mme-footnote-identifier="indent-task"]');
      const fenced = editor?.querySelector('[data-mme-footnote-definition="true"][data-mme-footnote-identifier="fenced-existing"]');
      const buttons = Array.from(editor?.querySelectorAll('[data-todo-toggle]') ?? []);
      return {
        buttons: buttons.length,
        definitions: editor?.querySelectorAll('[data-mme-footnote-definition="true"]').length ?? 0,
        fallbacks: editor?.querySelectorAll('[data-mme-preserved-footnote="true"]').length ?? 0,
        orderedStart: ordered?.querySelector('ol')?.getAttribute('start') ?? null,
        roles: editor?.querySelectorAll('[data-mme-footnote-definition="true"][role="doc-footnote"]').length ?? 0,
        codeBlocks: editor?.querySelectorAll('[data-mme-footnote-definition="true"] pre').length ?? 0,
        topLanguage: top?.querySelector('pre code')?.className ?? '',
        orderedLanguage: ordered?.querySelector('ol pre code')?.className ?? '',
        taskLanguage: task?.querySelector('[data-type="todo-item"] pre code')?.className ?? '',
        fencedLanguage: fenced?.querySelector('pre code')?.className ?? '',
        scriptElements: editor?.querySelectorAll('script').length ?? 0
      };
    })()`);
    /*
     * MME-0116: `definitions === 4`, `roles === 4`, `codeBlocks === 4` and
     * `fallbacks >= 6` were document-wide totals; MME-0068 through MME-0071
     * absorbed fixture 031's remaining definitions, so there are 7 definitions
     * and 3 fallbacks. `codeBlocks` keeps a floor because this gate is about
     * indented code specifically, and the per-definition language attributes
     * below — empty for indented, `language-js` for the fenced one — are the
     * distinction MME-0067 shipped.
     */
    assert(
      mounted.roles === mounted.definitions &&
      mounted.buttons === 2 &&
      mounted.codeBlocks >= 4 &&
      mounted.topLanguage === "" &&
      mounted.orderedLanguage === "" &&
      mounted.taskLanguage === "" &&
      mounted.fencedLanguage === "language-js" &&
      mounted.orderedStart === "3" &&
      mounted.scriptElements === 0 &&
      await evaluate(cdp, "window.__MME_INDENTED_CODE_RAN__ !== true"),
      `Indented-code mount incomplete: ${JSON.stringify(mounted)}`
    );
    await assertFootnoteMembership(evaluate, cdp, {
      notPreserved: ["[^indent-top]:", "[^indent-list]:", "[^indent-task]:", "[^fenced-existing]:"],
      preserved: [
        "[^quote-code]: Quote-contained code stays source-only.",
        "[^mixed-containers]: Indented code plus nested list stays source-only.",
        "[^nested-container]: Container definition stays source-only."
      ],
      references: 4,
      semantic: ["indent-top", "indent-list", "indent-task", "fenced-existing", "table-child", "callout-child", "raw-child"]
    });
    assert(await evaluate(cdp, `(() => {
      const html = document.querySelector('[data-testid="rich-editor-host"] .ProseMirror')?.innerHTML ?? '';
      return !html.includes('blockSources') && !html.includes('blockFingerprints') && !document.querySelector('[onclick="boom()"]');
    })()`), "Source metadata leaked or fallback HTML became active DOM.");
    assert(await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === ${JSON.stringify(source)}`), "Untouched Rich mount changed source bytes.");
    await screenshot(cdp, "footnote-indented-code-rich-desktop.png");

    await evaluate(cdp, 'window.__MME_DEMO_VISUAL_CHECK__.selectRichTextForTest("const editList = 1;")');
    await evaluate(cdp, 'window.__MME_DEMO_VISUAL_CHECK__.typeRichTextForTest("const editedList = 2;")');
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === ${JSON.stringify(editedSource)}`, "nested indented-code edit");
    await pressUndo(cdp);
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === ${JSON.stringify(source)}`, "indented-code undo");
    await pressUndo(cdp, true);
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === ${JSON.stringify(editedSource)}`, "indented-code redo");
    assert(
      await evaluate(cdp, `document.querySelector('[data-testid="code-block-controls"]')?.hidden === true`),
      "Fence-only language/meta controls must stay hidden for indented code."
    );
    await screenshot(cdp, "footnote-indented-code-edited-desktop.png");

    await evaluate(cdp, 'window.__MME_DEMO_VISUAL_CHECK__.memorySave("button")');
    await waitFor(cdp, 'window.__MME_DEMO_VISUAL_CHECK__.getSaveState().status === "saved"', "saved state");
    assert(await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getTestDiskContent() === ${JSON.stringify(editedSource)}`), "Saved content differs from Source Markdown.");
    await screenshot(cdp, "footnote-indented-code-saved-desktop.png");

    assert(await evaluate(cdp, `(() => {
      const fallbacks = Array.from(document.querySelectorAll('[data-mme-preserved-footnote="true"]'));
      const quote = fallbacks.find((element) => element.textContent?.includes('[^quote-code]:'));
      const mixed = fallbacks.find((element) => element.textContent?.includes('[^mixed-containers]:'));
      return quote?.getAttribute('aria-label') === 'Preserved Markdown footnote. Edit in Source mode.' && Boolean(mixed);
    })()`), "Quote-contained or mixed-container fallback was not explicit and accessible.");
    await evaluate(cdp, `Array.from(document.querySelectorAll('[data-mme-preserved-footnote="true"]')).find((element) => element.textContent?.includes('[^quote-code]:'))?.scrollIntoView({ block: "center" })`);
    await wait(150);
    await screenshot(cdp, "footnote-indented-code-unsupported-desktop.png");

    await cdp.send("Emulation.setDeviceMetricsOverride", { deviceScaleFactor: 1, height: 844, mobile: true, width: 390 });
    await wait(250);
    const constrained = await evaluate(cdp, `(() => {
      const host = document.querySelector('[data-testid="rich-editor-host"]');
      const details = Array.from(host?.querySelectorAll('[data-mme-footnote-definition="true"]') ?? []);
      const codeBlocks = Array.from(host?.querySelectorAll('[data-mme-footnote-definition="true"] pre') ?? []);
      const fallback = host?.querySelector('[data-mme-preserved-footnote="true"]');
      const h = host?.getBoundingClientRect();
      const f = fallback?.getBoundingClientRect();
      /*
       * MME-0116: "details.length === 4" and "codeBlocks.length === 4" were the
       * same document-wide totals as above, now 7 and more. The property is that
       * nothing overflows the host at 390, which holds for whatever mounted;
       * floors keep the check from passing on an empty editor.
       */
      return Boolean(
        h && f && details.length >= 4 && codeBlocks.length >= 4 &&
        f.width > 0 && f.height > 0 && f.right <= h.right + 1 &&
        details.every((detail) => detail.getBoundingClientRect().right <= h.right + 1) &&
        codeBlocks.every((block) => block.getBoundingClientRect().right <= h.right + 1)
      );
    })()`);
    assert(constrained, "Indented-code footnote content overflowed the constrained editor.");
    await screenshot(cdp, "footnote-indented-code-constrained.png");

    await cdp.send("Emulation.clearDeviceMetricsOverride");
    await evaluate(cdp, 'window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("source")');
    await waitFor(cdp, 'window.__MME_DEMO_VISUAL_CHECK__.getEditorMode() === "source"', "Source mode");
    assert(await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === ${JSON.stringify(editedSource)}`), "Source mode lost edited Markdown.");
    await screenshot(cdp, "footnote-indented-code-source-desktop.png");
    cdp.close();
    console.log(`MME-0067 runtime artifacts saved to ${visualDir}`);
  } finally {
    if (chrome.exitCode === null && chrome.signalCode === null) chrome.kill("SIGTERM");
    await Promise.race([chromeExit, wait(2000)]);
    if (chrome.exitCode === null && chrome.signalCode === null) chrome.kill("SIGKILL");
    await Promise.race([chromeExit, wait(2000)]);
    await rm(userDataDir, { force: true, maxRetries: 3, recursive: true, retryDelay: 100 });
  }
}

await main();
