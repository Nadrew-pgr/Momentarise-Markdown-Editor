import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { requireChromeExecutable } from "./chrome-helpers.mjs";

const chromePath = requireChromeExecutable();
const demoUrl = process.env.MME_DEMO_URL ?? "http://localhost:5174/";
const visualDir = "docs/internal/visual-checks/MME-0014";
const port = 13400 + Math.floor(Math.random() * 500);
const userDataDir = `/tmp/mme-visual-0014-${Date.now()}`;

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
    throw new Error(`Runtime evaluation failed: ${expression}`);
  }
  return result.result.value;
}

async function getSnapshot(cdp) {
  return evaluate(
    cdp,
    `(() => ({
      editorMode: window.__MME_DEMO_VISUAL_CHECK__.getEditorMode(),
      markdown: window.__MME_DEMO_VISUAL_CHECK__.getMarkdown(),
      foldState: window.__MME_DEMO_VISUAL_CHECK__.getFoldState(),
      saveState: window.__MME_DEMO_VISUAL_CHECK__.getSaveState(),
      richText: window.__MME_DEMO_VISUAL_CHECK__.getRichText(),
      hiddenText: Array.from(document.querySelectorAll(".rich-fold-hidden")).map((element) => element.textContent.trim()),
      visibleText: Array.from(document.querySelectorAll(".ProseMirror > :not(.rich-fold-hidden)")).map((element) => element.textContent.trim()),
      hasPersistentFoldStrip: Boolean(document.querySelector('[data-testid="folding-session-state"]')),
      toggleCommandVisible: Boolean(document.querySelector('[data-rich-command="toggleBlock"]'))
    }))()`
  );
}

async function screenshot(cdp, filename) {
  const result = await cdp.send("Page.captureScreenshot", {
    captureBeyondViewport: false,
    format: "png",
    fromSurface: true
  });
  await writeFile(join(visualDir, filename), Buffer.from(result.data, "base64"));
}

async function clickByTestId(cdp, testId) {
  const box = await evaluate(
    cdp,
    `(() => {
      const element = document.querySelector('[data-testid="${testId}"]');
      if (!element) {
        return null;
      }
      const rect = element.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })()`
  );
  if (!box) {
    throw new Error(`Cannot find element for click: ${testId}`);
  }
  await cdp.send("Input.dispatchMouseEvent", {
    button: "left",
    clickCount: 1,
    type: "mousePressed",
    x: box.x,
    y: box.y
  });
  await cdp.send("Input.dispatchMouseEvent", {
    button: "left",
    clickCount: 1,
    type: "mouseReleased",
    x: box.x,
    y: box.y
  });
}

async function hoverHeading(cdp, text) {
  const box = await evaluate(
    cdp,
    `(() => {
      const heading = Array.from(document.querySelectorAll(".ProseMirror h1, .ProseMirror h2, .ProseMirror h3, .ProseMirror h4, .ProseMirror h5, .ProseMirror h6")).find((element) => element.textContent.trim().startsWith(${JSON.stringify(text)}));
      if (!heading) {
        return null;
      }
      const rect = heading.getBoundingClientRect();
      return { x: rect.left + 8, y: rect.top + rect.height / 2 };
    })()`
  );
  if (!box) {
    throw new Error(`Cannot find heading for hover: ${text}`);
  }
  await cdp.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: box.x,
    y: box.y
  });
}

async function loadRichFixture(cdp, fileName, markdown) {
  await evaluate(
    cdp,
    `window.__MME_DEMO_VISUAL_CHECK__.loadImportedCopyForTest(${JSON.stringify(fileName)}, ${JSON.stringify(markdown)})`
  );
  await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich")`);
  await evaluate(cdp, `document.querySelector(".ProseMirror")?.focus()`);
  await waitForSnapshot(cdp, (snapshot) => snapshot.editorMode === "rich", "rich editor loaded");
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

async function waitForSnapshot(cdp, predicate, label) {
  const start = Date.now();
  let snapshot = await getSnapshot(cdp);
  while (Date.now() - start < 6000) {
    if (predicate(snapshot)) {
      return snapshot;
    }
    await wait(100);
    snapshot = await getSnapshot(cdp);
  }
  throw new Error(`Timed out waiting for ${label}.\nLast snapshot:\n${JSON.stringify(snapshot, null, 2)}`);
}

const foldingMarkdown = `# Root

Root intro.

## Alpha

Alpha body.

### Alpha child

Alpha child body.

#### Alpha deep

Alpha deep body.

##### Alpha deeper

Alpha deeper body.

###### Alpha deepest

Alpha deepest body.

## Beta

Beta body.

# Next root

Next root body.
`;

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
      "--window-size=1280,860",
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
          : { code: chrome.exitCode, signal: chrome.signalCode },
      getStderr: () => stderr,
      timeoutMs: 30000
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
    await wait(200);

    await loadRichFixture(cdp, "folding-h1-h6.md", foldingMarkdown);
    const baselineSnapshot = await waitForSnapshot(
      cdp,
      (snapshot) =>
        snapshot.foldState.items.length >= 8 &&
        snapshot.saveState.status === "saved" &&
        snapshot.hasPersistentFoldStrip === false,
      "fold headings loaded"
    );
    const baselineMarkdown = baselineSnapshot.markdown;
    const baselineCurrentHash = baselineSnapshot.saveState.currentHash;
    const baselineLastSavedHash = baselineSnapshot.saveState.lastSavedHash;
    await screenshot(cdp, "folding-h1-h6-loaded.png");

    await hoverHeading(cdp, "Root");
    await wait(150);
    await screenshot(cdp, "folding-hover-affordance.png");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.toggleRichFoldForText("Alpha child")`);
    await waitForSnapshot(
      cdp,
      (snapshot) =>
        snapshot.foldState.hiddenText.includes("Alpha deep") &&
        snapshot.foldState.hiddenText.includes("Alpha deepest body.") &&
        !snapshot.foldState.hiddenText.includes("Beta") &&
        snapshot.hiddenText.includes("Alpha deep") &&
        !snapshot.visibleText.includes("Alpha deep") &&
        snapshot.visibleText.includes("Beta") &&
        snapshot.saveState.status === "saved" &&
        !snapshot.saveState.dirtySince &&
        snapshot.saveState.currentHash === baselineCurrentHash &&
        snapshot.saveState.lastSavedHash === baselineLastSavedHash &&
        snapshot.markdown === baselineMarkdown &&
        !String(snapshot.markdown).includes("<details>"),
      "H3 collapsed descendants"
    );
    await screenshot(cdp, "folding-h3-collapsed.png");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.toggleRichFoldForText("Alpha")`);
    await waitForSnapshot(
      cdp,
      (snapshot) =>
        snapshot.foldState.hiddenText.includes("Alpha child") &&
        snapshot.foldState.hiddenText.includes("Alpha deepest body.") &&
        snapshot.foldState.hiddenText.includes("Alpha body.") &&
        !snapshot.foldState.hiddenText.includes("Beta") &&
        snapshot.hiddenText.includes("Alpha child") &&
        snapshot.hiddenText.includes("Alpha deepest body.") &&
        snapshot.visibleText.includes("Alpha") &&
        snapshot.visibleText.includes("Beta") &&
        snapshot.saveState.status === "saved" &&
        !snapshot.saveState.dirtySince &&
        snapshot.saveState.currentHash === baselineCurrentHash &&
        snapshot.saveState.lastSavedHash === baselineLastSavedHash &&
        snapshot.markdown === baselineMarkdown &&
        !String(snapshot.markdown).includes("<details>"),
      "nested parent collapsed while child remains folded"
    );
    await screenshot(cdp, "folding-nested-parent-collapsed.png");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.toggleRichFoldForText("Alpha")`);
    await waitForSnapshot(
      cdp,
      (snapshot) =>
        snapshot.foldState.hiddenText.includes("Alpha deep") &&
        snapshot.foldState.hiddenText.includes("Alpha deepest body.") &&
        !snapshot.foldState.hiddenText.includes("Alpha child") &&
        snapshot.hiddenText.includes("Alpha deep") &&
        snapshot.visibleText.includes("Alpha child") &&
        !snapshot.visibleText.includes("Alpha deep") &&
        snapshot.visibleText.includes("Beta") &&
        snapshot.saveState.status === "saved" &&
        !snapshot.saveState.dirtySince &&
        snapshot.saveState.currentHash === baselineCurrentHash &&
        snapshot.saveState.lastSavedHash === baselineLastSavedHash &&
        snapshot.markdown === baselineMarkdown &&
        !String(snapshot.markdown).includes("<details>"),
      "nested child remains collapsed after parent reopens"
    );
    await screenshot(cdp, "folding-nested-child-still-collapsed.png");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.toggleRichFoldForText("Alpha child")`);
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.toggleRichFoldForText("Root")`);
    await waitForSnapshot(
      cdp,
      (snapshot) =>
        snapshot.foldState.hiddenText.includes("Alpha") &&
        snapshot.foldState.hiddenText.includes("Beta body.") &&
        snapshot.foldState.visibleText.includes("Next root") &&
        snapshot.hiddenText.includes("Alpha") &&
        snapshot.hiddenText.includes("Beta body.") &&
        snapshot.visibleText.includes("Next root") &&
        !snapshot.visibleText.includes("Alpha") &&
        snapshot.saveState.status === "saved" &&
        !snapshot.saveState.dirtySince &&
        snapshot.saveState.currentHash === baselineCurrentHash &&
        snapshot.saveState.lastSavedHash === baselineLastSavedHash &&
        snapshot.markdown === baselineMarkdown &&
        !String(snapshot.markdown).includes("<details>"),
      "H1 collapsed descendants"
    );
    await screenshot(cdp, "folding-h1-collapsed.png");

    await loadRichFixture(cdp, "toggle-block.md", "Toggle label\n");
    await clickByTestId(cdp, "toolbar-more-button");
    await clickByTestId(cdp, "toolbar-command-toggleBlock");
    await waitForSnapshot(
      cdp,
      (snapshot) =>
        String(snapshot.markdown).includes("<details>") &&
        String(snapshot.markdown).includes("<summary>Toggle label</summary>"),
      "explicit toggle block command"
    );
    await screenshot(cdp, "toggle-block-explicit-details.png");

    cdp.close();
    console.log(`MME-0014 visual artifacts saved to ${visualDir}`);
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
