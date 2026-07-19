import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { requireChromeExecutable } from "./chrome-helpers.mjs";

const chromePath = requireChromeExecutable();
const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5174/";
const visualDir = "docs/internal/visual-checks/MME-0044";
const port = 17100 + Math.floor(Math.random() * 500);
const userDataDir = `/tmp/mme-visual-0044-${Date.now()}`;

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
        `Chrome exited before CDP became available (code ${exitStatus.code}, signal ${exitStatus.signal}). ` +
          `Run with system Chrome permission if sandboxed local Chrome aborts before startup.` +
          `${details ? `\n${details}` : ""}`
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

async function waitFor(cdp, expression, label, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await evaluate(cdp, expression)) {
      return;
    }
    await wait(100);
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

async function snapshot(cdp) {
  return evaluate(
    cdp,
    `(() => {
      const status = window.__MME_DEMO_VISUAL_CHECK__.getSaveState();
      return {
        activeDocument: window.__MME_DEMO_VISUAL_CHECK__.getActiveDocument(),
        adapter: document.querySelector('[data-testid="document-adapter"]')?.textContent ?? "",
        conflictActions: Array.from(document.querySelectorAll("[data-conflict-action]")).map((node) => node.dataset.conflictAction),
        diskContent: window.__MME_DEMO_VISUAL_CHECK__.getTestDiskContent(),
        dirty: document.querySelector('[data-testid="dirty-state"]')?.textContent ?? "",
        hasDismiss: Boolean(document.querySelector("[data-testid='conflict-action-dismiss']")),
        htmlPreview: window.__MME_DEMO_VISUAL_CHECK__.getHtmlPreviewState(),
        lastAction: document.querySelector('[data-testid="save-engine-last-action"]')?.textContent ?? "",
        modeButtons: Array.from(document.querySelectorAll('[data-testid$="-mode-button"]')).map((node) => node.textContent.trim()),
        saveDetails: document.querySelector('[data-testid="save-details"]')?.textContent ?? "",
        target: status.target,
        targetLabel: document.querySelector('[data-testid="persistence-target"]')?.textContent ?? "",
        topbarButtons: Array.from(document.querySelectorAll('[data-testid="open-action-group"] button')).filter((button) => getComputedStyle(button).display !== "none").map((button) => button.textContent.trim()),
        writable: document.querySelector('[data-testid="document-writable"]')?.textContent ?? ""
      };
    })()`
  );
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
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
      "--window-size=1360,860",
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
    await waitFor(cdp, `Boolean(window.__MME_DEMO_VISUAL_CHECK__?.saveAsWritableMarkdownFileForTest)`, "MME-0044 visual hooks");

    let state = await snapshot(cdp);
    assert(state.topbarButtons.includes("New"), "Topbar must expose New.");
    assert(state.topbarButtons.includes("Open file"), "Topbar must expose a single Open file action.");
    assert(state.topbarButtons.includes("Save As"), "Topbar must expose Save As.");
    await screenshot(cdp, "status-chrome-initial.png");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.loadImportedCopyForTest("unified-open.md", "# Unified Open\\n\\nImported Markdown.\\n")`);
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getActiveDocument().mode === "imported-copy"`, "imported Markdown opened");
    state = await snapshot(cdp);
    assert(state.target === "download-required", "Fallback Markdown import must require download/export.");
    assertIncludes(state.adapter, "download-export", "imported adapter label");
    assertIncludes(state.targetLabel, "download/export required", "imported target label");
    await screenshot(cdp, "open-markdown-imported-copy.png");

    await evaluate(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.loadHtmlArtifactForTest("artifact.html", "<!doctype html><html><body><main><h1>HTML artifact</h1><p>Preview route.</p></main></body></html>")`
    );
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getActiveDocument().kind === "html-artifact"`, "HTML artifact opened");
    state = await snapshot(cdp);
    assert(state.modeButtons.includes("Source"), "HTML artifact must expose Source.");
    assert(state.modeButtons.includes("Preview"), "HTML artifact must expose Preview.");
    assert(!state.modeButtons.includes("Rich"), "HTML artifact must not expose Rich.");
    assert(!state.modeButtons.includes("Live Preview"), "HTML artifact must not expose Live Preview.");
    assertIncludes(state.targetLabel, "HTML artifact", "HTML target label");
    await screenshot(cdp, "open-html-source-preview-only.png");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.createNewWritableMarkdownFileForTest("visual-new.md", "# Visual New\\n\\nCreated writable.\\n")`);
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getSaveState().target === "disk"`, "new writable Markdown file");
    state = await snapshot(cdp);
    assert(state.activeDocument.mode === "writable-file", "New writable file must become writable-file mode.");
    assert(state.writable === "yes", "New writable file status must say writable.");
    assertIncludes(state.diskContent, "Created writable.", "new writable disk content");
    await screenshot(cdp, "new-file-writable-target.png");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.loadImportedCopyForTest("needs-save-as.md", "# Save As\\n\\nImported before save as.\\n")`);
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.setCursorToEnd()`);
    await cdp.send("Input.insertText", { text: "\nSave As writes this body.\n" });
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getSaveState().status === "dirty"`, "dirty before Save As");
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.saveAsWritableMarkdownFileForTest("saved-as-visual.md")`);
    await waitFor(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.getSaveState().target === "disk" && window.__MME_DEMO_VISUAL_CHECK__.getTestDiskContent()?.includes("Save As writes this body.")`,
      "Save As writable target transition"
    );
    state = await snapshot(cdp);
    assert(state.activeDocument.fileName === "saved-as-visual.md", "Save As must update the active filename.");
    assertIncludes(state.lastAction, "saved as writable", "Save As last action");
    await screenshot(cdp, "save-as-writable-target.png");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.setCursorToEnd()`);
    await cdp.send("Input.insertText", { text: "\nLocal dirty conflict body.\n" });
    await evaluate(cdp, `(async () => { await window.__MME_DEMO_VISUAL_CHECK__.simulateExternalConflict(); return true; })()`);
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getSaveState().status === "conflict"`, "dirty external conflict");
    await evaluate(cdp, `document.querySelector("[data-testid='document-status-popover']").open = true`);
    await waitFor(cdp, `document.querySelectorAll("[data-conflict-action]").length === 3`, "explicit conflict actions");
    state = await snapshot(cdp);
    assert(state.conflictActions.join(",") === "reload-external,download-local-copy,retry-save", "Conflict actions must be explicit and ordered.");
    assert(state.hasDismiss === false, "Conflict menu must not expose unsafe dismiss.");
    assertIncludes(state.diskContent, "simulated external edit", "external side preserved");
    await screenshot(cdp, "conflict-actions-explicit.png");

    cdp.close();
    console.log(`MME-0044 visual artifacts saved to ${visualDir}`);
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
