import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { requireChromeExecutable } from "./chrome-helpers.mjs";

const chromePath = requireChromeExecutable();
const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5174/";
const visualDir = "docs/internal/visual-checks/MME-0022";
const port = 12500 + Math.floor(Math.random() * 500);
const userDataDir = `/tmp/mme-visual-0022-${Date.now()}`;

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
      if (handlers) {
        for (const handler of handlers.splice(0)) {
          handler(message.params ?? {});
        }
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

async function press(cdp, key, options = {}) {
  await cdp.send("Input.dispatchKeyEvent", {
    code: options.code ?? key,
    key,
    type: "keyDown",
    windowsVirtualKeyCode: options.virtualKeyCode
  });
  await cdp.send("Input.dispatchKeyEvent", {
    code: options.code ?? key,
    key,
    type: "keyUp",
    windowsVirtualKeyCode: options.virtualKeyCode
  });
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

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label} expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}.`);
  }
}

async function loadCase(cdp, content) {
  await evaluate(
    cdp,
    `window.__MME_DEMO_VISUAL_CHECK__.loadImportedCopyForTest("source-keymap.md", ${JSON.stringify(content)})`
  );
  await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("source")`);
  await evaluate(cdp, "window.__MME_DEMO_VISUAL_CHECK__.setCursorToEnd()");
  await wait(50);
}

async function markdown(cdp) {
  return evaluate(cdp, "window.__MME_DEMO_VISUAL_CHECK__.getMarkdown()");
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

    await loadCase(cdp, "- item");
    await press(cdp, "Enter");
    assertEqual(await markdown(cdp), "- item\n- ", "bullet Enter continuation");

    await loadCase(cdp, "- [ ] task");
    await press(cdp, "Enter");
    assertEqual(await markdown(cdp), "- [ ] task\n- [ ] ", "checkbox Enter continuation");

    await loadCase(cdp, "> quote");
    await press(cdp, "Enter");
    assertEqual(await markdown(cdp), "> quote\n> ", "blockquote Enter continuation");

    await loadCase(cdp, "- item\n- ");
    await press(cdp, "Enter");
    assertEqual(await markdown(cdp), "- item\n", "empty bullet Enter exits the list");

    await loadCase(cdp, "- ");
    await press(cdp, "Backspace", { code: "Backspace", virtualKeyCode: 8 });
    assertEqual(await markdown(cdp), "", "Backspace after bullet marker removes markup");

    await evaluate(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.loadWritableMarkdownFileForTest("source-keymap-save.md", "# Save\\n")`
    );
    await evaluate(cdp, "window.__MME_DEMO_VISUAL_CHECK__.setCursorToEnd()");
    await cdp.send("Input.insertText", { text: "changed" });
    await keyChord(cdp, "s");
    await waitFor(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.getTestDiskContent() === "# Save\\nchanged"`,
      "Mod-s writes through the demo save hook"
    );
    await screenshot(cdp, "source-keymap-integrity.png");

    cdp.close();
  } finally {
    chrome.kill("SIGTERM");
    await Promise.race([chromeExit, wait(2000)]);
    if (chrome.exitCode === null && chrome.signalCode === null) {
      chrome.kill("SIGKILL");
      await Promise.race([chromeExit, wait(2000)]);
    }
  }
}

await main();
