import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { requireChromeExecutable } from "./chrome-helpers.mjs";

const chromePath = requireChromeExecutable();
const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5174/";
const visualDir = "docs/internal/visual-checks/MME-0027";
const port = 13700 + Math.floor(Math.random() * 500);
const userDataDir = `/tmp/mme-visual-0027-${Date.now()}`;

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
    await waitFor(cdp, `Boolean(window.__MME_DEMO_VISUAL_CHECK__)`, "demo loaded");

    await evaluate(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.loadImportedCopyForTest("extension-registry.md", "# Extension registry\\n\\nHost extensions should render through the public registry.\\n")`
    );
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich")`);
    await waitFor(
      cdp,
      `Boolean(document.querySelector('[data-testid="toolbar-extension-host:callout-card"]'))`,
      "host toolbar item"
    );
    await screenshot(cdp, "extension-toolbar-host.png");

    await clickByTestId(cdp, "toolbar-extension-host:callout-card");
    await waitFor(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown().includes(":::host:callout-card-block")`,
      "host custom block insertion"
    );
    await screenshot(cdp, "extension-custom-block-inserted.png");

    await evaluate(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.setRichSelectionAfterText("public registry.");
      window.__MME_DEMO_VISUAL_CHECK__.typeRichTextForTest("/car")`
    );
    const slashState = await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getSlashMenuState()`);
    assert(slashState.items.includes("host:callout-card"), "host slash item is not searchable");
    await screenshot(cdp, "extension-slash-host.png");
    await clickByTestId(cdp, "slash-command-item-host:callout-card");
    await waitFor(
      cdp,
      `(() => {
        const markdown = window.__MME_DEMO_VISUAL_CHECK__.getMarkdown();
        return markdown.includes(":::host:callout-card-block") && !markdown.includes("/car");
      })()`,
      "host slash command consumes typed slash query"
    );
    await screenshot(cdp, "extension-slash-host-inserted.png");

    await clickByTestId(cdp, "command-palette-button");
    await evaluate(
      cdp,
      `(() => {
        const input = document.querySelector('[data-testid="command-palette-input"]');
        input.value = "translate";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        return true;
      })()`
    );
    await waitFor(
      cdp,
      `Boolean(document.querySelector('[data-testid="command-palette-ai-action-host:translate-selection"]'))`,
      "host AI command palette action"
    );
    await screenshot(cdp, "extension-ai-command-palette.png");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.startMockAiSessionForTest()`);
    await clickByTestId(cdp, "command-palette-ai-action-host:translate-selection");
    await waitFor(
      cdp,
      `document.querySelector('[data-testid="ai-prompt-input"]').value === "Translate the selection to French with a plain tone."`,
      "host parameterized AI prompt"
    );
    await screenshot(cdp, "extension-ai-host-prompt.png");
    const aiState = await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getAiWritingState()`);
    assert(aiState.providerRequestCount > 0, "host AI action did not reach the demo AI provider");

    await evaluate(
      cdp,
      `document.querySelector('[data-testid="editor-ai-panel-close"]')?.click();
      window.__MME_DEMO_VISUAL_CHECK__.loadImportedCopyForTest("rich-code-exit.md", "# Code exit\\n\\n\\\`\\\`\\\`ts\\nconst value = 1;\\n\\\`\\\`\\\`\\n");
      window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich");
      window.__MME_DEMO_VISUAL_CHECK__.setRichSelectionAfterText("1;")`
    );
    await evaluate(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.pressRichKeyForTest("Enter");
      window.__MME_DEMO_VISUAL_CHECK__.pressRichKeyForTest("Enter")`
    );
    await waitFor(
      cdp,
      `(() => {
        const markdown = window.__MME_DEMO_VISUAL_CHECK__.getMarkdown();
        return markdown.includes("\\\`\\\`\\\`ts\\nconst value = 1;\\n\\\`\\\`\\\`") && !markdown.includes("const value = 1;\\n\\n\\\`\\\`\\\`");
      })()`,
      "rich code block double Enter exits to a paragraph"
    );
    await screenshot(cdp, "rich-code-block-exit.png");

    cdp.close();
  } finally {
    chrome.kill("SIGTERM");
    await chromeExit.catch(() => {});
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
