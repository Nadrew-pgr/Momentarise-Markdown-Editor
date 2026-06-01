import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { requireChromeExecutable } from "./chrome-helpers.mjs";
import { sandboxAllowsScripts } from "../packages/md-preview-html/dist/index.js";

const chromePath = requireChromeExecutable();
const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5174/";
const visualDir = "docs/internal/visual-checks/MME-0015";
const port = 11000 + Math.floor(Math.random() * 500);
const userDataDir = `/tmp/mme-visual-0015-${Date.now()}`;

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
    `(() => {
      const frame = document.querySelector('[data-testid="html-preview-frame"]');
      const previewState = window.__MME_DEMO_VISUAL_CHECK__.getHtmlPreviewState();
      return {
        activeDocument: window.__MME_DEMO_VISUAL_CHECK__.getActiveDocument(),
        bannerText: document.querySelector('[data-testid="html-preview-banner"]')?.textContent ?? "",
        editorMode: window.__MME_DEMO_VISUAL_CHECK__.getEditorMode(),
        frameHidden: frame?.hidden ?? null,
        frameSandbox: frame?.getAttribute("sandbox") ?? null,
        frameSrcdoc: frame?.getAttribute("srcdoc") ?? "",
        markdown: window.__MME_DEMO_VISUAL_CHECK__.getMarkdown(),
        previewButtonPressed: document.querySelector('[data-testid="preview-mode-button"]')?.getAttribute("aria-pressed") ?? null,
        previewState,
        richButtonDisabled: document.querySelector('[data-testid="rich-mode-button"]')?.disabled ?? null,
        scriptRan: window.__MME_HTML_PREVIEW_SCRIPT_RAN__ === true,
        statusText: document.querySelector('[data-testid="html-preview-status"]')?.textContent ?? ""
      };
    })()`
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

async function setFileInputFiles(cdp, selector, files) {
  await cdp.send("DOM.enable");
  const { root } = await cdp.send("DOM.getDocument", {
    depth: -1,
    pierce: true
  });
  const { nodeId } = await cdp.send("DOM.querySelector", {
    nodeId: root.nodeId,
    selector
  });
  if (!nodeId) {
    throw new Error(`Cannot find file input: ${selector}`);
  }
  await cdp.send("DOM.setFileInputFiles", {
    files,
    nodeId
  });
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
  while (Date.now() - start < 6000) {
    if (predicate(snapshot)) {
      return snapshot;
    }
    await wait(100);
    snapshot = await getSnapshot(cdp);
  }
  throw new Error(`Timed out waiting for ${label}.\nLast snapshot:\n${JSON.stringify(snapshot, null, 2)}`);
}

async function waitForExpression(cdp, expression, label) {
  const start = Date.now();
  while (Date.now() - start < 6000) {
    if (await evaluate(cdp, expression)) {
      return;
    }
    await wait(100);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

function assertIncludes(value, expected, label) {
  if (!String(value).includes(expected)) {
    throw new Error(`Expected ${label} to include ${JSON.stringify(expected)}.\nActual: ${String(value)}`);
  }
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
      "--window-size=1280,820",
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
      getStderr: () => stderr,
      timeoutMs: 30000
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
    await waitForExpression(
      cdp,
      `Boolean(window.__MME_DEMO_VISUAL_CHECK__?.loadHtmlArtifactForTest)`,
      "MME demo visual hook"
    );

    const hostileHtml = `<!doctype html>
<html>
  <head><title>Unsafe visual fixture</title></head>
  <body>
    <h1>Sandboxed HTML artifact</h1>
    <p>The preview should render this text.</p>
    <script>
      document.body.dataset.scriptRan = "true";
      document.body.insertAdjacentHTML("beforeend", "<p>SCRIPT RAN</p>");
      try {
        window.top.__MME_HTML_PREVIEW_SCRIPT_RAN__ = true;
      } catch {}
    </script>
  </body>
</html>`;
    const hostileHtmlPath = join(userDataDir, "unsafe-visual.html");
    await writeFile(hostileHtmlPath, hostileHtml);

    await evaluate(
      cdp,
      `(() => {
        window.__MME_HTML_PREVIEW_SCRIPT_RAN__ = false;
      })()`
    );
    await setFileInputFiles(cdp, '[data-testid="html-file-input"]', [hostileHtmlPath]);
    const sourceOpened = await waitForSnapshot(
      cdp,
      (snapshot) =>
        snapshot.activeDocument.kind === "html-artifact" &&
        snapshot.editorMode === "source" &&
        snapshot.markdown.includes("<script>") &&
        snapshot.richButtonDisabled === true &&
        snapshot.previewState.scriptsEnabled === false,
      "HTML artifact source opened"
    );
    assertIncludes(sourceOpened.statusText, "HTML artifact", "HTML preview status");
    await screenshot(cdp, "html-source-opened.png");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("preview")`);
    const previewOpened = await waitForSnapshot(
      cdp,
      (snapshot) =>
        snapshot.editorMode === "preview" &&
        snapshot.previewButtonPressed === "true" &&
        snapshot.frameSandbox !== null &&
        snapshot.frameSrcdoc.includes("Sandboxed HTML artifact") &&
        snapshot.scriptRan === false,
      "sandboxed HTML preview opened"
    );
    if (sandboxAllowsScripts(previewOpened.frameSandbox)) {
      throw new Error(`HTML preview sandbox must not allow scripts: ${previewOpened.frameSandbox}`);
    }
    if (previewOpened.previewState.scriptsEnabled !== false) {
      throw new Error("HTML preview state must report scripts disabled.");
    }
    await wait(1000);
    const afterScriptWait = await getSnapshot(cdp);
    if (afterScriptWait.scriptRan) {
      throw new Error("Sandboxed HTML preview script ran unexpectedly.");
    }
    await screenshot(cdp, "html-sandbox-preview.png");

    cdp.close();
    console.log(`MME-0015 visual artifacts saved to ${visualDir}`);
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
    await rm(userDataDir, {
      force: true,
      maxRetries: 3,
      recursive: true,
      retryDelay: 100
    });
  }
}

await main();
