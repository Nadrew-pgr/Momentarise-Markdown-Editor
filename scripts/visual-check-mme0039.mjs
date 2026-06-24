import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { requireChromeExecutable } from "./chrome-helpers.mjs";

const chromePath = requireChromeExecutable();
const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5174/";
const visualDir = "docs/internal/visual-checks/MME-0039";
const port = 13000 + Math.floor(Math.random() * 500);
const userDataDir = `/tmp/mme-visual-0039-${Date.now()}`;

const showcaseMarkdown = `# Visual refresh check

A paragraph with **strong**, _emphasis_, \`inline code\`, ~~struck~~, and a [link](https://example.invalid).

> A quiet blockquote for tone review.

- [ ] Unchecked todo affordance
- [x] Checked todo affordance

| Feature | Status |
| :-- | :-: |
| Preserved blocks | quiet |

\`\`\`ts
const refreshed = true;
\`\`\`

Final paragraph after all block kinds.
`;

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
      `window.__MME_DEMO_VISUAL_CHECK__.loadImportedCopyForTest("visual-refresh.md", ${JSON.stringify(showcaseMarkdown)})`
    );
    await waitFor(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.getActiveDocument().fileName === "visual-refresh.md"`,
      "showcase document loaded"
    );
    await screenshot(cdp, "refresh-source-desktop.png");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.showRealFileOpenUnavailableForTest()`);
    await waitFor(
      cdp,
      `document.querySelector('[data-testid="editor-notice"]')?.textContent.includes("Real local file open is unavailable")`,
      "real file open unavailable notice"
    );
    const unavailableState = await evaluate(
      cdp,
      `(() => {
        const active = window.__MME_DEMO_VISUAL_CHECK__.getActiveDocument();
        return {
          fileName: active.fileName,
          mode: active.mode,
          notice: document.querySelector('[data-testid="editor-notice"]')?.textContent ?? ""
        };
      })()`
    );
    if (unavailableState.fileName !== "visual-refresh.md") {
      throw new Error(`Unavailable real-open feedback should not change the current document, got ${unavailableState.fileName}.`);
    }
    await screenshot(cdp, "refresh-open-file-unavailable.png");
    await evaluate(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.loadImportedCopyForTest("visual-refresh.md", ${JSON.stringify(showcaseMarkdown)})`
    );

    await cdp.send("Emulation.setDeviceMetricsOverride", {
      deviceScaleFactor: 1,
      height: 900,
      mobile: true,
      width: 390
    });
    await wait(350);
    const sourceMobileState = await evaluate(
      cdp,
      `(() => {
        const gutters = document.querySelector(".cm-gutters");
        const activeLine = document.querySelector(".cm-activeLine");
        const gutterDisplay = gutters ? getComputedStyle(gutters).display : "missing";
        const activeLineBackground = activeLine ? getComputedStyle(activeLine).backgroundColor : "missing";
        return {
          activeLineBackground,
          gutterDisplay,
          overflowX: document.documentElement.scrollWidth > window.innerWidth,
          viewportWidth: window.innerWidth
        };
      })()`
    );
    if (sourceMobileState.gutterDisplay !== "none") {
      throw new Error(`Mobile source gutters should be hidden, got ${sourceMobileState.gutterDisplay}.`);
    }
    if (!["rgba(0, 0, 0, 0)", "transparent"].includes(sourceMobileState.activeLineBackground)) {
      throw new Error(`Mobile source active line should be transparent, got ${sourceMobileState.activeLineBackground}.`);
    }
    if (sourceMobileState.overflowX) {
      throw new Error("Mobile source mode should not create document-level horizontal overflow.");
    }
    await screenshot(cdp, "refresh-source-mobile.png");
    await cdp.send("Emulation.clearDeviceMetricsOverride");

    await clickByTestId(cdp, "rich-mode-button");
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getEditorMode() === "rich"`, "rich mode active");
    await wait(250);
    await screenshot(cdp, "refresh-rich-blocks.png");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.openSlashMenuForTest("")`);
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getSlashMenuState().open === true`, "slash menu open");
    await screenshot(cdp, "refresh-slash-menu.png");
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.openSlashMenuForTest("zzz-none")`);

    await cdp.send("Emulation.setDeviceMetricsOverride", {
      deviceScaleFactor: 1,
      height: 900,
      mobile: true,
      width: 390
    });
    await wait(350);
    await screenshot(cdp, "refresh-narrow.png");
    await cdp.send("Emulation.clearDeviceMetricsOverride");

    cdp.close();
    console.log(`MME-0039 visual artifacts saved to ${visualDir}`);
  } finally {
    chrome.kill("SIGTERM");
    await Promise.race([chromeExit, wait(2000)]);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
