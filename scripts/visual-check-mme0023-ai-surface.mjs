import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { requireChromeExecutable } from "./chrome-helpers.mjs";

const chromePath = requireChromeExecutable();
const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5174/";
const visualDir = "docs/internal/visual-checks/MME-0023";
const port = 12600 + Math.floor(Math.random() * 500);
const userDataDir = `/tmp/mme-visual-0023-ai-${Date.now()}`;

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

async function screenshot(cdp, filename) {
  const result = await cdp.send("Page.captureScreenshot", {
    captureBeyondViewport: false,
    format: "png",
    fromSurface: true
  });
  await writeFile(join(visualDir, filename), Buffer.from(result.data, "base64"));
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
    await waitFor(cdp, `Boolean(window.__MME_DEMO_VISUAL_CHECK__)`, "demo visual hook");

    const beforeTop = await evaluate(
      cdp,
      `document.querySelector('[data-testid="editor-host"]').getBoundingClientRect().top`
    );
    await evaluate(cdp, `document.querySelector('[data-testid="editor-ai-button"]').click()`);
    await waitFor(cdp, `document.querySelector('[data-testid="ai-action-continue"]')?.offsetParent !== null`, "AI action menu");
    await evaluate(cdp, `document.querySelector('[data-testid="ai-action-continue"]').click()`);
    /*
     * MME-0116: this waited for `editor-ai-assistant-panel` to become visible.
     * MME-0028.5 rerouted every AI action to the inline prompt, so that panel now
     * stays hidden and the gate waited forever for a surface the product stopped
     * opening.
     *
     * What MME-0023 proves is the *shape* of the AI surface, not which element
     * implements it: something that floats over the document instead of a panel
     * that reflows the editor. The layout-stability check below is the other half
     * of the same claim and is untouched.
     *
     * The old predicate also pinned `position: fixed` and 460x260 pixels. Those
     * described the retired panel — the inline prompt is measured at absolute,
     * 520x560 — and re-pinning today's numbers would just reset the same clock.
     * So this asserts the properties that make it a popover rather than a dock:
     * taken out of normal flow, and strictly smaller than the editor host in both
     * dimensions. A surface that went back to being a full-height sidebar fails.
     */
    await waitFor(
      cdp,
      `(() => {
        const panel = document.querySelector('[data-testid="inline-ai-prompt"]');
        const host = document.querySelector('[data-testid="editor-host"]');
        if (!panel || !host || panel.hidden || panel.offsetParent === null) return false;
        const outOfFlow = ["absolute", "fixed"].includes(getComputedStyle(panel).position);
        const rect = panel.getBoundingClientRect();
        const hostRect = host.getBoundingClientRect();
        return outOfFlow && rect.width < hostRect.width && rect.height < hostRect.height;
      })()`,
      "inline AI prompt opens out of flow and smaller than the editor host"
    );
    /*
     * The retired panel must stay retired: an AI action that reopened it would
     * mean two AI surfaces exist, which is the state MME-0028.5 removed.
     */
    const legacyPanelVisible = await evaluate(
      cdp,
      `(() => {
        const panel = document.querySelector('[data-testid="editor-ai-assistant-panel"]');
        return Boolean(panel && !panel.hidden && panel.offsetParent !== null);
      })()`
    );
    if (legacyPanelVisible) {
      throw new Error(
        "The legacy assistant panel opened alongside the inline prompt. MME-0028.5 routes AI actions through the inline prompt only."
      );
    }
    const afterTop = await evaluate(
      cdp,
      `document.querySelector('[data-testid="editor-host"]').getBoundingClientRect().top`
    );
    if (Math.abs(afterTop - beforeTop) > 1) {
      throw new Error(`AI assistant changed editor layout top from ${beforeTop} to ${afterTop}.`);
    }
    await screenshot(cdp, "ai-assistant-popover.png");
    cdp.close();
    console.log(`MME-0023 AI surface artifact saved to ${visualDir}/ai-assistant-popover.png`);
  } finally {
    chrome.kill("SIGTERM");
    await Promise.race([chromeExit, wait(2000)]);
    /*
     * MME-0114: escalate. A Chrome that ignores SIGTERM stays alive with its
     * stdio pipes open, which keeps Node's event loop alive — the gate prints its
     * success line and then never exits. The runner can only kill it on timeout,
     * so a hanging gate looks exactly like a failing one and blocks the suite.
     */
    if (chrome.exitCode === null && chrome.signalCode === null) {
      chrome.kill("SIGKILL");
    }
    await Promise.race([chromeExit, wait(2000)]);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
