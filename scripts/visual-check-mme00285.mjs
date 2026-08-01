import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { requireChromeExecutable } from "./chrome-helpers.mjs";

const chromePath = requireChromeExecutable();
const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5174/";
const visualDir = "docs/internal/visual-checks/MME-0028.5";
const port = 14500 + Math.floor(Math.random() * 500);
const userDataDir = `/tmp/mme-visual-00285-${Date.now()}`;

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
      "--window-size=1360,1040",
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
      `window.__MME_DEMO_VISUAL_CHECK__.loadImportedCopyForTest("inline-ai.md", "# Inline AI\\n\\nCurrent line for the inline prompt.\\n\\nSecond paragraph stays put.\\n")`
    );
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich")`);
    await waitFor(cdp, `Boolean(document.querySelector('[data-testid="rich-editor-host"] .ProseMirror'))`, "rich editor");
    const editorTopBefore = await evaluate(cdp, `document.querySelector('[data-testid="rich-editor-host"]').getBoundingClientRect().top`);
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.setRichSelectionAfterText("Current line")`);
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.typeRichTextForTest(" /ai")`);
    await waitFor(cdp, `document.querySelector('[data-testid="inline-ai-prompt"]')?.hidden === false`, "inline AI prompt");
    await waitFor(
      cdp,
      `document.activeElement?.getAttribute("data-testid") === "inline-ai-prompt-input"`,
      "inline AI prompt focus"
    );
    const anchorProof = await evaluate(
      cdp,
      `(() => {
        const prompt = document.querySelector('[data-testid="inline-ai-prompt"]');
        const host = document.querySelector('[data-testid="inline-ai-prompt-host"]');
        const region = document.querySelector('.editor-region');
        const block = [...document.querySelectorAll('[data-testid="rich-editor-host"] .ProseMirror p')]
          .find((candidate) => candidate.textContent.includes('Current line'));
        if (!prompt || !region || !host || !block) return { ok: false, reason: "missing" };
        const promptRect = prompt.getBoundingClientRect();
        const regionRect = region.getBoundingClientRect();
        const hostRect = host.getBoundingClientRect();
        const blockRect = block.getBoundingClientRect();
        const hostStyle = getComputedStyle(host);
        return {
          blockBottom: blockRect.bottom,
          blockLeft: blockRect.left,
          hostDisplay: hostStyle.display,
          hostPosition: hostStyle.position,
          hostTop: hostRect.top,
          ok:
            promptRect.top >= blockRect.bottom - 6 &&
            promptRect.top <= blockRect.bottom + 48 &&
            promptRect.left >= regionRect.left &&
            promptRect.right <= regionRect.right,
          promptStyleTop: prompt.style.getPropertyValue("--inline-ai-top"),
          promptLeft: promptRect.left,
          promptRight: promptRect.right,
          promptTop: promptRect.top,
          regionTop: regionRect.top,
          texts: [...document.querySelectorAll('[data-testid="rich-editor-host"] .ProseMirror p')]
            .map((candidate) => candidate.textContent)
        };
      })()`
    );
    if (!anchorProof.ok) {
      throw new Error(`Inline AI prompt is not anchored inside the rich editor region: ${JSON.stringify(anchorProof)}.`);
    }
    const editorTopAfter = await evaluate(cdp, `document.querySelector('[data-testid="rich-editor-host"]').getBoundingClientRect().top`);
    if (Math.abs(editorTopAfter - editorTopBefore) > 1) {
      throw new Error(`Inline AI prompt changed rich editor layout top from ${editorTopBefore} to ${editorTopAfter}.`);
    }
    await screenshot(cdp, "inline-ai-prompt-rich.png");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.startMockAiSessionForTest()`);
    await evaluate(
      cdp,
      `(() => {
        const input = document.querySelector('[data-testid="inline-ai-prompt-input"]');
        input.value = "Continue with one concrete sentence.";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        const action = document.querySelector('[data-testid="inline-ai-action-continue"]');
        action.focus();
        action.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
      })()`
    );
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getAiWritingState().pendingStatus === "pending"`, "staged AI suggestion");
    await waitFor(cdp, `document.querySelector('[data-testid="inline-ai-accept-button"]')?.disabled === false`, "inline accept control");
    await screenshot(cdp, "inline-ai-suggestion-staged.png");
    await evaluate(cdp, `document.querySelector('[data-testid="inline-ai-reject-button"]').click()`);
    await waitFor(cdp, `!window.__MME_DEMO_VISUAL_CHECK__.getMarkdown().includes("AI suggestion")`, "reject leaves Markdown unchanged");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.showInlineAiProviderStateForTest("missing")`);
    await waitFor(
      cdp,
      `document.querySelector('[data-testid="inline-ai-provider-state"]')?.textContent.includes("Missing provider")`,
      "missing provider label"
    );
    await screenshot(cdp, "inline-ai-provider-missing.png");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.loadAiPolicyDeniedDocumentForTest()`);
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich")`);
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.startMockAiSessionForTest()`);
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.openInlineAiPromptForTest("summarize")`);
    await waitFor(cdp, `document.querySelector('[data-testid="inline-ai-prompt"]')?.hidden === false`, "policy prompt open");
    await evaluate(
      cdp,
      `(() => {
        const action = document.querySelector('[data-testid="inline-ai-action-summarize"]');
        action.focus();
        action.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
      })()`
    );
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getAiWritingState().pendingStatus === "blocked"`, "policy blocked");
    await waitFor(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.getAiWritingState().providerRequestCount === 1`,
      "policy denial did not call provider again"
    );
    await screenshot(cdp, "inline-ai-policy-blocked.png");
    cdp.close();
    console.log(`MME-0028.5 visual artifacts saved to ${visualDir}`);
  } finally {
    chrome.kill("SIGTERM");
    await Promise.race([chromeExit, wait(2000)]);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
