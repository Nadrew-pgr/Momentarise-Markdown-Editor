import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { requireChromeExecutable } from "./chrome-helpers.mjs";

const chromePath = requireChromeExecutable();
const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5174/";
const visualDir = "docs/internal/visual-checks/MME-0018";
const port = 12000 + Math.floor(Math.random() * 500);
const userDataDir = `/tmp/mme-visual-0018-${Date.now()}`;

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

async function getSnapshot(cdp) {
  return evaluate(
    cdp,
    `(() => ({
      activeDocument: window.__MME_DEMO_VISUAL_CHECK__.getActiveDocument(),
      ai: window.__MME_DEMO_VISUAL_CHECK__.getAiWritingState(),
      editorMode: window.__MME_DEMO_VISUAL_CHECK__.getEditorMode(),
      referenceSurface: window.__MME_DEMO_VISUAL_CHECK__.getReferenceSurfaceState(),
      slash: window.__MME_DEMO_VISUAL_CHECK__.getSlashMenuState(),
      toolbar: window.__MME_DEMO_VISUAL_CHECK__.getToolbarState()
    }))()`
  );
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

async function waitForSnapshot(cdp, predicate, label) {
  const start = Date.now();
  let snapshot = await getSnapshot(cdp);
  while (Date.now() - start < 7000) {
    if (predicate(snapshot)) {
      return snapshot;
    }
    await wait(100);
    snapshot = await getSnapshot(cdp);
  }
  throw new Error(`Timed out waiting for ${label}.\nLast snapshot:\n${JSON.stringify(snapshot, null, 2)}`);
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
    await waitForSnapshot(
      cdp,
      (snapshot) =>
        snapshot.referenceSurface?.debugInspectorVisible === false &&
        snapshot.referenceSurface?.aiEntryPoints?.includes("toolbar") &&
        snapshot.referenceSurface?.statusDisclosure === "discreet",
      "reference surface loaded"
    );
    await screenshot(cdp, "reference-surface-desktop.png");

    await clickByTestId(cdp, "command-palette-button");
    await waitForSnapshot(
      cdp,
      (snapshot) => snapshot.referenceSurface?.commandPaletteOpen === true,
      "command palette open"
    );
    await screenshot(cdp, "reference-surface-command-palette.png");
    await evaluate(cdp, `document.querySelector('[data-testid="command-palette"]')?.click()`);

    await evaluate(
      cdp,
      `(() => {
        window.__MME_DEMO_VISUAL_CHECK__.startMockAiSessionForTest();
        window.__MME_DEMO_VISUAL_CHECK__.setSelection(7, 32);
      })()`
    );
    await clickByTestId(cdp, "selected-text-ai-action");
    await waitForSnapshot(
      cdp,
      (snapshot) => snapshot.referenceSurface?.assistantPanelVisible === true && snapshot.ai.pendingStatus === "pending",
      "selected text AI suggestion pending"
    );
    await screenshot(cdp, "reference-surface-selected-ai.png");

    await clickByTestId(cdp, "rich-mode-button");
    await waitForSnapshot(
      cdp,
      (snapshot) => snapshot.editorMode === "rich" && snapshot.toolbar.visible === true,
      "rich reference toolbar loaded"
    );
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.openSlashMenuForTest("summ")`);
    await waitForSnapshot(
      cdp,
      (snapshot) => snapshot.slash.open === true && snapshot.slash.aiItems.includes("summarize"),
      "slash menu AI action available"
    );
    await screenshot(cdp, "reference-surface-slash-ai.png");

    await clickByTestId(cdp, "editor-ai-button");
    await waitForSnapshot(
      cdp,
      (snapshot) => snapshot.referenceSurface?.aiMenuOpen === true,
      "editor AI menu open"
    );
    await screenshot(cdp, "reference-surface-rich-ai.png");

    await cdp.send("Emulation.setDeviceMetricsOverride", {
      deviceScaleFactor: 1,
      height: 900,
      mobile: true,
      width: 390
    });
    await wait(350);
    await screenshot(cdp, "reference-surface-narrow.png");

    await cdp.send("Emulation.setDeviceMetricsOverride", {
      deviceScaleFactor: 1,
      height: 1024,
      mobile: true,
      width: 768
    });
    await wait(350);
    await screenshot(cdp, "reference-surface-tablet.png");

    await cdp.send("Emulation.setDeviceMetricsOverride", {
      deviceScaleFactor: 1,
      height: 760,
      mobile: false,
      width: 640
    });
    await wait(350);
    await screenshot(cdp, "reference-surface-ide-constrained.png");

    await cdp.send("Emulation.clearDeviceMetricsOverride");

    await evaluate(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.loadHtmlArtifactForTest("reference-preview.html", "<!doctype html><html><body><h1>Preview</h1><p>Sandboxed.</p></body></html>")`
    );
    await clickByTestId(cdp, "preview-mode-button");
    await waitForSnapshot(
      cdp,
      (snapshot) => snapshot.editorMode === "preview" && snapshot.activeDocument.kind === "html-artifact",
      "HTML preview mode loaded"
    );
    await screenshot(cdp, "reference-surface-html-preview.png");

    cdp.close();
    console.log(`MME-0018 visual artifacts saved to ${visualDir}`);
  } finally {
    chrome.kill("SIGTERM");
    await Promise.race([chromeExit, wait(2000)]);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
