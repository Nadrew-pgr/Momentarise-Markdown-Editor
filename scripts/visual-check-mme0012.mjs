import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { requireChromeExecutable } from "./chrome-helpers.mjs";

const chromePath = requireChromeExecutable();
const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5174/";
const visualDir = "docs/internal/visual-checks/MME-0012";
const port = 11800 + Math.floor(Math.random() * 500);
const userDataDir = `/tmp/mme-visual-0012-${Date.now()}`;
const richFixture = `---
title: Rich Mode Fixture
---

# Rich Heading

First paragraph.

\`\`\`ts
const before = true;
\`\`\`

:::momentarise-card kind="decision"
Keep custom extension raw.
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
    this.socket.send(
      JSON.stringify({
        id,
        method,
        params
      })
    );
    return new Promise((resolve, reject) => {
      this.pending.set(id, {
        reject,
        resolve
      });
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
      richText: window.__MME_DEMO_VISUAL_CHECK__.getRichText(),
      parserStatus: document.querySelector('[data-testid="parser-status"]').textContent,
      serializerStatus: document.querySelector('[data-testid="serializer-status"]').textContent,
      dirtyState: document.querySelector('[data-testid="dirty-state"]').textContent,
      primaryAction: document.querySelector('[data-testid="memory-save-button"]').textContent,
      sourcePressed: document.querySelector('[data-testid="source-mode-button"]').getAttribute("aria-pressed"),
      richPressed: document.querySelector('[data-testid="rich-mode-button"]').getAttribute("aria-pressed")
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

async function dispatchKey(cdp, key, options = {}) {
  const modifiers = (options.meta ? 4 : 0) + (options.shift ? 8 : 0);
  const code = key.length === 1 ? `Key${key.toUpperCase()}` : key;
  const windowsVirtualKeyCode = key.length === 1 ? key.toUpperCase().charCodeAt(0) : 13;
  await cdp.send("Input.dispatchKeyEvent", {
    code,
    key,
    modifiers,
    type: "keyDown",
    windowsVirtualKeyCode
  });
  await cdp.send("Input.dispatchKeyEvent", {
    code,
    key,
    modifiers,
    type: "keyUp",
    windowsVirtualKeyCode
  });
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
    {
      stdio: ["ignore", "ignore", "pipe"]
    }
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
      getStderr: () => stderr,
      timeoutMs: 30000
    });
    const browserCdp = await CdpClient.connect(version.webSocketDebuggerUrl);
    const { targetId } = await browserCdp.send("Target.createTarget", {
      url: "about:blank"
    });
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
    await cdp.send("Page.navigate", {
      url: demoUrl
    });
    await loadEvent;
    await wait(200);

    await evaluate(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.loadImportedCopyForTest("rich-mode.md", ${JSON.stringify(
        richFixture
      )})`
    );
    await waitForSnapshot(
      cdp,
      (snapshot) =>
        snapshot.editorMode === "source" &&
        snapshot.primaryAction === "Download" &&
        snapshot.sourcePressed === "true" &&
        snapshot.richPressed === "false",
      "source mode selected with honest imported-copy action"
    );
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich")`);
    await waitForSnapshot(
      cdp,
      (snapshot) => snapshot.editorMode === "rich" && String(snapshot.richText).includes("Rich Heading"),
      "rich mode loaded"
    );
    await screenshot(cdp, "rich-mode-loaded.png");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.setRichSelectionAfterText("Rich Heading")`);
    await cdp.send("Input.insertText", {
      text: " Edited"
    });
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.setRichSelectionAfterText("First paragraph.")`);
    await dispatchKey(cdp, "Enter");
    await cdp.send("Input.insertText", {
      text: "Second paragraph from rich."
    });
    const edited = await waitForSnapshot(
      cdp,
      (snapshot) =>
        String(snapshot.markdown).includes("# Rich Heading Edited") &&
        String(snapshot.markdown).includes("Second paragraph from rich.") &&
        String(snapshot.dirtyState).includes("dirty"),
      "rich heading and paragraph edited"
    );
    await screenshot(cdp, "rich-heading-paragraph-edited.png");

    await dispatchKey(cdp, "z", {
      meta: true
    });
    await waitForSnapshot(
      cdp,
      (snapshot) => !String(snapshot.markdown).includes("Second paragraph from rich."),
      "rich undo"
    );
    await dispatchKey(cdp, "z", {
      meta: true,
      shift: true
    });
    await waitForSnapshot(
      cdp,
      (snapshot) => String(snapshot.markdown).includes("Second paragraph from rich."),
      "rich redo"
    );

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.setRichSelectionAfterText("const before = true;")`);
    await cdp.send("Input.insertText", {
      text: "\nconst after = true;"
    });
    await waitForSnapshot(
      cdp,
      (snapshot) =>
        String(snapshot.markdown).includes("const after = true;") &&
        String(snapshot.markdown).includes(':::momentarise-card kind="decision"'),
      "rich code fence edit"
    );
    await screenshot(cdp, "rich-code-fence-edited.png");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("source")`);
    const source = await waitForSnapshot(
      cdp,
      (snapshot) =>
        snapshot.editorMode === "source" &&
        String(snapshot.markdown).includes("# Rich Heading Edited") &&
        String(snapshot.markdown).includes("const after = true;") &&
        String(snapshot.markdown).includes(':::momentarise-card kind="decision"') &&
        String(snapshot.parserStatus).includes("pass") &&
        String(snapshot.serializerStatus).includes("pass"),
      "source after rich round-trip"
    );
    if (!String(source.markdown).includes("---\ntitle: Rich Mode Fixture\n---")) {
      throw new Error("Frontmatter did not survive rich round-trip.");
    }
    const unsupportedOccurrences = String(source.markdown).match(/:::momentarise-card/g)?.length ?? 0;
    if (unsupportedOccurrences !== 1) {
      throw new Error(`Unsupported extension syntax should appear exactly once, got ${unsupportedOccurrences}.`);
    }
    await screenshot(cdp, "source-after-rich-roundtrip.png");

    cdp.close();
    console.log(`MME-0012 visual artifacts saved to ${visualDir}`);
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
