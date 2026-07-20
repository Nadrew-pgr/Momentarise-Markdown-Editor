import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { requireChromeExecutable } from "./chrome-helpers.mjs";

const chromePath = requireChromeExecutable();
const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5174/";
const visualDir = "docs/internal/visual-checks/MME-0057";
const port = 18900 + Math.floor(Math.random() * 500);
const userDataDir = `/tmp/mme-visual-0057-${Date.now()}`;
const source = [
  "# Release plan",
  "",
  "Ship this before **preserved review** and keep the surrounding Markdown exact.",
  "",
  "Existing notes stay allocated[^note] and remain case-aware[^NOTE-2].",
  "",
  "[^note]: Existing note.",
  "",
  "[^NOTE-2]: Existing second note.",
  ""
].join("\n");
const insertedSource = source.replace("Ship this before ", "Ship this before [^note-3]") + "\n[^note-3]: Footnote\n";

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
  const code = key.length === 1 ? `Key${key.toUpperCase()}` : key;
  const keyCode = key.length === 1 ? key.toUpperCase().charCodeAt(0) : key === "Enter" ? 13 : 0;
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
    await waitFor(cdp, `Boolean(window.__MME_DEMO_VISUAL_CHECK__?.setRichSelectionAfterText)`, "MME demo hook");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.loadWritableMarkdownFileForTest("footnote-insertion.md", ${JSON.stringify(source)})`);
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich")`);
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.setRichSelectionAfterText("Ship this before ")`);
    await cdp.send("Input.insertText", { text: "/foot" });
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getSlashMenuState().selectedId === "mme:footnote"`, "footnote slash option");
    assert(
      await evaluate(cdp, `document.querySelector('[data-testid="slash-command-item-mme:footnote"]')?.textContent.includes("Footnote")`),
      "Slash option must expose the localized Footnote label."
    );
    await screenshot(cdp, "footnote-command-desktop.png");

    await pressKey(cdp, "Enter");
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === ${JSON.stringify(insertedSource)}`, "footnote insertion");
    const richState = await evaluate(
      cdp,
      `(() => {
        const editor = document.querySelector('[data-testid="rich-editor-host"] .ProseMirror');
        return {
          definitions: editor?.querySelectorAll('[data-mme-footnote-definition="true"]').length ?? 0,
          references: editor?.querySelectorAll('[data-mme-footnote-reference="true"]').length ?? 0,
          save: window.__MME_DEMO_VISUAL_CHECK__.getSaveState().status
        };
      })()`
    );
    assert(richState.definitions === 3 && richState.references === 3, "Inserted footnote must remain semantic and paired.");
    assert(richState.save === "dirty", "Inserted footnote must make save state dirty.");
    await screenshot(cdp, "footnote-inserted-desktop.png");

    await pressKey(cdp, "z", { metaKey: true });
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === ${JSON.stringify(source)}`, "single-step footnote undo");
    await pressKey(cdp, "z", { metaKey: true, shiftKey: true });
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === ${JSON.stringify(insertedSource)}`, "single-step footnote redo");
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.memorySave("button")`);
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getSaveState().status === "saved"`, "saved insertion");
    assert(
      await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getTestDiskContent() === ${JSON.stringify(insertedSource)}`),
      "Saved disk content must equal inserted Markdown."
    );

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("source")`);
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getEditorMode() === "source"`, "source mode");
    assert(
      await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === ${JSON.stringify(insertedSource)}`),
      "Source mode must expose exact inserted GFM Markdown."
    );
    await screenshot(cdp, "footnote-source-desktop.png");

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
        const inserted = [...(host?.querySelectorAll('[data-mme-footnote-definition="true"]') ?? [])].at(-1);
        const hostRect = host?.getBoundingClientRect();
        const insertedRect = inserted?.getBoundingClientRect();
        return {
          nonblank: Boolean(insertedRect && insertedRect.width > 0 && insertedRect.height > 0),
          fits: Boolean(hostRect && insertedRect && insertedRect.left >= hostRect.left - 1 && insertedRect.right <= hostRect.right + 1)
        };
      })()`
    );
    assert(constrained.nonblank && constrained.fits, "Inserted definition must remain visible and contained at 390px.");
    await screenshot(cdp, "footnote-inserted-constrained.png");
    cdp.close();
    console.log(`MME-0057 runtime artifacts saved to ${visualDir}`);
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
