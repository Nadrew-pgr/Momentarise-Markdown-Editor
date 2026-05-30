import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const chromePath =
  process.env.CHROME_BIN ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5174/";
const visualDir = "docs/internal/visual-checks/MME-0009";
const port = 11000 + Math.floor(Math.random() * 500);
const userDataDir = `/tmp/mme-visual-0009-${Date.now()}`;

if (!existsSync(chromePath)) {
  throw new Error(`Chrome executable not found: ${chromePath}`);
}

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
    `(() => {
      const state = window.__MME_DEMO_VISUAL_CHECK__.getSaveState();
      return {
        activeDocument: window.__MME_DEMO_VISUAL_CHECK__.getActiveDocument(),
        diskContent: window.__MME_DEMO_VISUAL_CHECK__.getTestDiskContent(),
        dirtyLabel: document.querySelector('[data-testid="dirty-state"]').textContent,
        documentModeLabel: document.querySelector('[data-testid="document-mode"]').textContent,
        documentName: document.querySelector('[data-testid="document-name"]').textContent,
        documentPath: document.querySelector('[data-testid="document-path"]').textContent,
        eventLog: document.querySelector('[data-testid="event-log"]').innerText,
        lastAction: document.querySelector('[data-testid="save-engine-last-action"]').textContent,
        markdown: window.__MME_DEMO_VISUAL_CHECK__.getMarkdown(),
        saveEngineStatusLabel: document.querySelector('[data-testid="save-engine-state"]').textContent,
        saveLabel: document.querySelector('[data-testid="save-state"]').textContent,
        status: state.status,
        target: state.target,
        targetLabel: document.querySelector('[data-testid="persistence-target"]').textContent
      };
    })()`
  );
}

async function keyChord(cdp, key) {
  const modifiers = process.platform === "darwin" ? 4 : 2;
  const code = `Key${key.toUpperCase()}`;
  const virtualKeyCode = key.toUpperCase().charCodeAt(0);
  await cdp.send("Input.dispatchKeyEvent", {
    code,
    key,
    modifiers,
    nativeVirtualKeyCode: virtualKeyCode,
    type: "keyDown",
    windowsVirtualKeyCode: virtualKeyCode
  });
  await cdp.send("Input.dispatchKeyEvent", {
    code,
    key,
    modifiers,
    nativeVirtualKeyCode: virtualKeyCode,
    type: "keyUp",
    windowsVirtualKeyCode: virtualKeyCode
  });
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
    assertNoPlainSaved(snapshot);
    if (predicate(snapshot)) {
      return snapshot;
    }
    await wait(100);
    snapshot = await getSnapshot(cdp);
  }
  throw new Error(`Timed out waiting for ${label}.\nLast snapshot:\n${JSON.stringify(snapshot, null, 2)}`);
}

function assertIncludes(value, expected, label) {
  if (!String(value).includes(expected)) {
    throw new Error(`Expected ${label} to include ${JSON.stringify(expected)}.\nActual: ${String(value)}`);
  }
}

function assertNoPlainSaved(snapshot) {
  if (String(snapshot.saveLabel).trim().toLowerCase() === "saved") {
    throw new Error(`Save UI must not display plain "saved": ${JSON.stringify(snapshot)}`);
  }
  if (String(snapshot.saveEngineStatusLabel).trim().toLowerCase() === "saved") {
    throw new Error(`Save Engine panel must not display plain "saved": ${JSON.stringify(snapshot)}`);
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

    const initial = await waitForSnapshot(
      cdp,
      (snapshot) => snapshot.status === "saved" && snapshot.target === "memory-only",
      "initial fixture state"
    );
    assertIncludes(initial.targetLabel, "memory only", "initial fixture target label");
    await screenshot(cdp, "local-file-controls-initial.png");

    await evaluate(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.loadWritableMarkdownFileForTest("visual-crlf.md", "# Visual CRLF\\r\\n\\r\\nInitial CRLF body.\\r\\n")`
    );
    const crlfOpened = await waitForSnapshot(
      cdp,
      (snapshot) =>
        snapshot.status === "saved" &&
        snapshot.target === "disk" &&
        snapshot.activeDocument.mode === "writable-file" &&
        String(snapshot.diskContent).includes("\r\n"),
      "CRLF writable file opened clean"
    );
    assertIncludes(crlfOpened.documentName, "visual-crlf.md", "CRLF writable file name");
    assertIncludes(crlfOpened.dirtyLabel, "clean", "CRLF clean dirty label");
    assertIncludes(crlfOpened.targetLabel, "original file writable", "CRLF writable target label");
    await screenshot(cdp, "writable-crlf-opened-clean.png");

    await evaluate(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.loadWritableMarkdownFileForTest("visual-local.md", "# Visual local\\n\\nInitial disk body.\\n")`
    );
    const writableOpened = await waitForSnapshot(
      cdp,
      (snapshot) =>
        snapshot.status === "saved" &&
        snapshot.target === "disk" &&
        snapshot.activeDocument.mode === "writable-file",
      "writable file opened"
    );
    assertIncludes(writableOpened.documentName, "visual-local.md", "writable file name");
    assertIncludes(writableOpened.targetLabel, "original file writable", "writable target label");
    assertIncludes(writableOpened.documentModeLabel, "writable local file", "writable mode label");
    await screenshot(cdp, "writable-file-opened.png");

    await evaluate(cdp, "window.__MME_DEMO_VISUAL_CHECK__.setCursorToEnd()");
    await cdp.send("Input.insertText", {
      text: "\n\nSaved through writable target."
    });
    await waitForSnapshot(cdp, (snapshot) => snapshot.status === "dirty" && snapshot.target === "disk", "dirty disk state");
    await keyChord(cdp, "s");
    const writableSaved = await waitForSnapshot(
      cdp,
      (snapshot) =>
        snapshot.status === "saved" &&
        snapshot.target === "disk" &&
        String(snapshot.lastAction).includes("keyboard shortcut") &&
        String(snapshot.diskContent).includes("Saved through writable target."),
      "writable file saved to disk target"
    );
    assertIncludes(writableSaved.saveLabel, "disk saved", "writable saved label");
    assertIncludes(writableSaved.diskContent, "Saved through writable target.", "writable disk content");
    await screenshot(cdp, "writable-file-saved-to-disk-target.png");

    await evaluate(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.loadImportedCopyForTest("fallback-upload.md", "# Fallback upload\\n\\nInitial imported body.\\n")`
    );
    const importedOpened = await waitForSnapshot(
      cdp,
      (snapshot) =>
        snapshot.status === "saved" &&
        snapshot.target === "download-required" &&
        snapshot.activeDocument.mode === "imported-copy",
      "imported copy opened"
    );
    assertIncludes(importedOpened.documentName, "fallback-upload.md", "imported copy name");
    assertIncludes(importedOpened.targetLabel, "download/export required", "imported target label");
    await screenshot(cdp, "imported-copy-opened.png");

    await evaluate(cdp, "window.__MME_DEMO_VISUAL_CHECK__.setCursorToEnd()");
    await cdp.send("Input.insertText", {
      text: "\n\nFallback edit that needs export."
    });
    await waitForSnapshot(
      cdp,
      (snapshot) => snapshot.status === "dirty" && snapshot.target === "download-required",
      "dirty imported copy"
    );
    await keyChord(cdp, "s");
    const importedBlocked = await waitForSnapshot(
      cdp,
      (snapshot) =>
        snapshot.status === "dirty" &&
        snapshot.target === "download-required" &&
        String(snapshot.lastAction).includes("blocked"),
      "imported copy download required after save"
    );
    assertIncludes(importedBlocked.saveLabel, "download required", "imported dirty save label");
    assertIncludes(importedBlocked.targetLabel, "download/export required", "imported dirty target label");
    await screenshot(cdp, "imported-copy-download-required.png");

    cdp.close();
    console.log(`MME-0009 visual artifacts saved to ${visualDir}`);
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
