import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { requireChromeExecutable } from "./chrome-helpers.mjs";

const chromePath = requireChromeExecutable();
const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5174/";
const visualDir = "docs/internal/visual-checks/MME-0028";
const port = 14200 + Math.floor(Math.random() * 500);
const userDataDir = `/tmp/mme-visual-0028-${Date.now()}`;

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
        const { reject, resolve } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) {
          reject(new Error(message.error.message));
        } else {
          resolve(message.result ?? {});
        }
        return;
      }
      const handlers = this.events.get(message.method);
      if (!handlers) {
        return;
      }
      for (const handler of handlers.splice(0)) {
        handler(message.params ?? {});
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

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForJson(url, options = {}) {
  const timeoutMs = options.timeoutMs ?? 30000;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const exitStatus = options.getExitStatus?.();
    if (exitStatus) {
      const details = options.getStderr?.().trim();
      throw new Error(
        `Chrome exited before CDP became available (code ${exitStatus.code}, signal ${exitStatus.signal}).${
          details ? `\n${details}` : ""
        }`
      );
    }
    try {
      const response = await fetch(url);
      if (response.ok) {
        return response.json();
      }
    } catch {}
    await wait(100);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function waitFor(cdp, expression, label) {
  const start = Date.now();
  while (Date.now() - start < 7000) {
    if (await evaluate(cdp, expression)) {
      return;
    }
    await wait(100);
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

async function clickByTestId(cdp, testId) {
  await evaluate(
    cdp,
    `(() => {
      const element = document.querySelector('[data-testid="${testId}"]');
      if (!element) throw new Error('Missing element: ${testId}');
      element.click();
      return true;
    })()`
  );
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
      "--window-size=1360,1100",
      "about:blank"
    ],
    { stdio: ["ignore", "ignore", "pipe"] }
  );
  const chromeExit = new Promise((resolve) => {
    chrome.once("exit", resolve);
  });
  let stderr = "";
  chrome.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  try {
    const version = await waitForJson(`http://127.0.0.1:${port}/json/version`, {
      getExitStatus: () =>
        chrome.exitCode === null && chrome.signalCode === null
          ? null
          : {
              code: chrome.exitCode,
              signal: chrome.signalCode
            },
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
    await waitFor(cdp, `Boolean(window.__MME_DEMO_VISUAL_CHECK__)`, "demo loaded");

    /*
     * MME-0089 turned the persistent formatting toolbar off by default
     * (benchmark contract 4). This gate counts toolbar children, and
     * `createToolbar` renders them whether or not the root is hidden — so
     * without this opt-in the assertions below would have gone on passing
     * against an invisible toolbar, and the screenshots would have quietly lost
     * it. The opt-in itself is proven by `visual:mme-0089`.
     */
    await evaluate(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.setReferenceSurfacePreferencesForTest({ toolbarMode: "sticky" })`
    );

    await evaluate(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.loadImportedCopyForTest("surface-a11y.md", "# Surface extraction\\n\\nThe surface should be reusable and keyboard complete.\\n")`
    );
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich")`);
    await waitFor(cdp, `document.querySelector('[data-testid="rich-command-toolbar"]')?.getAttribute('role') === 'toolbar'`, "toolbar role");
    await screenshot(cdp, "surface-rich-toolbar.png");

    await waitFor(
      cdp,
      `(() => {
        const button = document.querySelector('[data-testid="command-palette-button"]');
        if (!button) return false;
        const style = window.getComputedStyle(button);
        return !button.hidden && button.tabIndex >= 0 && style.display !== 'none' && style.visibility !== 'hidden';
      })()`,
      "visible command palette opener"
    );
    await clickByTestId(cdp, "command-palette-button");
    await waitFor(cdp, `document.querySelector('[data-testid="command-palette"]')?.getAttribute('role') === 'dialog'`, "palette dialog");
    await waitFor(
      cdp,
      `Boolean(document.querySelector('[data-testid="command-palette-items"]')?.getAttribute('aria-activedescendant'))`,
      "palette active descendant"
    );
    await screenshot(cdp, "surface-command-palette-a11y.png");
    await evaluate(
      cdp,
      `(() => {
        const palette = document.querySelector('[data-testid="command-palette"]');
        if (!palette) throw new Error('Missing command palette for Escape proof.');
        palette.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        return palette.hidden;
      })()`
    );
    await waitFor(cdp, `document.querySelector('[data-testid="command-palette"]')?.hidden === true`, "palette closed before slash proof");
    await waitFor(
      cdp,
      `document.activeElement?.getAttribute('data-testid') === 'command-palette-button'`,
      "palette focus returned to visible opener"
    );

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.setRichSelectionAfterText("keyboard complete.")`);
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.typeRichTextForTest(" /sum")`);
    await waitFor(cdp, `document.querySelector('[data-testid="slash-command-menu"]')?.getAttribute('role') === 'listbox'`, "slash listbox");
    await waitFor(
      cdp,
      `(() => {
        const menu = document.querySelector('[data-testid="slash-command-menu"]');
        if (!menu) return false;
        const rect = menu.getBoundingClientRect();
        return rect.bottom <= window.innerHeight - 8 && rect.top >= 8;
      })()`,
      "slash menu inside viewport"
    );
    await screenshot(cdp, "surface-slash-menu-a11y.png");
    await evaluate(
      cdp,
      `(() => {
        const menu = document.querySelector('[data-testid="slash-command-menu"]');
        if (!menu) throw new Error('Missing slash menu for Escape proof.');
        menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        return menu.hidden;
      })()`
    );
    await waitFor(cdp, `document.querySelector('[data-testid="slash-command-menu"]')?.hidden === true`, "slash menu closed before AI proof");

    await clickByTestId(cdp, "toolbar-ai-button");
    await waitFor(cdp, `document.querySelector('[data-testid="editor-ai-assistant-panel"]')?.getAttribute('role') === 'dialog'`, "AI dialog");
    await screenshot(cdp, "surface-ai-panel.png");
    await evaluate(
      cdp,
      `(() => {
        const details = document.querySelector('[data-testid="ai-command-surface"]');
        if (!details) throw new Error('Missing AI command surface before status proof.');
        details.open = false;
        return !details.open;
      })()`
    );

    await clickByTestId(cdp, "editor-status-button");
    await waitFor(cdp, `document.querySelector('[data-testid="editor-status-button"]')?.getAttribute('aria-expanded') === 'true'`, "status disclosure expanded");
    await screenshot(cdp, "surface-status-popover.png");

    cdp.close();
  } finally {
    chrome.kill("SIGTERM");
    /*
     * MME-0114: bound the wait and escalate. A Chrome that ignores SIGTERM keeps
     * its stdio pipes open and so keeps Node's event loop alive; the gate prints
     * its result and never exits, which blocks the whole suite.
     */
    await Promise.race([chromeExit, wait(2000)]);
    if (chrome.exitCode === null && chrome.signalCode === null) {
      chrome.kill("SIGKILL");
    }
    await Promise.race([chromeExit, wait(2000)]);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

await main();
