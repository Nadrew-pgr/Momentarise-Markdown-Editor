import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { requireChromeExecutable } from "./chrome-helpers.mjs";

const chromePath = requireChromeExecutable();
const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5174/";
const visualDir = "docs/internal/visual-checks/MME-0035";
const port = 16600 + Math.floor(Math.random() * 500);
const userDataDir = `/tmp/mme-visual-0035-${Date.now()}`;

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
    await waitFor(cdp, `Boolean(window.__MME_DEMO_VISUAL_CHECK__?.loadWritableMarkdownFileForTest)`, "MME visual hooks");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.loadWritableMarkdownFileForTest("autosave.md", "# Autosave\\n")`);
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.setCursorToEnd()`);
    await cdp.send("Input.insertText", { text: "\nAutosaved without mode switch.\n" });
    await waitFor(cdp, `document.querySelector("[data-testid='dirty-state']")?.textContent === "dirty"`, "dirty state after source edit");
    await waitFor(
      cdp,
      `document.querySelector("[data-testid='dirty-state']")?.textContent === "clean" && window.__MME_DEMO_VISUAL_CHECK__.getTestDiskContent()?.includes("Autosaved without mode switch.")`,
      "autosave returns clean without mode switch",
      10000
    );
    await screenshot(cdp, "source-autosave-clean.png");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.loadWritableMarkdownFileForTest("external-clean.md", "# External clean\\n\\nInitial.\\n")`);
    await evaluate(cdp, `(async () => { await window.__MME_DEMO_VISUAL_CHECK__.simulateExternalConflict(); return true; })()`);
    await waitFor(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown().includes("simulated external edit") && document.querySelector("[data-testid='dirty-state']")?.textContent === "clean"`,
      "clean external change auto-applied"
    );
    await screenshot(cdp, "external-clean-auto-applied.png");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.loadWritableMarkdownFileForTest("external-dirty.md", "# External dirty\\n\\nInitial.\\n")`);
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.setCursorToEnd()`);
    await cdp.send("Input.insertText", { text: "\nLocal unsaved edit.\n" });
    await waitFor(cdp, `document.querySelector("[data-testid='dirty-state']")?.textContent === "dirty"`, "dirty state before external conflict");
    await evaluate(cdp, `(async () => { await window.__MME_DEMO_VISUAL_CHECK__.simulateExternalConflict(); return true; })()`);
    await waitFor(
      cdp,
      `document.querySelector("[data-testid='dirty-state']")?.textContent === "conflict" && window.__MME_DEMO_VISUAL_CHECK__.getMarkdown().includes("Local unsaved edit.") && window.__MME_DEMO_VISUAL_CHECK__.getTestDiskContent()?.includes("simulated external edit")`,
      "dirty external conflict preserves both sides"
    );
    await evaluate(cdp, `document.querySelector("[data-testid='document-status-popover']").open = true`);
    await waitFor(cdp, `Boolean(document.querySelector("[data-testid='conflict-action-reload-external']"))`, "conflict resolution actions");
    await screenshot(cdp, "external-dirty-conflict-actions.png");

    await evaluate(cdp, `document.querySelector("[data-testid='conflict-action-reload-external']").click()`);
    await waitFor(
      cdp,
      `document.querySelector("[data-testid='dirty-state']")?.textContent === "clean" && !window.__MME_DEMO_VISUAL_CHECK__.getMarkdown().includes("Local unsaved edit.") && window.__MME_DEMO_VISUAL_CHECK__.getMarkdown().includes("simulated external edit")`,
      "reload external clears conflict"
    );
    await screenshot(cdp, "external-conflict-reloaded.png");

    cdp.close();
  } finally {
    chrome.kill("SIGTERM");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
