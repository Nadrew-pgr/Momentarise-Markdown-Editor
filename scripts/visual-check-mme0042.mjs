import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { requireChromeExecutable } from "./chrome-helpers.mjs";

const chromePath = requireChromeExecutable();
const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5174/";
const visualDir = "docs/internal/visual-checks/MME-0042";
const port = 17042 + Math.floor(Math.random() * 500);
const userDataDir = `/tmp/mme-visual-0042-${Date.now()}`;

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
  const finalTableMarkdown = [
    "# Core interaction proof",
    "",
    "Click and keyboard insertion must land after the final preserved block.",
    "",
    "| Feature | State |",
    "| -- | -- |",
    "| Final table | preserved |",
    ""
  ].join("\n");
  const finalCalloutMarkdown = [
    "# Mouse insertion proof",
    "",
    "> [!NOTE] Final callout",
    "> Stay raw.",
    ""
  ].join("\n");

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

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.loadImportedCopyForTest("keyboard-final-table.md", ${JSON.stringify(finalTableMarkdown)})`);
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich")`);
    await waitFor(cdp, `document.querySelectorAll('[data-mme-preserved-table="true"]').length === 1`, "final table fallback");
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.selectFinalRichBlockForTest()`);
    await cdp.send("Input.dispatchKeyEvent", { key: "ArrowDown", type: "keyDown" });
    await cdp.send("Input.insertText", { text: "Keyboard paragraph after final table." });
    await waitFor(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown().includes("| Final table | preserved |\\n\\nKeyboard paragraph after final table.")`,
      "keyboard insertion after final table"
    );
    await screenshot(cdp, "keyboard-after-final-table.png");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.loadImportedCopyForTest("mouse-final-callout.md", ${JSON.stringify(finalCalloutMarkdown)})`);
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich")`);
    await waitFor(cdp, `document.querySelectorAll('[data-unsupported="true"]').length >= 1`, "final callout fallback");
    const clickPoint = JSON.parse(
      await evaluate(
        cdp,
        `JSON.stringify((() => {
          const editor = document.querySelector('[data-testid="rich-editor-host"] .ProseMirror');
          const last = Array.from(editor.children).filter((child) => !child.matches('[data-rich-block-affordance]')).at(-1);
          const rect = last.getBoundingClientRect();
          return { x: rect.left + Math.min(160, rect.width / 2), y: rect.bottom + 28 };
        })())`
      )
    );
    await cdp.send("Input.dispatchMouseEvent", {
      button: "left",
      buttons: 1,
      clickCount: 1,
      type: "mousePressed",
      x: clickPoint.x,
      y: clickPoint.y
    });
    await cdp.send("Input.dispatchMouseEvent", {
      button: "left",
      buttons: 0,
      clickCount: 1,
      type: "mouseReleased",
      x: clickPoint.x,
      y: clickPoint.y
    });
    await cdp.send("Input.insertText", { text: "Mouse paragraph after final callout." });
    await wait(250);
    const mouseProofState = await evaluate(
      cdp,
      `JSON.stringify((() => {
        const editor = document.querySelector('[data-testid="rich-editor-host"] .ProseMirror');
        const last = editor ? Array.from(editor.children).filter((child) => !child.matches('[data-rich-block-affordance]')).at(-1) : null;
        const hit = document.elementFromPoint(${clickPoint.x}, ${clickPoint.y});
        return {
          activeElement: document.activeElement?.className || document.activeElement?.dataset?.testid || document.activeElement?.tagName || null,
          clickPoint: ${JSON.stringify(clickPoint)},
          editorRect: editor ? editor.getBoundingClientRect().toJSON?.() ?? {
            bottom: editor.getBoundingClientRect().bottom,
            left: editor.getBoundingClientRect().left,
            right: editor.getBoundingClientRect().right,
            top: editor.getBoundingClientRect().top
          } : null,
          hitClass: hit?.className || null,
          hitTag: hit?.tagName || null,
          lastRect: last ? {
            bottom: last.getBoundingClientRect().bottom,
            left: last.getBoundingClientRect().left,
            right: last.getBoundingClientRect().right,
            top: last.getBoundingClientRect().top
          } : null,
          markdown: window.__MME_DEMO_VISUAL_CHECK__.getMarkdown()
        };
      })())`
    );
    if (!JSON.parse(mouseProofState).markdown.includes("> Stay raw.\n\nMouse paragraph after final callout.")) {
      throw new Error(`Mouse insertion after final callout failed:\n${mouseProofState}`);
    }
    await screenshot(cdp, "mouse-after-final-callout.png");

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
