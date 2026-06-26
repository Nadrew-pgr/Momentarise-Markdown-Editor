import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { requireChromeExecutable } from "./chrome-helpers.mjs";

const chromePath = requireChromeExecutable();
const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5174/";
const visualDir = "docs/internal/visual-checks/MME-0026";
const port = 13600 + Math.floor(Math.random() * 500);
const userDataDir = `/tmp/mme-visual-0026-${Date.now()}`;

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
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
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
      "--window-size=1360,920",
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

    await evaluate(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.loadImportedCopyForTest("preferences-demo.md", "# Runtime preferences\\n\\n- Source and rich editors stay mounted.\\n")`
    );

    await evaluate(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.setReferenceSurfacePreferencesForTest({
        toolbarMode: "floating",
        toolbarStyle: "solid",
        layoutDensity: "compact",
        readableLineWidth: 640,
        editorFontScale: 1.12,
        keymapProfile: "minimal"
      })`
    );
    const hostState = await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getReferenceSurfaceState()`);
    assert(hostState.toolbarMode === "floating", "host toolbar override did not apply");
    assert(hostState.layoutDensity === "compact", "host density override did not apply");
    assert(hostState.keymapProfile === "minimal", "host keymap override did not apply");
    assert(hostState.readableLineWidth === 640, "host readable width override did not apply");

    await evaluate(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.setReferenceSurfacePreferencesForTest({
        toolbarMode: "floating",
        toolbarStyle: "solid",
        layoutDensity: "compact",
        readableLineWidth: 640,
        keymapProfile: "minimal",
        userPreferences: {
          keymapProfile: "delegate",
          layoutDensity: "spacious",
          toolbarStyle: "compact"
        },
        userVisible: ["layout.density", "keymap.profile"]
      })`
    );
    const allowlistState = await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getReferenceSurfaceState()`);
    assert(allowlistState.layoutDensity === "spacious", "visible user density preference did not apply");
    assert(allowlistState.keymapProfile === "delegate", "visible user keymap preference did not apply");
    assert(allowlistState.toolbarStyle === "solid", "non-visible user toolbar style should be ignored");

    await evaluate(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich");
      window.__MME_DEMO_VISUAL_CHECK__.setReferenceSurfacePreferencesForTest({
        toolbarMode: "floating",
        layoutDensity: "compact",
        keymapDelegateToHost: true,
        keymapProfile: "delegate",
        locks: {
          "toolbar.mode": {
            lockedBy: "workspace",
            reason: "Workspace locks toolbar placement",
            value: "hidden"
          }
        },
        userPreferences: {
          toolbarMode: "inline"
        },
        userVisible: ["toolbar.mode", "layout.density", "keymap.delegateToHost", "keymap.profile"]
      })`
    );
    const lockedState = await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getReferenceSurfaceState()`);
    const lockedToolbarState = await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getToolbarState()`);
    assert(lockedState.toolbarMode === "hidden", "locked toolbar mode did not override user preference");
    assert(lockedState.keymapDelegateToHost === true, "delegated keymap did not apply live");
    assert(lockedState.keymapProfile === "delegate", "rich keymap profile did not apply live");
    assert(lockedToolbarState.visible === false, "locked hidden toolbar mode did not hide the rich toolbar");
    assert((await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getRichText()`)).includes("Runtime preferences"), "rich doc changed during live preference apply");

    await evaluate(
      cdp,
      `(() => {
        document.querySelector('[data-testid="debug-inspector"]').open = true;
        document.querySelector('[data-testid="surface-settings-panel"]').open = true;
        return true;
      })()`
    );
    await screenshot(cdp, "runtime-preferences-debug.png");
    cdp.close();
  } finally {
    chrome.kill("SIGTERM");
    await chromeExit;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

await main();
