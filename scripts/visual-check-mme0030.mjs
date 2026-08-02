import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { requireChromeExecutable } from "./chrome-helpers.mjs";

const chromePath = requireChromeExecutable();
const demoUrl = process.env.MME_DEMO_URL ?? "http://localhost:5174/";
const visualDir = "docs/internal/visual-checks/MME-0030";
const port = 16050 + Math.floor(Math.random() * 500);
const userDataDir = `/tmp/mme-visual-0030-${Date.now()}`;
const artifactManifest = [
  "theme-dark-desktop.png",
  "theme-dark-mobile.png",
  "theme-dark-tablet.png",
  "theme-dark-ide-pane.png",
  "theme-light-desktop.png",
  "theme-light-mobile.png",
  "theme-light-tablet.png",
  "theme-light-ide-pane.png",
  "theme-dark-slash-menu.png",
  "theme-light-command-palette.png",
  "theme-dark-block-affordances.png",
  "theme-light-preserved-markdown.png"
];

const showcaseMarkdown = `# Default theme check

MME should feel like a serious Markdown-native editor while preserving source bytes.

- [ ] Unchecked task with enough text to prove checkbox alignment
- [x] Checked task keeps source truth

> Blockquote and normal prose should feel quiet, not debug-like.

\`\`\`ts
const markdownSource = "durable";
\`\`\`

| Raw | Preserved |
| :-- | :-- |
| table | fallback |

:::host:unknown-card
Unknown extension payload remains preserved Markdown.
:::
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

async function setScheme(cdp, scheme) {
  await evaluate(cdp, `document.documentElement.dataset.mmeScheme = ${JSON.stringify(scheme)}`);
  await wait(180);
}

async function setViewport(cdp, width, height, mobile) {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    deviceScaleFactor: 1,
    height,
    mobile,
    width
  });
  await wait(260);
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

async function captureResponsiveSet(cdp, scheme) {
  await setScheme(cdp, scheme);
  await setViewport(cdp, 1360, 940, false);
  await screenshot(cdp, `theme-${scheme}-desktop.png`);
  await setViewport(cdp, 390, 900, true);
  await assertNoDocumentOverflow(cdp, `${scheme} mobile`);
  await screenshot(cdp, `theme-${scheme}-mobile.png`);
  await setViewport(cdp, 768, 1024, true);
  await assertNoDocumentOverflow(cdp, `${scheme} tablet`);
  await screenshot(cdp, `theme-${scheme}-tablet.png`);
  await setViewport(cdp, 640, 760, false);
  await assertNoDocumentOverflow(cdp, `${scheme} constrained IDE pane`);
  await screenshot(cdp, `theme-${scheme}-ide-pane.png`);
}

async function assertNoDocumentOverflow(cdp, label) {
  const state = await evaluate(
    cdp,
    `(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth
    }))()`
  );
  if (state.scrollWidth > state.viewportWidth + 1) {
    throw new Error(`${label} must not create document-level horizontal overflow: ${JSON.stringify(state)}`);
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
      "--window-size=1360,940",
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
      `window.__MME_DEMO_VISUAL_CHECK__.loadImportedCopyForTest("theme-v1.md", ${JSON.stringify(showcaseMarkdown)})`
    );
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich")`);
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getEditorMode() === "rich"`, "rich mode active");
    await waitFor(cdp, `document.querySelectorAll('[data-testid="rich-command-toolbar"] .toolbar-icon svg').length >= 10`, "icon toolbar rendered");

    await captureResponsiveSet(cdp, "dark");
    await captureResponsiveSet(cdp, "light");

    await setViewport(cdp, 1360, 940, false);
    await setScheme(cdp, "dark");
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.openSlashMenuForTest("todo")`);
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getSlashMenuState().open === true`, "slash menu open");
    await screenshot(cdp, "theme-dark-slash-menu.png");
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.openSlashMenuForTest("zzz-none")`);

    await setScheme(cdp, "light");
    await clickByTestId(cdp, "command-palette-button");
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getReferenceSurfaceState().commandPaletteOpen === true`, "command palette open");
    await screenshot(cdp, "theme-light-command-palette.png");
    await evaluate(cdp, `document.querySelector('[data-testid="command-palette"]')?.click()`);

    await setScheme(cdp, "dark");
    await evaluate(cdp, `document.querySelector('[data-rich-block-drag-handle]')?.focus()`);
    await waitFor(cdp, `document.activeElement?.hasAttribute("data-rich-block-drag-handle")`, "block handle focused");
    await screenshot(cdp, "theme-dark-block-affordances.png");

    await setScheme(cdp, "light");
    await evaluate(
      cdp,
      `(() => {
        const preserved = document.querySelector('.ProseMirror pre[data-unsupported="true"]');
        if (!preserved) throw new Error('Missing preserved Markdown block.');
        preserved.scrollIntoView({ block: 'center' });
      })()`
    );
    await wait(200);
    await screenshot(cdp, "theme-light-preserved-markdown.png");

    cdp.close();
    console.log(`MME-0030 visual artifacts saved to ${visualDir}`);
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
