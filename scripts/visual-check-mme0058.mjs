import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { requireChromeExecutable } from "./chrome-helpers.mjs";

const chromePath = requireChromeExecutable();
const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5174/";
const visualDir = "docs/internal/visual-checks/MME-0058";
const port = 19400 + Math.floor(Math.random() * 500);
const userDataDir = `/tmp/mme-visual-0058-${Date.now()}`;
const source = [
  "# Release evidence",
  "",
  "One release note[^ship] and another matching reference[^ship] stay linked.",
  "",
  "Unknown syntax stays exact:",
  "",
  "<x-proof data-preserve=\"yes\">opaque</x-proof>",
  "",
  "  [^ship]:   Rename every matching identifier without touching this body.",
  ""
].join("\n");
const renamedSource = source.replaceAll("[^ship]", "[^release-note]");

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
        message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result ?? {});
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
    const id = this.nextId++;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { reject, resolve }));
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
    throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? "Runtime evaluation failed.");
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
  const keyCode = key.toUpperCase().charCodeAt(0);
  const params = {
    code,
    key,
    modifiers,
    nativeVirtualKeyCode: keyCode,
    windowsVirtualKeyCode: keyCode
  };
  await cdp.send("Input.dispatchKeyEvent", { ...params, type: "rawKeyDown" });
  await cdp.send("Input.dispatchKeyEvent", { ...params, type: "keyUp" });
}

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForJson(url, chrome, stderr) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 30000) {
    if (chrome.exitCode !== null || chrome.signalCode !== null) {
      throw new Error(`Chrome exited before CDP was available.\n${stderr()}`);
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
    const version = await waitForJson(`http://127.0.0.1:${port}/json/version`, chrome, () => stderr);
    const browser = await CdpClient.connect(version.webSocketDebuggerUrl);
    const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" });
    browser.close();
    const targets = await waitForJson(`http://127.0.0.1:${port}/json/list`, chrome, () => stderr);
    const target = targets.find((candidate) => candidate.id === targetId);
    assert(target?.webSocketDebuggerUrl, "Missing page target WebSocket URL.");
    const cdp = await CdpClient.connect(target.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    const loaded = cdp.once("Page.loadEventFired");
    await cdp.send("Page.navigate", { url: demoUrl });
    await loaded;
    await waitFor(cdp, `Boolean(window.__MME_DEMO_VISUAL_CHECK__?.renameRichFootnoteIdentifierForTest)`, "MME rename hook");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.loadWritableMarkdownFileForTest("footnote-rename.md", ${JSON.stringify(source)})`);
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich")`);
    const result = await evaluate(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.renameRichFootnoteIdentifierForTest("SHIP", "release-note")`
    );
    assert(result.handled && result.identifier === "release-note" && result.reason === null, "Host rename metadata must be truthful.");
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === ${JSON.stringify(renamedSource)}`, "renamed Markdown");
    const richState = await evaluate(
      cdp,
      `(() => {
        const editor = document.querySelector('[data-testid="rich-editor-host"] .ProseMirror');
        const refs = [...(editor?.querySelectorAll('[data-mme-footnote-reference="true"]') ?? [])];
        const definitions = [...(editor?.querySelectorAll('[data-mme-footnote-definition="true"]') ?? [])];
        return {
          definitionLabels: definitions.map((node) => node.getAttribute('data-mme-footnote-label')),
          referenceLabels: refs.map((node) => node.getAttribute('data-mme-footnote-label')),
          save: window.__MME_DEMO_VISUAL_CHECK__.getSaveState().status
        };
      })()`
    );
    assert(richState.referenceLabels.join(",") === "release-note,release-note", "Every Rich reference must update.");
    assert(richState.definitionLabels.join(",") === "release-note", "Rich definition label must update.");
    assert(richState.save === "dirty", "Rename must make save state dirty.");
    await screenshot(cdp, "footnote-renamed-rich-desktop.png");

    await pressKey(cdp, "z", { metaKey: true });
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === ${JSON.stringify(source)}`, "single-step rename undo");
    await pressKey(cdp, "z", { metaKey: true, shiftKey: true });
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === ${JSON.stringify(renamedSource)}`, "single-step rename redo");
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.memorySave("button")`);
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getSaveState().status === "saved"`, "saved rename");
    assert(
      await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getTestDiskContent() === ${JSON.stringify(renamedSource)}`),
      "Saved disk content must equal renamed Markdown."
    );

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("source")`);
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getEditorMode() === "source"`, "source mode");
    await screenshot(cdp, "footnote-renamed-source-desktop.png");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich")`);
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
        const hostRect = host?.getBoundingClientRect();
        const definitionRect = definition?.getBoundingClientRect();
        return {
          nonblank: Boolean(definitionRect && definitionRect.width > 0 && definitionRect.height > 0),
          fits: Boolean(hostRect && definitionRect && definitionRect.left >= hostRect.left - 1 && definitionRect.right <= hostRect.right + 1)
        };
      })()`
    );
    assert(constrained.nonblank && constrained.fits, "Renamed definition must remain visible and contained at 390px.");
    await screenshot(cdp, "footnote-renamed-rich-constrained.png");
    cdp.close();
    console.log(`MME-0058 runtime artifacts saved to ${visualDir}`);
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
