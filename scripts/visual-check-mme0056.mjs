import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { requireChromeExecutable } from "./chrome-helpers.mjs";

const chromePath = requireChromeExecutable();
const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5174/";
const visualDir = "docs/internal/visual-checks/MME-0056";
const port = 18400 + Math.floor(Math.random() * 500);
const userDataDir = `/tmp/mme-visual-0056-${Date.now()}`;

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
    this.events = new Map();
    this.nextId = 1;
    this.pending = new Map();
    this.socket = socket;
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const pending = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) {
          pending.reject(new Error(message.error.message));
        } else {
          pending.resolve(message.result ?? {});
        }
        return;
      }
      const handlers = this.events.get(message.method);
      if (handlers) {
        for (const handler of handlers.splice(0)) {
          handler(message.params ?? {});
        }
      }
    });
  }

  close() {
    this.socket.close();
  }

  once(method) {
    return new Promise((resolve) => {
      const handlers = this.events.get(method) ?? [];
      handlers.push(resolve);
      this.events.set(method, handlers);
    });
  }

  send(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { reject, resolve });
    });
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function evaluate(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", {
    awaitPromise: true,
    expression,
    returnByValue: true
  });
  if (result.exceptionDetails) {
    const description = result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? "unknown exception";
    throw new Error(`Runtime evaluation failed: ${expression}\n${description}`);
  }
  return result.result.value;
}

async function screenshot(cdp, filename) {
  const result = await cdp.send("Page.captureScreenshot", {
    captureBeyondViewport: false,
    format: "png",
    fromSurface: true
  });
  await writeFile(join(visualDir, filename), Buffer.from(result.data, "base64"));
}

async function pressKey(cdp, key, { metaKey = false, shiftKey = false } = {}) {
  const modifiers = (metaKey ? 4 : 0) | (shiftKey ? 8 : 0);
  const code = `Key${key.toUpperCase()}`;
  const virtualKeyCode = key.toUpperCase().charCodeAt(0);
  const params = {
    code,
    key,
    modifiers,
    nativeVirtualKeyCode: virtualKeyCode,
    windowsVirtualKeyCode: virtualKeyCode
  };
  await cdp.send("Input.dispatchKeyEvent", { ...params, type: "rawKeyDown" });
  await cdp.send("Input.dispatchKeyEvent", { ...params, type: "keyUp" });
}

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForJson(url, options = {}) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 30000) {
    const exitStatus = options.getExitStatus?.();
    if (exitStatus) {
      throw new Error(`Chrome exited before CDP became available (${exitStatus.code ?? exitStatus.signal}).\n${options.getStderr?.() ?? ""}`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) {
        return response.json();
      }
    } catch {}
    await wait(100);
  }
  throw new Error(`Timed out waiting for ${url}.`);
}

async function waitFor(cdp, expression, label) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 8000) {
    if (await evaluate(cdp, expression)) {
      return;
    }
    await wait(100);
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

async function main() {
  await mkdir(visualDir, { recursive: true });
  const source = await readFile("fixtures/022-simple-footnote-editing/input.md", "utf8");
  const chrome = spawn(
    chromePath,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-features=Translate,OptimizationHints",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
      "--window-size=1360,900",
      "about:blank"
    ],
    { stdio: ["ignore", "ignore", "pipe"] }
  );
  const chromeExit = new Promise((resolve) => chrome.once("exit", resolve));
  let stderr = "";
  chrome.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  try {
    const version = await waitForJson(`http://127.0.0.1:${port}/json/version`, {
      getExitStatus: () =>
        chrome.exitCode === null && chrome.signalCode === null
          ? null
          : { code: chrome.exitCode, signal: chrome.signalCode },
      getStderr: () => stderr
    });
    const browserCdp = await CdpClient.connect(version.webSocketDebuggerUrl);
    const { targetId } = await browserCdp.send("Target.createTarget", { url: "about:blank" });
    browserCdp.close();
    const targets = await waitForJson(`http://127.0.0.1:${port}/json/list`);
    const target = targets.find((candidate) => candidate.id === targetId);
    if (!target?.webSocketDebuggerUrl) {
      throw new Error("Could not find page target WebSocket URL.");
    }

    const cdp = await CdpClient.connect(target.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    const loadEvent = cdp.once("Page.loadEventFired");
    await cdp.send("Page.navigate", { url: demoUrl });
    await loadEvent;
    await waitFor(cdp, `Boolean(window.__MME_DEMO_VISUAL_CHECK__?.selectRichFootnoteDefinitionForTest)`, "demo footnote hook");

    await evaluate(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.loadWritableMarkdownFileForTest("rich-footnotes.md", ${JSON.stringify(source)})`
    );
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich")`);
    await waitFor(
      cdp,
      `(() => {
        const editor = document.querySelector('[data-testid="rich-editor-host"] .ProseMirror');
        return Boolean(
          editor?.querySelector('[data-mme-footnote-definition="true"]') &&
          editor.querySelectorAll('[data-mme-footnote-reference="true"]').length === 3 &&
          editor.querySelectorAll('[data-mme-preserved-footnote="true"]').length === 6
        );
      })()`,
      "semantic footnotes and preserved fallbacks"
    );
    assert(await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === ${JSON.stringify(source)}`), "Untouched rich mount must preserve footnote source bytes.");
    await screenshot(cdp, "footnote-editable-desktop.png");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.selectRichFootnoteDefinitionForTest("simple")`);
    await cdp.send("Input.insertText", { text: "Edited definition body" });
    await waitFor(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown().includes("[^simple]: Edited definition body")`,
      "definition edit"
    );
    assert(
      await evaluate(
        cdp,
        `getComputedStyle(document.querySelector('[data-mme-footnote-marker="true"]'), '::before').content.includes('[^simple]:')`
      ),
      "Definition marker must survive full-body browser replacement."
    );
    const editedMarkdown = await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown()`);
    assert(editedMarkdown.includes("[^complex]: Complex definition starts here.\n    Continued definition line stays source-only."), "Complex definition must remain exact.");
    assert(editedMarkdown.includes("[^multi]: First definition paragraph stays source-only.\n\n    Second definition paragraph stays source-only."), "Multi-block definition must remain exact.");
    assert(editedMarkdown.includes("[^duplicate]: First duplicate definition stays source-only."), "Duplicate definition must remain exact.");

    await pressKey(cdp, "z", { metaKey: true });
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === ${JSON.stringify(source)}`, "definition undo");
    await pressKey(cdp, "z", { metaKey: true, shiftKey: true });
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === ${JSON.stringify(editedMarkdown)}`, "definition redo");
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.memorySave("button")`);
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getSaveState().status === "saved"`, "saved footnote edit");
    assert(await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getTestDiskContent() === ${JSON.stringify(editedMarkdown)}`), "Saved disk content must equal edited Markdown.");
    await screenshot(cdp, "footnote-edited-desktop.png");

    await cdp.send("Emulation.setDeviceMetricsOverride", {
      deviceScaleFactor: 1,
      height: 844,
      mobile: true,
      width: 390
    });
    await wait(250);
    const constrained = await evaluate(
      cdp,
      `(() => {
        const host = document.querySelector('[data-testid="rich-editor-host"]');
        const definition = host?.querySelector('[data-mme-footnote-definition="true"]');
        const fallback = host?.querySelector('[data-mme-preserved-footnote="true"]');
        const hostRect = host?.getBoundingClientRect();
        const definitionRect = definition?.getBoundingClientRect();
        const fallbackRect = fallback?.getBoundingClientRect();
        return {
          definitionNonblank: Boolean(definitionRect && definitionRect.width > 0 && definitionRect.height > 0),
          fallbackNonblank: Boolean(fallbackRect && fallbackRect.width > 0 && fallbackRect.height > 0),
          fits: Boolean(hostRect && definitionRect && fallbackRect && definitionRect.right <= hostRect.right + 1 && fallbackRect.right <= hostRect.right + 1)
        };
      })()`
    );
    assert(constrained.definitionNonblank && constrained.fallbackNonblank, "Constrained footnote blocks must render nonblank.");
    assert(constrained.fits, "Constrained footnote blocks must remain inside the editor.");
    await screenshot(cdp, "footnote-edited-constrained.png");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("source")`);
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getEditorMode() === "source"`, "source mode restored");
    assert(await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === ${JSON.stringify(editedMarkdown)}`), "Source/Rich switching must retain edited footnote Markdown.");
    cdp.close();
    console.log(`MME-0056 runtime artifacts saved to ${visualDir}`);
  } catch (error) {
    if (stderr.trim()) {
      console.error(stderr.trim());
    }
    throw error;
  } finally {
    if (chrome.exitCode === null && chrome.signalCode === null) {
      chrome.kill("SIGTERM");
    }
    await Promise.race([chromeExit, wait(2000)]);
    if (chrome.exitCode === null && chrome.signalCode === null) {
      chrome.kill("SIGKILL");
    }
    await Promise.race([chromeExit, wait(2000)]);
    await rm(userDataDir, { force: true, maxRetries: 3, recursive: true, retryDelay: 100 });
  }
}

await main();
