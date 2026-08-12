import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { requireChromeExecutable } from "./chrome-helpers.mjs";
import { assertFootnoteMembership } from "./visual-footnote-membership.mjs";

const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5174/";
const visualDir = "docs/internal/visual-checks/MME-0071";
const port = 21000 + Math.floor(Math.random() * 500);
const userDataDir = `/tmp/mme-visual-0071-${Date.now()}`;

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
  const source = await readFile("fixtures/035-inline-html-footnote-editing/input.md", "utf8");
  const editedSource = source.replace('data-key="cmd"', 'data-key="meta"');
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

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.loadWritableMarkdownFileForTest("inline-html-footnotes.md", ${JSON.stringify(source)})`);
    await evaluate(cdp, 'window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich")');
    await waitFor(cdp, `document.querySelectorAll('[data-testid="rich-editor-host"] [data-mme-raw-html-inline="true"]').length === 14`, "semantic inline-HTML footnotes");
    const mounted = await evaluate(cdp, `(() => {
      const editor = document.querySelector('[data-testid="rich-editor-host"] .ProseMirror');
      const definition = (identifier) => editor?.querySelector('[data-mme-footnote-definition="true"][data-mme-footnote-identifier="' + identifier + '"]');
      const top = definition('inline-top');
      const ordered = definition('inline-list');
      const hostile = definition('inline-hostile');
      const wrappers = Array.from(editor?.querySelectorAll('[data-mme-raw-html-inline="true"]') ?? []);
      return {
        /*
         * MME-0116: this counted matches across the whole editor, and the blanket
         * [style] term matched MME-0087's block-affordance widgets, which set an
         * inline top/left on every atom block — 8 false positives, none of them
         * payload. Narrowing the selector would have weakened the security check
         * it exists to be; excluding ProseMirror's own decoration widgets keeps
         * it editor-wide, so raw HTML that escapes its wrapper and becomes live
         * anywhere in the document is still caught.
         */
        activePayloadDom: [...(editor?.querySelectorAll('script, kbd, img, x-status, mark, i, [onclick], [onerror], [style], [src]') ?? [])]
          .filter((element) => element.closest('.ProseMirror-widget') === null).length,
        buttons: editor?.querySelectorAll('[data-todo-toggle]').length ?? 0,
        callouts: editor?.querySelectorAll('[data-mme-callout="true"]').length ?? 0,
        definitions: editor?.querySelectorAll('[data-mme-footnote-definition="true"]').length ?? 0,
        fallbacks: editor?.querySelectorAll('[data-mme-preserved-footnote="true"]').length ?? 0,
        htmlBlocks: editor?.querySelectorAll('[data-mme-raw-html-block="true"]').length ?? 0,
        htmlInline: wrappers.length,
        orderedStart: ordered?.querySelector('ol')?.getAttribute('start') ?? null,
        quotes: editor?.querySelectorAll('blockquote').length ?? 0,
        topText: top?.textContent ?? null,
        hostileText: hostile?.textContent ?? null,
        wrappersLabelled: wrappers.every((wrapper) => wrapper.getAttribute('aria-label') === 'Raw HTML source')
      };
    })()`);
    assert(
      mounted.activePayloadDom === 0 &&
      mounted.buttons === 2 &&
      mounted.callouts === 1 &&
      mounted.htmlBlocks === 1 &&
      mounted.htmlInline === 14 &&
      mounted.quotes === 2 &&
      mounted.wrappersLabelled &&
      mounted.topText.includes('<kbd data-key="cmd">') &&
      mounted.hostileText.includes("<script>") &&
      mounted.hostileText.includes("onerror=") &&
      mounted.orderedStart === "3",
      `Inline-HTML mount incomplete: ${JSON.stringify(mounted)}`
    );
    /*
     * MME-0116: `definitions === 8` and `fallbacks === 9` are true today, and
     * both are exactly the frozen document-wide totals that put the other twelve
     * footnote gates in quarantine — MME-0105 is the next issue that would break
     * them. Named identities replace them here for the same reason, before they
     * rot rather than after.
     */
    await assertFootnoteMembership(evaluate, cdp, {
      notPreserved: ["[^inline-top]:", "[^inline-list]:", "[^inline-hostile]:", "[^block-compatible]:"],
      preserved: [
        "[^wrapped-strong]:",
        "[^multiline-html]: Multiline inline HTML stays source",
        "[^table-html]: Table-cell inline HTML stays source",
        "[^nested-container]: Container definition stays so"
      ],
      references: 7,
      semantic: [
        "inline-top",
        "inline-multi",
        "inline-list",
        "inline-task",
        "inline-quote",
        "inline-callout",
        "inline-hostile",
        "block-compatible"
      ]
    });
    assert(await evaluate(cdp, `(() => {
      const html = document.querySelector('[data-testid="rich-editor-host"] .ProseMirror')?.innerHTML ?? '';
      return !html.includes('blockSources') && !html.includes('blockFingerprints') && globalThis.__MME_INLINE_HTML_RAN__ !== true;
    })()`), "Source metadata leaked or inline HTML became active DOM.");
    assert(await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === ${JSON.stringify(source)}`), "Untouched Rich mount changed source bytes.");
    await evaluate(cdp, `document.querySelector('[data-mme-footnote-identifier="inline-top"]')?.scrollIntoView({ block: "center" })`);
    await wait(150);
    await screenshot(cdp, "footnote-inline-html-rich-desktop.png");

    await evaluate(cdp, 'window.__MME_DEMO_VISUAL_CHECK__.selectRichTextForTest(\'data-key="cmd"\')');
    await evaluate(cdp, 'window.__MME_DEMO_VISUAL_CHECK__.typeRichTextForTest(\'data-key="meta"\')');
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === ${JSON.stringify(editedSource)}`, "inline-HTML tag edit");
    await pressUndo(cdp);
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === ${JSON.stringify(source)}`, "inline-HTML undo");
    await pressUndo(cdp, true);
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === ${JSON.stringify(editedSource)}`, "inline-HTML redo");
    const editedDom = await evaluate(cdp, `(() => {
      const definition = document.querySelector('[data-mme-footnote-definition="true"][data-mme-footnote-identifier="inline-top"]');
      return {
        text: definition?.textContent ?? null,
        wrappers: Array.from(definition?.querySelectorAll('[data-mme-raw-html-inline="true"]') ?? []).map((element) => element.textContent)
      };
    })()`);
    assert(
      editedDom.wrappers.some((text) => text?.includes('data-key="meta"')),
      `Inline-HTML source text did not update in editor DOM: ${JSON.stringify(editedDom)}`
    );
    await screenshot(cdp, "footnote-inline-html-edited-desktop.png");

    await evaluate(cdp, 'window.__MME_DEMO_VISUAL_CHECK__.memorySave("button")');
    await waitFor(cdp, 'window.__MME_DEMO_VISUAL_CHECK__.getSaveState().status === "saved"', "saved state");
    assert(await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getTestDiskContent() === ${JSON.stringify(editedSource)}`), "Saved content differs from edited Markdown.");
    await screenshot(cdp, "footnote-inline-html-saved-desktop.png");

    assert(await evaluate(cdp, `(() => {
      const fallbacks = Array.from(document.querySelectorAll('[data-mme-preserved-footnote="true"]'));
      const wrapped = fallbacks.find((element) => element.textContent?.includes('[^wrapped-strong]:'));
      const multiline = fallbacks.find((element) => element.textContent?.includes('[^multiline-html]:'));
      const table = fallbacks.find((element) => element.textContent?.includes('[^table-html]:'));
      return wrapped?.getAttribute('aria-label') === 'Preserved Markdown footnote. Edit in Source mode.' && Boolean(multiline && table);
    })()`), "Inline-HTML fallback was not explicit and accessible.");
    await evaluate(cdp, `Array.from(document.querySelectorAll('[data-mme-preserved-footnote="true"]')).find((element) => element.textContent?.includes('[^wrapped-strong]:'))?.scrollIntoView({ block: "center" })`);
    await wait(150);
    await screenshot(cdp, "footnote-inline-html-unsupported-desktop.png");

    await cdp.send("Emulation.setDeviceMetricsOverride", { deviceScaleFactor: 1, height: 844, mobile: true, width: 390 });
    await wait(250);
    const constrained = await evaluate(cdp, `(() => {
      const host = document.querySelector('[data-testid="rich-editor-host"]');
      const definitions = Array.from(host?.querySelectorAll('[data-mme-footnote-definition="true"]') ?? []);
      const htmlInline = Array.from(host?.querySelectorAll('[data-mme-raw-html-inline="true"]') ?? []);
      const fallback = host?.querySelector('[data-mme-preserved-footnote="true"]');
      const h = host?.getBoundingClientRect();
      const f = fallback?.getBoundingClientRect();
      return {
        contained: Boolean(
          h && f && definitions.length === 8 && htmlInline.length === 14 &&
          f.width > 0 && f.height > 0 && f.right <= h.right + 1 &&
          definitions.every((definition) => definition.getBoundingClientRect().right <= h.right + 1) &&
          htmlInline.every((inline) => inline.getBoundingClientRect().right <= h.right + 1)
        ),
        noPageOverflow: document.documentElement.scrollWidth <= window.innerWidth + 1
      };
    })()`);
    assert(constrained.contained, "Inline-HTML footnote content overflowed the constrained editor.");
    assert(constrained.noPageOverflow, "Inline-HTML footnote caused page-level overflow.");
    await screenshot(cdp, "footnote-inline-html-constrained.png");

    await cdp.send("Emulation.clearDeviceMetricsOverride");
    await evaluate(cdp, 'window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("source")');
    await waitFor(cdp, 'window.__MME_DEMO_VISUAL_CHECK__.getEditorMode() === "source"', "Source mode");
    assert(await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === ${JSON.stringify(editedSource)}`), "Source mode lost edited Markdown.");
    await screenshot(cdp, "footnote-inline-html-source-desktop.png");
    cdp.close();
    console.log(`MME-0071 runtime artifacts saved to ${visualDir}`);
  } finally {
    if (chrome.exitCode === null && chrome.signalCode === null) chrome.kill("SIGTERM");
    await Promise.race([chromeExit, wait(2000)]);
    if (chrome.exitCode === null && chrome.signalCode === null) chrome.kill("SIGKILL");
    await Promise.race([chromeExit, wait(2000)]);
    await rm(userDataDir, { force: true, maxRetries: 3, recursive: true, retryDelay: 100 });
  }
}

await main();
