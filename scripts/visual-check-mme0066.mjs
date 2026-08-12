import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { requireChromeExecutable } from "./chrome-helpers.mjs";
import { assertFootnoteMembership } from "./visual-footnote-membership.mjs";

const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5174/";
const visualDir = "docs/internal/visual-checks/MME-0066";
const port = 19500 + Math.floor(Math.random() * 500);
const userDataDir = `/tmp/mme-visual-0066-${Date.now()}`;

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
  const source = await readFile("fixtures/030-fenced-code-footnote-editing/input.md", "utf8");
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

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.loadWritableMarkdownFileForTest("fenced-code-footnotes.md", ${JSON.stringify(source)})`);
    await evaluate(cdp, 'window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich")');
    await waitFor(cdp, `document.querySelector('[data-testid="rich-editor-host"] .ProseMirror')?.textContent?.includes("const editList = 1;")`, "fenced-code Rich content");
    const mounted = await evaluate(cdp, `(() => {
      const editor = document.querySelector('[data-testid="rich-editor-host"] .ProseMirror');
      const top = editor?.querySelector('[data-mme-footnote-definition="true"][data-mme-footnote-identifier="code-top"]');
      const ordered = editor?.querySelector('[data-mme-footnote-definition="true"][data-mme-footnote-identifier="code-list"]');
      const task = editor?.querySelector('[data-mme-footnote-definition="true"][data-mme-footnote-identifier="code-task"]');
      const buttons = Array.from(editor?.querySelectorAll('[data-todo-toggle]') ?? []);
      return {
        buttons: buttons.length,
        definitions: editor?.querySelectorAll('[data-mme-footnote-definition="true"]').length ?? 0,
        fallbacks: editor?.querySelectorAll('[data-mme-preserved-footnote="true"]').length ?? 0,
        orderedStart: ordered?.querySelector('ol')?.getAttribute('start') ?? null,
        roles: editor?.querySelectorAll('[data-mme-footnote-definition="true"][role="doc-footnote"]').length ?? 0,
        topLanguage: top?.querySelector('pre code')?.className ?? '',
        orderedLanguage: ordered?.querySelector('ol pre code')?.className ?? '',
        taskLanguage: task?.querySelector('[data-type="todo-item"] pre code')?.className ?? '',
        scriptElements: editor?.querySelectorAll('script').length ?? 0
      };
    })()`);
    /*
     * MME-0116: `definitions === 3`, `roles === 3` and `fallbacks >= 7` were
     * document-wide totals frozen at MME-0066's authoring date; MME-0067 through
     * MME-0071 absorbed fixture 030's code definitions, leaving 7 definitions and
     * 3 fallbacks. `roles` becomes a relationship — every semantic definition
     * carries its ARIA role — which is the contract the number stood for. The
     * language attributes below are what MME-0066 shipped and stay exact.
     */
    assert(
      mounted.roles === mounted.definitions &&
      mounted.buttons === 2 &&
      mounted.topLanguage === "language-ts" &&
      mounted.orderedLanguage === "language-js" &&
      mounted.taskLanguage === "language-bash" &&
      mounted.orderedStart === "3" &&
      mounted.scriptElements === 0 &&
      await evaluate(cdp, "window.__MME_CODE_RAN__ !== true"),
      `Fenced-code mount incomplete: ${JSON.stringify(mounted)}`
    );
    await assertFootnoteMembership(evaluate, cdp, {
      notPreserved: ["[^code-top]:", "[^code-list]:", "[^code-task]:", "[^table-child]:"],
      preserved: [
        "[^quote-code]: Quote-contained code stays source-only.",
        "[^mixed-containers]: Code plus nested list stays source-only.",
        "[^nested-container]: Container definition stays source-only."
      ],
      references: 3,
      semantic: ["code-top", "code-list", "code-task", "indented-code", "table-child", "callout-child", "raw-child"]
    });
    assert(await evaluate(cdp, `(() => {
      const html = document.querySelector('[data-testid="rich-editor-host"] .ProseMirror')?.innerHTML ?? '';
      return !html.includes('blockSources') && !html.includes('blockFingerprints') && !document.querySelector('[onclick="boom()"]');
    })()`), "Source metadata leaked or fallback HTML became active DOM.");
    assert(await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === ${JSON.stringify(source)}`), "Untouched Rich mount changed source bytes.");
    await screenshot(cdp, "footnote-fenced-code-rich-desktop.png");

    await evaluate(cdp, 'window.__MME_DEMO_VISUAL_CHECK__.selectRichTextForTest("const editList = 1;")');
    await evaluate(cdp, 'window.__MME_DEMO_VISUAL_CHECK__.typeRichTextForTest("const editedList = 2;")');
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === ${JSON.stringify(editedSource)}`, "nested code edit");
    await pressUndo(cdp);
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === ${JSON.stringify(source)}`, "code undo");
    await pressUndo(cdp, true);
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === ${JSON.stringify(editedSource)}`, "code redo");
    await screenshot(cdp, "footnote-fenced-code-edited-desktop.png");

    await evaluate(cdp, 'window.__MME_DEMO_VISUAL_CHECK__.memorySave("button")');
    await waitFor(cdp, 'window.__MME_DEMO_VISUAL_CHECK__.getSaveState().status === "saved"', "saved state");
    assert(await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getTestDiskContent() === ${JSON.stringify(editedSource)}`), "Saved content differs from Source Markdown.");
    await screenshot(cdp, "footnote-fenced-code-saved-desktop.png");

    /*
     * MME-0116: this required `[^indented-code]` to be a preserved fallback.
     * MME-0067 shipped indented-code definitions, so it mounts semantically now
     * — the membership assertion above lists it under `semantic`. The property
     * being checked is that a fallback announces itself to assistive technology,
     * so it moves to `[^mixed-containers]`, which genuinely remains one.
     */
    assert(await evaluate(cdp, `(() => {
      const fallbacks = [...document.querySelectorAll('[data-mme-preserved-footnote="true"]')];
      const mixed = fallbacks.find((element) => element.textContent?.includes('[^mixed-containers]:'));
      return mixed?.getAttribute('aria-label') === 'Preserved Markdown footnote. Edit in Source mode.';
    })()`), "Mixed-container fallback was not explicit and accessible.");
    await evaluate(cdp, `Array.from(document.querySelectorAll('[data-mme-preserved-footnote="true"]')).find((element) => element.textContent?.includes('[^indented-code]:'))?.scrollIntoView({ block: "center" })`);
    await wait(150);
    await screenshot(cdp, "footnote-fenced-code-unsupported-desktop.png");

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
       * MME-0116: "details.length === 3" and "codeBlocks.length === 3" were the
       * same document-wide totals as above. The property is that nothing
       * overflows the host at 390; floors keep it from passing on an empty set.
       */
      return Boolean(
        h && f && details.length >= 3 && codeBlocks.length >= 3 &&
        f.width > 0 && f.height > 0 && f.right <= h.right + 1 &&
        details.every((detail) => detail.getBoundingClientRect().right <= h.right + 1) &&
        codeBlocks.every((block) => block.getBoundingClientRect().right <= h.right + 1)
      );
    })()`);
    assert(constrained, "Fenced-code footnote content overflowed the constrained editor.");
    await screenshot(cdp, "footnote-fenced-code-constrained.png");

    await cdp.send("Emulation.clearDeviceMetricsOverride");
    await evaluate(cdp, 'window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("source")');
    await waitFor(cdp, 'window.__MME_DEMO_VISUAL_CHECK__.getEditorMode() === "source"', "Source mode");
    assert(await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === ${JSON.stringify(editedSource)}`), "Source mode lost edited Markdown.");
    await screenshot(cdp, "footnote-fenced-code-source-desktop.png");
    cdp.close();
    console.log(`MME-0066 runtime artifacts saved to ${visualDir}`);
  } finally {
    if (chrome.exitCode === null && chrome.signalCode === null) chrome.kill("SIGTERM");
    await Promise.race([chromeExit, wait(2000)]);
    if (chrome.exitCode === null && chrome.signalCode === null) chrome.kill("SIGKILL");
    await Promise.race([chromeExit, wait(2000)]);
    await rm(userDataDir, { force: true, maxRetries: 3, recursive: true, retryDelay: 100 });
  }
}

await main();
