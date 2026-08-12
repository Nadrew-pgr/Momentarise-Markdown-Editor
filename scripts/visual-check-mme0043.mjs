import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { requireChromeExecutable } from "./chrome-helpers.mjs";

const chromePath = requireChromeExecutable();
const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5174/";
const visualDir = "docs/internal/visual-checks/MME-0043";
const port = 17043 + Math.floor(Math.random() * 500);
const userDataDir = `/tmp/mme-visual-0043-${Date.now()}`;

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
      "--window-size=1360,1000",
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
     * (benchmark contract 4): formatting now lives in the selection bubble and
     * the slash menu. This gate exercises the toolbar, so it opts in the way a
     * Google-Docs-style host would; the opt-in itself is proven by
     * `visual:mme-0089`.
     */
    await evaluate(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.setReferenceSurfacePreferencesForTest({ toolbarMode: "sticky" })`
    );

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.loadImportedCopyForTest("live-preview-proof.md", "")`);
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("live-preview")`);
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getEditorMode() === "live-preview"`, "live preview mode active");
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.typeRichTextForTest("# Live Preview Proof")`);
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.pressRichKeyForTest("Enter")`);
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.typeRichTextForTest("- [ ] Live task")`);
    await waitFor(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.getEditorMode() === "live-preview" &&
        document.querySelector('[data-testid="source-mode-button"]')?.textContent.trim() === "Source" &&
        document.querySelector('[data-testid="rich-mode-button"]')?.textContent.trim() === "Rich" &&
        Boolean(document.querySelector('[data-testid="live-preview-mode-button"][aria-pressed="true"]')) &&
        Boolean(document.querySelector('[data-testid="live-preview-banner"]:not([hidden])')) &&
        Boolean(document.querySelector('[data-testid="rich-command-toolbar"][hidden]')) &&
        Array.from(document.querySelectorAll('[data-testid="rich-editor-host"] [data-rich-block-affordance]')).every((element) => getComputedStyle(element).display === "none") &&
        Boolean(document.querySelector('[data-testid="rich-editor-host"] h1')) &&
        Boolean(document.querySelector('[data-testid="rich-editor-host"] [data-type="todo-item"]')) &&
        window.__MME_DEMO_VISUAL_CHECK__.getMarkdown().includes("# Live Preview Proof") &&
        window.__MME_DEMO_VISUAL_CHECK__.getMarkdown().includes("- [ ] Live task")`,
      "typed live-preview constructs without mode bounce"
    );
    await screenshot(cdp, "live-preview-typed-constructs.png");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich")`);
    await waitFor(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.getEditorMode() === "rich" &&
        Boolean(document.querySelector('[data-testid="rich-mode-button"][aria-pressed="true"]')) &&
        !document.querySelector('[data-testid="live-preview-banner"]:not([hidden])') &&
        Boolean(document.querySelector('[data-testid="rich-command-toolbar"]:not([hidden])')) &&
        Boolean(document.querySelector('[data-testid="rich-editor-host"] [data-rich-block-affordance]')) &&
        Boolean(document.querySelector('[data-testid="rich-editor-host"] h1')) &&
        Boolean(document.querySelector('[data-testid="rich-editor-host"] [data-type="todo-item"]')) &&
        window.__MME_DEMO_VISUAL_CHECK__.getMarkdown().includes("# Live Preview Proof")`,
      "same document remains in rich mode without live preview banner"
    );
    await screenshot(cdp, "rich-mode-same-document.png");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.loadWritableMarkdownFileForTest("live-preview-conflict.md", "# Live Conflict\\n\\nBase document.\\n")`);
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("live-preview")`);
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getEditorMode() === "live-preview"`, "live preview conflict fixture active");
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.setRichSelectionAfterText("Base document.")`);
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.typeRichTextForTest(" Local edit.")`);
    await evaluate(cdp, `(async () => { await window.__MME_DEMO_VISUAL_CHECK__.simulateExternalConflict(); return true; })()`);
    await waitFor(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.getEditorMode() === "live-preview" &&
        window.__MME_DEMO_VISUAL_CHECK__.getSaveState().status === "conflict" &&
        window.__MME_DEMO_VISUAL_CHECK__.getMarkdown().includes("Base document. Local edit.")`,
      "dirty live-preview external change produces conflict without overwriting local edit"
    );
    await screenshot(cdp, "live-preview-external-conflict.png");

    await evaluate(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.loadHtmlArtifactForTest("artifact.html", "<main><h1>HTML Preview</h1><p>No live preview mode.</p></main>")`
    );
    await waitFor(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.getActiveDocument().kind === "html-artifact" &&
        Boolean(document.querySelector('[data-testid="preview-mode-button"]')) &&
        !document.querySelector('[data-testid="live-preview-mode-button"]') &&
        !document.querySelector('[data-testid="rich-mode-button"]')`,
      "html artifact mode controls exclude live preview"
    );
    await screenshot(cdp, "html-artifact-no-live-preview.png");

    cdp.close();
  } finally {
    chrome.kill("SIGTERM");
    await Promise.race([chromeExit, wait(1000)]);
    if (chrome.exitCode === null && chrome.signalCode === null) {
      chrome.kill("SIGKILL");
      await Promise.race([chromeExit, wait(1000)]);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
