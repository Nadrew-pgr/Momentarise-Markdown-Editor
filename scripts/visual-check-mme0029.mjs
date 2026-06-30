import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { requireChromeExecutable } from "./chrome-helpers.mjs";

const chromePath = requireChromeExecutable();
const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5174/";
const visualDir = "docs/internal/visual-checks/MME-0029";
const port = 15550 + Math.floor(Math.random() * 500);
const userDataDir = `/tmp/mme-visual-0029-${Date.now()}`;

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
  const mixedFixture = await readFile("fixtures/014-mixed-real-world/input.md", "utf8");
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
      "--window-size=1360,1500",
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

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.loadImportedCopyForTest("blocks.md", ${JSON.stringify(mixedFixture)})`);
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich")`);
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getBlockAffordanceState().count >= 3`, "block handles");
    await evaluate(cdp, `document.querySelector('[data-rich-block-drag-handle]')?.focus()`);
    await waitFor(cdp, `document.activeElement?.hasAttribute("data-rich-block-drag-handle")`, "block handle focus");
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getBlockAffordanceState().firstHandleFocusable`, "focusable block handle");
    const hoverPoint = JSON.parse(
      await evaluate(
        cdp,
        `JSON.stringify((() => {
          const block = document.querySelector('[data-testid="rich-editor-host"] .ProseMirror > *');
          const rect = block.getBoundingClientRect();
          return { x: rect.left + 12, y: rect.top + 12 };
        })())`
      )
    );
    await cdp.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: hoverPoint.x,
      y: hoverPoint.y
    });
    const visibleHandleState = await evaluate(
      cdp,
      `JSON.stringify((() => {
        const handle = document.querySelector('[data-rich-block-drag-handle]');
        const rect = handle.getBoundingClientRect();
        const style = getComputedStyle(handle.closest('[data-rich-block-affordance]'));
        return {
          height: rect.height,
          opacity: Number(style.opacity),
          width: rect.width,
          x: rect.left,
          y: rect.top
        };
      })())`
    );
    const handleState = JSON.parse(visibleHandleState);
    if (handleState.width < 16 || handleState.height < 16 || handleState.opacity <= 0 || handleState.x < 0) {
      throw new Error(`Block handle must be visible and inside the viewport: ${visibleHandleState}`);
    }
    await screenshot(cdp, "block-handle-hover-focus.png");

    await evaluate(cdp, `document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }))`);
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getBlockAffordanceState().menuOpen`, "keyboard block menu");
    await evaluate(cdp, `document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown" }))`);
    await waitFor(
      cdp,
      `document.activeElement?.dataset?.richBlockMenuAction === "duplicate"`,
      "block menu arrow navigation"
    );
    await screenshot(cdp, "block-menu-keyboard.png");
    await evaluate(cdp, `document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }))`);
    await waitFor(cdp, `!window.__MME_DEMO_VISUAL_CHECK__.getBlockAffordanceState().menuOpen`, "block menu closed");

    await evaluate(
      cdp,
      `(() => {
        const sourceHandle = document.querySelector('[data-testid="rich-block-drag-handle-4"]');
        const targetBlock = Array.from(document.querySelector('[data-testid="rich-editor-host"] .ProseMirror')?.children ?? [])
          .find((block) => block.textContent?.includes("Summary"));
        if (!sourceHandle || !targetBlock) {
          throw new Error("Missing drag source or target block.");
        }
        const transfer = new DataTransfer();
        transfer.setData("application/x-momentarise-rich-block-index", "4");
        transfer.setData("text/plain", "momentarise-rich-block:4");
        const startRect = sourceHandle.getBoundingClientRect();
        sourceHandle.dispatchEvent(new DragEvent("dragstart", {
          bubbles: true,
          cancelable: true,
          clientX: startRect.left + startRect.width / 2,
          clientY: startRect.top + startRect.height / 2,
          dataTransfer: transfer
        }));
        const targetRect = targetBlock.getBoundingClientRect();
        const view = document.querySelector('[data-testid="rich-editor-host"] .ProseMirror');
        const dragover = new DragEvent("dragover", {
          bubbles: true,
          cancelable: true,
          clientX: targetRect.left + 12,
          clientY: targetRect.top + targetRect.height * 0.25,
          dataTransfer: transfer
        });
        dragover.mmeRichBlockIndex = 4;
        targetBlock.dispatchEvent(dragover);
        const drop = new DragEvent("drop", {
          bubbles: true,
          cancelable: true,
          clientX: targetRect.left + 12,
          clientY: targetRect.top + targetRect.height * 0.25,
          dataTransfer: transfer
        });
        drop.mmeRichBlockIndex = 4;
        targetBlock.dispatchEvent(drop);
      })()`
    );
    await wait(250);
    const dragProofState = await evaluate(
      cdp,
      `JSON.stringify({
        dropResult: document.querySelector('[data-testid="rich-editor-host"] .ProseMirror')?.dataset?.richBlockDropResult ?? null,
        dropSeen: document.querySelector('[data-testid="rich-editor-host"] .ProseMirror')?.dataset?.richBlockDropSeen ?? null,
        markdown: window.__MME_DEMO_VISUAL_CHECK__.getMarkdown()
      })`
    );
    if (!JSON.parse(dragProofState).markdown.includes("before rich mode.\n\n## Summary")) {
      throw new Error(`Drag/drop reorder did not produce targeted Markdown output: ${dragProofState}`);
    }
    await screenshot(cdp, "block-reordered-targeted.png");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.startMockAiSessionForTest()`);
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.selectRichTextForTest("source mode")`);
    await waitFor(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.getSelectionBubbleState().open && window.__MME_DEMO_VISUAL_CHECK__.getSelectionBubbleState().aiVisible && !window.__MME_DEMO_VISUAL_CHECK__.getSelectionBubbleState().aiDisabled`,
      "selection bubble toolbar"
    );
    await screenshot(cdp, "selection-bubble-toolbar-ai.png");

    await evaluate(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.setReferenceSurfacePreferencesForTest({ visibleCommandGroups: ["blocks", "marks", "lists", "insert", "status"] })`
    );
    await waitFor(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.getSelectionBubbleState().open && !window.__MME_DEMO_VISUAL_CHECK__.getSelectionBubbleState().aiVisible`,
      "selection bubble AI hidden by command group"
    );

    await evaluate(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.loadImportedCopyForTest("repeat.md", "# Repeat\\n\\nsame word same word\\n")`
    );
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.setReferenceSurfacePreferencesForTest({ visibleCommandGroups: ["blocks", "marks", "lists", "insert", "ai", "status"] })`);
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich")`);
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.selectRichTextForTest("same word")`);
    await waitFor(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.getSelectionBubbleState().open && !window.__MME_DEMO_VISUAL_CHECK__.getSelectionBubbleState().aiDisabled`,
      "repeated selected text remains AI eligible"
    );

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.loadEmptyMarkdownForTest()`);
    await waitFor(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.getBlockAffordanceState().placeholder === "Type / for commands"`,
      "empty document placeholder"
    );
    await screenshot(cdp, "empty-placeholder.png");

    cdp.close();
  } finally {
    chrome.kill("SIGTERM");
    await Promise.race([chromeExit, wait(1000)]);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
